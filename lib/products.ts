// lib/products.ts — product reads (RLS lets the public see active products only)
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

export async function getProducts(opts: { category?: string; q?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false });
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.q) {
    const safe = opts.q.replace(/[%,()]/g, " ").trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  if (opts.limit) query = query.limit(opts.limit);
  const { data } = await query;
  return (data ?? []) as Product[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProduct(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  return (data as Product | null) ?? null;
}
