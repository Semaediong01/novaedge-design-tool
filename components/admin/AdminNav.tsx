// components/admin/AdminNav.tsx — sidebar links with the current page highlighted
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Sell",
    links: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/customers", label: "Customers" },
    ],
  },
  {
    label: "Catalog",
    links: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/sections", label: "Sections" },
      { href: "/admin/homepage", label: "Home page" },
      { href: "/admin/templates", label: "Design templates" },
    ],
  },
  {
    label: "Money",
    links: [
      { href: "/admin/discounts", label: "Discount codes" },
      { href: "/admin/affiliates", label: "Affiliates" },
      { href: "/admin/delivery", label: "Delivery" },
      { href: "/admin/reports", label: "Reports" },
    ],
  },
  {
    label: "Store",
    links: [
      { href: "/admin/content", label: "Store content" },
      { href: "/admin/team", label: "Team and activity" },
    ],
  },
];

export default function AdminNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  return (
    <nav className="admin-nav ad-nav" aria-label="Admin">
      {GROUPS.map((g) => (
        <div key={g.label} className="ad-nav-group">
          <p className="ad-nav-label">{g.label}</p>
          {g.links.map((l) => (
            <Link key={l.href} href={l.href} className={active(l.href) ? "active" : undefined} aria-current={active(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </div>
      ))}
      <div className="ad-nav-group">
        <Link href="/" target="_blank">View store ↗</Link>
      </div>
    </nav>
  );
}
