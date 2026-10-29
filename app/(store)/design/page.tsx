// app/(store)/design/page.tsx — the designer. Needs an account (the proxy sends visitors to log in).
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProduct } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import { usesTeeMockup } from "@/lib/mockups";
import DesignCanvas from "./DesignCanvas";

export const metadata = { title: "Designer · Nova Edge" };

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; designId?: string; size?: string; color?: string }>;
}) {
  const { productId, designId, size, color } = await searchParams;
  const qs = new URLSearchParams();
  if (productId) qs.set("productId", productId);
  if (designId) qs.set("designId", designId);
  if (size) qs.set("size", size);
  if (color) qs.set("color", color);
  const user = await requireUser(`/design?${qs.toString()}`);

  if (!productId) {
    return (
      <main className="container section narrow">
        <h1>Pick something to design</h1>
        <p className="lede">Choose a piece first, then open the designer from its page.</p>
        <Link href="/shop?custom=1" className="btn btn-lg">Browse customizable pieces</Link>
      </main>
    );
  }

  const product = await getProduct(productId);
  const mockup = product ? usesTeeMockup(product) : false;
  if (!product || !product.customizable || (!mockup && !product.images[0])) notFound();

  let initialDesign = null;
  if (designId) {
    const supabase = await createClient();
    const { data: design } = await supabase
      .from("designs")
      .select("id, elements, print_url, locked, product_id")
      .eq("id", designId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (design?.locked) {
      return (
        <main className="container section narrow">
          <h1>This design is already ordered</h1>
          <p className="lede">Designs can&apos;t be changed after the order is placed. You can start a new one from the product page.</p>
          <Link href={`/product/${product.id}`} className="btn btn-lg">Back to the product</Link>
        </main>
      );
    }
    if (design && design.product_id === product.id) {
      initialDesign = { id: design.id as string, elements: design.elements as never[], printUrl: design.print_url as string | null };
    }
  }

  return (
    <DesignCanvas
      userId={user.id}
      product={{
        id: product.id,
        title: product.title,
        image: mockup ? null : product.images[0],
        mockup,
        price: product.price,
        sizes: product.sizes,
        colors: product.colors,
      }}
      initialDesign={initialDesign}
      initialSize={size && product.sizes.includes(size) ? size : (product.sizes[0] ?? "")}
      initialColor={color && product.colors.includes(color) ? color : (product.colors[0] ?? "")}
    />
  );
}
