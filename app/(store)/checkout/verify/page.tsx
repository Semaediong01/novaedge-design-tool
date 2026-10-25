// app/(store)/checkout/verify/page.tsx — where Paystack sends the customer back
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { settleOrder } from "@/lib/orders";
import ClearCart from "./ClearCart";

export const metadata = { title: "Payment · Nova Edge" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const user = await requireUser("/orders");
  const { reference, trxref } = await searchParams;
  const ref = reference ?? trxref;

  const result = ref ? await settleOrder(ref, user.id) : { ok: false as const, reason: "not-found" };

  return (
    <main className="container section narrow">
      {result.ok ? (
        <>
          <ClearCart />
          <h1>Payment received</h1>
          <p className="lede">Thanks. Your order is paid and goes to print next. We saved your receipt under My orders.</p>
          <div className="hero-cta">
            <Link href="/orders" className="btn btn-lg">View my orders</Link>
            <Link href="/shop" className="btn btn-lg btn-ghost">Keep shopping</Link>
          </div>
        </>
      ) : (
        <>
          <h1>We couldn&apos;t confirm your payment</h1>
          <p className="lede">
            {result.reason === "unpaid"
              ? "Paystack hasn't reported a successful payment for this order. If you were charged, it will update here within a few minutes."
              : "We couldn't find that order."}
          </p>
          <div className="hero-cta">
            <Link href="/orders" className="btn btn-lg">Check my orders</Link>
            <Link href="/cart" className="btn btn-lg btn-ghost">Back to cart</Link>
          </div>
        </>
      )}
    </main>
  );
}
