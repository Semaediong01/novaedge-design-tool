// app/admin/(panel)/homepage/actions.ts — choose and order the products on the home page
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { normalizeProduct } from "@/lib/products";

export async function saveHomepage(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();

  // Re-read the products instead of trusting ids from the form.
  const { data, error: readError } = await supabase.from("products").select("*").eq("active", true);
  if (readError) redirect("/admin/homepage?error=" + encodeURIComponent("Couldn't load the products. Try again."));
  const products = (data ?? []).map((r) => normalizeProduct(r));

  const updates: { id: string; featured: boolean; sort_order: number }[] = [];
  for (const p of products) {
    const featured = formData.get(`show_${p.id}`) === "on";
    const raw = String(formData.get(`pos_${p.id}`) ?? "").trim();
    let order = p.sort_order;
    if (raw !== "") {
      const n = Number(raw);
      if (!Number.isInteger(n) || Math.abs(n) > 100_000) {
        redirect("/admin/homepage?error=" + encodeURIComponent(`The position for ${p.title} must be a whole number, like 1, 2 or 3.`));
      }
      order = n;
    }
    if (featured !== p.featured || order !== p.sort_order) updates.push({ id: p.id, featured, sort_order: order });
  }

  for (const u of updates) {
    const { error } = await supabase.from("products").update({ featured: u.featured, sort_order: u.sort_order }).eq("id", u.id);
    if (error) redirect("/admin/homepage?error=" + encodeURIComponent("Couldn't save every change. Try again."));
  }

  await logAction(user, "homepage.update", "product", undefined, {
    changed: updates.length,
    featured: products.filter((p) => (updates.find((u) => u.id === p.id)?.featured ?? p.featured)).map((p) => p.title),
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin/homepage");
  redirect("/admin/homepage?saved=1");
}
