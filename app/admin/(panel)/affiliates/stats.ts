// stats.ts — affiliate sales and commission figures, worked out from orders
import { createClient } from "@/lib/supabase/server";

export type AffOrder = {
  id: string;
  reference: string;
  email: string;
  created_at: string;
  paid_at: string | null;
  affiliate_id: string | null;
  subtotal: number | string | null;
  total: number | string;
  discount_amount: number | string;
  affiliate_commission: number | string;
  affiliate_paid: boolean;
  payment_status: string;
  fulfillment_status: string;
};

export type AffStats = { orders: number; sales: number; earned: number; paid: number; owed: number };

export const emptyStats = (): AffStats => ({ orders: 0, sales: 0, earned: 0, paid: 0, owed: 0 });

const COLUMNS = "id, reference, email, created_at, paid_at, affiliate_id, subtotal, total, discount_amount, affiliate_commission, affiliate_paid, payment_status, fulfillment_status";
const PAGE = 1000;

/** Orders that count: paid and not cancelled. (Refunded orders are not "paid", so they drop out too.) */
export async function fetchAffiliateOrders(affiliateId?: string): Promise<AffOrder[]> {
  const supabase = await createClient();
  const out: AffOrder[] = [];
  for (let from = 0; from < 100_000; from += PAGE) {
    let q = supabase
      .from("orders")
      .select(COLUMNS)
      .not("affiliate_id", "is", null)
      .eq("payment_status", "paid")
      .neq("fulfillment_status", "cancelled")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (affiliateId) q = q.eq("affiliate_id", affiliateId);
    const { data } = await q;
    const rows = (data ?? []) as AffOrder[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Product revenue after discounts (delivery is never included). */
export const orderSales = (o: AffOrder) => Math.max(0, Number(o.subtotal ?? o.total) - Number(o.discount_amount || 0));

export function addToStats(s: AffStats, o: AffOrder) {
  const c = Number(o.affiliate_commission || 0);
  s.orders += 1;
  s.sales += orderSales(o);
  s.earned += c;
  if (o.affiliate_paid) s.paid += c;
  else s.owed += c;
}

export function statsByAffiliate(orders: AffOrder[]) {
  const map = new Map<string, AffStats>();
  for (const o of orders) {
    if (!o.affiliate_id) continue;
    const s = map.get(o.affiliate_id) ?? emptyStats();
    addToStats(s, o);
    map.set(o.affiliate_id, s);
  }
  return map;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
