// components/SiteFooter.tsx
import Image from "next/image";
import Link from "next/link";

import { getShopSections } from "@/lib/categories";
import { getSiteContent } from "@/lib/store-data";

export default async function SiteFooter() {
  const [sections, content] = await Promise.all([getShopSections(), getSiteContent()]);
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link href="/" aria-label="Nova Edge Clothing, home">
            <Image className="footer-logo" src="/brand/novaedge-logo-white.png" alt="Nova Edge Clothing" width={696} height={431} />
          </Link>
          <p className="footer-note">{content.footer_tagline}</p>
          {(content.contact_email || content.contact_phone || content.instagram) && (
            <p className="footer-note">
              {content.contact_email && <a href={`mailto:${content.contact_email}`}>{content.contact_email}</a>}
              {content.contact_phone && <><br /><a href={`tel:${content.contact_phone}`}>{content.contact_phone}</a></>}
              {content.instagram && <><br />{content.instagram}</>}
            </p>
          )}
        </div>
        <div>
          <h3>Shop</h3>
          <Link href="/shop">All products</Link>
          {sections.map((s) => (
            <Link key={s.name} href={`/shop?category=${encodeURIComponent(s.name)}`}>
              {s.name}
              {s.soon && <span className="soon-tag">Soon</span>}
            </Link>
          ))}
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
