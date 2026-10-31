// app/admin/(panel)/orders/[id]/page.tsx — one order: customer, artwork, money and actions
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { FULFILLMENT_STATUSES, type Order } from "@/lib/types";
import { UUID_RE, fulfillmentTone, paymentTone } from "../shared";
import { markRefunded, recheckPayment, saveNote, setFulfillment } from "./actions";
import "../orders.css";

export const metadata = { title: "Order · Admin" };

const SAVED: Record<string, string> = {
  status: "Fulfillment status updated.",
  nochange: "Nothing to change.",
  note: "Note saved.",
  paid: "Paystack confirmed the payment. The order is now paid.",
  refunded: "Order marked as refunded.",
};
const ERRORS: Record<string, string> = {
  "bad-status": "That status change isn't allowed.",
  "not-paid": "This order isn't paid yet. Unpaid orders can only be cancelled.",
  changed: "The order changed while you were working. Check it and try again.",
  "not-pending": "Only orders waiting for payment can be re-checked.",
  paystack: "Couldn't reach Paystack. Try again in a moment.",
  unpaid: "Paystack has no matching successful payment for this order yet.",
  confirm: "Tick the box to confirm the refund.",
  "not-refundable": "Only paid orders can be marked as refunded.",
  save: "Couldn't save. Try again.",
};

