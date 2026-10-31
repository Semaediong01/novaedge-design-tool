// Run with: npx tsx tests/pricing.test.ts  (Node 22+)
import type { Discount } from "@/lib/types";
import assert from "node:assert/strict";
import { promoActive, effectivePrice, variantSoldOut, evaluateDiscount, deliveryFor, commissionFor } from "../lib/pricing";

const now = new Date("2026-11-01T12:00:00Z");
const base = { price: 15000, promo_price: null, promo_starts_at: null, promo_ends_at: null, promo_label: null };

// promo
assert.equal(effectivePrice(base, now), 15000);
assert.equal(effectivePrice({ ...base, promo_price: 12000 }, now), 12000);
assert.equal(effectivePrice({ ...base, promo_price: 16000 }, now), 15000, "promo higher than price is ignored");
assert.equal(promoActive({ ...base, promo_price: 12000, promo_ends_at: "2026-10-31T00:00:00Z" }, now), false, "expired");
assert.equal(promoActive({ ...base, promo_price: 12000, promo_starts_at: "2026-11-02T00:00:00Z" }, now), false, "not started");
assert.equal(promoActive({ ...base, promo_price: 0 }, now), true, "free promo allowed");

// variants
assert.equal(variantSoldOut(["Black|XL"], "black", "xl"), true);
assert.equal(variantSoldOut(["Black|XL"], "Black", "L"), false);
assert.equal(variantSoldOut(["Ash|*"], "Ash", "M"), true);
assert.equal(variantSoldOut(["*|XXL"], "White", "XXL"), true);
assert.equal(variantSoldOut([], "White", "M"), false);

// discounts
const lines = [
  { productId: "a", unitPrice: 10000, quantity: 2, affiliateRate: null },
  { productId: "b", unitPrice: 5000, quantity: 1, affiliateRate: 20 },
];
const d = (o: Record<string, unknown> = {}): Discount => ({ id: "1", code: "X", description: "", type: "percent" as const, value: 10, min_order: 0, product_ids: null, starts_at: null, ends_at: null, usage_limit: null, used_count: 0, active: true, created_at: "", ...o });
let r = evaluateDiscount(d({}), lines, now);
assert.ok(r.ok); assert.equal(r.amount, 2500); assert.deepEqual(r.shares, [2000, 500]);
r = evaluateDiscount(d({ type: "fixed", value: 99999 }), lines, now);
assert.ok(r.ok); assert.equal(r.amount, 25000, "fixed discount never exceeds the cart");
r = evaluateDiscount(d({ product_ids: ["b"] }), lines, now);
assert.ok(r.ok); assert.equal(r.amount, 500); assert.deepEqual(r.shares, [0, 500]);
assert.equal(evaluateDiscount(d({ product_ids: ["zzz"] }), lines, now).ok, false);
assert.equal(evaluateDiscount(d({ min_order: 30000 }), lines, now).ok, false);
assert.equal(evaluateDiscount(d({ ends_at: "2026-10-01T00:00:00Z" }), lines, now).ok, false);
assert.equal(evaluateDiscount(d({ starts_at: "2026-12-01T00:00:00Z" }), lines, now).ok, false);
assert.equal(evaluateDiscount(d({ usage_limit: 5, used_count: 5 }), lines, now).ok, false);
assert.equal(evaluateDiscount(d({ active: false }), lines, now).ok, false);
assert.equal(evaluateDiscount(null, lines, now).ok, false);
// shares always add up exactly
r = evaluateDiscount(d({ value: 33.33 }), [{ productId: "a", unitPrice: 3333, quantity: 1, affiliateRate: null }, { productId: "b", unitPrice: 3333, quantity: 1, affiliateRate: null }, { productId: "c", unitPrice: 3334, quantity: 1, affiliateRate: null }], now);
assert.ok(r.ok); assert.equal(Math.round(r.shares.reduce((s, n) => s + n, 0) * 100) / 100, r.amount);

// delivery
const zones = [
  { id: "1", name: "Akwa Ibom", states: ["Akwa Ibom"], fee: 2000, active: true },
  { id: "2", name: "Abuja", states: ["FCT"], fee: 4000, active: true },
  { id: "3", name: "Lagos", states: ["Lagos"], fee: 3500, active: false },
  { id: "4", name: "Everywhere else", states: [], fee: 5000, active: true },
];
assert.deepEqual(deliveryFor("Akwa Ibom", zones), { fee: 2000, zone: "Akwa Ibom" });
assert.deepEqual(deliveryFor("akwa ibom state", zones), { fee: 2000, zone: "Akwa Ibom" });
assert.deepEqual(deliveryFor("Abuja", zones), { fee: 4000, zone: "Abuja" });
assert.deepEqual(deliveryFor("Federal Capital Territory", zones), { fee: 4000, zone: "Abuja" });
assert.deepEqual(deliveryFor("Lagos", zones), { fee: 5000, zone: "Everywhere else" }, "inactive zone falls back");
assert.deepEqual(deliveryFor("Kano", []), { fee: 0, zone: null });

// commission: after discount, per-product override, no delivery
const aff = { commission_rate: 12 };
const shares = [2000, 500];
const c = commissionFor(lines, shares, aff);
assert.deepEqual(c.perLine, [2160, 900]); // (20000-2000)*12% ; (5000-500)*20%
assert.equal(c.total, 3060);
assert.equal(commissionFor(lines, shares, null).total, 0);

console.log("pricing tests passed");
