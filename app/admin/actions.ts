// app/admin/actions.ts — admin server actions. Every one re-checks that the caller is an admin.
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, requireAdmin } from "@/lib/auth";
import { CATEGORIES, ORDER_STATUSES, type OrderStatus } from "@/lib/types";

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
  redirect("/admin");
}

export async function adminLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function readProduct(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const price = Number(formData.get("price"));
  const category = String(formData.get("category") ?? "");
  const images = String(formData.get("images") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

  if (!title) return { error: "Give the product a name." };
  if (!Number.isFinite(price) || price < 0) return { error: "Enter a price in naira, like 19850." };
  if (!(CATEGORIES as readonly string[]).includes(category)) return { error: "Choose a category." };

  return {
    values: {
      title,
      description: String(formData.get("description") ?? "").trim(),
      category,
      price,
      images,
      sizes: list(formData.get("sizes")),
      colors: list(formData.get("colors")),
      customizable: formData.get("customizable") === "on",
      in_stock: formData.get("in_stock") === "on",
      active: formData.get("active") === "on",
    },
  };
}

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = readProduct(formData);
  if ("error" in parsed) return { error: parsed.error };
  // T-shirts without a photo use the built-in realistic mockups, so only other products need a photo.
  if (parsed.values.customizable && parsed.values.images.length === 0 && parsed.values.category !== "T-Shirts") {
    return { error: "Add at least one photo. Customizable products use the first photo in the designer." };
  }

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("products").update(parsed.values).eq("id", id)
    : await supabase.from("products").insert(parsed.values);

  if (error) return { error: "Couldn't save the product. " + error.message };
  revalidatePath("/", "layout");
  redirect("/admin/products");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  // Products that already appear on orders are hidden instead of deleted, so order history stays intact.
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) await supabase.from("products").update({ active: false }).eq("id", id);
  revalidatePath("/", "layout");
  redirect("/admin/products");
}

export async function setOrderStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return;
  const supabase = await createClient();
  await supabase.from("orders").update({ status }).eq("id", id);
  revalidatePath("/admin/orders");
}
