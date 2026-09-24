// app/design/page.tsx
import Link from "next/link";
import { getProduct } from "@/lib/shopify";
import DesignCanvas from "./DesignCanvas";

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const { productId } = await searchParams;

  if (!productId) {
    return <p style={{ padding: "2rem" }}>No product selected.</p>;
  }

  const product = await getProduct(decodeURIComponent(productId));

  return (
    <>
      <header className="site-header">
        <Link href="/products" className="wordmark">
          NOVA<span>EDGE</span>
        </Link>
        <Link href="/products" className="header-link">← All products</Link>
      </header>

      <DesignCanvas garmentImageUrl={product.featuredImage.url} productId={product.id} productTitle={product.title} />
    </>
  );
}