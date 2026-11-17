// lib/recommended.ts — the "You may also like" products on every product page. Chosen in Admin -> Recommended.
import { createClient } from "@/lib/supabase/server";
import { normalizeProduct } from "@/lib/products";
import type { Product } from "@/lib/types";

export type RecommendedConfig = { default: string[]; by_product: Record<string, string[]> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.map(String).filter((x) => UUID.test(x)))].slice(0, 12) : []);

export function cleanRecommended(value: unknown): RecommendedConfig {
  const o = (value ?? {}) as { default?: unknown; by_product?: unknown };
  const by: Record<string, string[]> = {};
  if (o.by_product && typeof o.by_product === "object") {
    for (const [k, v] of Object.entries(o.by_product as Record<string, unknown>)) {
      const list = ids(v);
      if (UUID.test(k) && list.length > 0) by[k] = list;
    }
  }
  return { default: ids(o.default), by_product: by };
}

/** Never throws: an empty config simply means "pick automatically". */
export async function getRecommendedConfig(): Promise<RecommendedConfig> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("site_settings").select("value").eq("key", "recommended").maybeSingle();
    return cleanRecommended(data?.value);
  } catch {
    return { default: [], by_product: {} };
  }
}

/** The products to show under `product`: its own list, else the default list, else same category and newest first. */
export async function getRecommendedProducts(product: Product, limit = 4): Promise<Product[]> {
  const supabase = await createClient();
  const [{ data }, config] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
    getRecommendedConfig(),
  ]);
  const all = (data ?? []).map((r) => normalizeProduct(r)).filter((p) => p.id !== product.id && p.in_stock);
  const byId = new Map(all.map((p) => [p.id, p]));
  const chosen = (config.by_product[product.id] ?? config.default).map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  const rest = [...all.filter((p) => p.category === product.category), ...all.filter((p) => p.category !== product.category)];
  const out: Product[] = [...chosen];
  // Fill any empty spots automatically so the block is never nearly bare, unless the owner picked a full list.
  for (const p of rest) {
    if (out.length >= limit) break;
    if (!out.some((x) => x.id === p.id)) out.push(p);
  }
  return out.slice(0, limit);
}
