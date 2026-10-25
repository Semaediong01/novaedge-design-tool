// app/(store)/product/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import { naira } from "@/lib/format";
import ProductActions from "@/components/ProductActions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  return { title: product ? `${product.title} · Nova Edge` : "Product · Nova Edge" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const [main, ...rest] = product.images;

  return (
    <main className="container section">
      <p className="crumbs">
        <Link href="/shop">Shop</Link> / <Link href={`/shop?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
      </p>

      <div className="pdp">
        <div className="pdp-gallery">
          <div className="pdp-main">
            {main ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={main} alt={product.title} />
            ) : (
              <span className="product-thumb-empty">No photo yet</span>
            )}
          </div>
          {rest.length > 0 && (
            <div className="pdp-thumbs">
              {rest.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt={`${product.title}, another view`} loading="lazy" />
              ))}
            </div>
          )}
        </div>

        <div className="pdp-info">
          <h1>{product.title}</h1>
          <p className="price price-lg">{naira(product.price)}</p>
          {product.customizable && <p className="pdp-note">Customizing is included in the price.</p>}
          {product.description && <p className="pdp-desc">{product.description}</p>}
          <ProductActions product={product} />
        </div>
      </div>
    </main>
  );
}
