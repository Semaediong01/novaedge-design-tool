// app/admin/(panel)/print-sizes/page.tsx — how big the print is on each tee size
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrintWidths } from "@/lib/store-data";
import { PRINT_RATIO, GOOD_DPI } from "@/lib/print-sizes";
import { normalizeProduct } from "@/lib/products";
import ConfirmButton from "../products/ConfirmButton";
import { resetPrintSizes, savePrintSizes } from "./actions";

export const metadata = { title: "Print sizes · Admin · Nova Edge" };

export default async function AdminPrintSizes({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const widths = await getPrintWidths();

  // Offer a row for every size your products use that has no setting yet.
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("sizes, category").eq("category", "T-Shirts");
  const used = new Set<string>();
  for (const row of data ?? []) for (const s of normalizeProduct(row as Record<string, unknown>).sizes) used.add(s);
  const known = new Set(Object.keys(widths).map((k) => k.toLowerCase()));
  const rows = [...Object.entries(widths), ...[...used].filter((s) => !known.has(s.toLowerCase())).map((s) => [s, 0] as [string, number])];
  rows.push(["", 0]); // one blank row for a new size

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Print sizes</h1>
          <p>
            How wide the front print is on each tee size. The height follows automatically (it keeps the designer&apos;s shape, so nothing is stretched).
            Orders use this to show the real print size and check the artwork is sharp enough: we aim for {GOOD_DPI} dpi or more.
          </p>
        </div>
      </div>

      {sp.saved && <p className="ad-flash">Saved.</p>}
      {sp.error && <p className="ad-flash err" role="alert">{sp.error}</p>}

      <form action={savePrintSizes} className="ad-form">
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr><th>Tee size</th><th>Print width (cm)</th><th className="num">Print height (cm)</th></tr>
            </thead>
            <tbody>
              {rows.map(([label, width], i) => (
                <tr key={i}>
                  <td><input className="field" name="label" defaultValue={label} placeholder="e.g. 3XL" maxLength={12} aria-label="Tee size" /></td>
                  <td><input className="field" name="width" type="number" step="0.1" min="5" max="60" defaultValue={width || ""} placeholder="cm" aria-label={`Print width for ${label || "new size"}`} /></td>
                  <td className="num">{width ? (Math.round(width * PRINT_RATIO * 10) / 10).toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ad-hint">
          These are starting values (S 26, M 28, L 30, XL 32, XXL 34 cm wide). Ask your printer for their real maximum print size per tee size and enter it here.
          Leave a row&apos;s size blank to remove it.
        </p>
        <div className="ad-actions">
          <button type="submit" className="btn">Save print sizes</button>
        </div>
      </form>

      <form action={resetPrintSizes} className="danger-zone">
        <ConfirmButton message="Put the print sizes back to the starting values?" className="btn btn-danger btn-sm">Reset to starting values</ConfirmButton>
      </form>
    </>
  );
}
