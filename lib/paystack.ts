// lib/paystack.ts — server-only Paystack calls
import crypto from "node:crypto";

const BASE = "https://api.paystack.co";

function headers() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function initializeTransaction(input: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
}) {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountNaira * 100), // kobo
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) throw new Error(json.message ?? "Paystack could not start the payment");
  return json.data as { authorization_url: string; access_code: string; reference: string };
}

export async function verifyTransaction(reference: string) {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: headers(),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.status) return null;
  return json.data as { status: string; amount: number; reference: string; currency: string };
}

export function isValidSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY ?? "").update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
