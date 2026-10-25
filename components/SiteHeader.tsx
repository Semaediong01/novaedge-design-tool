// components/SiteHeader.tsx
import Link from "next/link";
import { Search } from "lucide-react";
import { getUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/types";
import CartLink from "./CartLink";

export default async function SiteHeader() {
  const user = await getUser();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="wordmark">
          NOVA<span>EDGE</span>
        </Link>

        <form action="/shop" className="header-search" role="search">
          <Search size={16} aria-hidden />
          <input type="search" name="q" placeholder="Search tees, hoodies, punchlines" aria-label="Search products" />
        </form>

        <div className="header-actions">
          {user ? (
            <>
              <Link href="/orders" className="header-link">
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
              <Link href="/login" className="header-link">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-sm">
                Sign up
              </Link>
            </>
          )}
          <CartLink />
        </div>
      </div>

      <nav className="category-nav" aria-label="Shop by category">
        <Link href="/shop">All</Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={`/shop?category=${encodeURIComponent(c)}`}>
            {c}
          </Link>
        ))}
        <Link href="/shop?custom=1" className="category-nav-accent">
          Design your own
        </Link>
      </nav>
    </header>
  );
}
