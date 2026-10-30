// app/admin/(panel)/products/new/page.tsx
import { requireAdmin } from "@/lib/auth";
import { getAllSections } from "@/lib/store-data";
import ProductForm from "../ProductForm";

export default async function NewProduct() {
  await requireAdmin();
  const sections = await getAllSections();
  return (
    <>
      <h1>Add product</h1>
      <ProductForm sections={sections} />
    </>
  );
}
