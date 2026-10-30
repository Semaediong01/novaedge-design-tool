// app/admin/(panel)/discounts/page.tsx — all discount codes
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import type { Discount } from "@/lib/types";
import { lagosLabel } from "./lagos";
import { toggleDiscount } from "./actions";
import "./discounts.css";

export const metadata = { title: "Discount codes · Admin · Nova Edge" };

function statusOf(d: Discount, now: Date): { label: string; tone: string } {
  if (!d.active) return { label: "Off", tone: "dim" };
  if (d.usage_limit != null && d.used_count >= d.usage_limit) return { label: "Used up", tone: "bad" };
  if (d.ends_at && new Date(d.ends_at) < now) return { label: "Expired", tone: "bad" };
  if (d.starts_at && new Date(d.starts_at) > now) return { label: "Scheduled", tone: "warn" };
  return { label: "Live", tone: "good" };
}

export default async function AdminDiscounts({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string; error?: string }> }) {
  await requireAdmin();
  const { saved, deleted, error } = await searchParams;
  const supabase = await createClient();

  const [{ data: dData }, { data: pData }] = await Promise.all([
    supabase.from("discounts").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("id, title"),
  ]);
  const discounts = (dData ?? []) as Discount[];
  const titles = new Map((pData ?? []).map((p) => [p.id as string, p.title as string]));
  const now = new Date();

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Discount codes</h1>
          <p>Customers type a code at checkout. It is checked on the server every time, so a code only works while it is on, inside its dates and under its limit.</p>
        </div>
        <div className="ad-actions">
          <Link href="/admin/discounts/new" className="btn">New code</Link>
        </div>
      </div>

      {saved && <p className="ad-flash">Saved.</p>}
      {deleted && <p className="ad-flash">Code deleted.</p>}
      {error && <p className="ad-flash err" role="alert">{error}</p>}

      {discounts.length === 0 ? (
        <p className="empty-state">No discount codes yet. Create one to offer a percentage or a fixed amount off.</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th className="num">Min order</th>
                <th>Applies to</th>
                <th className="num">Uses</th>
                <th>Window</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => {
                const st = statusOf(d, now);
                const names = (d.product_ids ?? []).map((id) => titles.get(id) ?? "(removed product)");
                return (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/admin/discounts/${d.id}`} className="row-link dc-code">{d.code}</Link>
                      {d.description && <span className="dc-sub">{d.description}</span>}
                    </td>
                    <td>{d.type === "percent" ? `${Number(d.value)}% off` : `${naira(d.value)} off`}</td>
                    <td className="num">{Number(d.min_order) > 0 ? naira(d.min_order) : "None"}</td>
                    <td>
                      {d.product_ids == null ? "All products" : (
                        <span title={names.join(", ")}>
                          {names.length} product{names.length === 1 ? "" : "s"}
                          <span className="dc-sub">{names.slice(0, 3).join(", ")}{names.length > 3 ? ` +${names.length - 3} more` : ""}</span>
                        </span>
                      )}
                    </td>
                    <td className="num">{d.used_count} / {d.usage_limit ?? "∞"}</td>
                    <td>
                      {d.starts_at || d.ends_at ? (
                        <>
                          {d.starts_at ? lagosLabel(d.starts_at) : "Any time"}
                          <span className="dc-sub">to {d.ends_at ? lagosLabel(d.ends_at) : "no end"}</span>
                        </>
                      ) : "Always"}
                    </td>
                    <td><span className={`ad-badge ${st.tone}`}>{st.label}</span></td>
                    <td>
                      <div className="dc-row-actions">
                        <Link href={`/admin/discounts/${d.id}`} className="text-link">Edit</Link>
                        <form action={toggleDiscount}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className="btn btn-ghost btn-xs">{d.active ? "Switch off" : "Switch on"}</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="ad-hint dc-note">Times are Lagos time. A code stacks with a product&apos;s own promo price (the promo price comes first, then the code comes off). Codes that have been used can be switched off but not deleted, so your sales history stays accurate.</p>
    </>
  );
}
