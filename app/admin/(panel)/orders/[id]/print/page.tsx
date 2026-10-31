// app/admin/(panel)/orders/[id]/print/page.tsx — packing slip for one order
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shortDate } from "@/lib/format";
import type { Order } from "@/lib/types";
import { UUID_RE } from "../../shared";
import PrintButton from "./PrintButton";
import "../../orders.css";

export const metadata = { title: "Packing slip · Admin" };

export default async function PackingSlip({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const o = data as Order;
  const items = o.order_items ?? [];
  const sh = o.shipping;

  return (
    <>
      <div className="slip-bar">
        <PrintButton />
        <Link href={`/admin/orders/${o.id}`} className="btn btn-ghost btn-sm">Back to order</Link>
      </div>
      <article className="slip">
        <h1>Nova Edge · Packing slip</h1>
        <p>Order <strong>{o.reference}</strong> · {shortDate(o.created_at)}</p>

        <div className="slip-grid">
          <div>
            <strong>Ship to</strong>
            <p>
              {sh?.name}<br />
              {sh?.address}<br />
              {sh?.city}, {sh?.state}<br />
              {sh?.phone}
            </p>
          </div>
          <div>
            <strong>Order</strong>
            <p>
              {o.email}<br />
              Payment: {o.payment_status}<br />
              Status: {o.fulfillment_status}
            </p>
          </div>
        </div>

        <table>
          <thead>
            <tr><th>Item</th><th>Size</th><th>Colour</th><th>Qty</th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.title}{i.design_id || i.design_elements ? " (custom print)" : ""}</td>
                <td>{i.size ?? "—"}</td>
                <td>{i.color ?? "—"}</td>
                <td>{i.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {o.admin_note && <p className="slip-note">{o.admin_note}</p>}
      </article>
    </>
  );
}
