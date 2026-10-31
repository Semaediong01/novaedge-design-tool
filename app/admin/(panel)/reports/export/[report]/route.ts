// app/admin/(panel)/reports/export/[report]/route.ts — CSV download of one report for ?from=&to=
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse } from "@/lib/csv";
import { loadReport, parseRange, REPORT_NAMES, type ReportName } from "../../data";

export const dynamic = "force-dynamic";

type Row = (string | number)[];

export async function GET(request: NextRequest, ctx: { params: Promise<{ report: string }> }) {
  await requireAdmin();
  const { report: name } = await ctx.params;
  if (!(REPORT_NAMES as readonly string[]).includes(name)) return new Response("Unknown report", { status: 404 });

  const range = parseRange(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const supabase = await createClient();
  const { report: r } = await loadReport(supabase, range);

  const tables: Record<ReportName, Row[]> = {
    sales: [
      ["Measure", "Value"],
      ["From", range.from],
      ["To", range.to],
      ["Paid orders", r.summary.orders],
      ["Items sold", r.summary.units],
      ["Product sales before discounts (NGN)", r.summary.gross],
      ["Discounts given (NGN)", r.summary.discounts],
      ["Delivery collected (NGN)", r.summary.delivery],
      ["Total paid by customers (NGN)", r.summary.net],
      ["Average order value (NGN)", r.summary.aov],
    ],
    products: [["Product", "Units", "Revenue (NGN)"], ...r.products.map((p) => [p.title, p.units, p.revenue])],
    categories: [["Category", "Units", "Revenue (NGN)"], ...r.categories.map((c) => [c.category, c.units, c.revenue])],
    discounts: [["Code", "Orders", "Discount given (NGN)"], ...r.discounts.map((d) => [d.code, d.orders, d.amount])],
    affiliates: [["Affiliate", "Code", "Orders", "Sales (NGN)", "Commission (NGN)"], ...r.affiliates.map((a) => [a.affiliate, a.code, a.orders, a.sales, a.commission])],
    states: [["State", "Orders", "Sales (NGN)"], ...r.states.map((s) => [s.state, s.orders, s.sales])],
    days: [["Day", "Orders", "Items", "Sales (NGN)"], ...r.days.map((d) => [d.date, d.orders, d.units, d.sales])],
  };

  return csvResponse(`nova-edge-${name}-${range.from}-to-${range.to}.csv`, tables[name as ReportName]);
}
