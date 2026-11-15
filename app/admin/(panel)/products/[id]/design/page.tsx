// app/admin/(panel)/products/[id]/design/page.tsx — change the design of a product made from a design
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLibrary } from "@/lib/library";
import { normalizeProduct } from "@/lib/products";
import { saveDesignedProduct } from "../../design-actions";
import DesignProductEditor from "../../DesignProductEditor";

export const metadata = { title: "Edit design · Admin · Nova Edge" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditDesignProduct({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = normalizeProduct(data);
  if (!p.preset) notFound();
  const library = await getLibrary();
  return (
    <DesignProductEditor
      key={p.id}
      userId={user.id}
      library={library}
      draft={{ id: p.id, title: p.title, description: p.description, price: p.price, colors: p.colors, customizable: p.customizable, elements: p.preset.elements, save: saveDesignedProduct }}
    />
  );
}
