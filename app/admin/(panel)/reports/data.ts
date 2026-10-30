// app/admin/(panel)/reports/data.ts — date ranges (Africa/Lagos) and sales aggregation shared by the
// overview, the reports page and the CSV exports.
import type { SupabaseClient } from "@supabase/supabase-js";
import { money } from "@/lib/pricing";

/** Nigeria is UTC+1 all year (no daylight saving), so a fixed offset gives exact Lagos day boundaries. */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-29" for the Lagos calendar day a moment falls on. */
export function lagosDate(d: Date | string | number): string {
  return new Date(new Date(d).getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant a Lagos calendar day begins. */
export function lagosStart(date: string): Date {
  return new Date(`${date}T00:00:00+01:00`);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isValidDate(s: string | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export type DateRange = {
  from: string; // first Lagos day, inclusive
  to: string; // last Lagos day, inclusive
  startIso: string; // instant `from` begins
  endIso: string; // instant the day after `to` begins (exclusive upper bound)
  days: number;
};

const MAX_RANGE_DAYS = 366;

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Reads ?from=&to= (YYYY-MM-DD). Defaults to the last 30 days; bad input falls back, long ranges are clamped to a year. */
export function parseRange(sp: Raw): DateRange {
  const today = lagosDate(Date.now());
  let to = isValidDate(one(sp.to)) ? one(sp.to) : today;
  let from = isValidDate(one(sp.from)) ? one(sp.from) : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  if (from < addDays(to, -(MAX_RANGE_DAYS - 1))) from = addDays(to, -(MAX_RANGE_DAYS - 1));
  const days = Math.round((lagosStart(to).getTime() - lagosStart(from).getTime()) / 86400000) + 1;
  return { from, to, startIso: lagosStart(from).toISOString(), endIso: lagosStart(addDays(to, 1)).toISOString(), days };
}

// ---------------------------------------------------------------- bounded, paged reads

const PAGE = 1000; // Supabase returns at most 1,000 rows per request by default
export const MAX_ROWS = 5000; // every report reads at most this many orders; the page says so when it is hit

/** Reads up to `max` rows by walking pages of 1,000. `truncated` means there were more than we read. */
export async function fetchPaged<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  max = MAX_ROWS
): Promise<{ rows: T[]; truncated: boolean; failed: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error || !data) return { rows, truncated: false, failed: true };
    rows.push(...(data as T[]));
    if (data.length < PAGE) return { rows, truncated: false, failed: false };
  }
  return { rows, truncated: true, failed: false };
}

// ---------------------------------------------------------------- sales rows

export type SaleItem = {
  product_id: string | null;
  title: string;
  quantity: number;
  unit_price: number;
  discount_share: number;
  commission: number;
};

export type SaleOrder = {
  id: string;
  reference: string;
  email: string;
  user_id: string;
  created_at: string;
  total: number;
  subtotal: number | null;
  discount_code: string | null;
  discount_amount: number;
  delivery_fee: number;
  affiliate_id: string | null;
  affiliate_code: string | null;
  affiliate_commission: number;
  fulfillment_status: string;
  shipping: { state?: string } | null;
  order_items: SaleItem[] | null;
};

const SALE_COLUMNS =
  "id, reference, email, user_id, created_at, total, subtotal, discount_code, discount_amount, delivery_fee, affiliate_id, affiliate_code, affiliate_commission, fulfillment_status, shipping, order_items(product_id, title, quantity, unit_price, discount_share, commission)";

/** Paid, not cancelled orders created in [startIso, endIso) (endIso optional), newest first, capped at MAX_ROWS. */
export async function loadSales(supabase: SupabaseClient, startIso: string | null, endIso: string | null) {
  const { rows, truncated, failed } = await fetchPaged<SaleOrder>((from, to) => {
    let q = supabase
      .from("orders")
      .select(SALE_COLUMNS)
      .eq("payment_status", "paid")
      .neq("fulfillment_status", "cancelled")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
    if (startIso) q = q.gte("created_at", startIso);
    if (endIso) q = q.lt("created_at", endIso);
    return q;
  });
  return { orders: rows, truncated, failed };
}

// ---------------------------------------------------------------- aggregation

export type ProductRow = { key: string; title: string; units: number; revenue: number };
export type CategoryRow = { category: string; units: number; revenue: number };
export type DiscountRow = { code: string; orders: number; amount: number };
export type AffiliateRow = { affiliate: string; code: string; orders: number; sales: number; commission: number };
export type StateRow = { state: string; orders: number; sales: number };
export type DayRow = { date: string; orders: number; units: number; sales: number };

export type Summary = {
  orders: number;
  gross: number; // product sales before discounts
  discounts: number;
  delivery: number;
  net: number; // what customers paid
  aov: number;
  units: number;
};

export type Report = {
  summary: Summary;
  products: ProductRow[];
  categories: CategoryRow[];
  discounts: DiscountRow[];
  affiliates: AffiliateRow[];
  states: StateRow[];
  days: DayRow[];
};

const sum = (xs: number[]) => xs.reduce((s, n) => s + n, 0);
const num = (n: unknown) => Number(n) || 0;

/** Product sales before discounts: the stored subtotal, or worked back from the total for older orders. */
export function grossOf(o: Pick<SaleOrder, "total" | "subtotal" | "delivery_fee" | "discount_amount">) {
  return o.subtotal != null ? num(o.subtotal) : num(o.total) - num(o.delivery_fee) + num(o.discount_amount);
}

/**
 * Builds every report table from a list of paid orders.
 * `categoryOf` maps product id to category and `affiliateNames` maps affiliate id to name.
 */
export function aggregate(
  orders: SaleOrder[],
  categoryOf: Map<string, string> = new Map(),
  affiliateNames: Map<string, string> = new Map()
): Report {
  const products = new Map<string, ProductRow>();
  const categories = new Map<string, CategoryRow>();
  const discounts = new Map<string, DiscountRow>();
  const affiliates = new Map<string, AffiliateRow>();
  const states = new Map<string, StateRow>();
  const days = new Map<string, DayRow>();
  let units = 0;

  for (const o of orders) {
    const items = o.order_items ?? [];
    const orderUnits = sum(items.map((i) => num(i.quantity)));
    units += orderUnits;

    for (const i of items) {
      // Revenue is what the customer paid for the line: price x quantity less its share of any discount.
      const revenue = num(i.unit_price) * num(i.quantity) - num(i.discount_share);
      const key = i.product_id ?? `t:${i.title}`;
      const p = products.get(key) ?? { key, title: i.title, units: 0, revenue: 0 };
      p.units += num(i.quantity);
      p.revenue += revenue;
      products.set(key, p);

      const cat = (i.product_id && categoryOf.get(i.product_id)) || "Removed products";
      const c = categories.get(cat) ?? { category: cat, units: 0, revenue: 0 };
      c.units += num(i.quantity);
      c.revenue += revenue;
      categories.set(cat, c);
    }

    if (o.discount_code) {
      const d = discounts.get(o.discount_code) ?? { code: o.discount_code, orders: 0, amount: 0 };
      d.orders += 1;
      d.amount += num(o.discount_amount);
      discounts.set(o.discount_code, d);
    }

    if (o.affiliate_id || o.affiliate_code) {
      const key = o.affiliate_id ?? `c:${o.affiliate_code}`;
      const a = affiliates.get(key) ?? {
        affiliate: (o.affiliate_id && affiliateNames.get(o.affiliate_id)) || o.affiliate_code || "Unknown",
        code: o.affiliate_code ?? "",
        orders: 0,
        sales: 0,
        commission: 0,
      };
      a.orders += 1;
      a.sales += num(o.total) - num(o.delivery_fee); // product revenue after discounts, no delivery
      a.commission += num(o.affiliate_commission);
      affiliates.set(key, a);
    }

    const state = (o.shipping?.state ?? "").trim() || "Not given";
    const s = states.get(state) ?? { state, orders: 0, sales: 0 };
    s.orders += 1;
    s.sales += num(o.total);
    states.set(state, s);

    const date = lagosDate(o.created_at);
    const d = days.get(date) ?? { date, orders: 0, units: 0, sales: 0 };
    d.orders += 1;
    d.units += orderUnits;
    d.sales += num(o.total);
    days.set(date, d);
  }

  const gross = sum(orders.map(grossOf));
  const discountTotal = sum(orders.map((o) => num(o.discount_amount)));
  const delivery = sum(orders.map((o) => num(o.delivery_fee)));
  const net = sum(orders.map((o) => num(o.total)));

  const r2 = <T extends object>(rows: T[], fields: (keyof T)[]) =>
    rows.map((r) => {
      const out = { ...r };
      for (const f of fields) (out as Record<keyof T, unknown>)[f] = money(num(r[f]));
      return out;
    });
  const byMoney = <T extends { revenue?: number; sales?: number; amount?: number }>(a: T, b: T) =>
    num(b.revenue ?? b.sales ?? b.amount) - num(a.revenue ?? a.sales ?? a.amount);

  return {
    summary: {
      orders: orders.length,
      gross: money(gross),
      discounts: money(discountTotal),
      delivery: money(delivery),
      net: money(net),
      aov: orders.length ? money(net / orders.length) : 0,
      units,
    },
    products: r2([...products.values()].sort(byMoney), ["revenue"]),
    categories: r2([...categories.values()].sort(byMoney), ["revenue"]),
    discounts: r2([...discounts.values()].sort(byMoney), ["amount"]),
    affiliates: r2([...affiliates.values()].sort(byMoney), ["sales", "commission"]),
    states: r2([...states.values()].sort(byMoney), ["sales"]),
    days: r2([...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1)), ["sales"]),
  };
}

/** Everything the reports page and the exports need for a date range. */
export async function loadReport(supabase: SupabaseClient, range: DateRange) {
  const [{ orders, truncated, failed }, { data: prods }, { data: affs }] = await Promise.all([
    loadSales(supabase, range.startIso, range.endIso),
    supabase.from("products").select("id, category"),
    supabase.from("affiliates").select("id, name"),
  ]);
  const categoryOf = new Map<string, string>((prods ?? []).map((p: { id: string; category: string }) => [p.id, p.category]));
  const affiliateNames = new Map<string, string>((affs ?? []).map((a: { id: string; name: string }) => [a.id, a.name]));
  return { report: aggregate(orders, categoryOf, affiliateNames), truncated, failed };
}

export const REPORT_NAMES = ["sales", "products", "categories", "discounts", "affiliates", "states", "days"] as const;
export type ReportName = (typeof REPORT_NAMES)[number];

export function exportHref(name: ReportName, range: Pick<DateRange, "from" | "to">) {
  return `/admin/reports/export/${name}?from=${range.from}&to=${range.to}`;
}
