// lib/products.ts — product reads (RLS lets the public see active products only)
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

/**
 * The store launches with one plain, designable tee in White, Black and Ash. If the database has no products at all,
 * it is added automatically (once). After that, products are managed in the admin.
 */
let starterTried = false;
async function ensureClassicTee() {
  if (starterTried) return;
  starterTried = true;
  try {
    const db = createServiceClient();
    const { count } = await db.from("products").select("*", { count: "exact", head: true });
    if (count !== 0) return;
    await db.from("products").insert({
      title: "Classic Tee",
      description: "A clean everyday tee with the small Nova Edge symbol on the chest. Keep it, resize it or remove it, or add your own design.",
      category: "T-Shirts",
      price: 15000,
      images: [],
      sizes: ["S", "M", "L", "XL", "XXL"],
      colors: ["White", "Black", "Ash"],
      customizable: true,
      in_stock: true,
      active: true,
    });
  } catch {
    starterTried = false;
  }
}

export async function getProducts(opts: { category?: string; q?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false });
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.q) {
    const safe = opts.q.replace(/[%,()]/g, " ").trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  if (opts.limit) query = query.limit(opts.limit);
  let { data } = await query;
  if ((data ?? []).length === 0 && !opts.q) {
    await ensureClassicTee();
    ({ data } = await query);
  }
  return (data ?? []) as Product[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProduct(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  return (data as Product | null) ?? null;
}
