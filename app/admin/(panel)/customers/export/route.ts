// app/admin/(panel)/customers/export/route.ts — CSV of the customers matching the list filters
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse } from "@/lib/csv";
import { cleanQuery, cleanSort, filterCustomers, loadCustomers } from "../shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireAdmin();
  const sp = request.nextUrl.searchParams;
  const supabase = await createClient();
  const list = filterCustomers(await loadCustomers(supabase), cleanQuery(sp.get("q") ?? undefined), cleanSort(sp.get("sort") ?? undefined));

  const out: (string | number | null)[][] = [["Name", "Email", "Joined", "Paid orders", "Total spent", "Last order"]];
  for (const c of list) out.push([c.name, c.email, c.joined, c.paidOrders, c.spent, c.lastOrder]);
  return csvResponse(`nova-edge-customers-${new Date().toISOString().slice(0, 10)}.csv`, out);
}
