// app/admin/(panel)/affiliates/[id]/page.tsx — one affiliate: link, stats, orders, payout
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira, shortDate } from "@/lib/format";
import type { Affiliate } from "@/lib/types";
import ConfirmButton from "../ConfirmButton";
import CopyButton from "../CopyButton";
import { markCommissionPaid } from "../actions";
import { addToStats, emptyStats, fetchAffiliateOrders, orderSales } from "../stats";
import "../affiliates.css";

export const metadata = { title: "Affiliate · Admin · Nova Edge" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AffiliateDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; paid?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { saved, paid, error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.from("affiliates").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as Affiliate;

  const orders = await fetchAffiliateOrders(a.id);
  const stats = emptyStats();
  for (const o of orders) addToStats(stats, o);

  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/?ref=${a.code}`;
  const paidAmount = paid && /^\d+(\.\d{1,2})?$/.test(paid) ? Number(paid) : null;

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>{a.name}</h1>
          <p>
            <span className="af-code">{a.code}</span> · {Number(a.commission_rate)}% default rate ·{" "}
            <span className={`ad-badge ${a.active ? "good" : "dim"}`}>{a.active ? "Active" : "Off"}</span>
            {a.email && <> · {a.email}</>}
          </p>
        </div>
        <div className="ad-actions">
          <Link href={`/admin/affiliates/${a.id}/edit`} className="btn btn-ghost">Edit</Link>
          <a href={`/admin/affiliates/${a.id}/export`} className="btn btn-ghost">Export CSV</a>
          <Link href="/admin/affiliates" className="text-link">All affiliates</Link>
        </div>
      </div>

      {saved && <p className="ad-flash">Saved.</p>}
      {paidAmount != null && <p className="ad-flash">Marked {naira(paidAmount)} of commission as paid.</p>}
      {error && <p className="ad-flash err" role="alert">{error}</p>}

      <div className="ad-card">
        <h2>Referral link</h2>
        <div className="af-link-row">
          <span className="af-link">{link}</span>
          <CopyButton text={link} />
        </div>
        {!process.env.NEXT_PUBLIC_SITE_URL && <p className="ad-hint">NEXT_PUBLIC_SITE_URL isn&apos;t set, so add your store&apos;s address in front of this before sharing it.</p>}
      </div>

      <div className="ad-grid ad-grid-3 af-stats">
        <div className="ad-stat"><span>Paid orders</span><strong>{stats.orders}</strong></div>
        <div className="ad-stat"><span>Sales (after discounts)</span><strong>{naira(stats.sales)}</strong></div>
        <div className="ad-stat"><span>Commission earned</span><strong>{naira(stats.earned)}</strong></div>
        <div className="ad-stat"><span>Paid out</span><strong>{naira(stats.paid)}</strong></div>
        <div className="ad-stat"><span>Owed now</span><strong>{naira(stats.owed)}</strong></div>
      </div>

      <div className="ad-card">
        <h2>Pay out</h2>
        {stats.owed > 0 ? (
          <form action={markCommissionPaid} className="af-pay">
            <input type="hidden" name="id" value={a.id} />
            <ConfirmButton
              className="btn"
              message={`Mark ${naira(stats.owed)} of commission as paid to ${a.name}? Do this after you have actually sent the money. It can't be undone here.`}
            >
              Mark all owed commission as paid ({naira(stats.owed)})
            </ConfirmButton>
            <span className="ad-hint">Only affects this affiliate&apos;s paid, non-cancelled orders that are still unpaid.</span>
          </form>
        ) : (
          <p className="muted">Nothing owed right now.</p>
        )}
      </div>

      <div className="ad-card af-section">
        <h2>How commission works</h2>
        <ul className="af-rules">
          <li>Commission is worked out on product revenue after discounts. Delivery fees never earn commission.</li>
          <li>A product with its own affiliate rate uses that rate; every other product uses this affiliate&apos;s default rate.</li>
          <li>Customers can&apos;t earn commission on their own orders (a customer can&apos;t be their own affiliate).</li>
          <li>Each order has one affiliate: the one from the latest <code>?ref=</code> link the customer used.</li>
          <li>Commission only counts once the order is paid, and drops away if the order is cancelled.</li>
        </ul>
      </div>

      {a.notes && (
        <div className="ad-card af-section">
          <h2>Notes</h2>
          <p className="af-notes">{a.notes}</p>
        </div>
      )}

      <h2 className="af-section">Orders</h2>
      {orders.length === 0 ? (
        <p className="empty-state">No paid orders from this link yet.</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="num">Sales</th>
                <th className="num">Commission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="row-link">{o.reference}</Link></td>
                  <td>{shortDate(o.paid_at ?? o.created_at)}</td>
                  <td>{o.email}</td>
                  <td className="num">{naira(orderSales(o))}</td>
                  <td className="num">{naira(o.affiliate_commission)}</td>
                  <td><span className={`ad-badge ${o.affiliate_paid ? "good" : "warn"}`}>{o.affiliate_paid ? "Paid" : "Owed"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
