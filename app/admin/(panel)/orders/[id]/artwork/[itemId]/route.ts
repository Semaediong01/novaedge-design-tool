// Download the transparent artwork for one order item, marked with its real print size (so design software opens
// it at, for example, 30 cm wide). The pixels are never changed.
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrintWidths } from "@/lib/store-data";
import { dpiFor, pngSize, printSizeFor, withPngDpi } from "@/lib/print-sizes";
import { logAction } from "@/lib/audit";
import { UUID_RE } from "../../../shared";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await requireAdmin();
  const { id, itemId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(itemId)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("order_items")
    .select("id, size, color, production_url, orders!inner(reference)")
    .eq("id", itemId)
    .eq("order_id", id)
    .maybeSingle();
  const url = item?.production_url as string | null | undefined;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!item || !url || !base || !url.startsWith(base)) return new Response("Not found", { status: 404 });

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok) return new Response("The artwork file could not be fetched.", { status: 502 });
  let bytes: Uint8Array = new Uint8Array(await upstream.arrayBuffer());

  const px = pngSize(bytes);
  const spec = printSizeFor(item.size, await getPrintWidths());
  if (px && spec) bytes = withPngDpi(bytes, dpiFor(px.width, spec.width));

  const reference = String((item.orders as unknown as { reference: string }).reference).replace(/[^A-Za-z0-9-]/g, "");
  const part = (v: unknown) => String(v ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
  const name = `${reference}-${part(item.size)}-${part(item.color)}-print.png`;
  await logAction(user, "order.artwork_download", "order", id, { item: itemId });

  return new Response(new Blob([bytes as BlobPart], { type: "image/png" }), {
    headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
