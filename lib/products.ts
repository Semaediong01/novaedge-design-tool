// lib/products.ts — product reads (RLS lets the public see active products only)
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

/** Fills in the fields newer database versions add, so the store also works before the SQL upgrade is run. */
export function normalizeProduct(row: Record<string, unknown>): Product {
  const p = row as unknown as Product;
  return {
    ...p,
    images: p.images ?? [],
    sizes: p.sizes ?? [],
    colors: p.colors ?? [],
    price: Number(p.price),
    featured: p.featured ?? false,
    sort_order: p.sort_order ?? 0,
    promo_price: p.promo_price == null ? null : Number(p.promo_price),
    promo_label: p.promo_label ?? null,
    promo_starts_at: p.promo_starts_at ?? null,
    promo_ends_at: p.promo_ends_at ?? null,
    affiliate_rate: p.affiliate_rate == null ? null : Number(p.affiliate_rate),
    sold_out_variants: p.sold_out_variants ?? [],
    symbol_default: p.symbol_default ?? true,
    allow_uploads: p.allow_uploads ?? true,
  };
}

/**
 * The store launches with one plain, designable tee in White, Black and Ash. It always shows, even before it exists
 * in the database: the built-in copy is used for display and saved (with this fixed id) the first time the server can.
 */
export const CLASSIC_TEE_ID = "00000000-0000-4000-8000-000000000001";

function builtInTee(): Product {
  return normalizeProduct({
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
    featured: true,
    created_at: "2026-10-30T00:00:00Z",
  });
}

async function saveClassicTee() {
  try {
    const db = createServiceClient();
    const { count } = await db.from("products").select("*", { count: "exact", head: true });
    if (count !== 0) return; // the store already has products: never add one behind the admin's back
    await db.from("products").upsert(
      {
        id: CLASSIC_TEE_ID,
        title: "Classic Tee",
        description: builtInTee().description,
        category: "T-Shirts",
        price: 15000,
        images: [],
        sizes: ["S", "M", "L", "XL", "XXL"],
        colors: ["White", "Black", "Ash"],
        customizable: true,
        in_stock: true,
        active: true,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
  } catch {
    /* no server key yet: the built-in copy still displays */
  }
}

export async function getProducts(opts: { category?: string; q?: string; limit?: number } = {}) {
  const supabase = await createClient();
  const run = async () => {
    let query = supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (opts.category) query = query.eq("category", opts.category);
    if (opts.q) {
      const safe = opts.q.replace(/[%,()]/g, " ").trim();
      if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
    if (opts.limit) query = query.limit(opts.limit);
    return query;
  };
  const first = await run();
  let data = first.data;
  const error = first.error;
  if (error) {
    // Older database without the sort_order column: fall back to newest first.
    let q = supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false });
    if (opts.category) q = q.eq("category", opts.category);
    if (opts.limit) q = q.limit(opts.limit);
    ({ data } = await q);
  }
  if ((data ?? []).length === 0 && !opts.q && (!opts.category || opts.category === "T-Shirts")) {
    await saveClassicTee();
    ({ data } = await run());
    if ((data ?? []).length === 0) return [builtInTee()];
  }
  return (data ?? []).map((r) => normalizeProduct(r));
}

/** Products chosen in the admin to show on the home page (falls back to the newest products). */
export async function getHomeProducts(limit = 8) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .eq("featured", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!error && data && data.length > 0) return data.map((r) => normalizeProduct(r));
  return getProducts({ limit });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProduct(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (data) return normalizeProduct(data);
  if (id === CLASSIC_TEE_ID) {
    await saveClassicTee();
    const again = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    return again.data ? normalizeProduct(again.data) : builtInTee();
  }
  return null;
}
