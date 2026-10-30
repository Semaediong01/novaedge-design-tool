// lib/products.ts — product reads (RLS lets the public see active products only)
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

/**
 * The store launches with one plain, designable tee in White, Black and Ash. It always shows, even before it exists
 * in the database: the built-in copy below is used for display, and is saved to the database (with this fixed id)
 * the first time the server is able to, so carts, designs and orders can point at it.
 */
export const CLASSIC_TEE_ID = "00000000-0000-4000-8000-000000000001";

function builtInTee(): Product {
  return {
    id: CLASSIC_TEE_ID,
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
    created_at: "2026-10-30T00:00:00Z",
  };
}

async function saveClassicTee() {
  try {
    const db = createServiceClient();
    const { count } = await db.from("products").select("*", { count: "exact", head: true });
    if (count !== 0) return; // the store already has products: never add one behind the admin's back
    const { id, created_at: _created, ...row } = builtInTee();
    void _created;
    await db.from("products").upsert({ id, ...row }, { onConflict: "id", ignoreDuplicates: true });
  } catch {
    /* no server key yet: the built-in copy still displays */
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
    // Empty store: show (and try to save) the Classic Tee, but only where a tee belongs.
    const tee = builtInTee();
    if (!opts.category || opts.category === tee.category) {
      await saveClassicTee();
      ({ data } = await query);
      if ((data ?? []).length === 0) return [tee];
    }
  }
  return (data ?? []) as Product[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProduct(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (data) return data as Product;
  if (id === CLASSIC_TEE_ID) {
    await saveClassicTee();
    const again = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    return (again.data as Product | null) ?? builtInTee();
  }
  return null;
}
