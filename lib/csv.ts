// lib/csv.ts — CSV text for the admin exports (opens cleanly in Excel and Google Sheets)
type Cell = string | number | boolean | null | undefined;

function cell(v: Cell) {
  let s = v == null ? "" : String(v);
  // Stop spreadsheet programs from running a cell as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]) {
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function csvResponse(filename: string, rows: Cell[][]) {
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
