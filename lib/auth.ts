// lib/auth.ts — server-side session helpers
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(next = "/") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function isAdmin(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user) redirect("/admin/login");
  if (!(await isAdmin(user.id))) redirect("/admin/login?error=not-admin");
  return user;
}
