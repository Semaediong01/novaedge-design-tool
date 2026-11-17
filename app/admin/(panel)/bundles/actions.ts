// app/admin/(panel)/bundles/actions.ts — "buy this product, get that one cheaper" offers
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { cleanRules, loadBundleRules, type BundleRule } from "@/lib/bundles";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const back = (kind: "saved" | "error", msg = "1") => redirect(`/admin/bundles?${kind}=${encodeURIComponent(msg)}`);

async function writeRules(rules: BundleRule[]) {
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert({ key: "bundle_rules", value: { rules }, updated_at: new Date().toISOString() });
  revalidatePath("/admin/bundles");
  revalidatePath("/product/[id]", "page");
  revalidatePath("/checkout");
  return !error;
}

export async function addBundleRule(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const trigger = String(formData.get("trigger") ?? "");
  const target = String(formData.get("target") ?? "");
  const type = formData.get("type") === "fixed" ? "fixed" : "percent";
  const value = Number(formData.get("value"));
  const label = String(formData.get("label") ?? "").trim().slice(0, 80);

  if (!UUID.test(trigger) || !UUID.test(target)) back("error", "Choose both products.");
  if (trigger === target) back("error", "Choose two different products.");
  if (!Number.isFinite(value) || value <= 0) back("error", "Enter how much the offer takes off.");
  if (type === "percent" && value > 100) back("error", "A percentage can't be more than 100.");
  if (value > 10_000_000) back("error", "That amount is too large.");

  const rules = await loadBundleRules(supabase, { all: true });
  if (rules.length >= 50) back("error", "That's the most offers allowed. Remove one first.");
  const rule: BundleRule = { id: crypto.randomUUID(), trigger_product_id: trigger, target_product_id: target, type, value, label, active: true };
  if (!(await writeRules(cleanRules({ rules: [...rules, rule] })))) back("error", "Couldn't save. Try again.");
  await logAction(user, "bundle.create", "site_settings", rule.id, { trigger, target, type, value });
  back("saved");
}

export async function toggleBundleRule(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const rules = await loadBundleRules(supabase, { all: true });
  const next = rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r));
  if (!(await writeRules(next))) back("error", "Couldn't save. Try again.");
  await logAction(user, "bundle.toggle", "site_settings", id, {});
  back("saved");
}

export async function deleteBundleRule(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const rules = await loadBundleRules(supabase, { all: true });
  if (!(await writeRules(rules.filter((r) => r.id !== id)))) back("error", "Couldn't save. Try again.");
  await logAction(user, "bundle.delete", "site_settings", id, {});
  back("saved");
}
