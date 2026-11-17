// app/admin/(panel)/recommended/actions.ts — save which products are recommended on product pages
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { cleanRecommended } from "@/lib/recommended";

export async function saveRecommended(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const by_product: Record<string, string[]> = {};
  for (const key of new Set([...formData.keys()])) {
    if (key.startsWith("for_")) by_product[key.slice(4)] = formData.getAll(key).map(String);
  }
  const value = cleanRecommended({ default: formData.getAll("default").map(String), by_product });

  const { error } = await supabase.from("site_settings").upsert({ key: "recommended", value, updated_at: new Date().toISOString() });
  if (error) redirect(`/admin/recommended?error=${encodeURIComponent("Couldn't save. Try again.")}`);
  await logAction(user, "recommended.update", "site_settings", "recommended", { default: value.default.length, products: Object.keys(value.by_product).length });
  revalidatePath("/admin/recommended");
  revalidatePath("/product/[id]", "page");
  redirect("/admin/recommended?saved=1");
}
