// lib/categories.ts — which shop sections to show.
// T-Shirts always shows. Every other category (Hoodies, Joggers, Caps, ...) appears in the menu,
// shop filters and footer only once at least one active product is in it, so adding the first
// product to a category in the admin is what opens that section.
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/types";

export async function getActiveCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("category").eq("active", true);
  const used = new Set((data ?? []).map((r: { category: string }) => r.category));
  return CATEGORIES.filter((c) => c === "T-Shirts" || used.has(c));
}
