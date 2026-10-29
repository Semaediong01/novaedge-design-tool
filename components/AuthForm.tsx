// components/AuthForm.tsx — customer email/password + Google sign in and sign up
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/format";

export default function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const router = useRouter();
  const target = safeNext(next, "/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;

  const handleGoogle = async () => {
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) setError(error.message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message === "Invalid login credentials" ? "That email and password don't match. Check both and try again." : error.message);
      } else {
        router.push(target);
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push(target);
        router.refresh();
      } else {
        setNotice("Check your inbox. We sent a link to confirm your email, then you can log in.");
      }
    }
    setBusy(false);
  };

  const isLogin = mode === "login";
  const otherHref = `${isLogin ? "/signup" : "/login"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="auth-card">
      <Link href="/" aria-label="Nova Edge Clothing, home">
        <Image className="auth-logo logo-light" src="/brand/novaedge-logo.png" alt="Nova Edge Clothing" width={696} height={431} />
        <Image className="auth-logo logo-dark" src="/brand/novaedge-logo-white.png" alt="Nova Edge Clothing" width={696} height={431} />
      </Link>
      <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>
      <p className="auth-sub">{isLogin ? "Log in to check out and track your orders." : "You need an account to place an order."}</p>

      <button type="button" className="btn btn-ghost btn-block" onClick={handleGoogle}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
          <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        Continue with Google
      </button>

      <div className="auth-divider">
        <span>or use your email</span>
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        <label className="field-group">
          <span className="panel-label">Email</span>
          <input className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field-group">
          <span className="panel-label">Password</span>
          <input
            className="field"
            type="password"
            required
            minLength={8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {!isLogin && <span className="form-note">At least 8 characters.</span>}
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}

        <button type="submit" className="btn btn-lg btn-block" disabled={busy}>
          {busy && <Loader2 size={18} className="spin" />} {isLogin ? "Log in" : "Create account"}
        </button>
      </form>

      <p className="auth-switch">
        {isLogin ? "New to Nova Edge?" : "Already have an account?"} <Link href={otherHref}>{isLogin ? "Create an account" : "Log in"}</Link>
      </p>
    </div>
  );
}
