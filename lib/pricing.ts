// lib/pricing.ts — every price, discount, delivery fee and commission is worked out here, on the server.
// Pure functions (no database calls) so they can be tested on their own.
import type { Affiliate, DeliveryZone, Discount, Product } from "@/lib/types";
import { stateKey } from "@/lib/nigeria";

export const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type PromoFields = Pick<Product, "price" | "promo_price" | "promo_starts_at" | "promo_ends_at" | "promo_label">;

/** True while the product's own promo price applies. */
export function promoActive(p: PromoFields, now = new Date()): boolean {
  if (p.promo_price == null) return false;
  if (!(Number(p.promo_price) < Number(p.price))) return false;
  if (p.promo_starts_at && new Date(p.promo_starts_at) > now) return false;
  if (p.promo_ends_at && new Date(p.promo_ends_at) < now) return false;
  return true;
}

/** What a customer pays for one unit. */
export function effectivePrice(p: PromoFields, now = new Date()): number {
  return promoActive(p, now) ? Number(p.promo_price) : Number(p.price);
}

/** Variant keys look like "Black|XL", "Black|*" (whole colour) or "*|XL" (whole size). */
export function variantSoldOut(soldOut: string[] | null | undefined, color: string, size: string): boolean {
  if (!soldOut?.length) return false;
  const c = color.trim().toLowerCase();
  const s = size.trim().toLowerCase();
  return soldOut.some((entry) => {
    const [ec = "", es = ""] = entry.split("|").map((x) => x.trim().toLowerCase());
    return (ec === "*" || ec === c) && (es === "*" || es === s);
  });
}

export type PricedLine = {
  productId: string;
  unitPrice: number;
  quantity: number;
  affiliateRate: number | null; // the product's own commission rate, if it has one
};

export type DiscountResult =
  | { ok: true; code: string; amount: number; shares: number[] }
  | { ok: false; error: string };

export const lineTotal = (l: Pick<PricedLine, "unitPrice" | "quantity">) => money(l.unitPrice * l.quantity);

/** Checks a discount code against the cart and works out how much it takes off (and each line's share). */
export function evaluateDiscount(d: Discount | null, lines: PricedLine[], now = new Date()): DiscountResult {
  if (!d || !d.active) return { ok: false, error: "That code isn't valid." };
  if (d.starts_at && new Date(d.starts_at) > now) return { ok: false, error: "That code isn't active yet." };
  if (d.ends_at && new Date(d.ends_at) < now) return { ok: false, error: "That code has expired." };
  if (d.usage_limit != null && d.used_count >= d.usage_limit) return { ok: false, error: "That code has been fully used." };

  const subtotal = money(lines.reduce((s, l) => s + lineTotal(l), 0));
  if (subtotal < Number(d.min_order)) {
    return { ok: false, error: `Spend at least ₦${Number(d.min_order).toLocaleString("en-NG")} to use this code.` };
  }

  const eligible = lines.map((l) => !d.product_ids || d.product_ids.includes(l.productId));
  const base = money(lines.reduce((s, l, i) => s + (eligible[i] ? lineTotal(l) : 0), 0));
  if (base <= 0) return { ok: false, error: "This code doesn't apply to anything in your cart." };

  const raw = d.type === "percent" ? (base * Number(d.value)) / 100 : Math.min(Number(d.value), base);
  const amount = Math.min(money(raw), base);

  // Split the discount across eligible lines in proportion to their value (last one takes the rounding).
  const shares = lines.map(() => 0);
  let given = 0;
  const idx = lines.map((_, i) => i).filter((i) => eligible[i]);
  idx.forEach((i, n) => {
    const share = n === idx.length - 1 ? money(amount - given) : money((amount * lineTotal(lines[i])) / base);
    shares[i] = share;
    given = money(given + share);
  });
  return { ok: true, code: d.code, amount, shares };
}

/** The fee for a state: the first active zone that lists it, otherwise the "Everywhere else" zone, otherwise free. */
export function deliveryFor(state: string, zones: DeliveryZone[]): { fee: number; zone: string | null } {
  const key = stateKey(state);
  const active = zones.filter((z) => z.active);
  if (key) {
    const hit = active.find((z) => z.states.some((s) => stateKey(s) === key));
    if (hit) return { fee: Number(hit.fee), zone: hit.name };
  }
  const fallback = active.find((z) => z.states.length === 0);
  return fallback ? { fee: Number(fallback.fee), zone: fallback.name } : { fee: 0, zone: null };
}

/**
 * Affiliate commission is paid on product revenue AFTER discounts (never on delivery).
 * A product can set its own rate; otherwise the affiliate's rate applies.
 */
export function commissionFor(lines: PricedLine[], shares: number[], affiliate: Pick<Affiliate, "commission_rate"> | null) {
  if (!affiliate) return { perLine: lines.map(() => 0), total: 0 };
  const perLine = lines.map((l, i) => {
    const revenue = Math.max(0, money(lineTotal(l) - (shares[i] ?? 0)));
    const rate = l.affiliateRate ?? Number(affiliate.commission_rate);
    return money((revenue * rate) / 100);
  });
  return { perLine, total: money(perLine.reduce((s, n) => s + n, 0)) };
}
