// app/admin/(panel)/print-sizes/actions.ts — save the print width for each garment size
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { DEFAULT_PRINT_WIDTHS } from "@/lib/print-sizes";

export async function savePrintSizes(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const labels = formData.getAll("label").map((v) => String(v).trim().slice(0, 12));
  const widths = formData.getAll("width").map((v) => Number(v));
  const out: Record<string, number> = {};
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const w = widths[i];
    if (!label) continue; // a blank row is simply not saved
    if (!Number.isFinite(w) || w < 5 || w > 60) redirect(`/admin/print-sizes?error=${encodeURIComponent(`${label}: enter a width between 5 and 60 cm.`)}`);
    if (Object.keys(out).some((k) => k.toLowerCase() === label.toLowerCase())) redirect(`/admin/print-sizes?error=${encodeURIComponent(`${label} appears twice.`)}`);
    out[label] = Math.round(w * 10) / 10;
  }
  if (Object.keys(out).length === 0) redirect(`/admin/print-sizes?error=${encodeURIComponent("Add at least one size.")}`);

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "print_sizes", value: { widths_cm: out }, updated_at: new Date().toISOString() });
  if (error) redirect(`/admin/print-sizes?error=${encodeURIComponent("Couldn't save. Try again.")}`);

  await logAction(user, "print_sizes.update", "site_settings", "print_sizes", { widths_cm: out });
  revalidatePath("/admin/print-sizes");
  revalidatePath("/admin/orders", "layout");
  redirect("/admin/print-sizes?saved=1");
}

export async function resetPrintSizes() {
  const user = await requireAdmin();
  const supabase = await createClient();
  await supabase.from("site_settings").upsert({ key: "print_sizes", value: { widths_cm: DEFAULT_PRINT_WIDTHS }, updated_at: new Date().toISOString() });
  await logAction(user, "print_sizes.reset", "site_settings", "print_sizes");
  revalidatePath("/admin/print-sizes");
  redirect("/admin/print-sizes?saved=1");
}
