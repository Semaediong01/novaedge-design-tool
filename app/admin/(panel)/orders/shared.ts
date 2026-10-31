// app/admin/(panel)/orders/shared.ts — filters, badges and the order query shared by the list page and the CSV export
import type { SupabaseClient } from "@supabase/supabase-js";
import { FULFILLMENT_STATUSES, PAYMENT_STATUSES } from "@/lib/types";

export const PAGE_SIZE = 40;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrderFilters = {
  q: string;
  /** a payment status, or "all" */
  payment: string;
  /** a fulfillment status, or "" for any */
  fulfillment: string;
};

type Raw = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Reads and validates the filters from the URL. With no payment filter the view is paid orders. */
export function parseFilters(sp: Raw): OrderFilters {
  const q = one(sp.q).replace(/[,()%*\\:"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const p = one(sp.payment);
  const payment = p === "all" || (PAYMENT_STATUSES as readonly string[]).includes(p) ? p : "paid";
  const f = one(sp.fulfillment);
  const fulfillment = (FULFILLMENT_STATUSES as readonly string[]).includes(f) ? f : "";
  return { q, payment, fulfillment };
}

export function filterParams(f: OrderFilters) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  p.set("payment", f.payment);
  if (f.fulfillment) p.set("fulfillment", f.fulfillment);
  return p;
}

/** One page of orders matching the filters, newest first. `select` is the PostgREST column list. */
export async function fetchOrders(supabase: SupabaseClient, f: OrderFilters, select: string, from: number, to: number) {
  let query = supabase.from("orders").select(select, { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (f.payment !== "all") query = query.eq("payment_status", f.payment);
  if (f.fulfillment) query = query.eq("fulfillment_status", f.fulfillment);
  if (f.q) query = query.or(`reference.ilike.%${f.q}%,email.ilike.%${f.q}%,shipping->>name.ilike.%${f.q}%`);
  const { data, count, error } = await query;
  return { rows: (data ?? []) as unknown as Record<string, unknown>[], count: count ?? 0, error };
}

export function paymentTone(s: string) {
  if (s === "paid") return "good";
  if (s === "pending") return "warn";
  if (s === "failed") return "bad";
  return "info"; // refunded
}

export function fulfillmentTone(s: string) {
  if (s === "delivered") return "good";
  if (s === "printing") return "warn";
  if (s === "shipped") return "info";
  if (s === "cancelled") return "dim";
  return ""; // new
}
