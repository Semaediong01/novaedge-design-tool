// app/(store)/cart/page.tsx
"use client";

import Link from "next/link";
import { Minus, Paintbrush, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { createClient } from "@/lib/supabase/client";
import { naira } from "@/lib/format";
import type { CartLine } from "@/lib/types";

export default function CartPage() {
  const { lines, ready, subtotal, setQuantity, removeLine, clearDesign } = useCart();

  // Delete the saved design from the database, then drop it from the cart line.
  const deleteDesign = async (line: CartLine) => {
    if (line.designId) await createClient().from("designs").delete().eq("id", line.designId);
    clearDesign(line.id);
  };

  const removeWholeLine = async (line: CartLine) => {
    if (line.designId) await createClient().from("designs").delete().eq("id", line.designId);
    removeLine(line.id);
  };

  if (!ready) return <main className="container section" />;

  if (lines.length === 0) {
    return (
      <main className="container section">
        <h1>Your cart</h1>
        <p className="empty-state">
          Your cart is empty. <Link href="/shop" className="text-link">Browse the shop</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="container section">
      <h1>Your cart</h1>

      <div className="cart-layout">
        <ul className="cart-list">
          {lines.map((line) => {
            const editHref = `/design?productId=${line.productId}&designId=${line.designId}&size=${encodeURIComponent(line.size)}&color=${encodeURIComponent(line.color)}`;
            const redesignHref = `/design?productId=${line.productId}&size=${encodeURIComponent(line.size)}&color=${encodeURIComponent(line.color)}`;
            return (
              <li key={line.id} className="cart-line">
                <div className="cart-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {line.printUrl ? <img src={line.printUrl} alt="Your design" className="cart-thumb-design" /> : line.image && <img src={line.image} alt={line.title} />}
                </div>

                <div className="cart-info">
                  <Link href={`/product/${line.productId}`} className="cart-title">
                    {line.title}
                  </Link>
                  <p className="muted">
                    {[line.size, line.color].filter(Boolean).join(" · ")}
                  </p>

                  {line.designId ? (
                    <div className="cart-design">
                      <span className="tag tag-inline">Custom design</span>
                      <Link href={editHref} className="text-link">Edit design</Link>
                      <button type="button" className="text-link text-link-btn" onClick={() => deleteDesign(line)}>
                        Delete design
                      </button>
                    </div>
                  ) : (
                    <Link href={redesignHref} className="text-link cart-design">
                      <Paintbrush size={14} /> Add a custom design
                    </Link>
                  )}
                </div>

                <div className="cart-qty">
                  {line.designId ? (
                    <span className="muted">Qty 1</span>
                  ) : (
                    <div className="qty-stepper">
                      <button type="button" onClick={() => setQuantity(line.id, line.quantity - 1)} aria-label="Fewer">
                        <Minus size={14} />
                      </button>
                      <span>{line.quantity}</span>
                      <button type="button" onClick={() => setQuantity(line.id, line.quantity + 1)} aria-label="More">
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="cart-price">
                  <strong>{naira(line.price * line.quantity)}</strong>
                  <button type="button" className="icon-btn icon-btn-sm" onClick={() => removeWholeLine(line)} aria-label={`Remove ${line.title}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="summary">
          <h2>Order summary</h2>
          <div className="summary-row">
            <span>Subtotal</span>
            <strong>{naira(subtotal)}</strong>
          </div>
          <p className="form-note">Customizing is included. Delivery is arranged after you pay.</p>
          <Link href="/checkout" className="btn btn-lg btn-block">
            Checkout
          </Link>
        </aside>
      </div>
    </main>
  );
}
