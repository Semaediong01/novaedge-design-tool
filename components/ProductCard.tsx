// components/ProductCard.tsx
import Link from "next/link";
import { naira } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.id}`} className="product-card">
      <div className="product-thumb">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.title} loading="lazy" />
        ) : (
          <span className="product-thumb-empty">No photo yet</span>
        )}
        {product.customizable && <span className="tag">Customizable</span>}
        {!product.in_stock && <span className="tag tag-out">Sold out</span>}
      </div>
      <div className="product-meta">
        <h3>{product.title}</h3>
        <span className="price">{naira(product.price)}</span>
      </div>
      <p className="product-cat">{product.category}</p>
    </Link>
  );
}
