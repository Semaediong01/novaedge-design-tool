// lib/checkout.ts — turns a cart into a trusted order total. Server only (uses the service-role client).
import type { SupabaseClient } from "@supabase/supabase-js";
import { commissionFor, deliveryFor, effectivePrice, evaluateDiscount, lineTotal, money, variantSoldOut, type PricedLine } from "@/lib/pricing";
import { normalizeProduct } from "@/lib/products";
import { productImage } from "@/lib/mockups";
import type { Affiliate, DeliveryZone, Discount, Product } from "@/lib/types";

export type CartInput = { productId: string; size: string; color: string; quantity: number; designId: string | null };

export type PricedCartLine = PricedLine & {
  product: Product;
  title: string;
  image: string | null;
  size: string | null;
  color: string | null;
  designId: string | null;
  printUrl: string | null;
  productionUrl: string | null;
  designElements: unknown[] | null;
  lineTotal: number;
  discountShare: number;
  commission: number;
};

export type CartPricing =
  | { ok: false; error: string }
  | {
      ok: true;
      lines: PricedCartLine[];
      subtotal: number;
      discount: { code: string; amount: number } | null;
      discountError: string | null;
      delivery: { fee: number; zone: string | null };
      total: number;
      affiliate: Pick<Affiliate, "id" | "code" | "name"> | null;
      commission: number;
    };

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

type Options = {
  items: unknown;
  code?: string | null;
  state?: string | null;
  affiliateCode?: string | null;
  /** When set, designs are checked to belong to this customer and are loaded for the order. */
  user?: { id: string; email: string } | null;
};

export async function priceCart(db: SupabaseClient, opts: Options): Promise<CartPricing> {
  const raw = Array.isArray(opts.items) ? (opts.items.slice(0, 30) as Partial<CartInput>[]) : [];
  if (raw.length === 0) return { ok: false, error: "Your cart is empty." };

  const items: CartInput[] = raw.map((i) => ({
    productId: text(i.productId, 60),
    size: text(i.size, 20),
    color: text(i.color, 40),
    quantity: Math.max(1, Math.min(Math.floor(Number(i.quantity) || 1), 20)),
    designId: i.designId ? text(i.designId, 60) : null,
  }));

  // Prices always come from the database, never from the browser.
  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data: rows } = await db.from("products").select("*").in("id", productIds).eq("active", true);
  const products = new Map((rows ?? []).map((r) => [r.id as string, normalizeProduct(r)]));

  const designIds = items.map((i) => i.designId).filter(Boolean) as string[];
  const designs = new Map<string, { id: string; user_id: string; product_id: string; elements: unknown[]; print_url: string | null; production_url: string | null; locked: boolean }>();
  if (opts.user && designIds.length) {
    const { data } = await db.from("designs").select("*").in("id", designIds);
    for (const d of data ?? []) designs.set(d.id, d);
  }

  const now = new Date();
  const priced: PricedCartLine[] = [];

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product || !product.in_stock) {
      return { ok: false, error: "An item in your cart is no longer available. Remove it and try again." };
    }
    if (product.sizes.length > 0 && !product.sizes.includes(item.size)) return { ok: false, error: `${product.title}: pick a valid size.` };
    if (product.colors.length > 0 && !product.colors.includes(item.color)) return { ok: false, error: `${product.title}: pick a valid colour.` };
    if (variantSoldOut(product.sold_out_variants, item.color, item.size)) {
      return { ok: false, error: `${product.title} in ${item.color} ${item.size} is sold out. Remove it and try another size or colour.` };
    }

    let design = null;
    if (item.designId && opts.user) {
      design = designs.get(item.designId) ?? null;
      if (!design || design.user_id !== opts.user.id || design.product_id !== product.id || design.locked || !design.print_url) {
        return { ok: false, error: "One of your designs can't be used. Open it in the designer and save it again." };
      }
    }

    const quantity = item.designId ? 1 : item.quantity;
    const unitPrice = effectivePrice(product, now);
    priced.push({
      productId: product.id,
      unitPrice,
      quantity,
      affiliateRate: product.affiliate_rate,
      product,
      title: product.title,
      image: productImage(product, item.color),
      size: item.size || null,
      color: item.color || null,
      designId: design?.id ?? null,
      printUrl: design?.print_url ?? null,
      productionUrl: design?.production_url ?? null,
      designElements: design?.elements ?? null,
      lineTotal: lineTotal({ unitPrice, quantity }),
      discountShare: 0,
      commission: 0,
    });
  }

  const subtotal = money(priced.reduce((s, l) => s + l.lineTotal, 0));

  // Discount code
  let discount: { code: string; amount: number } | null = null;
  let discountError: string | null = null;
  let shares = priced.map(() => 0);
  const code = text(opts.code, 40).toUpperCase();
  if (code) {
    const { data } = await db.from("discounts").select("*").eq("code", code).maybeSingle();
    const result = evaluateDiscount((data as Discount | null) ?? null, priced, now);
    if (result.ok) {
      discount = { code: result.code, amount: result.amount };
      shares = result.shares;
    } else {
      discountError = result.error;
    }
  }

  // Delivery
  const { data: zoneRows } = await db.from("delivery_zones").select("*").eq("active", true);
  const delivery = deliveryFor(text(opts.state, 60), ((zoneRows ?? []) as DeliveryZone[]).map((z) => ({ ...z, fee: Number(z.fee) })));

  // Affiliate (one per order, never the customer themselves)
  let affiliate: Pick<Affiliate, "id" | "code" | "name" | "commission_rate"> | null = null;
  const refCode = text(opts.affiliateCode, 40).toUpperCase();
  if (refCode) {
    const { data } = await db.from("affiliates").select("id, code, name, email, commission_rate").eq("code", refCode).eq("active", true).maybeSingle();
    const selfReferral = data?.email && opts.user?.email && String(data.email).toLowerCase() === opts.user.email.toLowerCase();
    if (data && !selfReferral) affiliate = { id: data.id, code: data.code, name: data.name, commission_rate: Number(data.commission_rate) };
  }
  const commission = commissionFor(priced, shares, affiliate);

  priced.forEach((l, i) => {
    l.discountShare = shares[i];
    l.commission = commission.perLine[i];
  });

  const total = money(subtotal - (discount?.amount ?? 0) + delivery.fee);
  return {
    ok: true,
    lines: priced,
    subtotal,
    discount,
    discountError,
    delivery,
    total,
    affiliate: affiliate ? { id: affiliate.id, code: affiliate.code, name: affiliate.name } : null,
    commission: commission.total,
  };
}
