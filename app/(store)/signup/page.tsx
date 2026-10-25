// app/signup/page.tsx
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/format";

export const metadata = { title: "Create account · Nova Edge" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getUser()) redirect(safeNext(next, "/"));

  return (
    <main className="auth-page">
      <AuthForm mode="signup" next={next} />
    </main>
  );
}
