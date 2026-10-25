// app/(store)/page.tsx — home
import Link from "next/link";
import { getProducts } from "@/lib/products";
import ProductCard from "@/components/ProductCard";

export default async function HomePage() {
  const products = await getProducts({ limit: 8 });

  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1 className="hero-title">Wear the punchline.</h1>
            <p className="hero-sub">
              Tees and hoodies for people who live in group chats, load-shedding and stack traces. Buy a design we made, or make your own.
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

          <div className="hero-tee" aria-hidden>
            <div className="hero-tee-print">
              <span>Network</span>
              <span>no dey</span>
              <span className="hero-tee-small">but we dey</span>
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
          <h2>Your idea, on a tee, in three steps</h2>
          <ol className="steps">
            <li>
              <strong>Pick a piece.</strong> Choose a tee, hoodie or joggers in your size and color.
            </li>
            <li>
              <strong>Add your art.</strong> Drop in text, shapes or your own image and move it around on the garment.
            </li>
            <li>
              <strong>We print and ship.</strong> Your design is printed on demand and delivered to your door. Customizing costs nothing extra.
            </li>
          </ol>
          <Link href="/shop?custom=1" className="btn btn-lg btn-green">
            Start designing
          </Link>
        </div>
      </section>
    </main>
  );
}
