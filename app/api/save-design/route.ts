import { saveDesign } from "@/lib/shopify";

export async function POST(req: Request) {
  const { designId, productId, elements } = await req.json();
  const result = await saveDesign(designId ?? null, productId, { elements });
  return Response.json(result);
}