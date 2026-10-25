// proxy.ts (Next.js 16's replacement for middleware.ts)
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // everything except static assets and the Paystack webhook (it has no cookies)
    "/((?!_next/static|_next/image|favicon.ico|api/paystack/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
