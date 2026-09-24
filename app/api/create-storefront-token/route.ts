import { createStorefrontToken } from "@/lib/shopify";

export async function GET() {
  const result = await createStorefrontToken();
  return Response.json(result);
}