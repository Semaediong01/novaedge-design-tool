"use server";
// app/admin/(panel)/team/actions.ts — add and remove admins (owners only)
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

const back = (qs: string): never => redirect(`/admin/team?${qs}`);
const fail = (msg: string): never => back(`error=${encodeURIComponent(msg)}`);

/** The caller must be an owner, judged from their own admins row (never from form data). */
async function requireOwner() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("admins").select("role").eq("user_id", user.id).maybeSingle();
  if (data?.role !== "owner") fail("Only an owner can add or remove admins.");
  return user;
}

type AuthUser = { id: string; email?: string };

async function findAuthUser(email: string): Promise<AuthUser | null> {
  const service = createServiceClient();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) fail("Could not look up users. Try again.");
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (users.length < perPage) break;
  }
  return null;
}

export async function addAdmin(formData: FormData) {
  const user = await requireOwner();
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address.");

  const target = await findAuthUser(email);
  if (!target) {
    fail("No account uses that email. Create the user first in Supabase, under Authentication, Users, Add user (or ask them to sign up on the store), then add them here.");
  }
  const t = target as AuthUser;

  const service = createServiceClient();
  const { data: existing } = await service.from("admins").select("user_id").eq("user_id", t.id).maybeSingle();
  if (existing) fail("That person is already an admin.");

  const { error } = await service.from("admins").insert({ user_id: t.id, email: t.email?.toLowerCase() ?? email, role: "admin" });
  if (error) fail("Could not add the admin. Try again.");

  await logAction(user, "admin.add", "admin", t.id, { email });
  revalidatePath("/admin/team");
  back("saved=added");
}

export async function removeAdmin(formData: FormData) {
  const user = await requireOwner();
  const targetId = String(formData.get("user_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) fail("That admin was not found.");
  if (targetId === user.id) fail("You cannot remove yourself.");

  const service = createServiceClient();
  const { data: target } = await service.from("admins").select("user_id, email, role").eq("user_id", targetId).maybeSingle();
  if (!target) fail("That admin was not found.");

  if (target!.role === "owner") {
    const { count } = await service.from("admins").select("user_id", { count: "exact", head: true }).eq("role", "owner");
    if ((count ?? 0) <= 1) fail("You cannot remove the last owner.");
  }

  const { error } = await service.from("admins").delete().eq("user_id", targetId);
  if (error) fail("Could not remove the admin. Try again.");

  await logAction(user, "admin.remove", "admin", targetId, { email: target!.email, role: target!.role });
  revalidatePath("/admin/team");
  back("saved=removed");
}
