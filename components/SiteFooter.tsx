// components/SiteFooter.tsx
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link href="/" className="wordmark">
            NOVA<span>EDGE</span>
          </Link>
          <p className="footer-note">Tech humor and Naija wit, printed on demand and shipped to you.</p>
        </div>
        <div>
          <h3>Shop</h3>
          <Link href="/shop">All products</Link>
          <Link href="/shop?category=T-Shirts">T-shirts</Link>
          <Link href="/shop?category=Hoodies">Hoodies</Link>
          <Link href="/shop?custom=1">Design your own</Link>
        </div>
        <div>
          <h3>Account</h3>
          <Link href="/login">Log in</Link>
          <Link href="/signup">Create account</Link>
          <Link href="/orders">My orders</Link>
        </div>
      </div>
      <p className="container footer-fine">© {new Date().getFullYear()} Nova Edge. Payments by Paystack.</p>
    </footer>
  );
}
