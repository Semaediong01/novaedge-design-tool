// app/admin/(panel)/team/page.tsx — activity log and the list of admins
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { naira } from "@/lib/format";
import { lagosLabel } from "../discounts/lagos";
import { addAdmin, removeAdmin } from "./actions";
import ConfirmButton from "./ConfirmButton";
import "./team.css";

export const metadata = { title: "Team and activity · Admin · Nova Edge" };

const PAGE_SIZE = 50;

const AREAS: Record<string, string> = {
  product: "Products",
  order: "Orders",
  discount: "Discount codes",
  affiliate: "Affiliates",
  delivery: "Delivery",
  section: "Sections",
  homepage: "Home page",
  template: "Design templates",
  content: "Store content",
  customer: "Customers",
  admin: "Admins and sign-ins",
};

const NOUNS: Record<string, string> = {
  product: "a product",
  order: "an order",
  discount: "a discount code",
  affiliate: "an affiliate",
  delivery: "a delivery zone",
  section: "a section",
  homepage: "the home page",
  template: "a design template",
  content: "store content",
  customer: "a customer",
  admin: "an admin",
};

const VERBS: Record<string, string> = {
  create: "Created",
  add: "Added",
  update: "Updated",
  edit: "Edited",
  delete: "Deleted",
  remove: "Removed",
  activate: "Turned on",
  deactivate: "Turned off",
  toggle: "Switched",
  reorder: "Reordered",
  publish: "Published",
  save: "Saved",
};

const SPECIAL: Record<string, string> = {
  "admin.login": "Signed in",
  "admin.add": "Added an admin",
  "admin.remove": "Removed an admin",
  "order.fulfillment": "Changed an order's fulfillment status",
  "order.note": "Edited an order note",
  "order.recheck_payment": "Re-checked an order's payment",
  "order.refund": "Marked an order as refunded",
};

function label(action: string) {
  if (SPECIAL[action]) return SPECIAL[action];
  const [area, ...rest] = action.split(".");
  const verb = rest.join(" ").replace(/_/g, " ");
  const noun = NOUNS[area];
  const v = VERBS[verb];
  if (v && noun) return `${v} ${noun}`;
  const text = `${verb} ${noun ?? area}`.trim().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function summarise(details: unknown): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
    if (v == null || v === "" || typeof v === "object") continue;
    const key = k.replace(/_/g, " ");
    const val = /(price|amount|fee|total|commission)$/.test(k) && typeof v === "number" ? naira(v) : String(v);
    parts.push(`${key}: ${val.length > 60 ? val.slice(0, 57) + "..." : val}`);
    if (parts.length === 5) break;
  }
  return parts.join(" · ");
}

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type AdminRow = { user_id: string; email: string; role: string; created_at: string };
type LogRow = { id: number; admin_email: string | null; action: string; entity: string | null; details: unknown; created_at: string };

