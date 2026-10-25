// app/admin/(panel)/products/[id]/page.tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteProduct } from "../../../actions";
import ProductForm from "../ProductForm";
import type { Product } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <>
      <h1>Edit product</h1>
      <ProductForm product={data as Product} />
      <form action={deleteProduct} className="danger-zone">
        <input type="hidden" name="id" value={id} />
        <p className="muted">Deleting removes the product from the shop. If it already appears on an order, it is hidden instead so order history stays intact.</p>
        <button type="submit" className="btn btn-danger btn-sm">Delete product</button>
      </form>
    </>
  );
}
