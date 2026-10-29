// app/(store)/product/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import ProductView from "@/components/mockups/ProductView";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  return { title: product ? `${product.title} · Nova Edge` : "Product · Nova Edge" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <main className="container section">
      <p className="crumbs">
        <Link href="/shop">Shop</Link> / <Link href={`/shop?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
      </p>

      <ProductView product={product} />
    </main>
  );
}
