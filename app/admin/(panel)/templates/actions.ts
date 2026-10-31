// app/admin/(panel)/templates/actions.ts — save, switch, reorder and delete design templates
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ELEMENT_TYPES = new Set(["text", "image", "rect", "circle", "symbol"]);
const text = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);
const enc = encodeURIComponent;

function refresh() {
  revalidatePath("/admin/templates");
  revalidatePath("/design");
  revalidatePath("/product/[id]", "page");
}

export type TemplateSaveInput = { id: string | null; title: string; category: string; elements: unknown[]; previewUrl: string | null };
export type TemplateSaveResult = { ok: true; id: string } | { ok: false; error: string };

/** Called by the designer in template mode. Creates or updates a template row. */
export async function saveTemplate(input: TemplateSaveInput): Promise<TemplateSaveResult> {
  const user = await requireAdmin();
  const supabase = await createClient();

  const title = String(input?.title ?? "").trim().slice(0, 80);
  if (!title) return { ok: false, error: "Give the template a title first." };

  const category = String(input?.category ?? "").trim().slice(0, 60);
  if (!category) return { ok: false, error: "Pick a category." };

  if (!Array.isArray(input.elements) || input.elements.length > 200) return { ok: false, error: "The design has too many elements." };
  const elements = input.elements.filter(
    (el): el is Record<string, unknown> => Boolean(el) && typeof el === "object" && ELEMENT_TYPES.has(String((el as { type?: unknown }).type)),
  );

  const previewUrl = typeof input.previewUrl === "string" && /^https?:\/\//.test(input.previewUrl) ? input.previewUrl.slice(0, 600) : null;

  if (input.id) {
    if (!UUID.test(input.id)) return { ok: false, error: "That template could not be found." };
    const { data: found } = await supabase.from("templates").select("id").eq("id", input.id).maybeSingle();
    if (!found) return { ok: false, error: "That template no longer exists." };
    const { error } = await supabase.from("templates").update({ title, category, elements, preview_url: previewUrl }).eq("id", input.id);
    if (error) return { ok: false, error: "Couldn't save the template. Try again." };
    await logAction(user, "template.update", "template", input.id, { title, category, elements: elements.length });
    refresh();
    return { ok: true, id: input.id };
  }

  const { data: last } = await supabase.from("templates").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const sort_order = Math.min(100000, Number(last?.sort_order ?? 0) + 1);
  const { data, error } = await supabase
    .from("templates")
    .insert({ title, category, elements, preview_url: previewUrl, active: true, sort_order })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't save the template. Try again." };
  await logAction(user, "template.create", "template", data.id, { title, category, elements: elements.length });
  refresh();
  return { ok: true, id: data.id as string };
}

export async function updateTemplateMeta(formData: FormData) {
  const user = await requireAdmin();
  const id = text(formData.get("id"), 60);
  if (!UUID.test(id)) redirect("/admin/templates?error=" + enc("That template could not be found."));

  const supabase = await createClient();
  const { data: row } = await supabase.from("templates").select("id, title, category, sort_order").eq("id", id).maybeSingle();
  if (!row) redirect("/admin/templates?error=" + enc("That template no longer exists."));

  const title = text(formData.get("title"), 80);
  if (!title) redirect("/admin/templates?error=" + enc("A template needs a title."));
  const category = text(formData.get("category"), 60);
  if (!category) redirect("/admin/templates?error=" + enc("A template needs a category."));
  const sortRaw = Number(text(formData.get("sort_order"), 10));
  const sort_order = Number.isFinite(sortRaw) ? Math.min(100000, Math.max(0, Math.round(sortRaw))) : row.sort_order;

  const { error } = await supabase.from("templates").update({ title, category, sort_order }).eq("id", row.id);
  if (error) redirect("/admin/templates?error=" + enc("Couldn't save the template. Try again."));

  await logAction(user, "template.update", "template", row.id, { title, category, sort_order, previous_title: row.title });
  refresh();
  redirect("/admin/templates?saved=1");
}

export async function setTemplateActive(formData: FormData) {
  const user = await requireAdmin();
  const id = text(formData.get("id"), 60);
  if (!UUID.test(id)) redirect("/admin/templates?error=" + enc("That template could not be found."));
  const active = formData.get("active") === "1";

  const supabase = await createClient();
  const { data: row } = await supabase.from("templates").select("id, title").eq("id", id).maybeSingle();
  if (!row) redirect("/admin/templates?error=" + enc("That template no longer exists."));

  const { error } = await supabase.from("templates").update({ active }).eq("id", row.id);
  if (error) redirect("/admin/templates?error=" + enc("Couldn't change the template. Try again."));

  await logAction(user, active ? "template.activate" : "template.deactivate", "template", row.id, { title: row.title });
  refresh();
  redirect("/admin/templates?saved=1");
}

export async function deleteTemplate(formData: FormData) {
  const user = await requireAdmin();
  const id = text(formData.get("id"), 60);
  if (!UUID.test(id)) redirect("/admin/templates?error=" + enc("That template could not be found."));

  const supabase = await createClient();
  const { data: row } = await supabase.from("templates").select("id, title, category").eq("id", id).maybeSingle();
  if (!row) redirect("/admin/templates?error=" + enc("That template no longer exists."));

  const { error } = await supabase.from("templates").delete().eq("id", row.id);
  if (error) redirect("/admin/templates?error=" + enc("Couldn't delete the template. Try again."));

  await logAction(user, "template.delete", "template", row.id, { title: row.title, category: row.category });
  refresh();
  redirect("/admin/templates?deleted=1");
}
