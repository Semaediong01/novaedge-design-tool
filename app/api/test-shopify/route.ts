// app/api/test-shopify/route.ts
import { shopifyAdminRequest } from "@/lib/shopify";

export async function GET() {
  const data = await shopifyAdminRequest(`
    query {
      shop {
        name
      }
    }
  `);

  return Response.json(data);
}