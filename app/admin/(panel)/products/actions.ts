// app/admin/(panel)/products/actions.ts — save, delete and quick-change products
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { getAllSections } from "@/lib/store-data";
import { normalizeProduct } from "@/lib/products";
import { lagosInputToIso } from "./lagos";

export type ProductFormState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);
const to2dp = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** "S, M, L" -> unique (ignoring case) trimmed names. Returns an error text for bad entries. */
function parseList(raw: string, what: string): { list: string[] } | { error: string } {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const v = part.trim();
    if (!v) continue;
    if (v.length > 30) return { error: `Each ${what} must be 30 characters or fewer.` };
    if (v.includes("|") || v === "*") return { error: `A ${what} can't contain "|" or be just "*".` };
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  if (out.length > 30) return { error: `Use at most 30 ${what}s.` };
  return { list: out };
}

function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function done(flag: string, extra = ""): never {
  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  redirect(`/admin/products?${flag}${extra}`);
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const user = await requireAdmin();
  const supabase = await createClient();

  // Editing? Re-read the row instead of trusting the form.
  const idRaw = text(formData.get("id"), 60);
  let existing: ReturnType<typeof normalizeProduct> | null = null;
  if (idRaw) {
    if (!UUID.test(idRaw)) return { error: "That product could not be found." };
    const { data } = await supabase.from("products").select("*").eq("id", idRaw).maybeSingle();
    if (!data) return { error: "That product no longer exists." };
    existing = normalizeProduct(data);
  }

  const title = text(formData.get("title"), 120);
  if (!title) return { error: "Give the product a name." };
  const description = text(formData.get("description"), 4000);

  const category = text(formData.get("category"), 60);
  const sections = await getAllSections();
  const allowed = new Set(sections.map((s) => s.name));
  if (existing) allowed.add(existing.category);
  if (!category || !allowed.has(category)) return { error: "Choose a category from the list." };

  // Price and promo
  const price = parseNumber(text(formData.get("price"), 20));
  if (price == null || !Number.isFinite(price) || price < 0) return { error: "Enter a price in naira, like 19850." };
  if (price > 100_000_000) return { error: "That price is too large." };

  const promoRaw = parseNumber(text(formData.get("promo_price"), 20));
  if (promoRaw != null && (!Number.isFinite(promoRaw) || promoRaw < 0)) return { error: "The promo price must be zero or more." };
  const promoPrice = promoRaw == null ? null : to2dp(promoRaw);
  if (promoPrice != null && !(promoPrice < price)) return { error: "The promo price must be lower than the normal price." };

  let promoLabel: string | null = null;
  let promoStarts: string | null = null;
  let promoEnds: string | null = null;
  if (promoPrice != null) {
    promoLabel = text(formData.get("promo_label"), 40) || null;
    const s = lagosInputToIso(text(formData.get("promo_starts_at"), 30));
    const e = lagosInputToIso(text(formData.get("promo_ends_at"), 30));
    if (s === "invalid" || e === "invalid") return { error: "Check the promo start and end date-times." };
    if (s && e && new Date(e) <= new Date(s)) return { error: "The promo end must be after its start." };
    promoStarts = s;
    promoEnds = e;
  }

  // Affiliate commission
  const rateRaw = parseNumber(text(formData.get("affiliate_rate"), 10));
  if (rateRaw != null && (!Number.isFinite(rateRaw) || rateRaw < 0 || rateRaw > 100)) return { error: "The commission must be between 0 and 100 percent, or blank." };
  const affiliateRate = rateRaw == null ? null : to2dp(rateRaw);

  // Variants
  const sizesParsed = parseList(String(formData.get("sizes") ?? ""), "size");
  if ("error" in sizesParsed) return { error: sizesParsed.error };
  const colorsParsed = parseList(String(formData.get("colors") ?? ""), "colour");
  if ("error" in colorsParsed) return { error: colorsParsed.error };
  const sizes = sizesParsed.list;
  const colors = colorsParsed.list;

  const soldOut: string[] = [];
  for (const v of formData.getAll("sold_out")) {
    const entry = String(v).trim();
    const parts = entry.split("|");
    if (parts.length !== 2) return { error: "A sold out entry is not valid. Reload the page and try again." };
    const [c, s] = parts;
    const colorOk = c === "*" || colors.includes(c);
    const sizeOk = s === "*" || sizes.includes(s);
    if (!colorOk || !sizeOk || (c === "*" && s === "*")) {
      return { error: `Sold out entry "${entry}" refers to a colour or size this product doesn't have.` };
    }
    if (!soldOut.includes(entry)) soldOut.push(entry);
  }

  // Personalization and visibility
  const customizable = formData.get("customizable") === "on";
  const symbolDefault = formData.get("symbol_default") === "on";
  const allowUploads = formData.get("allow_uploads") === "on";
  const active = formData.get("active") === "on";
  const inStock = formData.get("in_stock") === "on";
  const featured = formData.get("featured") === "on";

  const sortRaw = text(formData.get("sort_order"), 10);
  let sortOrder = 0;
  if (sortRaw !== "") {
    const n = Number(sortRaw);
    if (!Number.isInteger(n) || Math.abs(n) > 100_000) return { error: "The order must be a whole number, like 1, 2 or 3." };
    sortOrder = n;
  }

  // Photos
  const images = String(formData.get("images") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (images.length > 12) return { error: "Use at most 12 photos." };
  if (images.some((u) => !/^https?:\/\//i.test(u) && !u.startsWith("/"))) return { error: "One of the photos has an invalid address. Remove it and upload again." };
  // T-shirts without a photo use the built-in mockups, so only other customizable products need a photo.
  if (customizable && images.length === 0 && category !== "T-Shirts") {
    return { error: "Add at least one photo. Customizable products use the first photo in the designer." };
  }

  const row = {
    title,
    description,
    category,
    price: to2dp(price),
    images,
    sizes,
    colors,
    customizable,
    in_stock: inStock,
    active,
    featured,
    sort_order: sortOrder,
    promo_price: promoPrice,
    promo_label: promoLabel,
    promo_starts_at: promoStarts,
    promo_ends_at: promoEnds,
    affiliate_rate: affiliateRate,
    sold_out_variants: soldOut,
    symbol_default: symbolDefault,
    allow_uploads: allowUploads,
  };

  if (existing) {
    const { error } = await supabase.from("products").update(row).eq("id", existing.id);
    if (error) return { error: "Couldn't save the product. " + error.message };

    const before = existing as unknown as Record<string, unknown>;
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k === "promo_starts_at" || k === "promo_ends_at") {
        const a = before[k] ? new Date(before[k] as string).getTime() : null;
        const b = v ? new Date(v as string).getTime() : null;
        if (a !== b) changed[k] = { from: before[k] ?? null, to: v };
      } else if (k === "images") {
        if (!sameValue(before[k], v)) changed[k] = { from: (before[k] as string[]).length + " photo(s)", to: images.length + " photo(s)" };
      } else if (!sameValue(before[k], v)) {
        changed[k] = { from: before[k] ?? null, to: v };
      }
    }
    await logAction(user, "product.update", "product", existing.id, { title, changed });
  } else {
    const { data, error } = await supabase.from("products").insert(row).select("id").single();
    if (error || !data) return { error: "Couldn't save the product. " + (error?.message ?? "") };
    await logAction(user, "product.create", "product", data.id as string, { title, category, price: row.price, active, featured });
  }

  done("saved=1");
}

export async function deleteProduct(formData: FormData) {
  const user = await requireAdmin();
  const id = text(formData.get("id"), 60);
  if (!UUID.test(id)) redirect("/admin/products?error=" + encodeURIComponent("That product could not be found."));

  const supabase = await createClient();
  const { data: row } = await supabase.from("products").select("id, title").eq("id", id).maybeSingle();
  if (!row) redirect("/admin/products?error=" + encodeURIComponent("That product no longer exists."));

  // Products that already appear on orders are hidden instead of deleted, so order history stays intact.
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    const { error: hideError } = await supabase.from("products").update({ active: false }).eq("id", id);
    if (hideError) redirect("/admin/products?error=" + encodeURIComponent("Couldn't delete or hide the product. Try again."));
    await logAction(user, "product.hide", "product", id, { title: row.title, reason: "has orders" });
    done("hidden=1");
  }
  await logAction(user, "product.delete", "product", id, { title: row.title });
  done("deleted=1");
}

