// app/admin/(panel)/orders/page.tsx — all orders with search, filters and paging
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira, shortDate } from "@/lib/format";
import { FULFILLMENT_STATUSES, PAYMENT_STATUSES } from "@/lib/types";
import { PAGE_SIZE, filterParams, fetchOrders, fulfillmentTone, parseFilters, paymentTone } from "./shared";
import "./orders.css";

type Row = {
  id: string;
  user_id: string;
  email: string;
  reference: string;
  payment_status: string;
  fulfillment_status: string;
  total: number | string;
  created_at: string;
  affiliate_code: string | null;
  shipping: { name?: string } | null;
  order_items: { quantity: number }[] | null;
};

export const metadata = { title: "Orders · Admin" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = parseFilters(sp);
  const rawPage = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(Math.floor(rawPage), 10000) : 1;
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const [{ rows, count }, toPrint, toShip] = await Promise.all([
    fetchOrders(supabase, f, "id, user_id, email, reference, payment_status, fulfillment_status, total, created_at, affiliate_code, shipping, order_items(quantity)", from, from + PAGE_SIZE - 1),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "paid").eq("fulfillment_status", "new"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "paid").eq("fulfillment_status", "printing"),
  ]);
  const orders = rows as unknown as Row[];
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const link = (extra: Record<string, string>) => {
    const p = filterParams(f);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/admin/orders?${p.toString()}`;
  };
  const exportHref = `/admin/orders/export?${filterParams(f).toString()}`;
  const onToPrint = f.payment === "paid" && f.fulfillment === "new" && !f.q;
  const onToShip = f.payment === "paid" && f.fulfillment === "printing" && !f.q;

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Orders</h1>
          <p>{count} {count === 1 ? "order" : "orders"} match this view.</p>
        </div>
        <div className="ad-actions">
          <a href={exportHref} className="btn btn-ghost btn-sm">Export CSV</a>
        </div>
      </div>

      <div className="ord-chips">
        <Link href="/admin/orders?payment=paid&fulfillment=new" className={`chip${onToPrint ? " active" : ""}`}>To print<b>{toPrint.count ?? 0}</b></Link>
        <Link href="/admin/orders?payment=paid&fulfillment=printing" className={`chip${onToShip ? " active" : ""}`}>To ship<b>{toShip.count ?? 0}</b></Link>
        <Link href="/admin/orders" className={`chip${f.payment === "paid" && !f.fulfillment && !f.q ? " active" : ""}`}>All paid</Link>
        <Link href="/admin/orders?payment=pending" className={`chip${f.payment === "pending" && !f.fulfillment && !f.q ? " active" : ""}`}>Waiting for payment</Link>
      </div>

      <form method="get" action="/admin/orders" className="ad-toolbar">
        <input type="search" name="q" defaultValue={f.q} placeholder="Search reference, email or name" className="field" aria-label="Search orders" />
        <select name="payment" defaultValue={f.payment} className="field" aria-label="Payment status">
          <option value="all">Any payment</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>Payment: {s}</option>
          ))}
        </select>
        <select name="fulfillment" defaultValue={f.fulfillment} className="field" aria-label="Fulfillment status">
          <option value="">Any fulfillment</option>
          {FULFILLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>Fulfillment: {s}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-sm">Apply</button>
        <Link href="/admin/orders" className="text-link">Reset</Link>
      </form>

      {orders.length === 0 ? (
        <p className="empty-state">No orders match.</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="num">Items</th>
                <th>Payment</th>
                <th>Fulfillment</th>
                <th className="num">Total</th>
                <th>Affiliate</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="row-link">{o.reference}</Link></td>
                  <td>{shortDate(o.created_at)}</td>
                  <td>
                    {o.shipping?.name || "—"}
                    <span className="ord-sub">{o.email}</span>
                  </td>
                  <td className="num">{(o.order_items ?? []).reduce((s, i) => s + Number(i.quantity), 0)}</td>
                  <td><span className={`ad-badge ${paymentTone(o.payment_status)}`}>{o.payment_status}</span></td>
                  <td><span className={`ad-badge ${fulfillmentTone(o.fulfillment_status)}`}>{o.fulfillment_status}</span></td>
                  <td className="num">{naira(o.total)}</td>
                  <td>{o.affiliate_code ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="ord-pager">
          {page > 1 ? <Link href={link({ page: String(page - 1) })} className="btn btn-ghost btn-sm">Previous</Link> : <span />}
          <span className="muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={link({ page: String(page + 1) })} className="btn btn-ghost btn-sm">Next</Link> : <span />}
        </div>
      )}
    </>
  );
}
