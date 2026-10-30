// lagos.ts — admin date-times are typed and shown in Lagos time (UTC+1, no daylight saving)
const HOUR = 3_600_000;

/** "2026-11-27T09:30" typed in the form -> "2026-11-27T09:30:00+01:00" for the database. Null when blank or invalid. */
export function lagosInputToIso(value: string): string | null | "invalid" {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return "invalid";
  const iso = `${v}:00+01:00`;
  return Number.isNaN(new Date(iso).getTime()) ? "invalid" : iso;
}

/** Stored timestamp -> value for a datetime-local input, in Lagos time. */
export function isoToLagosInput(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  return new Date(t + HOUR).toISOString().slice(0, 16);
}

/** Readable Lagos date-time for tables. */
export function lagosLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
