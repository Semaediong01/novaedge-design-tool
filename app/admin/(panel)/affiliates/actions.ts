// app/admin/(panel)/affiliates/actions.ts — create, edit and pay affiliates
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { round2 } from "./stats";

export type AffiliateFormState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[A-Z0-9_-]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);
const enc = encodeURIComponent;

export async function saveAffiliate(_prev: AffiliateFormState, formData: FormData): Promise<AffiliateFormState> {
  const user = await requireAdmin();
  const supabase = await createClient();

  const idRaw = text(formData.get("id"), 60);
  let existing: { id: string; code: string } | null = null;
  if (idRaw) {
    if (!UUID.test(idRaw)) return { error: "That affiliate could not be found." };
    const { data } = await supabase.from("affiliates").select("id, code").eq("id", idRaw).maybeSingle();
    if (!data) return { error: "That affiliate no longer exists." };
    existing = data;
  }

  const name = text(formData.get("name"), 120);
  if (!name) return { error: "Enter the affiliate's name." };

  const email = text(formData.get("email"), 200).toLowerCase();
  if (email && !EMAIL.test(email)) return { error: "That email address doesn't look right." };

  const code = text(formData.get("code"), 60).toUpperCase();
  if (!CODE.test(code)) return { error: "The code must be 3 to 30 characters: letters, numbers, dashes or underscores." };

  const rateRaw = text(formData.get("commission_rate"), 10);
  const rate = rateRaw === "" ? 12 : round2(Number(rateRaw));
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { error: "The commission rate must be between 0 and 100." };

  const notes = text(formData.get("notes"), 2000);
  const active = formData.get("active") === "on";

  const { data: clash } = await supabase.from("affiliates").select("id").eq("code", code).maybeSingle();
  if (clash && clash.id !== existing?.id) return { error: `The code ${code} is already used by another affiliate.` };

  const row = { name, email: email || null, code, commission_rate: rate, active, notes };
  const dupMsg = `The code ${code} is already used by another affiliate.`;

  let id: string;
  if (existing) {
    const { error } = await supabase.from("affiliates").update(row).eq("id", existing.id);
    if (error) return { error: error.code === "23505" ? dupMsg : "Couldn't save the affiliate. Try again." };
    id = existing.id;
    await logAction(user, "affiliate.update", "affiliate", id, { name, code, rate, active, previous_code: existing.code });
  } else {
    const { data, error } = await supabase.from("affiliates").insert(row).select("id").single();
    if (error || !data) return { error: error?.code === "23505" ? dupMsg : "Couldn't save the affiliate. Try again." };
    id = data.id;
    await logAction(user, "affiliate.create", "affiliate", id, { name, code, rate, active });
  }

  revalidatePath("/admin/affiliates");
  revalidatePath(`/admin/affiliates/${id}`);
  redirect(`/admin/affiliates/${id}?saved=1`);
}

/** Mark every unpaid commission of one affiliate as paid. Only paid, non-cancelled orders count. */
export async function markCommissionPaid(formData: FormData) {
  const user = await requireAdmin();
  const id = text(formData.get("id"), 60);
  if (!UUID.test(id)) redirect("/admin/affiliates?error=" + enc("That affiliate could not be found."));

  const supabase = await createClient();
  const { data: aff } = await supabase.from("affiliates").select("id, name, code").eq("id", id).maybeSingle();
  if (!aff) redirect("/admin/affiliates?error=" + enc("That affiliate no longer exists."));

  const back = `/admin/affiliates/${aff.id}`;
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ affiliate_paid: true })
    .eq("affiliate_id", aff.id)
    .eq("payment_status", "paid")
    .neq("fulfillment_status", "cancelled")
    .eq("affiliate_paid", false)
    .gt("affiliate_commission", 0)
    .select("id, affiliate_commission");
  if (error) redirect(`${back}?error=` + enc("Couldn't mark the commission as paid. Try again."));

  const rows = updated ?? [];
  if (rows.length === 0) redirect(`${back}?error=` + enc("There is no commission owed to this affiliate."));
  const amount = round2(rows.reduce((s, r) => s + Number(r.affiliate_commission || 0), 0));

  await logAction(user, "affiliate.pay_commission", "affiliate", aff.id, { code: aff.code, name: aff.name, amount, orders: rows.length });
  revalidatePath("/admin/affiliates");
  revalidatePath(back);
  redirect(`${back}?paid=${amount}`);
}
