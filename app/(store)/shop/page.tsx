// app/(store)/shop/page.tsx
import Image from "next/image";
import Link from "next/link";
import { getProducts } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import { MAIN_SECTIONS, getShopSections } from "@/lib/categories";

export const metadata = { title: "Shop · Nova Edge" };

const SOON_COPY: Record<string, string> = {
  Hoodies: "Soft, heavy and made to be personalized, just like the tees. We're getting them ready.",
  Joggers: "Same clean look, same Nova Edge symbol, made to move.",
  Caps: "Ready for your own design. We're getting them ready.",
  Casuals: "Our casual wear is being put together and will land here as soon as it's ready.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; custom?: string }>;
}) {
  const { category, q, custom } = await searchParams;
  const sections = await getShopSections();
  const all = await getProducts({ category, q });
  const products = custom ? all.filter((p) => p.customizable) : all;

  const comingSoon = Boolean(category) && !q && !custom && products.length === 0 && (MAIN_SECTIONS as readonly string[]).includes(category as string);
  const heading = q ? `Results for “${q}”` : custom ? "Design your own" : (category ?? "All products");

  return (
    <main className="container section">
      <div className="section-head">
        <h1>{heading}</h1>
        {!comingSoon && <span className="muted">{products.length} {products.length === 1 ? "product" : "products"}</span>}
      </div>

      {custom && <p className="lede">Pick any piece below, then use the designer to add text, shapes or your own image.</p>}

      <div className="option-row filter-row">
        <Link href="/shop" className={`chip${!category && !custom ? " active" : ""}`}>
          All
        </Link>
        {sections.map((s) => (
          <Link key={s.name} href={`/shop?category=${encodeURIComponent(s.name)}`} className={`chip${category === s.name ? " active" : ""}`}>
            {s.name}
            {s.count === 0 && <span className="soon-tag">Soon</span>}
          </Link>
        ))}
      </div>

      {comingSoon ? (
        <section className="coming-soon">
          <Image className="coming-soon-mark" src="/brand/ne-monogram.png" alt="" width={389} height={328} />
          <p className="eyebrow">Coming soon</p>
          <h2>{category} are coming</h2>
          <p className="lede">{SOON_COPY[category as string]}</p>
          <div className="hero-cta">
            <Link href="/shop?category=T-Shirts" className="btn btn-lg">
              Shop tees
            </Link>
            <Link href="/shop?custom=1" className="btn btn-lg btn-ghost">
              Design your own
            </Link>
          </div>
        </section>
      ) : products.length > 0 ? (
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
