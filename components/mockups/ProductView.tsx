// components/mockups/ProductView.tsx — product page body: gallery that follows the chosen colour, plus the buy box
"use client";

import { useState } from "react";
import { naira } from "@/lib/format";
import { productImage, usesTeeMockup } from "@/lib/mockups";
import ProductActions from "@/components/ProductActions";
import type { Product } from "@/lib/types";

export default function ProductView({ product }: { product: Product }) {
  const [color, setColor] = useState(product.colors[0] ?? "");
  const tee = usesTeeMockup(product);

  // Generated tees: one view with the symbol, one without. Uploaded photos: the admin's own gallery.
  const views = tee
    ? [
        { src: productImage(product, color, true), label: `${product.title}, ${color} with the Nova Edge symbol` },
        { src: productImage(product, color, false), label: `${product.title}, ${color} plain` },
      ]
    : product.images.map((src, i) => ({ src, label: i === 0 ? product.title : `${product.title}, another view` }));

  const [picked, setPicked] = useState(0);
  const main = views[Math.min(picked, views.length - 1)];

  return (
    <div className="pdp">
      <div className="pdp-gallery">
        <div className="pdp-main">
          {main?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={main.src} alt={main.label} />
          ) : (
            <span className="product-thumb-empty">No photo yet</span>
          )}
        </div>
        {views.length > 1 && (
          <div className="pdp-thumbs">
            {views.map((v, i) => (
              <button key={v.src ?? i} type="button" className={`pdp-thumb${i === picked ? " active" : ""}`} onClick={() => setPicked(i)} aria-label={v.label} aria-pressed={i === picked}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {v.src && <img src={v.src} alt="" loading="lazy" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pdp-info">
        <h1>{product.title}</h1>
        <p className="price price-lg">{naira(product.price)}</p>
        {product.customizable && <p className="pdp-note">Customizing is included in the price.</p>}
        {tee && <p className="muted">Comes with the small Nova Edge symbol on the chest. Open the designer to make it bigger, smaller, move it or remove it.</p>}
        {product.description && <p className="pdp-desc">{product.description}</p>}
        <ProductActions product={product} color={color} onColorChange={(c) => { setColor(c); setPicked(0); }} />
      </div>
    </div>
  );
}
