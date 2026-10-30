// app/admin/(panel)/customers/shared.ts — customers come from Supabase auth users joined with order totals
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_USERS = 1000;

export type Customer = {
  id: string;
  email: string;
  name: string;
  joined: string;
  paidOrders: number;
  spent: number;
  lastOrder: string | null;
};

type OrderRow = {
  user_id: string;
  payment_status: string;
  total: number | string;
  created_at: string;
  shipping: { name?: string } | null;
};

/** Every order's light columns, newest first (read in batches; RLS lets admins see all). */
async function allOrders(supabase: SupabaseClient): Promise<OrderRow[]> {
  const rows: OrderRow[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await supabase
      .from("orders")
      .select("user_id, payment_status, total, created_at, shipping")
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    const batch = (data ?? []) as unknown as OrderRow[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

export async function loadCustomers(supabase: SupabaseClient): Promise<Customer[]> {
  const db = createServiceClient();
  const [{ data: users }, orders] = await Promise.all([db.auth.admin.listUsers({ page: 1, perPage: MAX_USERS }), allOrders(supabase)]);

  const agg = new Map<string, { paid: number; spent: number; last: string | null; name: string }>();
  for (const o of orders) {
    // orders are newest first, so the first one seen per user is the latest
    const a = agg.get(o.user_id) ?? { paid: 0, spent: 0, last: o.created_at, name: o.shipping?.name ?? "" };
    if (!a.name && o.shipping?.name) a.name = o.shipping.name;
    if (o.payment_status === "paid") {
      a.paid += 1;
      a.spent += Number(o.total);
    }
    agg.set(o.user_id, a);
  }

  return (users?.users ?? []).map((u) => {
    const a = agg.get(u.id);
    const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
    return {
      id: u.id,
      email: u.email ?? "",
      name: a?.name || meta.full_name || meta.name || "",
      joined: u.created_at,
      paidOrders: a?.paid ?? 0,
      spent: a?.spent ?? 0,
      lastOrder: a?.last ?? null,
    };
  });
}

export function filterCustomers(list: Customer[], q: string, sort: string) {
  const needle = q.toLowerCase();
  const out = needle ? list.filter((c) => c.email.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle)) : list.slice();
  if (sort === "spend") out.sort((a, b) => b.spent - a.spent || b.paidOrders - a.paidOrders);
  else out.sort((a, b) => +new Date(b.joined) - +new Date(a.joined));
  return out;
}

export function cleanQuery(v: string | string[] | undefined) {
  const s = (Array.isArray(v) ? v[0] : v) ?? "";
  return s.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function cleanSort(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) === "spend" ? "spend" : "new";
}
