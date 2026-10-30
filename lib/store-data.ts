// lib/store-data.ts — store-wide settings read by the public pages (sections, wording, delivery, templates).
// Every helper falls back to sensible defaults, so the store keeps working before the SQL upgrade is run.
import { createClient } from "@/lib/supabase/server";
import type { DeliveryZone, Section, SiteContent, Template } from "@/lib/types";

export const DEFAULT_CONTENT: SiteContent = {
  announcements: ["Customizing costs nothing extra", "Delivered to you", "Secure payment with Paystack"],
  hero_eyebrow: "Nova Edge Clothing",
  hero_title: "Made to wear.",
  hero_accent: "Made yours.",
  hero_sub:
    "Premium everyday pieces, made to be yours. Start clean, add your own design, and we deliver it to you.",
  footer_tagline: "Premium everyday clothing, delivered to you.",
  contact_email: "",
  contact_phone: "",
  instagram: "",
};

export async function getSiteContent(): Promise<SiteContent> {
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "content").maybeSingle();
  const stored = (data?.value ?? {}) as Partial<SiteContent>;
  const merged = { ...DEFAULT_CONTENT, ...stored };
  if (!Array.isArray(merged.announcements)) merged.announcements = DEFAULT_CONTENT.announcements;
  return merged;
}

export const DEFAULT_SECTIONS: Section[] = [
  { name: "T-Shirts", sort_order: 1, soon: false, visible: true },
  { name: "Hoodies", sort_order: 2, soon: true, visible: true },
  { name: "Joggers", sort_order: 3, soon: true, visible: true },
  { name: "Caps", sort_order: 4, soon: true, visible: true },
  { name: "Casuals", sort_order: 5, soon: true, visible: true },
];

/** Every section (visible or not), in menu order. */
export async function getAllSections(): Promise<Section[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sections").select("*").order("sort_order", { ascending: true }).order("name");
  if (error || !data || data.length === 0) return DEFAULT_SECTIONS;
  return data as Section[];
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("delivery_zones").select("*").eq("active", true).order("fee");
  return ((data ?? []) as DeliveryZone[]).map((z) => ({ ...z, fee: Number(z.fee) }));
}

export async function getTemplates(category?: string): Promise<Template[]> {
  const supabase = await createClient();
  let q = supabase.from("templates").select("*").eq("active", true).order("sort_order").order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data } = await q;
  return (data ?? []) as Template[];
}
