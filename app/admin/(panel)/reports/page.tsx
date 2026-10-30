// app/admin/(panel)/reports/page.tsx — sales reports for a date range, each with a CSV download
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { exportHref, loadReport, MAX_ROWS, parseRange, type ReportName } from "./data";
import "./reports.css";

export const metadata = { title: "Reports · Admin · Nova Edge" };

type Col<T> = { head: string; cell: (r: T) => React.ReactNode; num?: boolean };

function Section<T>({ id, title, name, range, rows, cols, empty }: {
  id: string; title: string; name: ReportName; range: { from: string; to: string }; rows: T[]; cols: Col<T>[]; empty: string;
}) {
  return (
    <section className="rp-section" aria-labelledby={id}>
      <div className="rp-section-head">
        <h2 id={id}>{title}</h2>
        <a className="btn btn-ghost btn-xs" href={exportHref(name, range)} download>Download CSV</a>
      </div>
      {rows.length === 0 ? (
        <p className="empty-state">{empty}</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead><tr>{cols.map((c) => <th key={c.head} className={c.num ? "num" : undefined}>{c.head}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{cols.map((c) => <td key={c.head} className={c.num ? "num" : undefined}>{c.cell(r)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function AdminReports({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const range = parseRange(await searchParams);
  const supabase = await createClient();
  const { report, truncated, failed } = await loadReport(supabase, range);
  const s = report.summary;

  const summaryRows = [
    { label: "Paid orders", value: String(s.orders) },
    { label: "Items sold", value: String(s.units) },
    { label: "Product sales before discounts", value: naira(s.gross) },
    { label: "Discounts given", value: naira(s.discounts) },
    { label: "Delivery collected", value: naira(s.delivery) },
    { label: "Total paid by customers", value: naira(s.net) },
    { label: "Average order value", value: naira(s.aov) },
  ];

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Reports</h1>
          <p>Only paid orders that were not cancelled are counted. Days run midnight to midnight, Lagos time.</p>
        </div>
      </div>

      <form method="get" className="rp-range">
        <label>From<input className="field" type="date" name="from" defaultValue={range.from} required /></label>
        <label>To<input className="field" type="date" name="to" defaultValue={range.to} required /></label>
        <button type="submit" className="btn">Show report</button>
      </form>

      {failed && <p className="ad-flash err" role="alert">Some orders could not be loaded, so these figures may be incomplete.</p>}
      {truncated && <p className="ad-flash err">More than {MAX_ROWS.toLocaleString("en-NG")} orders match. Figures cover the newest {MAX_ROWS.toLocaleString("en-NG")}. Choose a shorter range.</p>}

      <Section id="r-sales" title="Sales summary" name="sales" range={range} rows={summaryRows} empty="No sales in this range."
        cols={[{ head: "Measure", cell: (r) => r.label }, { head: "Value", cell: (r) => r.value, num: true }]} />
      <Section id="r-products" title="By product" name="products" range={range} rows={report.products} empty="No products sold in this range."
        cols={[{ head: "Product", cell: (r) => r.title }, { head: "Units", cell: (r) => r.units, num: true }, { head: "Revenue", cell: (r) => naira(r.revenue), num: true }]} />
      <Section id="r-categories" title="By category" name="categories" range={range} rows={report.categories} empty="No category sales in this range."
        cols={[{ head: "Category", cell: (r) => r.category }, { head: "Units", cell: (r) => r.units, num: true }, { head: "Revenue", cell: (r) => naira(r.revenue), num: true }]} />
      <Section id="r-discounts" title="Discount code usage" name="discounts" range={range} rows={report.discounts} empty="No discount codes were used in this range."
        cols={[{ head: "Code", cell: (r) => r.code }, { head: "Orders", cell: (r) => r.orders, num: true }, { head: "Discount given", cell: (r) => naira(r.amount), num: true }]} />
      <Section id="r-affiliates" title="Affiliate performance" name="affiliates" range={range} rows={report.affiliates} empty="No affiliate sales in this range."
        cols={[{ head: "Affiliate", cell: (r) => r.affiliate }, { head: "Code", cell: (r) => r.code }, { head: "Orders", cell: (r) => r.orders, num: true }, { head: "Sales", cell: (r) => naira(r.sales), num: true }, { head: "Commission", cell: (r) => naira(r.commission), num: true }]} />
      <Section id="r-states" title="By state" name="states" range={range} rows={report.states} empty="No orders in this range."
        cols={[{ head: "State", cell: (r) => r.state }, { head: "Orders", cell: (r) => r.orders, num: true }, { head: "Sales", cell: (r) => naira(r.sales), num: true }]} />
      <Section id="r-days" title="By day" name="days" range={range} rows={[...report.days].reverse()} empty="No orders in this range."
        cols={[{ head: "Day", cell: (r) => r.date }, { head: "Orders", cell: (r) => r.orders, num: true }, { head: "Items", cell: (r) => r.units, num: true }, { head: "Sales", cell: (r) => naira(r.sales), num: true }]} />
    </>
  );
}
