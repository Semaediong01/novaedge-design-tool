// app/admin/login/page.tsx — separate from the customer login
import AdminLoginForm from "./AdminLoginForm";

export const metadata = { title: "Admin login · Nova Edge" };

export default function AdminLoginPage() {
  return (
    <main className="auth-page">
      <AdminLoginForm />
    </main>
  );
}
