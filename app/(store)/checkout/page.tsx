// app/(store)/checkout/page.tsx
import { requireUser } from "@/lib/auth";
import CheckoutForm from "./CheckoutForm";

export const metadata = { title: "Checkout · Nova Edge" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  return (
    <main className="container section">
      <h1>Checkout</h1>
      <CheckoutForm email={user.email ?? ""} />
    </main>
  );
}
