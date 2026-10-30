// app/admin/actions.ts — admin server actions. Every one re-checks that the caller is an admin.
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export type FormState = { error?: string };

export async function adminLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your admin email and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "That email and password don't match." };

  if (!(await isAdmin(data.user.id))) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have admin access." };
  }
  await logAction({ id: data.user.id, email: data.user.email }, "admin.login");
  redirect("/admin");
}

export async function adminLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
