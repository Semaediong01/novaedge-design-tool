// app/products/page.tsx
import Link from "next/link";
import { getProducts } from "@/lib/shopify";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <>
      <header className="site-header">
        <Link href="/products" className="wordmark">
          NOVA<span>EDGE</span>
        </Link>
      </header>

      <main style={{ maxWidth: "1160px", margin: "0 auto", padding: "5rem 2rem 8rem" }}>
        <section style={{ marginBottom: "5rem", maxWidth: "620px" }}>
          <span className="badge" style={{ marginBottom: "1.5rem" }}>Made-to-order, printed on demand</span>
          <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", marginBottom: "1.25rem" }}>
            Wear the <span className="text-gradient">punchline.</span>
          </h1>
          <p style={{ fontSize: "1.15rem", color: "var(--text-muted)", maxWidth: "42ch" }}>
            Start with a Nova Edge tee, then make it yours — drop in your own
            text, graphics, or shapes before it goes to print.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {products.map((product: any) => (
            <Link
              key={product.id}
              href={`/design?productId=${encodeURIComponent(product.id)}`}
              className="glass"
              style={{
                display: "block",
                borderRadius: "16px",
                padding: "1.25rem",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
              }}
            >
              <div style={{ borderRadius: "10px", overflow: "hidden", marginBottom: "1.25rem", background: "var(--surface-solid)" }}>
                {product.featuredImage ? (
                  <img
                    src={product.featuredImage.url}
                    alt={product.featuredImage.altText || product.title}
                    style={{ width: "100%", display: "block" }}
                  />
                ) : (
                  <div style={{ aspectRatio: "1" }} />
                )}
              </div>
              <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>{product.title}</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                {product.variants.edges.length > 1
                  ? `${product.variants.edges.length} options available`
                  : "One design, made yours"}
              </p>
              <span style={{ color: "var(--accent-bright)", fontSize: "0.9rem", fontWeight: 500 }}>
                Customize this piece →
              </span>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}