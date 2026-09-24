import { findDesignByProduct } from "@/lib/shopify";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  if (!productId) return Response.json({ design: null });

  const metaobject = await findDesignByProduct(productId);
  if (!metaobject) return Response.json({ design: null });

  const jsonField = metaobject.fields.find((f: any) => f.key === "design_json");
  return Response.json({
    designId: metaobject.id,
    elements: jsonField ? JSON.parse(jsonField.value).elements : [],
  });
}