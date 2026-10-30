// lib/categories.ts — the sections of the shop, managed in Admin -> Sections.
// A section marked "Soon" shows the Soon tag and the coming-soon page until the admin switches it off.
import { createClient } from "@/lib/supabase/server";
import { getAllSections } from "@/lib/store-data";

export type ShopSection = { name: string; count: number; soon: boolean };

export async function getShopSections(): Promise<ShopSection[]> {
  const supabase = await createClient();
  const [sections, { data }] = await Promise.all([
    getAllSections(),
    supabase.from("products").select("category").eq("active", true),
  ]);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { category: string }[]) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);

  return sections
    .filter((s) => s.visible)
    .map((s) => ({ name: s.name, count: counts.get(s.name) ?? 0, soon: s.soon }));
}
