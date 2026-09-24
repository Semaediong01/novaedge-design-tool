// app/api/list-products/route.ts
import { getProducts } from "@/lib/shopify";

export async function GET() {
  const products = await getProducts();
  return Response.json(products.map((p: any) => ({ id: p.id, title: p.title })));
}