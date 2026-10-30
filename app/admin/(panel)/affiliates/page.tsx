// app/admin/(panel)/affiliates/page.tsx — all affiliates with their sales and commission
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import type { Affiliate } from "@/lib/types";
import { emptyStats, fetchAffiliateOrders, statsByAffiliate } from "./stats";
import "./affiliates.css";

export const metadata = { title: "Affiliates · Admin · Nova Edge" };

export default async function AdminAffiliates({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const { saved, error } = await searchParams;
  const supabase = await createClient();

  const [{ data }, orders] = await Promise.all([
    supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
    fetchAffiliateOrders(),
  ]);
  const affiliates = (data ?? []) as Affiliate[];
  const stats = statsByAffiliate(orders);
  const totalOwed = affiliates.reduce((s, a) => s + (stats.get(a.id)?.owed ?? 0), 0);

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Affiliates</h1>
          <p>People who share a link like <code>/?ref=CODE</code> and earn a commission on the orders it brings in.</p>
        </div>
        <div className="ad-actions">
          <Link href="/admin/affiliates/new" className="btn">New affiliate</Link>
        </div>
      </div>

      {saved && <p className="ad-flash">Saved.</p>}
      {error && <p className="ad-flash err" role="alert">{error}</p>}

      {affiliates.length === 0 ? (
        <p className="empty-state">No affiliates yet. Add one to get them a referral link.</p>
      ) : (
        <>
          {totalOwed > 0 && <p className="ad-hint">Total commission owed across all affiliates: <strong>{naira(totalOwed)}</strong></p>}
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Affiliate</th>
                  <th>Code</th>
                  <th className="num">Rate</th>
                  <th className="num">Paid orders</th>
                  <th className="num">Sales</th>
                  <th className="num">Commission earned</th>
                  <th className="num">Paid out</th>
                  <th className="num">Owed</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((a) => {
                  const s = stats.get(a.id) ?? emptyStats();
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/affiliates/${a.id}`} className="row-link">{a.name}</Link>
                        {a.email && <span className="af-sub">{a.email}</span>}
                      </td>
                      <td className="af-code">{a.code}</td>
                      <td className="num">{Number(a.commission_rate)}%</td>
                      <td className="num">{s.orders}</td>
                      <td className="num">{naira(s.sales)}</td>
                      <td className="num">{naira(s.earned)}</td>
                      <td className="num">{naira(s.paid)}</td>
                      <td className="num"><strong>{naira(s.owed)}</strong></td>
                      <td><span className={`ad-badge ${a.active ? "good" : "dim"}`}>{a.active ? "Active" : "Off"}</span></td>
                      <td><Link href={`/admin/affiliates/${a.id}/edit`} className="text-link">Edit</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="ad-hint af-section">Figures count orders that are paid and not cancelled. Sales are product revenue after discounts, without delivery.</p>
    </>
  );
}
