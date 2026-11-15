// lib/library.ts — artwork the store owner uploads for customers to drop into the designer
import { createClient } from "@/lib/supabase/server";

export type LibraryItem = { id: string; title: string; image_url: string; category: string; active: boolean; sort_order: number };

// Never throws: if the table isn't there yet (SQL not run) or the query fails, the library is simply empty.
export async function getLibrary(opts?: { all?: boolean }): Promise<LibraryItem[]> {
  try {
    const supabase = await createClient();
    let q = supabase.from("design_library").select("id, title, image_url, category, active, sort_order");
    if (!opts?.all) q = q.eq("active", true);
    const { data, error } = await q.order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as LibraryItem[];
  } catch {
    return [];
  }
}
