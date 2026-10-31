// categories.ts — categories a template can belong to
import { getAllSections } from "@/lib/store-data";

/** Categories a template can belong to: the shop's sections plus T-Shirts. */
export async function templateCategories(): Promise<string[]> {
  const sections = await getAllSections();
  const names = sections.map((s) => s.name).filter(Boolean);
  return Array.from(new Set(["T-Shirts", ...names]));
}