const QUICK_FIELDS: Record<string, string> = { active: "product.visibility", in_stock: "product.stock", featured: "product.homepage" };

/** One-click show/hide, in/out of stock and add/remove home page from the products list. */
export async function quickProductAction(formData: FormData) {
  const user = await requireAdmin();
  const id = text(formData.get("id"), 60);
  const field = text(formData.get("field"), 20);
  const value = text(formData.get("value"), 5) === "true";
  const q = text(formData.get("q"), 80);
  const cat = text(formData.get("cat"), 60);
  const back = new URLSearchParams();
  if (q) back.set("q", q);
  if (cat) back.set("cat", cat);
  const tail = back.toString() ? "&" + back.toString() : "";

  if (!UUID.test(id) || !(field in QUICK_FIELDS)) redirect("/admin/products?error=" + encodeURIComponent("That change could not be made."));
  const supabase = await createClient();
  const { data: row } = await supabase.from("products").select("id, title").eq("id", id).maybeSingle();
  if (!row) redirect("/admin/products?error=" + encodeURIComponent("That product no longer exists."));

  const { error } = await supabase.from("products").update({ [field]: value }).eq("id", id);
  if (error) redirect("/admin/products?error=" + encodeURIComponent("Couldn't change the product. Try again.") + tail);

  await logAction(user, QUICK_FIELDS[field], "product", id, { title: row.title, [field]: value });
  done("saved=1", tail);
}
