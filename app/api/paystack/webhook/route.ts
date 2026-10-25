// app/api/paystack/webhook/route.ts — Paystack tells us a payment succeeded (backup to the redirect)
import { isValidSignature } from "@/lib/paystack";
import { settleOrder } from "@/lib/orders";

export async function POST(req: Request) {
  const raw = await req.text();
  if (!isValidSignature(raw, req.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(raw);
  if (event.event === "charge.success" && typeof event.data?.reference === "string") {
    await settleOrder(event.data.reference);
  }
  return new Response("ok", { status: 200 });
}
