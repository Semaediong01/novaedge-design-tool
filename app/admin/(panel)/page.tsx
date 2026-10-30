// app/admin/(panel)/page.tsx — overview: sales tiles, things to do, sales chart, top products
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { aggregate, addDays, fetchPaged, lagosDate, lagosStart, loadSales, MAX_ROWS } from "./reports/data";
import "./overview.css";

export const metadata = { title: "Overview · Admin · Nova Edge" };

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const CHART_MAX_DAYS = 90;

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const { range: rawRange } = await searchParams;
  const range: RangeKey = RANGES.some((r) => r.key === rawRange) ? (rawRange as RangeKey) : "30d";
  const supabase = await createClient();

  // Read the clock once per request (this page renders on the server for every visit).
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const today = lagosDate(nowMs);
  const fromDay = range === "today" ? today : range === "7d" ? addDays(today, -6) : range === "30d" ? addDays(today, -29) : null;
  const startIso = fromDay ? lagosStart(fromDay).toISOString() : null;
  const hourAgo = new Date(nowMs - 3600_000).toISOString();

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [sales, toPrint, toShip, pending, soldOut, owed] = await Promise.all([
    // Bounded read: at most MAX_ROWS (5,000) paid orders are summed; the page warns when that limit is reached.
    loadSales(supabase, startIso, null),
    count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "paid").eq("fulfillment_status", "new")),
    count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "paid").eq("fulfillment_status", "printing")),
    count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "pending").lt("created_at", hourAgo)),
    count(supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true).eq("in_stock", false)),
    // Commission still owed to affiliates, all time (also capped at 5,000 orders).
    fetchPaged<{ affiliate_commission: number }>((from, to) =>
      supabase
        .from("orders")
        .select("affiliate_commission")
        .eq("payment_status", "paid")
        .neq("fulfillment_status", "cancelled")
        .eq("affiliate_paid", false)
        .gt("affiliate_commission", 0)
        .order("id")
        .range(from, to)
    ),
  ]);

  const orders = sales.orders;
  const report = aggregate(orders);
  const s = report.summary;
  const commissionOwed = owed.rows.reduce((t, r) => t + Number(r.affiliate_commission || 0), 0);

  // New customers: people in this period whose first paid order falls inside it.
  const buyers = [...new Set(orders.map((o) => o.user_id))];
  let newCustomers = buyers.length;
  if (startIso && buyers.length) {
    const returning = new Set<string>();
    for (let i = 0; i < buyers.length; i += 150) {
      const { data } = await supabase
        .from("orders")
        .select("user_id")
        .in("user_id", buyers.slice(i, i + 150))
        .eq("payment_status", "paid")
        .lt("created_at", startIso)
        .limit(1000);
      for (const r of data ?? []) returning.add(r.user_id as string);
    }
    newCustomers = buyers.length - returning.size;
  }

  // Chart: one bar per Lagos day (long periods show the latest 90 days).
  const byDay = new Map(report.days.map((d) => [d.date, d]));
  const firstDay = fromDay ?? (report.days[0]?.date ?? today);
  let chartDays: string[] = [];
  for (let d = firstDay; d <= today; d = addDays(d, 1)) chartDays.push(d);
  const chartTrimmed = chartDays.length > CHART_MAX_DAYS;
  if (chartTrimmed) chartDays = chartDays.slice(-CHART_MAX_DAYS);
  const series = chartDays.map((date) => ({ date, sales: byDay.get(date)?.sales ?? 0, orders: byDay.get(date)?.orders ?? 0 }));
  const maxSales = Math.max(1, ...series.map((d) => d.sales));
  const barW = 10;
  const chartH = 120;
  const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });

  const tiles: { label: string; value: string }[] = [
    { label: "Sales", value: naira(s.net) },
    { label: "Paid orders", value: String(s.orders) },
    { label: "Average order value", value: naira(s.aov) },
    { label: "Items sold", value: String(s.units) },
    { label: "New customers", value: String(newCustomers) },
    { label: "Discounts given", value: naira(s.discounts) },
    { label: "Delivery collected", value: naira(s.delivery) },
    { label: "Affiliate commission owed (all time)", value: naira(commissionOwed) },
  ];

  const cards: { href: string; n: number; label: string }[] = [
    { href: "/admin/orders?payment=paid&fulfillment=new", n: toPrint, label: "orders to print" },
    { href: "/admin/orders?payment=paid&fulfillment=printing", n: toShip, label: "orders to ship" },
    { href: "/admin/orders?payment=pending", n: pending, label: "pending payments over 1 hour old" },
    { href: "/admin/products", n: soldOut, label: "sold-out products" },
  ];

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Overview</h1>
          <p>How the store is doing. Days run midnight to midnight, Lagos time.</p>
        </div>
        <nav className="ov-range" aria-label="Period">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/admin?range=${r.key}`} aria-current={r.key === range} scroll={false}>
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      {sales.failed && <p className="ad-flash err" role="alert">Some sales could not be loaded, so the figures below may be incomplete.</p>}
      {sales.truncated && <p className="ad-flash err">This period has more than {MAX_ROWS.toLocaleString("en-NG")} orders. Figures cover the newest {MAX_ROWS.toLocaleString("en-NG")}. Choose a shorter period.</p>}

      <div className="ad-grid ad-grid-3">
        {tiles.map((t) => (
          <div className="ad-stat" key={t.label}>
            <strong>{t.value}</strong>
            <span>{t.label}</span>
          </div>
        ))}
      </div>

      <div className="ov-actions">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`ov-action${c.n > 0 ? " alert" : ""}`}>
            <strong>{c.n}</strong>
            <span>{c.label}</span>
          </Link>
        ))}
      </div>

      <section className="ad-card" aria-labelledby="ov-chart-h">
        <h2 id="ov-chart-h">Sales by day</h2>
        {s.orders === 0 ? (
          <p className="ad-empty">No paid orders in this period.</p>
        ) : (
          <>
            <svg className="ov-chart" viewBox={`0 0 ${series.length * barW} ${chartH}`} preserveAspectRatio="none" role="img" aria-label={`Bar chart of daily sales, highest day ${naira(maxSales)}`}>
              {series.map((d, i) => {
                const h = d.sales > 0 ? Math.max(2, (d.sales / maxSales) * chartH) : 0;
                return (
                  <rect key={d.date} x={i * barW + 1} y={chartH - h} width={barW - 2} height={h} rx="1">
                    <title>{`${dayLabel(d.date)}: ${naira(d.sales)} from ${d.orders} order${d.orders === 1 ? "" : "s"}`}</title>
                  </rect>
                );
              })}
            </svg>
            <div className="ov-chart-axis">
              <span>{dayLabel(series[0].date)}</span>
              <span>Highest day {naira(maxSales)}</span>
              <span>{dayLabel(series[series.length - 1].date)}</span>
            </div>
            {chartTrimmed && <p className="ov-note">Showing the latest {CHART_MAX_DAYS} days.</p>}
            <details className="ov-details">
              <summary>Show as a table</summary>
              <div className="ad-table-wrap" style={{ marginTop: "0.6rem" }}>
                <table className="ad-table">
                  <thead><tr><th>Day</th><th className="num">Orders</th><th className="num">Sales</th></tr></thead>
                  <tbody>
                    {[...series].reverse().map((d) => (
                      <tr key={d.date}><td>{dayLabel(d.date)}</td><td className="num">{d.orders}</td><td className="num">{naira(d.sales)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      <div className="ov-two">
        <section className="ad-card" aria-labelledby="ov-top-h">
          <h2 id="ov-top-h">Top products</h2>
          {report.products.length === 0 ? (
            <p className="ad-empty">Nothing sold in this period.</p>
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table" style={{ minWidth: 0 }}>
                <thead><tr><th>Product</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
                <tbody>
                  {report.products.slice(0, 8).map((p) => (
                    <tr key={p.key}><td>{p.title}</td><td className="num">{p.units}</td><td className="num">{naira(p.revenue)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="ad-card" aria-labelledby="ov-recent-h">
          <h2 id="ov-recent-h">Recent paid orders</h2>
          {orders.length === 0 ? (
            <p className="ad-empty">No paid orders in this period.</p>
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table" style={{ minWidth: 0 }}>
                <thead><tr><th>Order</th><th>Date</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {orders.slice(0, 8).map((o) => (
                    <tr key={o.id}>
                      <td><Link className="row-link" href={`/admin/orders/${o.id}`}>{o.reference}</Link></td>
                      <td>{new Date(o.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}</td>
                      <td className="num">{naira(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="ov-note"><Link className="text-link" href="/admin/orders">All orders</Link></p>
        </section>
      </div>

      <div className="ov-links">
        <Link href="/admin/products/new" className="btn">Add product</Link>
        <Link href="/" className="btn btn-ghost" target="_blank" rel="noopener">View store</Link>
      </div>
    </>
  );
}
