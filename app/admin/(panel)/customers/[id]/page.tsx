// app/admin/(panel)/customers/[id]/page.tsx — one customer: orders and addresses used
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { naira, shortDate } from "@/lib/format";
import { fulfillmentTone, paymentTone } from "../../orders/shared";
import { UUID_RE } from "../shared";
import "../../orders/orders.css";

export const metadata = { title: "Customer · Admin" };

type Row = {
  id: string;
  reference: string;
  payment_status: string;
  fulfillment_status: string;
  total: number | string;
  created_at: string;
  shipping: { name?: string; phone?: string; address?: string; city?: string; state?: string } | null;
  order_items: { quantity: number }[] | null;
};

export default async function AdminCustomer({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const db = createServiceClient();
  const { data: found } = await db.auth.admin.getUserById(id);
  const user = found?.user;
  if (!user) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, reference, payment_status, fulfillment_status, total, created_at, shipping, order_items(quantity)")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(500);
  const orders = (data ?? []) as unknown as Row[];

  const paid = orders.filter((o) => o.payment_status === "paid");
  const spent = paid.reduce((s, o) => s + Number(o.total), 0);
  const addresses = new Map<string, NonNullable<Row["shipping"]>>();
  for (const o of orders) {
    const s = o.shipping;
    if (!s?.address) continue;
    const key = [s.name, s.address, s.city, s.state, s.phone].join("|").toLowerCase();
    if (!addresses.has(key)) addresses.set(key, s);
  }
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const name = orders.find((o) => o.shipping?.name)?.shipping?.name || meta.full_name || meta.name || "";

  return (
    <>
      <div className="ad-head">
        <div>
          <p><Link href="/admin/customers" className="text-link">All customers</Link></p>
          <h1>{name || user.email || "Customer"}</h1>
          <p className="muted">{user.email} · joined {shortDate(user.created_at)}</p>
        </div>
      </div>

      <div className="ord-two">
        <section className="ad-card">
          <h2>Summary</h2>
          <dl className="ad-key-value">
            <dt>Paid orders</dt><dd>{paid.length}</dd>
            <dt>Total spent</dt><dd>{naira(spent)}</dd>
            <dt>Last order</dt><dd>{orders[0] ? shortDate(orders[0].created_at) : "—"}</dd>
          </dl>
        </section>
        <section className="ad-card">
          <h2>Addresses used</h2>
          {addresses.size === 0 ? (
            <p className="muted">No addresses yet.</p>
          ) : (
            <ul className="ord-addresses">
              {[...addresses.values()].map((s, i) => (
                <li key={i}>
                  {s.name}<br />
                  {s.address}, {s.city}, {s.state}<br />
                  <span className="muted">{s.phone}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ad-card">
        <h2>Orders</h2>
        {orders.length === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date</th>
                  <th className="num">Items</th>
                  <th>Payment</th>
                  <th>Fulfillment</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="row-link">{o.reference}</Link></td>
                    <td>{shortDate(o.created_at)}</td>
                    <td className="num">{(o.order_items ?? []).reduce((s, i) => s + Number(i.quantity), 0)}</td>
                    <td><span className={`ad-badge ${paymentTone(o.payment_status)}`}>{o.payment_status}</span></td>
                    <td><span className={`ad-badge ${fulfillmentTone(o.fulfillment_status)}`}>{o.fulfillment_status}</span></td>
                    <td className="num">{naira(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