export default async function AdminTeam({ searchParams }: { searchParams: Promise<Raw> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();

  const area = Object.keys(AREAS).includes(one(sp.area)) ? one(sp.area) : "";
  const who = one(sp.who).trim().replace(/[%_,()\\]/g, "").slice(0, 100);
  const page = Math.max(1, Math.min(1000, parseInt(one(sp.page), 10) || 1));
  const saved = one(sp.saved);
  const error = one(sp.error);

  let q = supabase.from("audit_log").select("id, admin_email, action, entity, details, created_at", { count: "exact" });
  if (area) q = q.like("action", `${area}.%`);
  if (who) q = q.ilike("admin_email", `%${who}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data: logData, count } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const logs = (logData ?? []) as LogRow[];
  const total = count ?? 0;
  const hasNext = from + logs.length < total;

  // Admins can only read their own row under RLS, so the full list is read with the service client (after requireAdmin above).
  const { data: adminData } = await createServiceClient().from("admins").select("user_id, email, role, created_at").order("created_at", { ascending: true });
  const admins = (adminData ?? []) as AdminRow[];
  const isOwner = admins.find((a) => a.user_id === user.id)?.role === "owner";

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (area) params.set("area", area);
    if (who) params.set("who", who);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/admin/team${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Team and activity</h1>
          <p>Who can sign in to the admin, and a record of what they changed.</p>
        </div>
      </div>

      {saved === "added" && <p className="ad-flash">Admin added.</p>}
      {saved === "removed" && <p className="ad-flash">Admin removed.</p>}
      {error && <p className="ad-flash err" role="alert">{error}</p>}

      <section className="ad-card" aria-labelledby="tm-admins-h">
        <h2 id="tm-admins-h">Admins</h2>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr><th>Email</th><th>Role</th><th>Added</th>{isOwner && <th><span className="sr-only">Actions</span></th>}</tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.user_id}>
                  <td>{a.email}{a.user_id === user.id && <span className="muted"> (you)</span>}</td>
                  <td><span className={`ad-badge ${a.role === "owner" ? "good" : "info"}`}>{a.role}</span></td>
                  <td>{lagosLabel(a.created_at)}</td>
                  {isOwner && (
                    <td>
                      {a.user_id !== user.id && (
                        <form action={removeAdmin} className="ad-inline-form">
                          <input type="hidden" name="user_id" value={a.user_id} />
                          <ConfirmButton className="btn btn-ghost btn-xs" message={`Remove ${a.email} as an admin? They will lose access to the admin straight away.`}>Remove</ConfirmButton>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isOwner ? (
          <form action={addAdmin} className="ad-form" style={{ marginTop: "1rem" }}>
            <div>
              <label htmlFor="tm-email"><strong>Add an admin</strong></label>
              <input id="tm-email" className="field" type="email" name="email" required maxLength={254} placeholder="person@example.com" autoComplete="off" />
              <p className="ad-hint">They need an account first. Create the user in Supabase under Authentication, Users, Add user (or have them sign up on the store), then enter their email here. New admins get the admin role, not owner.</p>
            </div>
            <div><button type="submit" className="btn">Add admin</button></div>
          </form>
        ) : (
          <p className="ad-hint" style={{ marginTop: "0.75rem" }}>Only an owner can add or remove admins.</p>
        )}
      </section>

      <section className="ad-card tm-section" aria-labelledby="tm-sec-h">
        <h2 id="tm-sec-h">Security checklist</h2>
        <ul className="tm-check">
          <li>Give every person their own login. Never share one admin account.</li>
          <li>Use a long, unique password and turn on two-factor sign-in where you can.</li>
          <li>Remove an admin as soon as they stop working with you.</li>
          <li>Keep the owner role to one or two trusted people.</li>
          <li>Check the activity log below now and then for changes you do not recognise.</li>
          <li>Keep the service role key and Paystack secret key out of chats, screenshots and public code.</li>
        </ul>
      </section>

      <section className="tm-section" aria-labelledby="tm-log-h">
        <h2 id="tm-log-h">Activity log</h2>
        <form method="get" className="ad-toolbar tm-filters">
          <select className="field" name="area" defaultValue={area} aria-label="Area">
            <option value="">All areas</option>
            {Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="field" type="search" name="who" defaultValue={who} placeholder="Admin email" aria-label="Admin email" />
          <button type="submit" className="btn btn-xs">Filter</button>
          {(area || who) && <Link href="/admin/team" className="text-link">Clear</Link>}
        </form>

        {logs.length === 0 ? (
          <p className="empty-state">No activity matches.</p>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>When (Lagos)</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{lagosLabel(l.created_at)}</td>
                    <td>{l.admin_email ?? "Unknown"}</td>
                    <td>{label(l.action)}</td>
                    <td className="tm-detail">{summarise(l.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="tm-pager">
          {page > 1 ? <Link className="text-link" href={pageHref(page - 1)}>Newer</Link> : <span className="off">Newer</span>}
          <span className="muted">Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
          {hasNext ? <Link className="text-link" href={pageHref(page + 1)}>Older</Link> : <span className="off">Older</span>}
        </div>
      </section>
    </>
  );
}
