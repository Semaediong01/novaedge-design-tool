// app/admin/(panel)/discounts/actions.ts — create, edit, switch off and delete discount codes
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { lagosInputToIso } from "./lagos";

export type DiscountFormState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[A-Z0-9_-]{3,30}$/;

const text = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);
const to2dp = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function done(path: string, flag: string): never {
  revalidatePath("/admin/discounts");
  redirect(`${path}${flag}`);
}

export async function saveDiscount(_prev: DiscountFormState, formData: FormData): Promise<DiscountFormState> {
  const user = await requireAdmin();
  const supabase = await createClient();

  // Editing? Re-read the row instead of trusting the form.
  const idRaw = text(formData.get("id"), 60);
  let existing: { id: string; code: string; used_count: number } | null = null;
  if (idRaw) {
    if (!UUID.test(idRaw)) return { error: "That discount code could not be found." };
    const { data } = await supabase.from("discounts").select("id, code, used_count").eq("id", idRaw).maybeSingle();
    if (!data) return { error: "That discount code no longer exists." };
    existing = data;
  }

  const code = text(formData.get("code"), 60).toUpperCase();
  if (!CODE.test(code)) return { error: "The code must be 3 to 30 characters: letters, numbers, dashes or underscores." };

  const description = text(formData.get("description"), 200);

  const type = text(formData.get("type"), 10);
  if (type !== "percent" && type !== "fixed") return { error: "Choose percent or fixed amount." };

  const rawValue = Number(text(formData.get("value"), 20));
  if (!Number.isFinite(rawValue) || rawValue <= 0) return { error: "Enter how much the code takes off." };
  const value = to2dp(rawValue);
  if (value <= 0) return { error: "Enter how much the code takes off." };
  if (type === "percent" && value > 100) return { error: "A percentage can be 1 to 100." };
  if (type === "percent" && value < 1) return { error: "A percentage can be 1 to 100." };
  if (type === "fixed" && value > 10_000_000) return { error: "That amount is too large." };

  const minRaw = text(formData.get("min_order"), 20);
  const minOrder = minRaw === "" ? 0 : to2dp(Number(minRaw));
  if (!Number.isFinite(minOrder) || minOrder < 0 || minOrder > 100_000_000) return { error: "The minimum order must be zero or more." };

  // Product restriction: keep only ids that really are products. None ticked = every product.
  const wanted = Array.from(new Set(formData.getAll("product_ids").map((v) => String(v)).filter((v) => UUID.test(v))));
  let productIds: string[] | null = null;
  if (wanted.length > 0) {
    const { data: found } = await supabase.from("products").select("id").in("id", wanted);
    productIds = (found ?? []).map((p) => p.id as string);
    if (productIds.length === 0) return { error: "The products you ticked no longer exist. Reload the page and try again." };
  }

  const startsAt = lagosInputToIso(text(formData.get("starts_at"), 30));
  const endsAt = lagosInputToIso(text(formData.get("ends_at"), 30));
  if (startsAt === "invalid" || endsAt === "invalid") return { error: "Check the start and end date-times." };
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return { error: "The end must be after the start." };

  const limitRaw = text(formData.get("usage_limit"), 12);
  let usageLimit: number | null = null;
  if (limitRaw !== "") {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n < 1 || n > 10_000_000) return { error: "The usage limit must be a whole number, 1 or more (or blank for unlimited)." };
    usageLimit = n;
  }
  if (existing && usageLimit != null && usageLimit < existing.used_count) {
    return { error: `This code has already been used ${existing.used_count} times, so the limit can't be lower than that. Switch the code off instead if you want to stop it.` };
  }

  const active = formData.get("active") === "on";

  // Unique code
  const { data: clash } = await supabase.from("discounts").select("id").eq("code", code).maybeSingle();
  if (clash && clash.id !== existing?.id) return { error: `The code ${code} already exists. Pick another.` };

  const row = {
    code,
    description,
    type,
    value,
    min_order: minOrder,
    product_ids: productIds,
    starts_at: startsAt,
    ends_at: endsAt,
    usage_limit: usageLimit,
    active,
  };

  let savedId: string;
  if (existing) {
    const { error } = await supabase.from("discounts").update(row).eq("id", existing.id);
    if (error) return { error: error.code === "23505" ? `The code ${code} already exists. Pick another.` : "Couldn't save the code. Try again." };
    savedId = existing.id;
    await logAction(user, "discount.update", "discount", savedId, { code, type, value, min_order: minOrder, active, usage_limit: usageLimit, products: productIds?.length ?? "all" });
  } else {
    const { data, error } = await supabase.from("discounts").insert(row).select("id").single();
    if (error || !data) return { error: error?.code === "23505" ? `The code ${code} already exists. Pick another.` : "Couldn't save the code. Try again." };
    savedId = data.id;
    await logAction(user, "discount.create", "discount", savedId, { code, type, value, min_order: minOrder, active, usage_limit: usageLimit, products: productIds?.length ?? "all" });
  }

  return done("/admin/discounts", "?saved=1");
}

/** Switch a code on or off from the list. */
export async function toggleDiscount(formData: FormData) {
  const user = await requireAdmin();
  const id = text(formData.get("id"), 60);
  if (!UUID.test(id)) redirect("/admin/discounts?error=" + encodeURIComponent("That code could not be found."));

  const supabase = await createClient();
  const { data: row } = await supabase.from("discounts").select("id, code, active").eq("id", id).maybeSingle();
  if (!row) redirect("/admin/discounts?error=" + encodeURIComponent("That code no longer exists."));

  const next = !row.active;
  const { error } = await supabase.from("discounts").update({ active: next }).eq("id", row.id);
  if (error) redirect("/admin/discounts?error=" + encodeURIComponent("Couldn't change the code. Try again."));

  await logAction(user, next ? "discount.activate" : "discount.deactivate", "discount", row.id, { code: row.code });
  done("/admin/discounts", "?saved=1");
}

/** Delete a code that has never been used. Used codes can only be switched off. */
export async function deleteDiscount(formData: FormData) {
  const user = await requireAdmin();
  const id = text(formData.get("id"), 60);
  if (!UUID.test(id)) redirect("/admin/discounts?error=" + encodeURIComponent("That code could not be found."));

  const supabase = await createClient();
  const { data: row } = await supabase.from("discounts").select("id, code, used_count").eq("id", id).maybeSingle();
  if (!row) redirect("/admin/discounts?error=" + encodeURIComponent("That code no longer exists."));
  if (row.used_count > 0) {
    redirect("/admin/discounts?error=" + encodeURIComponent(`${row.code} has been used ${row.used_count} time(s), so it can't be deleted. Switch it off instead.`));
  }

  // The used_count = 0 filter makes sure a purchase that lands right now can't be wiped.
  const { error } = await supabase.from("discounts").delete().eq("id", row.id).eq("used_count", 0);
  if (error) redirect("/admin/discounts?error=" + encodeURIComponent("Couldn't delete the code. Try again."));

  await logAction(user, "discount.delete", "discount", row.id, { code: row.code });
  done("/admin/discounts", "?deleted=1");
}
