// data.ts — reads the zones and works out which other active zone holds each state
import { createClient } from "@/lib/supabase/server";
import { NIGERIAN_STATES, stateKey } from "@/lib/nigeria";
import type { DeliveryZone } from "@/lib/types";

export async function loadZones(): Promise<DeliveryZone[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("delivery_zones").select("*").order("created_at", { ascending: true });
  return ((data ?? []) as DeliveryZone[]).map((z) => ({ ...z, fee: Number(z.fee), states: z.states ?? [] }));
}

/** state -> name of the active zone that has it (ignoring one zone, the one being edited). */
export function takenByMap(zones: DeliveryZone[], ignoreId?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const z of zones) {
    if (!z.active || z.id === ignoreId) continue;
    for (const s of z.states) {
      const hit = NIGERIAN_STATES.find((n) => stateKey(n) === stateKey(s));
      if (hit) out[hit] = z.name;
    }
  }
  return out;
}
