// components/ProductCard.tsx
import Link from "next/link";
import { naira } from "@/lib/format";
import { productImage } from "@/lib/mockups";
import { effectivePrice, promoActive } from "@/lib/pricing";
import type { Product } from "@/lib/types";

export default function ProductCard({ product }: { product: Product }) {
  const image = productImage(product, product.colors[0]);
  const onPromo = promoActive(product);
  return (
    <Link href={`/product/${product.id}`} className="product-card">
      <div className="product-thumb">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.title} loading="lazy" />
        ) : (
          <span className="product-thumb-empty">No photo yet</span>
        )}
        {product.customizable && <span className="tag">Customizable</span>}
        {!product.in_stock && <span className="tag tag-out">Sold out</span>}
        {onPromo && product.in_stock && <span className="tag tag-promo">{product.promo_label || "Sale"}</span>}
      </div>
      <div className="product-meta">
        <h3>{product.title}</h3>
        <span className="price">
          {onPromo && <s className="price-was">{naira(product.price)}</s>} {naira(effectivePrice(product))}
        </span>
      </div>
      <p className="product-cat">{product.category}</p>
    </Link>
  );
}
