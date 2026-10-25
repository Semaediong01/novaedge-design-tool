// app/admin/(panel)/layout.tsx — everything inside needs an admin account
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { adminLogout } from "../actions";

export const metadata = { title: "Admin · Nova Edge" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link href="/admin" className="wordmark">
          NOVA<span>EDGE</span>
        </Link>
        <p className="admin-badge">Admin</p>
        <nav className="admin-nav">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/products">Products</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/" target="_blank">View store</Link>
        </nav>
        <div className="admin-user">
          <span className="muted">{user.email}</span>
          <form action={adminLogout}>
            <button type="submit" className="text-link text-link-btn">Log out</button>
          </form>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
