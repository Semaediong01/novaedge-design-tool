// proxy.ts (Next.js 16's replacement for middleware.ts)
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    // Say exactly what is wrong instead of a blank "Internal Server Error".
    return new Response(`Nova Edge is not configured yet. Missing environment variables: ${missing.join(", ")}. Add them in Vercel -> Settings -> Environment Variables, then redeploy.`, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // everything except static assets and the Paystack webhook (it has no cookies)
    "/((?!_next/static|_next/image|favicon.ico|api/paystack/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
