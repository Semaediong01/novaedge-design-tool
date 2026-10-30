// zones.ts — shared bits for the delivery screens (not a server action file)
import { NIGERIAN_STATES, stateKey } from "@/lib/nigeria";

export const FALLBACK_NAME = "Everywhere else";

export const stateLabel = (s: string) => (s === "FCT" ? "Abuja (FCT)" : s);

type ZoneLike = { name: string; states: string[] };
export const isFallback = (z: ZoneLike) => z.name === FALLBACK_NAME && z.states.length === 0;

/** The official state name for any spelling we may have stored ("Abuja", "Akwa Ibom State"...). */
export function canonicalState(s: string): string | null {
  const k = stateKey(s);
  return NIGERIAN_STATES.find((n) => stateKey(n) === k) ?? null;
}
