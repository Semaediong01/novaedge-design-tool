// app/(store)/checkout/CheckoutForm.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Tag } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { naira } from "@/lib/format";
import { NIGERIAN_STATES } from "@/lib/nigeria";

type Quote = {
  lines: { productId: string; unitPrice: number; regularPrice: number; quantity: number; lineTotal: number }[];
  subtotal: number;
  discount: { code: string; amount: number } | null;
  discountError: string | null;
  delivery: { fee: number; zone: string | null };
  total: number;
};

export default function CheckoutForm({ email }: { email: string }) {
  const { lines, ready } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const items = useMemo(
    () => lines.map((l) => ({ productId: l.productId, size: l.size, color: l.color, quantity: l.quantity, designId: l.designId })),
    [lines]
  );

  // Ask the server for the real prices, discount and delivery fee whenever something changes.
  useEffect(() => {
    if (!ready || items.length === 0) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the quote is fetched from the server whenever the cart, state or code changes
    setQuoting(true);
    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, code, state }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "We couldn't work out your total.");
          setQuote(null);
        } else {
          setError("");
          setQuote(data);
        }
      })
      .catch(() => !cancelled && setError("We couldn't work out your total. Check your connection."))
      .finally(() => !cancelled && setQuoting(false));
    return () => {
      cancelled = true;
    };
  }, [items, code, state, ready]);

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
          items,
          code,
          shipping: {
            name: form.get("name"),
            phone: form.get("phone"),
            address: form.get("address"),
            city: form.get("city"),
            state,
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

  const total = quote?.total;

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
            <select className="field" name="state" required value={state} onChange={(e) => setState(e.target.value)} autoComplete="address-level1">
              <option value="" disabled>Choose your state</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>{s === "FCT" ? "Abuja (FCT)" : s}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="field-group">
          <span className="panel-label">Discount code</span>
          <div className="code-row">
            <input
              className="field"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Have a code?"
              autoCapitalize="characters"
              autoComplete="off"
            />
            <button type="button" className="btn btn-ghost" onClick={() => setCode(codeInput.trim())} disabled={quoting}>
              <Tag size={16} /> Apply
            </button>
          </div>
          {quote?.discount && <p className="form-ok">Code {quote.discount.code} applied: −{naira(quote.discount.amount)}</p>}
          {quote?.discountError && code && <p className="form-error" role="alert">{quote.discountError}</p>}
        </div>

        <p className="form-note">Receipt goes to {email}.</p>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" className="btn btn-lg" disabled={busy || quoting || !quote || !state}>
          {(busy || quoting) && <Loader2 size={18} className="spin" />}
          {!state ? "Choose your state to continue" : total != null ? ` Pay ${naira(total)} with Paystack` : " Working out your total…"}
        </button>
      </form>

      <aside className="summary">
        <h2>In your order</h2>
        <ul className="summary-items">
          {lines.map((l, i) => {
            const q = quote?.lines[i];
            const onPromo = q && q.unitPrice < q.regularPrice;
            return (
              <li key={l.id}>
                <span>
                  {l.title} {l.designId && <em>(custom)</em>}
                  <small className="muted"> {[l.size, l.color].filter(Boolean).join(" · ")} × {l.quantity}</small>
                </span>
                <strong>
                  {onPromo && <s className="price-was">{naira(q.regularPrice * q.quantity)}</s>} {naira(q ? q.lineTotal : l.price * l.quantity)}
                </strong>
              </li>
            );
          })}
        </ul>
        <div className="summary-row"><span>Subtotal</span><strong>{quote ? naira(quote.subtotal) : "…"}</strong></div>
        {quote?.discount && <div className="summary-row"><span>Discount ({quote.discount.code})</span><strong>−{naira(quote.discount.amount)}</strong></div>}
        <div className="summary-row">
          <span>Delivery{quote?.delivery.zone ? ` (${quote.delivery.zone})` : ""}</span>
          <strong>{!state ? "Choose state" : quote ? (quote.delivery.fee === 0 ? "Free" : naira(quote.delivery.fee)) : "…"}</strong>
        </div>
        <div className="summary-row summary-total"><span>Total</span><strong>{quote ? naira(quote.total) : "…"}</strong></div>
      </aside>
    </div>
  );
}
