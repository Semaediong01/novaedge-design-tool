// components/RecommendedProducts.tsx — the "You may also like" row on a product page
import ProductCard from "@/components/ProductCard";
import { getRecommendedProducts } from "@/lib/recommended";
import type { Product } from "@/lib/types";

export default async function RecommendedProducts({ product }: { product: Product }) {
  const items = await getRecommendedProducts(product);
  if (items.length === 0) return null;
  return (
    <section className="recommended" aria-labelledby="rec-title">
      <h2 id="rec-title">You may also like</h2>
      <div className="product-grid">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
