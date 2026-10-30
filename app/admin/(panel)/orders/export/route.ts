// app/admin/(panel)/orders/export/route.ts — CSV of the orders matching the list filters
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse } from "@/lib/csv";
import { fetchOrders, parseFilters } from "../shared";

export const dynamic = "force-dynamic";

type Item = { title: string; size: string | null; color: string | null; quantity: number };
type Row = {
  reference: string;
  created_at: string;
  paid_at: string | null;
  email: string;
  shipping: { name?: string; phone?: string; address?: string; city?: string; state?: string } | null;
  order_items: Item[] | null;
  subtotal: number | string | null;
  discount_code: string | null;
  discount_amount: number | string;
  delivery_zone: string | null;
  delivery_fee: number | string;
  total: number | string;
  payment_status: string;
  fulfillment_status: string;
  affiliate_code: string | null;
  affiliate_commission: number | string;
};

const COLUMNS = "reference, created_at, paid_at, email, shipping, subtotal, discount_code, discount_amount, delivery_zone, delivery_fee, total, payment_status, fulfillment_status, affiliate_code, affiliate_commission, order_items(title, size, color, quantity)";
const BATCH = 1000;
const MAX_ROWS = 20000;

export async function GET(request: NextRequest) {
  await requireAdmin();
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const f = parseFilters(sp);
  const supabase = await createClient();

  const all: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    const { rows } = await fetchOrders(supabase, f, COLUMNS, from, from + BATCH - 1);
    all.push(...(rows as unknown as Row[]));
    if (rows.length < BATCH) break;
  }

  const out: (string | number | null)[][] = [
    ["Reference", "Date", "Paid at", "Name", "Email", "Phone", "Address", "City", "State", "Items", "Subtotal", "Discount code", "Discount", "Delivery zone", "Delivery fee", "Total", "Payment status", "Fulfillment status", "Affiliate code", "Commission"],
  ];
  for (const o of all) {
    const s = o.shipping ?? {};
    const items = (o.order_items ?? [])
      .map((i) => `${i.quantity} x ${i.title}${[i.size, i.color].filter(Boolean).length ? ` (${[i.size, i.color].filter(Boolean).join(", ")})` : ""}`)
      .join("; ");
    out.push([
      o.reference,
      o.created_at,
      o.paid_at,
      s.name ?? "",
      o.email,
      s.phone ?? "",
      s.address ?? "",
      s.city ?? "",
      s.state ?? "",
      items,
      Number(o.subtotal ?? o.total),
      o.discount_code,
      Number(o.discount_amount),
      o.delivery_zone,
      Number(o.delivery_fee),
      Number(o.total),
      o.payment_status,
      o.fulfillment_status,
      o.affiliate_code,
      Number(o.affiliate_commission),
    ]);
  }
  return csvResponse(`nova-edge-orders-${new Date().toISOString().slice(0, 10)}.csv`, out);
}
