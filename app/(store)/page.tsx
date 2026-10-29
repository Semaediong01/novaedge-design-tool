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
            <p className="eyebrow">Tech humor · Naija wit</p>
            <h1 className="hero-title">
              Wear the <em>punchline.</em>
            </h1>
            <p className="hero-sub">
              Tees and caps for people who live in group chats, load-shedding and stack traces. Buy a design we made, or make your own.
            </p>
            <div className="hero-cta">
              <Link href="/shop" className="btn btn-lg">
                Shop the drop
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
                <span>Network</span>
                <span>no dey</span>
                <span className="hero-tee-small">but we dey</span>
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
              <strong>Ready-made or custom</strong>
              <span>Shop our designs or make your own</span>
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
          <h2>Fresh off the press</h2>
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
          <p className="empty-state">New designs are on the way. Check back soon.</p>
        )}
      </section>

      <section className="steps-band">
        <div className="container">
          <p className="eyebrow">Design your own</p>
          <h2>Your idea, on a tee, in three steps</h2>
          <ol className="steps">
            <li>
              <strong>Pick a piece.</strong> Choose a tee or cap in your size and color.
            </li>
            <li>
              <strong>Add your art.</strong> Drop in text, shapes or your own image and move it around on the garment.
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
