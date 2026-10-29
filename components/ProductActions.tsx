// components/ProductActions.tsx — size/color pickers plus add-to-cart and customize
"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Paintbrush, ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";
import { productImage } from "@/lib/mockups";
import type { Product } from "@/lib/types";

type Props = {
  product: Product;
  /** Optional: let the page own the colour so its photos can follow it. */
  color?: string;
  onColorChange?: (color: string) => void;
};

export default function ProductActions({ product, color: controlledColor, onColorChange }: Props) {
  const { addLine } = useCart();
  const [size, setSize] = useState(product.sizes[0] ?? "");
  const [ownColor, setOwnColor] = useState(product.colors[0] ?? "");
  const color = controlledColor ?? ownColor;
  const setColor = (c: string) => {
    setOwnColor(c);
    onColorChange?.(c);
  };
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addLine({
      productId: product.id,
      title: product.title,
      image: productImage(product, color),
      price: product.price,
      size,
      color,
      quantity: 1,
      designId: null,
      printUrl: null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const customizeHref = `/design?productId=${product.id}&size=${encodeURIComponent(size)}&color=${encodeURIComponent(color)}`;

  return (
    <div className="pdp-actions">
      {product.sizes.length > 0 && (
        <fieldset className="option-group">
          <legend className="panel-label">Size</legend>
          <div className="option-row">
            {product.sizes.map((s) => (
              <button key={s} type="button" className={`chip${s === size ? " active" : ""}`} onClick={() => setSize(s)} aria-pressed={s === size}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {product.colors.length > 0 && (
        <fieldset className="option-group">
          <legend className="panel-label">Color</legend>
          <div className="option-row">
            {product.colors.map((c) => (
              <button key={c} type="button" className={`chip${c === color ? " active" : ""}`} onClick={() => setColor(c)} aria-pressed={c === color}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {product.in_stock ? (
        <div className="pdp-buttons">
          {product.customizable && (
            <Link href={customizeHref} className="btn btn-green btn-lg">
              <Paintbrush size={18} /> Customize this
            </Link>
          )}
          <button type="button" className="btn btn-lg" onClick={handleAdd}>
            {added ? <Check size={18} /> : <ShoppingBag size={18} />} {added ? "Added to cart" : "Add to cart"}
          </button>
        </div>
      ) : (
        <p className="form-note">This product is sold out right now.</p>
      )}
    </div>
  );
}
