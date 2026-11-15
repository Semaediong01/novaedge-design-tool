// app/admin/(panel)/library/actions.ts — add, hide/show and delete library artwork
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MARKER = "/product-images/library/";

function refresh() {
  revalidatePath("/admin/library");
  revalidatePath("/design");
}

export async function addLibraryItem(input: { title: string; category: string; url: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAdmin();
  const title = String(input?.title ?? "").trim();
  const category = String(input?.category ?? "").trim();
  const url = String(input?.url ?? "").trim();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  if (title.length < 1 || title.length > 60) return { ok: false, error: "Title must be 1 to 60 characters." };
  if (category.length < 1 || category.length > 40) return { ok: false, error: "Category must be 1 to 40 characters." };
  if (!/^https?:\/\//i.test(url) || !base || !url.startsWith(base)) return { ok: false, error: "That image address isn't allowed." };

  const supabase = await createClient();
  const { data: last, error: readErr } = await supabase
    .from("design_library")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (readErr) return { ok: false, error: "Couldn't save. Has the latest supabase/schema.sql been run?" };
  const sort_order = ((last?.[0]?.sort_order as number | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from("design_library")
    .insert({ title, category, image_url: url, active: true, sort_order })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Couldn't save. Try again." };

  await logAction(user, "library.add", "design_library", data?.id, { title, category });
  refresh();
  return { ok: true };
}

export async function toggleLibraryItem(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect(`/admin/library?error=${encodeURIComponent("Unknown item.")}`);
  const supabase = await createClient();
  const { data: row } = await supabase.from("design_library").select("active").eq("id", id).maybeSingle();
  if (!row) redirect(`/admin/library?error=${encodeURIComponent("Item not found.")}`);
  const active = !row.active;
  const { error } = await supabase.from("design_library").update({ active }).eq("id", id);
  if (error) redirect(`/admin/library?error=${encodeURIComponent("Couldn't save. Try again.")}`);
  await logAction(user, active ? "library.show" : "library.hide", "design_library", id);
  refresh();
  redirect("/admin/library?saved=1");
}

export async function deleteLibraryItem(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect(`/admin/library?error=${encodeURIComponent("Unknown item.")}`);
  const supabase = await createClient();
  const { data: row } = await supabase.from("design_library").select("title, image_url").eq("id", id).maybeSingle();
  const { error } = await supabase.from("design_library").delete().eq("id", id);
  if (error) redirect(`/admin/library?error=${encodeURIComponent("Couldn't delete. Try again.")}`);

  // Best effort: also remove the file from storage (only ever inside product-images/library/).
  try {
    const url = row?.image_url as string | undefined;
    const i = url ? url.indexOf(MARKER) : -1;
    if (url && i >= 0) {
      const name = decodeURIComponent(url.slice(i + MARKER.length).split("?")[0]);
      if (name && !name.includes("/") && !name.includes("..")) await supabase.storage.from("product-images").remove([`library/${name}`]);
    }
  } catch {
    /* ignore */
  }

  await logAction(user, "library.delete", "design_library", id, { title: row?.title ?? null });
  refresh();
  redirect("/admin/library?saved=1");
}
