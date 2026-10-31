// app/admin/(panel)/customers/page.tsx — customers with order totals
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira, shortDate } from "@/lib/format";
import { cleanQuery, cleanSort, filterCustomers, loadCustomers } from "./shared";
import "../orders/orders.css";

export const metadata = { title: "Customers · Admin" };
const SHOWN = 200;

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = cleanQuery(sp.q);
  const sort = cleanSort(sp.sort);

  const supabase = await createClient();
  const all = await loadCustomers(supabase);
  const list = filterCustomers(all, q, sort);
  const shown = list.slice(0, SHOWN);
  const exportParams = new URLSearchParams({ sort });
  if (q) exportParams.set("q", q);

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Customers</h1>
          <p>{list.length} {list.length === 1 ? "customer" : "customers"}{list.length > SHOWN ? `, showing the first ${SHOWN}` : ""}.</p>
        </div>
        <div className="ad-actions">
          <a href={`/admin/customers/export?${exportParams.toString()}`} className="btn btn-ghost btn-sm">Export CSV</a>
        </div>
      </div>

      <form method="get" action="/admin/customers" className="ad-toolbar">
        <input type="search" name="q" defaultValue={q} placeholder="Search name or email" className="field" aria-label="Search customers" />
        <select name="sort" defaultValue={sort} className="field" aria-label="Sort">
          <option value="new">Newest first</option>
          <option value="spend">Top spenders</option>
        </select>
        <button type="submit" className="btn btn-sm">Apply</button>
        <Link href="/admin/customers" className="text-link">Reset</Link>
      </form>

      {shown.length === 0 ? (
        <p className="empty-state">No customers match.</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Joined</th>
                <th className="num">Paid orders</th>
                <th className="num">Total spent</th>
                <th>Last order</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/customers/${c.id}`} className="row-link">{c.name || c.email || "Unnamed"}</Link>
                    {c.name && <span className="ord-sub">{c.email}</span>}
                  </td>
                  <td>{shortDate(c.joined)}</td>
                  <td className="num">{c.paidOrders}</td>
                  <td className="num">{naira(c.spent)}</td>
                  <td>{c.lastOrder ? shortDate(c.lastOrder) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
