// app/admin/(panel)/products/[id]/page.tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAllSections } from "@/lib/store-data";
import { normalizeProduct } from "@/lib/products";
import { deleteProduct } from "../actions";
import ConfirmButton from "../ConfirmButton";
import ProductForm from "../ProductForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const sections = await getAllSections();

  return (
    <>
      <h1>Edit product</h1>
      <ProductForm product={normalizeProduct(data)} sections={sections} />
      <form action={deleteProduct} className="danger-zone">
        <input type="hidden" name="id" value={id} />
        <p className="muted">Deleting removes the product from the shop. If it already appears on an order, it is hidden instead so order history stays intact.</p>
        <ConfirmButton message="Delete this product?" className="btn btn-danger btn-sm">Delete product</ConfirmButton>
      </form>
    </>
  );
}
