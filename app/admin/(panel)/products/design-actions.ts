// app/admin/(panel)/products/design-actions.ts — save a product made from a design on a standby mockup
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { TEE_COLOR_NAMES, teeColorKey } from "@/lib/mockups";
import type { ProductSaveInput } from "@/app/(store)/design/DesignCanvas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ELEMENT_TYPES = new Set(["text", "image", "rect", "circle", "sticker", "frame"]);
type Result = { ok: true; id: string } | { ok: false; error: string };

/** Only pictures stored in this project's own storage are accepted. */
function ownUrl(v: unknown): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof v === "string" && base && v.startsWith(base) && v.length < 700 ? v : null;
}

export async function saveDesignedProduct(input: ProductSaveInput): Promise<Result> {
  const user = await requireAdmin();
  const supabase = await createClient();

  if (!UUID.test(String(input?.id))) return { ok: false, error: "Something went wrong. Reload and try again." };
  const title = String(input.title ?? "").trim().slice(0, 80);
  if (!title) return { ok: false, error: "Give the product a name first." };
  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0 || price > 10_000_000) return { ok: false, error: "Enter a valid price." };
  const description = String(input.description ?? "").trim().slice(0, 300);

  const colors = [...new Set((Array.isArray(input.colors) ? input.colors : []).map(String).filter((c) => TEE_COLOR_NAMES.includes(c)))];
  if (colors.length === 0) return { ok: false, error: "Pick at least one colour to sell." };

  if (!Array.isArray(input.elements) || input.elements.length === 0 || input.elements.length > 200) return { ok: false, error: "Add a design to the tee first." };
  const elements = input.elements.filter((el): el is Record<string, unknown> => Boolean(el) && typeof el === "object" && ELEMENT_TYPES.has(String((el as { type?: unknown }).type)));

  const art = { front: ownUrl(input.art?.front), back: ownUrl(input.art?.back) };
  if (!art.front && !art.back) return { ok: false, error: "The print artwork wasn't saved. Try again." };

  const previews: Record<string, { front?: string; back?: string }> = {};
  for (const [key, v] of Object.entries(input.previews ?? {})) {
    const k = teeColorKey(key);
    if (!k) continue;
    const front = ownUrl(v?.front);
    const back = ownUrl(v?.back);
    if (front || back) previews[k] = { ...(front ? { front } : {}), ...(back ? { back } : {}) };
  }
  if (Object.keys(previews).length === 0) return { ok: false, error: "The previews weren't saved. Try again." };

  const cap = input.base === "cap";
  const preset = { base: cap ? "cap" : "tee", elements, art, previews };
  const customizable = Boolean(input.customizable);

  const { data: existing } = await supabase.from("products").select("id").eq("id", input.id).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("products").update({ title, description, price, colors, customizable, preset, images: [] }).eq("id", input.id);
    if (error) return { ok: false, error: "Couldn't save. Has the latest SQL been run in Supabase?" };
    await logAction(user, "product.design_update", "product", input.id, { title, price });
  } else {
    const { data: last } = await supabase.from("products").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("products").insert({
      id: input.id, title, description, category: cap ? "Caps" : "T-Shirts", price,
      images: [], sizes: cap ? ["One size"] : ["S", "M", "L", "XL", "XXL"], colors, customizable, in_stock: true, active: true,
      sort_order: Math.min(100000, Number(last?.sort_order ?? 0) + 1), preset,
    });
    if (error) return { ok: false, error: "Couldn't save. Has the latest SQL been run in Supabase?" };
    await logAction(user, "product.design_create", "product", input.id, { title, price });
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/");
  revalidatePath(`/product/${input.id}`);
  return { ok: true, id: input.id };
}
