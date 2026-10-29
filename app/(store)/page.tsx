// app/(store)/page.tsx — home
import Image from "next/image";
import Link from "next/link";
import { Palette, Shirt, ShieldCheck } from "lucide-react";
import { getProducts } from "@/lib/products";
import ProductCard from "@/components/ProductCard";

export default async function HomePage() {
  const products = await getProducts({ limit: 8 });

  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Nova Edge Clothing</p>
            <h1 className="hero-title">
              Plain tees. <em>Made yours.</em>
            </h1>
            <p className="hero-sub">
              Premium tees in white, black and ash, with the Nova Edge symbol or without it. Keep it clean, or add your own design and we print it on demand.
            </p>
            <div className="hero-cta">
              <Link href="/shop" className="btn btn-lg">
                Shop tees
              </Link>
              <Link href="/shop?custom=1" className="btn btn-lg btn-ghost">
                Design your own
              </Link>
            </div>
          </div>

          <div className="hero-stage" aria-hidden>
            <Image className="hero-mark" src="/brand/ne-monogram-white.png" alt="" width={389} height={328} />
            <div className="hero-tee">
              <div className="hero-tee-print">
                <Image className="hero-tee-symbol" src="/brand/ne-monogram-white.png" alt="" width={389} height={328} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="value-strip" aria-label="Why Nova Edge">
        <div className="container value-grid">
          <div className="value-item">
            <Shirt size={26} aria-hidden />
            <div>
              <strong>Plain or personalized</strong>
              <span>Wear it clean, or add your own design</span>
            </div>
          </div>
          <div className="value-item">
            <Palette size={26} aria-hidden />
            <div>
              <strong>Customizing is free</strong>
              <span>No surcharge for your own design</span>
            </div>
          </div>
          <div className="value-item">
            <ShieldCheck size={26} aria-hidden />
            <div>
              <strong>Secure checkout</strong>
              <span>Pay safely with Paystack</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>The tees</h2>
          <Link href="/shop" className="text-link">
            See everything
          </Link>
        </div>
        {products.length > 0 ? (
          <div className="grid-products">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="empty-state">Our tees are on the way. Check back soon.</p>
        )}
      </section>

      <section className="steps-band">
        <div className="container">
          <p className="eyebrow">Design your own</p>
          <h2>Your idea, on a tee, in three steps</h2>
          <ol className="steps">
            <li>
              <strong>Pick your tee.</strong> Choose white, black or ash in your size.
            </li>
            <li>
              <strong>Make it yours.</strong> Keep the Nova Edge symbol, move it, or remove it. Add text, shapes or your own image.
            </li>
            <li>
              <strong>We print and ship.</strong> Your design is printed on demand and delivered to your door. Customizing costs nothing extra.
            </li>
          </ol>
          <Link href="/shop?custom=1" className="btn btn-lg btn-light">
            Start designing
          </Link>
        </div>
      </section>
    </main>
  );
}
