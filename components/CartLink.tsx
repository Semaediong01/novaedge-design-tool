// components/CartLink.tsx
"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";

export default function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" className="icon-btn" aria-label={`Cart, ${ready ? count : 0} items`}>
      <ShoppingBag size={20} />
      {ready && count > 0 && <span className="cart-count">{count}</span>}
    </Link>
  );
}
