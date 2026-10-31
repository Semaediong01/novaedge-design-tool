// app/admin/(panel)/layout.tsx — everything inside needs an admin account
import { requireAdmin } from "@/lib/auth";
import { adminLogout } from "../actions";
import AdminNav from "@/components/admin/AdminNav";
import BrandLogo from "@/components/BrandLogo";
import "../admin.css";

export const metadata = { title: "Admin · Nova Edge", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="ad-brand">
          <BrandLogo />
        </div>
        <p className="admin-badge">Admin</p>
        <AdminNav />
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
