// lib/categories.ts — the sections of the shop.
// The five main sections always show in the menu. A section with no products yet opens a "coming soon"
// page, and the first product added to it in the admin turns it into a normal shop section.
// Any other category (Sweatshirts, Accessories) appears only once it has a product.
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/types";

export const MAIN_SECTIONS = ["T-Shirts", "Hoodies", "Joggers", "Caps", "Casuals"] as const;

export type ShopSection = { name: string; count: number; soon: boolean };

export async function getShopSections(): Promise<ShopSection[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("category").eq("active", true);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { category: string }[]) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);

  const names = [...MAIN_SECTIONS, ...CATEGORIES.filter((c) => !(MAIN_SECTIONS as readonly string[]).includes(c) && counts.has(c))];
  // T-Shirts is the live section and never shows Soon; the others show Soon until they have a product.
  return names.map((name) => ({ name, count: counts.get(name) ?? 0, soon: name !== "T-Shirts" && !counts.get(name) }));
}
