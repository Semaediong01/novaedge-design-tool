// lib/supabase/admin.ts — service-role client. Bypasses RLS: import ONLY from server code
// (route handlers, server components, server actions) and never expose to the browser.
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
