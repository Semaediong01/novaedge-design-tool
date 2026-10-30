// app/admin/(panel)/delivery/actions.ts — create, edit and delete delivery zones
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { stateKey } from "@/lib/nigeria";
import { FALLBACK_NAME, canonicalState, isFallback, stateLabel } from "./zones";

export type ZoneFormState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);
const enc = encodeURIComponent;

function refresh() {
  revalidatePath("/admin/delivery");
}

function parseFee(raw: string): number | null {
  if (raw === "") return null;
  const n = Math.round(Number(raw) * 100) / 100;
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? n : null;
}

export async function saveZone(_prev: ZoneFormState, formData: FormData): Promise<ZoneFormState> {
  const user = await requireAdmin();
  const supabase = await createClient();

  const idRaw = text(formData.get("id"), 60);
  let existing: { id: string; name: string; states: string[] } | null = null;
  if (idRaw) {
    if (!UUID.test(idRaw)) return { error: "That zone could not be found." };
    const { data } = await supabase.from("delivery_zones").select("id, name, states").eq("id", idRaw).maybeSingle();
    if (!data) return { error: "That zone no longer exists." };
    existing = data as { id: string; name: string; states: string[] };
  }
  const fallback = existing ? isFallback(existing) : false;

  const fee = parseFee(text(formData.get("fee"), 20));
  if (fee == null) return { error: "Enter a delivery fee in naira (0 or more)." };
  const active = formData.get("active") === "on";

  let name = FALLBACK_NAME;
  let states: string[] = [];
  if (!fallback) {
    name = text(formData.get("name"), 60);
    if (!name) return { error: "Give the zone a name." };
    if (name.toLowerCase() === FALLBACK_NAME.toLowerCase()) return { error: `"${FALLBACK_NAME}" is a special zone. Use the button on the Delivery page to create it.` };

    const picked = new Set<string>();
    for (const v of formData.getAll("states")) {
      const s = canonicalState(String(v));
      if (!s) return { error: "One of the states isn't valid. Reload the page and try again." };
      picked.add(s);
    }
    states = Array.from(picked);
    if (states.length === 0) return { error: "Tick at least one state. (A zone with no states would act like \"Everywhere else\".)" };

    const { data: nameClash } = await supabase.from("delivery_zones").select("id, name");
    if ((nameClash ?? []).some((z) => z.id !== existing?.id && String(z.name).toLowerCase() === name.toLowerCase())) {
      return { error: `A zone called "${name}" already exists.` };
    }
  }

  // A state may sit in only one ACTIVE zone.
  if (active && !fallback) {
    const { data: others } = await supabase.from("delivery_zones").select("id, name, states").eq("active", true);
    const taken = new Map<string, string>();
    for (const z of (others ?? []) as { id: string; name: string; states: string[] }[]) {
      if (z.id === existing?.id) continue;
      for (const s of z.states) taken.set(stateKey(s), z.name);
    }
    const clashes = states.filter((s) => taken.has(stateKey(s)));
    if (clashes.length > 0) {
      const detail = Array.from(new Set(clashes.map((s) => `${stateLabel(s)} is already in "${taken.get(stateKey(s))}"`))).join("; ");
      return { error: `A state can be in only one active zone. ${detail}. Untick it here, or remove it from that zone first.` };
    }
  }

  let id: string;
  if (existing) {
    const patch = fallback ? { fee, active } : { name, states, fee, active };
    const { error } = await supabase.from("delivery_zones").update(patch).eq("id", existing.id);
    if (error) return { error: error.code === "23505" ? `A zone called "${name}" already exists.` : "Couldn't save the zone. Try again." };
    id = existing.id;
    await logAction(user, "delivery.update", "delivery_zone", id, { name, fee, active, states: states.length, previous_name: existing.name });
  } else {
    const { data, error } = await supabase.from("delivery_zones").insert({ name, states, fee, active }).select("id").single();
    if (error || !data) return { error: error?.code === "23505" ? `A zone called "${name}" already exists.` : "Couldn't save the zone. Try again." };
    id = data.id;
    await logAction(user, "delivery.create", "delivery_zone", id, { name, fee, active, states: states.length });
  }

  refresh();
  redirect("/admin/delivery?saved=1");
}

/** Create the "Everywhere else" zone when it is missing. */
export async function createFallbackZone(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const fee = parseFee(text(formData.get("fee"), 20));
  if (fee == null) redirect("/admin/delivery?error=" + enc("Enter a delivery fee in naira (0 or more)."));

  const { data: found } = await supabase.from("delivery_zones").select("id").eq("name", FALLBACK_NAME).maybeSingle();
  if (found) redirect("/admin/delivery?error=" + enc(`"${FALLBACK_NAME}" already exists.`));

  const { data, error } = await supabase.from("delivery_zones").insert({ name: FALLBACK_NAME, states: [], fee, active: true }).select("id").single();
  if (error || !data) redirect("/admin/delivery?error=" + enc("Couldn't create the zone. Try again."));

  await logAction(user, "delivery.create", "delivery_zone", data.id, { name: FALLBACK_NAME, fee, active: true, states: 0 });
  refresh();
  redirect("/admin/delivery?saved=1");
}

export async function deleteZone(formData: FormData) {
  const user = await requireAdmin();
  const id = text(formData.get("id"), 60);
  if (!UUID.test(id)) redirect("/admin/delivery?error=" + enc("That zone could not be found."));

  const supabase = await createClient();
  const { data: zone } = await supabase.from("delivery_zones").select("id, name, states, fee").eq("id", id).maybeSingle();
  if (!zone) redirect("/admin/delivery?error=" + enc("That zone no longer exists."));
  if (isFallback(zone as { name: string; states: string[] })) {
    redirect("/admin/delivery?error=" + enc(`"${FALLBACK_NAME}" can't be deleted. Switch it off or change its fee instead.`));
  }

  const { error } = await supabase.from("delivery_zones").delete().eq("id", zone.id);
  if (error) redirect("/admin/delivery?error=" + enc("Couldn't delete the zone. Try again."));

  await logAction(user, "delivery.delete", "delivery_zone", zone.id, { name: zone.name, fee: Number(zone.fee), states: (zone.states as string[]).length });
  refresh();
  redirect("/admin/delivery?deleted=1");
}