const dateTime = (iso: string) => new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function AdminOrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { saved, error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const o = data as Order;
  const items = o.order_items ?? [];
  const sh = o.shipping;

  const paid = o.payment_status === "paid";
  const unpaid = o.payment_status === "pending" || o.payment_status === "failed";
  const canSetStatus = paid || unpaid;
  const allowed = paid ? FULFILLMENT_STATUSES : unpaid ? (["cancelled"] as const) : [];
  const subtotal = Number(o.subtotal ?? o.total);

  return (
    <>
      <div className="ad-head">
        <div>
          <p><Link href="/admin/orders" className="text-link">All orders</Link></p>
          <h1>{o.reference}</h1>
          <p>
            <span className={`ad-badge ${paymentTone(o.payment_status)}`}>{o.payment_status}</span>{" "}
            <span className={`ad-badge ${fulfillmentTone(o.fulfillment_status)}`}>{o.fulfillment_status}</span>{" "}
            <span className="muted">Placed {dateTime(o.created_at)}{o.paid_at ? ` · paid ${dateTime(o.paid_at)}` : ""}</span>
          </p>
        </div>
        <div className="ad-actions">
          <Link href={`/admin/orders/${o.id}/print`} className="btn btn-ghost btn-sm">Packing slip</Link>
        </div>
      </div>

      {saved && SAVED[saved] && <p className="ad-flash">{SAVED[saved]}</p>}
      {error && ERRORS[error] && <p className="ad-flash err">{ERRORS[error]}</p>}

      <div className="ord-two">
        <section className="ad-card">
          <h2>Customer and delivery</h2>
          <dl className="ad-key-value">
            <dt>Name</dt><dd>{sh?.name}</dd>
            <dt>Email</dt><dd>{o.email}</dd>
            <dt>Phone</dt><dd>{sh?.phone}</dd>
            <dt>Address</dt><dd>{sh?.address}, {sh?.city}, {sh?.state}</dd>
            <dt>Account</dt><dd><Link href={`/admin/customers/${o.user_id}`} className="text-link">View customer</Link></dd>
          </dl>
        </section>

        <section className="ad-card">
          <h2>Money</h2>
          <dl className="ad-key-value">
            <dt>Subtotal</dt><dd>{naira(subtotal)}</dd>
            <dt>Discount</dt><dd>{o.discount_code ? `${o.discount_code}: −${naira(o.discount_amount)}` : "None"}</dd>
            <dt>Delivery</dt><dd>{o.delivery_zone ? `${o.delivery_zone}: ` : ""}{naira(o.delivery_fee)}</dd>
            <dt><strong>Total</strong></dt><dd><strong>{naira(o.total)}</strong></dd>
            <dt>Affiliate</dt>
            <dd>
              {o.affiliate_code ? (
                <>
                  {o.affiliate_code}: {naira(o.affiliate_commission)}{" "}
                  {o.payment_status === "refunded" ? <span className="ad-badge dim">not counted (refunded)</span> : o.affiliate_paid ? <span className="ad-badge good">paid</span> : <span className="ad-badge warn">owed</span>}
                </>
              ) : (
                "None"
              )}
            </dd>
          </dl>
        </section>
      </div>

      <section className="ad-card">
        <h2>Items</h2>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th></th>
                <th>Item</th>
                <th>Size / colour</th>
                <th className="num">Qty</th>
                <th className="num">Unit price</th>
                <th className="num">Discount</th>
                <th className="num">Line total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const line = Number(i.unit_price) * i.quantity;
                const custom = Boolean(i.design_id || i.design_elements);
                return (
                  <tr key={i.id}>
                    <td>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {i.image && <img src={i.image} alt="" className="ord-thumb" />}
                    </td>
                    <td>
                      {i.title} {custom && <span className="ad-badge info">custom</span>}
                      {(i.print_url || i.production_url) && (
                        <div className="ord-art">
                          {i.print_url && (
                            <figure>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={i.print_url} alt={`Print preview for ${i.title}`} />
                              <figcaption>
                                Customer print file<br />
                                <a href={i.print_url} download target="_blank" rel="noreferrer" className="text-link">Download print file</a>
                              </figcaption>
                            </figure>
                          )}
                          {i.production_url && (
                            <figure>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={i.production_url} alt={`Production artwork for ${i.title}`} className="ord-checker" />
                              <figcaption>
                                Transparent artwork<br />
                                <a href={i.production_url} download target="_blank" rel="noreferrer" className="text-link">Download production artwork</a>
                              </figcaption>
                            </figure>
                          )}
                        </div>
                      )}
                      {custom && !i.print_url && !i.production_url && <p className="ord-warn">Customized, but no artwork files were saved for this item.</p>}
                    </td>
                    <td>{[i.size, i.color].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="num">{i.quantity}</td>
                    <td className="num">{naira(i.unit_price)}</td>
                    <td className="num">{Number(i.discount_share) > 0 ? `−${naira(i.discount_share)}` : "—"}</td>
                    <td className="num">{naira(line - Number(i.discount_share))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ad-card ord-actions">
        <h2>Actions</h2>

        {canSetStatus ? (
          <form action={setFulfillment}>
            <input type="hidden" name="id" value={o.id} />
            <label className="panel-label" htmlFor="ord-status">Fulfillment</label>
            <select id="ord-status" name="status" className="field" defaultValue={allowed.includes(o.fulfillment_status as never) ? o.fulfillment_status : allowed[0]} style={{ width: "auto" }}>
              {allowed.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-sm">Update</button>
            {!paid && <span className="ad-hint">Not paid yet, so the order can only be cancelled.</span>}
          </form>
        ) : (
          <p className="muted">This order is {o.payment_status}, so its fulfillment can&apos;t be changed.</p>
        )}

        {o.payment_status === "pending" && (
          <form action={recheckPayment}>
            <input type="hidden" name="id" value={o.id} />
            <button type="submit" className="btn btn-ghost btn-sm">Re-check payment with Paystack</button>
            <span className="ad-hint">Asks Paystack if this reference was paid. Payment can&apos;t be marked paid by hand.</span>
          </form>
        )}

        {paid && (
          <details className="ord-refund">
            <summary>Mark as refunded</summary>
            <form action={markRefunded}>
              <input type="hidden" name="id" value={o.id} />
              <p className="ad-hint">Sets payment to refunded{o.fulfillment_status === "delivered" ? "" : " and cancels the order"}. Affiliate commission on it stops counting. Refund the customer in Paystack first.</p>
              <label className="check">
                <input type="checkbox" name="confirm" value="yes" required /> I have refunded {naira(o.total)} to the customer
              </label>
              <button type="submit" className="btn btn-danger btn-sm">Confirm refund</button>
            </form>
          </details>
        )}

        <form action={saveNote} className="ord-note-form">
          <input type="hidden" name="id" value={o.id} />
          <label className="panel-label" htmlFor="ord-note">Admin note (private)</label>
          <textarea id="ord-note" name="note" className="field" defaultValue={o.admin_note} maxLength={2000} />
          <div><button type="submit" className="btn btn-sm">Save note</button></div>
        </form>
      </section>
    </>
  );
}
