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

let starterChecked = false;

/**
 * The store always starts with the plain Classic Tee. If the database has no products at all and the starter
 * has never been added, add it once. (After that, products are managed only in the admin.)
 */
async function ensureStarterProduct() {
  if (starterChecked) return;
  starterChecked = true;
  try {
    const db = createServiceClient();
    const { count } = await db.from("products").select("*", { count: "exact", head: true });
    if (count !== 0) return;
    const flag = await db.from("site_settings").select("key").eq("key", "starter_seeded").maybeSingle();
    if (flag.data) return; // it was added before and then deliberately removed
    const { error } = await db.from("products").insert({
      title: "Classic Tee",
      description:
        "A clean everyday tee with the small Nova Edge symbol on the chest. Keep it, resize it or remove it, or add your own design.",
      category: "T-Shirts",
      price: 15000,
      images: [],
      sizes: ["S", "M", "L", "XL", "XXL"],
      colors: ["White", "Black", "Ash"],
      customizable: true,
      in_stock: true,
      active: true,
    });
    if (!error) await db.from("site_settings").upsert({ key: "starter_seeded", value: { at: new Date().toISOString() } });
  } catch {
    starterChecked = false; // try again on the next request
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
  let { data, error } = await run();
  if (error) {
    // Older database without the sort_order column: fall back to newest first.
    let q = supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false });
    if (opts.category) q = q.eq("category", opts.category);
    if (opts.limit) q = q.limit(opts.limit);
    ({ data } = await q);
  }
  if ((data ?? []).length === 0 && !opts.category && !opts.q) {
    await ensureStarterProduct();
    ({ data } = await run());
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
  return data ? normalizeProduct(data) : null;
}
