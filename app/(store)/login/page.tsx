// app/login/page.tsx
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/format";

export const metadata = { title: "Log in · Nova Edge" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getUser()) redirect(safeNext(next, "/"));

  return (
    <main className="auth-page">
      {error && <p className="form-error auth-top-error">Google sign in did not finish. Try again or use your email.</p>}
      <AuthForm mode="login" next={next} />
    </main>
  );
}
