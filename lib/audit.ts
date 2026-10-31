// lib/audit.ts — records who changed what in the admin. Best effort: a logging problem never blocks the change.
import { createClient } from "@/lib/supabase/server";

type Actor = { id: string; email?: string | null };

export async function logAction(actor: Actor, action: string, entity?: string, entityId?: string, details: Record<string, unknown> = {}) {
  try {
    const supabase = await createClient();
    await supabase.from("audit_log").insert({
      admin_id: actor.id,
      admin_email: actor.email ?? null,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      details,
    });
  } catch {
    /* ignore */
  }
}
