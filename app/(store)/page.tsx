// app/(store)/page.tsx — home
import Image from "next/image";
import Link from "next/link";
import { Palette, Shirt, ShieldCheck } from "lucide-react";
import { getProducts } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import TerminalLine from "@/components/TerminalLine";

export default async function HomePage() {
  const products = await getProducts({ limit: 8 });

  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow eyebrow-tech">Nova Edge Clothing</p>
            <h1 className="hero-title">
              Made to wear. <em>Made yours.</em>
            </h1>
            <p className="hero-sub">
              Premium everyday pieces, made to be yours. Start clean, add your own design, and we deliver it to your door.
            </p>
            <TerminalLine />
            <div className="hero-cta">
              <Link href="/shop" className="btn btn-lg">
                Shop now
              </Link>
              <Link href="/shop?custom=1" className="btn btn-lg btn-ghost">
                Design your own
              </Link>
            </div>
          </div>

          <div className="hero-stage" aria-hidden>
            <span className="hud hud-tl">NE // 001</span>
            <span className="hud hud-tr">FRONT</span>
            <span className="hud hud-bl">PRINT AREA 220 × 300</span>
            <span className="hud hud-br">● LIVE PREVIEW</span>
            <span className="hero-scan" />
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
          <h2>Shop the collection</h2>
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
          <p className="empty-state">New pieces are on the way. Check back soon.</p>
        )}
      </section>

      <section className="steps-band">
        <div className="container">
          <p className="eyebrow">Design your own</p>
          <h2>Your idea, on your clothes, in three steps</h2>
          <ol className="steps">
            <li>
              <strong>Pick your piece.</strong> Choose your style, color and size.
            </li>
            <li>
              <strong>Make it yours.</strong> Keep the Nova Edge symbol, resize it, or remove it. Add text, shapes or your own image.
            </li>
            <li>
              <strong>We deliver it.</strong> We make your piece and bring it to your door. Customizing costs nothing extra.
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
