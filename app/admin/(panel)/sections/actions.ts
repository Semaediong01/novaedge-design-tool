// app/admin/(panel)/sections/actions.ts — manage the shop sections (the menu)
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { DEFAULT_SECTIONS } from "@/lib/store-data";
import type { Section } from "@/lib/types";

const text = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

function finish(flag: string, value = "1"): never {
  revalidatePath("/", "layout");
  revalidatePath("/admin/sections");
  redirect(`/admin/sections?${flag}=${encodeURIComponent(value)}`);
}

function fail(message: string): never {
  redirect("/admin/sections?error=" + encodeURIComponent(message));
}

async function readSections(): Promise<Section[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("sections").select("*").order("sort_order", { ascending: true }).order("name");
  return (data ?? []) as Section[];
}

export async function saveDefaultSections() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const existing = await readSections();
  if (existing.length > 0) fail("Sections are already saved.");
  const { error } = await supabase.from("sections").insert(DEFAULT_SECTIONS.map((s) => ({ ...s })));
  if (error) fail("Couldn't save the sections. Try again.");
  await logAction(user, "section.seed", "section", undefined, { names: DEFAULT_SECTIONS.map((s) => s.name) });
  finish("saved");
}

export async function addSection(formData: FormData) {
  const user = await requireAdmin();
  const name = text(formData.get("name"), 200).replace(/\s+/g, " ");
  if (!name) fail("Type a name for the new section.");
  if (name.length > 30) fail("A section name can be 30 characters at most.");

  const sections = await readSections();
  if (sections.length === 0) fail("Save the starting sections first, then add more.");
  if (sections.some((s) => s.name.toLowerCase() === name.toLowerCase())) fail(`There is already a section called ${name}.`);

  const next = sections.reduce((m, s) => Math.max(m, s.sort_order), 0) + 1;
  const supabase = await createClient();
  const { error } = await supabase.from("sections").insert({ name, sort_order: next, soon: true, visible: true });
  if (error) fail("Couldn't add the section. Try again.");
  await logAction(user, "section.create", "section", name, { name });
  finish("saved");
}

export async function toggleSection(formData: FormData) {
  const user = await requireAdmin();
  const name = text(formData.get("name"), 60);
  const field = text(formData.get("field"), 10);
  if (field !== "soon" && field !== "visible") fail("That change could not be made.");
  const value = text(formData.get("value"), 5) === "true";

  const sections = await readSections();
  if (!sections.some((s) => s.name === name)) fail("That section no longer exists.");
  const supabase = await createClient();
  const { error } = await supabase.from("sections").update({ [field]: value }).eq("name", name);
  if (error) fail("Couldn't change the section. Try again.");
  await logAction(user, field === "soon" ? "section.soon" : "section.visibility", "section", name, { [field]: value });
  finish("saved");
}

export async function moveSection(formData: FormData) {
  const user = await requireAdmin();
  const name = text(formData.get("name"), 60);
  const dir = text(formData.get("dir"), 4);
  if (dir !== "up" && dir !== "down") fail("That change could not be made.");

  const sections = await readSections();
  const i = sections.findIndex((s) => s.name === name);
  if (i < 0) fail("That section no longer exists.");
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= sections.length) finish("saved");

  const reordered = [...sections];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  const supabase = await createClient();
  for (let n = 0; n < reordered.length; n++) {
    const wanted = n + 1;
    if (reordered[n].sort_order === wanted) continue;
    const { error } = await supabase.from("sections").update({ sort_order: wanted }).eq("name", reordered[n].name);
    if (error) fail("Couldn't change the order. Try again.");
  }
  await logAction(user, "section.move", "section", name, { direction: dir });
  finish("saved");
}

export async function deleteSection(formData: FormData) {
  const user = await requireAdmin();
  const name = text(formData.get("name"), 60);
  const sections = await readSections();
  if (!sections.some((s) => s.name === name)) fail("That section no longer exists.");

  const supabase = await createClient();
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category", name);
  if ((count ?? 0) > 0) fail(`${name} still has ${count} product${count === 1 ? "" : "s"}. Move or delete them first.`);

  const { error } = await supabase.from("sections").delete().eq("name", name);
  if (error) fail("Couldn't delete the section. Try again.");
  await logAction(user, "section.delete", "section", name, { name });
  finish("deleted");
}
