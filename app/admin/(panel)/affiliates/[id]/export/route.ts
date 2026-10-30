// app/admin/(panel)/affiliates/[id]/export/route.ts — CSV of one affiliate's orders
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse } from "@/lib/csv";
import { fetchAffiliateOrders, orderSales } from "../../stats";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: aff } = await supabase.from("affiliates").select("id, name, code").eq("id", id).maybeSingle();
  if (!aff) return new Response("Not found", { status: 404 });

  const orders = await fetchAffiliateOrders(aff.id);
  const rows: (string | number)[][] = [["Order", "Date", "Customer email", "Sales after discounts (NGN)", "Commission (NGN)", "Commission status"]];
  for (const o of orders) {
    rows.push([
      o.reference,
      new Date(o.paid_at ?? o.created_at).toISOString().slice(0, 10),
      o.email,
      orderSales(o),
      Number(o.affiliate_commission || 0),
      o.affiliate_paid ? "Paid" : "Owed",
    ]);
  }
  const safe = String(aff.code).replace(/[^A-Z0-9_-]/g, "");
  return csvResponse(`affiliate-${safe}-orders.csv`, rows);
}
