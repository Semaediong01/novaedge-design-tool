// app/admin/(panel)/orders/page.tsx — orders with print files and status updates
import { createClient } from "@/lib/supabase/server";
import { naira, shortDate } from "@/lib/format";
import { ORDER_STATUSES, type Order } from "@/lib/types";
import { setOrderStatus } from "../../actions";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(100);
  if (status && (ORDER_STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
  else query = query.neq("status", "pending").neq("status", "cancelled");

  const { data } = await query;
  const orders = (data ?? []) as Order[];

  return (
    <>
      <h1>Orders</h1>
      <div className="option-row filter-row">
        <a href="/admin/orders" className={`chip${!status ? " active" : ""}`}>Paid and later</a>
        {ORDER_STATUSES.map((s) => (
          <a key={s} href={`/admin/orders?status=${s}`} className={`chip${status === s ? " active" : ""}`}>{s}</a>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="empty-state">No orders here yet.</p>
      ) : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id} className="order-card">
              <div className="order-head">
                <div>
                  <strong>{o.reference}</strong>
                  <p className="muted">{shortDate(o.created_at)} · {o.email}</p>
                </div>
                <span className={`status status-${o.status}`}>{o.status}</span>
                <strong>{naira(o.total)}</strong>
              </div>

              <p className="ship-to">
                <strong>{o.shipping.name}</strong>, {o.shipping.phone}<br />
                {o.shipping.address}, {o.shipping.city}, {o.shipping.state}
              </p>

              <ul className="order-items">
                {(o.order_items ?? []).map((i) => (
                  <li key={i.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {(i.print_url || i.image) && <img src={(i.print_url ?? i.image) as string} alt="" />}
                    <span>
                      {i.title} <small className="muted">{[i.size, i.color].filter(Boolean).join(" · ")} × {i.quantity}</small>
                      {i.print_url && (
                        <>
                          <br />
                          <a href={i.print_url} download target="_blank" rel="noreferrer" className="text-link">Download print file</a>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <form action={setOrderStatus} className="status-form">
                <input type="hidden" name="id" value={o.id} />
                <label className="panel-label" htmlFor={`s-${o.id}`}>Update status</label>
                <select id={`s-${o.id}`} name="status" className="field" defaultValue={o.status}>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button type="submit" className="btn btn-sm">Save</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
