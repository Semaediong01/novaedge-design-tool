// app/admin/(panel)/content/actions.ts — edit the store wording (site_settings key "content")
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { DEFAULT_CONTENT, getSiteContent } from "@/lib/store-data";
import type { SiteContent } from "@/lib/types";

const text = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\s+/g, " ").trim();
const back = (flag: string, value = "1"): never => redirect(`/admin/content?${flag}=${encodeURIComponent(value)}`);

export async function saveContent(formData: FormData) {
  const user = await requireAdmin();

  const announcements: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const line = text(formData.get(`announcement_${i}`));
    if (line.length > 80) back("error", `Announcement ${i} is too long (80 characters at most).`);
    if (line) announcements.push(line);
  }

  const limits: { key: Exclude<keyof SiteContent, "announcements">; label: string; max: number; required?: boolean }[] = [
    { key: "hero_eyebrow", label: "Hero small heading", max: 40 },
    { key: "hero_title", label: "Hero title", max: 60, required: true },
    { key: "hero_accent", label: "Hero accent line", max: 60 },
    { key: "hero_sub", label: "Hero text", max: 240 },
    { key: "footer_tagline", label: "Footer tagline", max: 140 },
    { key: "contact_email", label: "Contact email", max: 120 },
    { key: "contact_phone", label: "Contact phone", max: 30 },
    { key: "instagram", label: "Instagram", max: 100 },
  ];
  const next: SiteContent = { ...DEFAULT_CONTENT, announcements };
  for (const f of limits) {
    const v = text(formData.get(f.key));
    if (f.required && !v) back("error", `${f.label} can't be empty.`);
    if (v.length > f.max) back("error", `${f.label} is too long (${f.max} characters at most).`);
    next[f.key] = v;
  }
  if (next.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.contact_email)) back("error", "That contact email doesn't look right.");
  if (next.contact_phone && !/^[0-9+()\-\s]{6,30}$/.test(next.contact_phone)) back("error", "The phone number can only use digits, spaces, + and -.");
  if (next.instagram && /^https?:\/\//i.test(next.instagram) && !/^https:\/\/(www\.)?instagram\.com\//i.test(next.instagram)) {
    back("error", "Use your Instagram handle (like @novaedge) or an instagram.com link.");
  }

  const supabase = await createClient();
  const before = await getSiteContent();
  const { error } = await supabase.from("site_settings").upsert({ key: "content", value: { ...before, ...next }, updated_at: new Date().toISOString() });
  if (error) back("error", "Couldn't save. Try again.");

  const changed = (Object.keys(next) as (keyof SiteContent)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(next[k]));
  await logAction(user, "content.update", "site_settings", "content", { changed });
  revalidatePath("/", "layout");
  revalidatePath("/admin/content");
  back("saved");
}

export async function resetContent() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert({ key: "content", value: DEFAULT_CONTENT, updated_at: new Date().toISOString() });
  if (error) back("error", "Couldn't reset. Try again.");
  await logAction(user, "content.reset", "site_settings", "content");
  revalidatePath("/", "layout");
  revalidatePath("/admin/content");
  back("reset");
}
