// app/(store)/product/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import { getTemplates } from "@/lib/store-data";
import { createClient } from "@/lib/supabase/server";
import { loadBundleRules } from "@/lib/bundles";
import { naira } from "@/lib/format";
import ProductView from "@/components/mockups/ProductView";
import RecommendedProducts from "@/components/RecommendedProducts";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  return { title: product ? `${product.title} · Nova Edge` : "Product · Nova Edge" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const templates = product.customizable && product.in_stock ? await getTemplates(product.category) : [];

  // "Buy X, get this cheaper" offers that apply to this product.
  const supabase = await createClient();
  const offers = (await loadBundleRules(supabase)).filter((r) => r.target_product_id === product.id);
  const triggers = offers.length
    ? (await supabase.from("products").select("id, title").in("id", offers.map((o) => o.trigger_product_id))).data ?? []
    : [];

  return (
    <main className="container section">
      <p className="crumbs">
        <Link href="/shop">Shop</Link> / <Link href={`/shop?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
      </p>

      <ProductView product={product} />

      {offers.map((o) => {
        const t = triggers.find((x) => x.id === o.trigger_product_id);
        if (!t) return null;
        return (
          <p key={o.id} className="pdp-offer">
            <strong>{o.label || "Bundle offer"}:</strong> buy <Link href={`/product/${t.id}`} className="text-link">{t.title}</Link> and get this {o.type === "percent" ? `${o.value}% off` : `${naira(o.value)} off`}. Applied at checkout.
          </p>
        );
      })}

      {templates.length > 0 && (
        <Link href={`/design?productId=${product.id}`} className="text-link pdp-template-link">
          Start from a template ({templates.length} available)
        </Link>
      )}

      <RecommendedProducts product={product} />
    </main>
  );
}
