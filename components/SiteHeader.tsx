// components/SiteHeader.tsx
import Link from "next/link";
import { Search } from "lucide-react";
import { getUser } from "@/lib/auth";
import CartLink from "./CartLink";
import BrandLogo from "./BrandLogo";
import ThemeToggle from "./ThemeToggle";
import { getShopSections } from "@/lib/categories";

export default async function SiteHeader() {
  const user = await getUser();
  const sections = await getShopSections();

  return (
    <>
    <div className="announce">
      <span>Customizing costs nothing extra</span>
      <span>Printed on demand</span>
      <span>Secure payment with Paystack</span>
    </div>
    <header className="site-header">
      <div className="header-inner">
        <BrandLogo />

        <form action="/shop" className="header-search" role="search">
          <Search size={16} aria-hidden />
          <input type="search" name="q" placeholder="Search products" aria-label="Search products" />
        </form>

        <div className="header-actions">
          {user ? (
            <>
              <Link href="/orders" className="header-link header-orders">
                My orders
              </Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="header-link header-link-btn">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="header-link header-login">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-sm">
                Sign up
              </Link>
            </>
          )}
          <ThemeToggle />
          <CartLink />
        </div>
      </div>

      <nav className="category-nav" aria-label="Shop by category">
        <Link href="/shop">All</Link>
        {sections.map((s) => (
          <Link key={s.name} href={`/shop?category=${encodeURIComponent(s.name)}`}>
            {s.name}
            {s.soon && <span className="soon-tag">Soon</span>}
          </Link>
        ))}
        <Link href="/shop?custom=1" className="category-nav-accent">
          Design your own
        </Link>
      </nav>
    </header>
    </>
  );
}
