// app/(store)/shop/page.tsx
import Link from "next/link";
import { getProducts } from "@/lib/products";
import ProductCard from "@/components/ProductCard";

// Launch range: T-shirts and caps only. Add categories here when new product lines go live.
const LAUNCH_CATEGORIES = ["T-Shirts", "Caps"] as const;

export const metadata = { title: "Shop · Nova Edge" };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; custom?: string }>;
}) {
  const { category, q, custom } = await searchParams;
  const all = await getProducts({ category, q });
  const products = custom ? all.filter((p) => p.customizable) : all;

  const heading = q ? `Results for “${q}”` : custom ? "Design your own" : (category ?? "All products");

  return (
    <main className="container section">
      <div className="section-head">
        <h1>{heading}</h1>
        <span className="muted">{products.length} {products.length === 1 ? "product" : "products"}</span>
      </div>

      {custom && <p className="lede">Pick any piece below, then use the designer to add text, shapes or your own image.</p>}

      <div className="option-row filter-row">
        <Link href="/shop" className={`chip${!category && !custom ? " active" : ""}`}>
          All
        </Link>
        {LAUNCH_CATEGORIES.map((c) => (
          <Link key={c} href={`/shop?category=${encodeURIComponent(c)}`} className={`chip${category === c ? " active" : ""}`}>
            {c}
          </Link>
        ))}
      </div>

      {products.length > 0 ? (
        <div className="grid-products">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p className="empty-state">
          Nothing matches that yet. <Link href="/shop" className="text-link">Clear filters</Link>
        </p>
      )}
    </main>
  );
}
