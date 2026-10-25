// app/admin/(panel)/page.tsx — overview
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { naira, shortDate } from "@/lib/format";
import type { Order } from "@/lib/types";

export default async function AdminHome() {
  const supabase = await createClient();

  const [{ count: productCount }, { data: orders }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*").neq("status", "pending").neq("status", "cancelled").order("created_at", { ascending: false }),
  ]);

  const paid = (orders ?? []) as Order[];
  const toPrint = paid.filter((o) => o.status === "paid" || o.status === "printing").length;
  const revenue = paid.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <>
      <h1>Overview</h1>
      <div className="stat-row">
        <div className="stat">
          <strong>{toPrint}</strong>
          <span>orders to print or ship</span>
        </div>
        <div className="stat">
          <strong>{paid.length}</strong>
          <span>paid orders</span>
        </div>
        <div className="stat">
          <strong>{naira(revenue)}</strong>
          <span>paid revenue</span>
        </div>
        <div className="stat">
          <strong>{productCount ?? 0}</strong>
          <span>products</span>
        </div>
      </div>

      <div className="section-head">
        <h2>Latest paid orders</h2>
        <Link href="/admin/orders" className="text-link">All orders</Link>
      </div>
      {paid.length === 0 ? (
        <p className="empty-state">No paid orders yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th></tr>
          </thead>
          <tbody>
            {paid.slice(0, 6).map((o) => (
              <tr key={o.id}>
                <td>{o.reference}</td>
                <td>{shortDate(o.created_at)}</td>
                <td><span className={`status status-${o.status}`}>{o.status}</span></td>
                <td>{naira(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
