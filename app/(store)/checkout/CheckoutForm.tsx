// app/(store)/checkout/CheckoutForm.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { naira } from "@/lib/format";

export default function CheckoutForm({ email }: { email: string }) {
  const { lines, ready, subtotal } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!ready) return null;

  if (lines.length === 0) {
    return (
      <p className="empty-state">
        Your cart is empty. <Link href="/shop" className="text-link">Browse the shop</Link>
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.productId,
            size: l.size,
            color: l.color,
            quantity: l.quantity,
            designId: l.designId,
          })),
          shipping: {
            name: form.get("name"),
            phone: form.get("phone"),
            address: form.get("address"),
            city: form.get("city"),
            state: form.get("state"),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "We couldn't start the payment. Try again.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="cart-layout">
      <form onSubmit={handleSubmit} className="form-stack checkout-form">
        <h2>Delivery details</h2>
        <label className="field-group">
          <span className="panel-label">Full name</span>
          <input className="field" name="name" required autoComplete="name" />
        </label>
        <label className="field-group">
          <span className="panel-label">Phone number</span>
          <input className="field" name="phone" type="tel" required autoComplete="tel" />
        </label>
        <label className="field-group">
          <span className="panel-label">Street address</span>
          <input className="field" name="address" required autoComplete="street-address" />
        </label>
        <div className="form-grid">
          <label className="field-group">
            <span className="panel-label">City</span>
            <input className="field" name="city" required autoComplete="address-level2" />
          </label>
          <label className="field-group">
            <span className="panel-label">State</span>
            <input className="field" name="state" required autoComplete="address-level1" />
          </label>
        </div>
        <p className="form-note">Receipt goes to {email}.</p>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" className="btn btn-lg" disabled={busy}>
          {busy && <Loader2 size={18} className="spin" />} Pay {naira(subtotal)} with Paystack
        </button>
      </form>

      <aside className="summary">
        <h2>In your order</h2>
        <ul className="summary-items">
          {lines.map((l) => (
            <li key={l.id}>
              <span>
                {l.title} {l.designId && <em>(custom)</em>}
                <small className="muted"> {[l.size, l.color].filter(Boolean).join(" · ")} × {l.quantity}</small>
              </span>
              <strong>{naira(l.price * l.quantity)}</strong>
            </li>
          ))}
        </ul>
        <div className="summary-row">
          <span>Total</span>
          <strong>{naira(subtotal)}</strong>
        </div>
      </aside>
    </div>
  );
}
