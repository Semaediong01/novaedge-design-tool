// lib/format.ts
export function naira(amount: number | string) {
  return "₦" + Number(amount).toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
