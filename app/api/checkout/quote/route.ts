// app/api/checkout/quote/route.ts — the order summary shown at checkout: prices, discount code, delivery, total.
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { priceCart } from "@/lib/checkout";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const cookieStore = await cookies();
  const result = await priceCart(createServiceClient(), {
    items: body?.items,
    code: typeof body?.code === "string" ? body.code : null,
    state: typeof body?.state === "string" ? body.state : null,
    affiliateCode: cookieStore.get("ne_ref")?.value ?? null,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  return Response.json({
    lines: result.lines.map((l) => ({
      productId: l.productId,
      unitPrice: l.unitPrice,
      regularPrice: Number(l.product.price),
      quantity: l.quantity,
      lineTotal: l.lineTotal,
    })),
    subtotal: result.subtotal,
    discount: result.discount,
    discountError: result.discountError,
    delivery: result.delivery,
    total: result.total,
  });
}
