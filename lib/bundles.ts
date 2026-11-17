// lib/bundles.ts — "buy this, get that cheaper" offers, kept in site_settings (key bundle_rules)
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BundleRule } from "@/lib/pricing";

export type { BundleRule };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanRules(input: unknown): BundleRule[] {
  const raw = (input as { rules?: unknown } | null)?.rules;
  if (!Array.isArray(raw)) return [];
  const out: BundleRule[] = [];
  for (const r of raw.slice(0, 100)) {
    const o = r as Record<string, unknown>;
    const value = Number(o?.value);
    if (!o || !UUID.test(String(o.trigger_product_id)) || !UUID.test(String(o.target_product_id)) || !Number.isFinite(value) || value <= 0) continue;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id.slice(0, 60) : crypto.randomUUID(),
      trigger_product_id: String(o.trigger_product_id),
      target_product_id: String(o.target_product_id),
      type: o.type === "fixed" ? "fixed" : "percent",
      value,
      label: typeof o.label === "string" ? o.label.trim().slice(0, 80) : "",
      active: o.active !== false,
    });
  }
  return out;
}

/** Never throws: no rules means no bundle offers. */
export async function loadBundleRules(db: SupabaseClient, opts?: { all?: boolean }): Promise<BundleRule[]> {
  try {
    const { data } = await db.from("site_settings").select("value").eq("key", "bundle_rules").maybeSingle();
    const rules = cleanRules(data?.value);
    return opts?.all ? rules : rules.filter((r) => r.active);
  } catch {
    return [];
  }
}
