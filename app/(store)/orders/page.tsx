// app/(store)/orders/page.tsx — the customer's own orders
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira, shortDate } from "@/lib/format";
import type { Order } from "@/lib/types";

export const metadata = { title: "My orders · Nova Edge" };

export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as Order[];

  return (
    <main className="container section">
      <h1>My orders</h1>

      {orders.length === 0 ? (
        <p className="empty-state">
          No orders yet. <Link href="/shop" className="text-link">Find something to wear</Link>
        </p>
      ) : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id} className="order-card">
              <div className="order-head">
                <div>
                  <strong>{o.reference}</strong>
                  <p className="muted">{shortDate(o.created_at)}</p>
                </div>
                <span className={`status status-${o.status}`}>{o.status}</span>
                <strong>{naira(o.total)}</strong>
              </div>
              <ul className="order-items">
                {(o.order_items ?? []).map((i) => (
                  <li key={i.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {(i.print_url || i.image) && <img src={(i.print_url ?? i.image) as string} alt="" />}
                    <span>
                      {i.title} {i.design_id && <em>(custom)</em>}
                      <small className="muted"> {[i.size, i.color].filter(Boolean).join(" · ")} × {i.quantity}</small>
                    </span>
                  </li>
                ))}
              </ul>
              {o.status === "pending" && <p className="form-note">Waiting for payment. If you already paid, this updates within a few minutes.</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
