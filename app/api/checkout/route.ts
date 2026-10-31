// app/api/checkout/route.ts — builds the order from trusted data and starts the Paystack payment
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { initializeTransaction } from "@/lib/paystack";
import { priceCart } from "@/lib/checkout";
import { NIGERIAN_STATES } from "@/lib/nigeria";

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return Response.json({ error: "Log in to check out." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const shipping = {
    name: text(body?.shipping?.name),
    phone: text(body?.shipping?.phone, 30),
    address: text(body?.shipping?.address),
    city: text(body?.shipping?.city),
    state: text(body?.shipping?.state),
  };
  if (Object.values(shipping).some((v) => !v)) return Response.json({ error: "Fill in every delivery field." }, { status: 400 });
  if (!(NIGERIAN_STATES as readonly string[]).includes(shipping.state)) return Response.json({ error: "Choose your state." }, { status: 400 });

  const db = createServiceClient();
  const cookieStore = await cookies();
  const priced = await priceCart(db, {
    items: body?.items,
    code: typeof body?.code === "string" ? body.code : null,
    state: shipping.state,
    affiliateCode: cookieStore.get("ne_ref")?.value ?? null,
    user: { id: user.id, email: user.email },
  });
  if (!priced.ok) return Response.json({ error: priced.error }, { status: 400 });
  // A code the customer typed that doesn't work stops the payment, so nobody pays full price by surprise.
  if (priced.discountError) return Response.json({ error: priced.discountError }, { status: 400 });
  if (priced.total < 100) return Response.json({ error: "This order total is too low to pay online. Please contact us." }, { status: 400 });

  const reference = `NE-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  const { data: order, error } = await db
    .from("orders")
    .insert({
      user_id: user.id,
      email: user.email,
      reference,
      total: priced.total,
      subtotal: priced.subtotal,
      discount_code: priced.discount?.code ?? null,
      discount_amount: priced.discount?.amount ?? 0,
      delivery_fee: priced.delivery.fee,
      delivery_zone: priced.delivery.zone,
      affiliate_id: priced.affiliate?.id ?? null,
      affiliate_code: priced.affiliate?.code ?? null,
      affiliate_commission: priced.commission,
      shipping,
    })
    .select("id")
    .single();
  if (error || !order) return Response.json({ error: "We couldn't create your order. Try again." }, { status: 500 });

  // Each item keeps its own copy of the artwork, so the order is complete even if the design is changed later.
  const { error: itemsError } = await db.from("order_items").insert(
    priced.lines.map((l) => ({
      order_id: order.id,
      product_id: l.product.id,
      title: l.title,
      image: l.image,
      size: l.size,
      color: l.color,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      design_id: l.designId,
      print_url: l.printUrl,
      production_url: l.productionUrl,
      design_elements: l.designElements,
      discount_share: l.discountShare,
      commission: l.commission,
    }))
  );
  if (itemsError) {
    await db.from("orders").delete().eq("id", order.id);
    return Response.json({ error: "We couldn't save your order items. Try again." }, { status: 500 });
  }

  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const tx = await initializeTransaction({
      email: user.email,
      amountNaira: priced.total,
      reference,
      callbackUrl: `${origin}/checkout/verify`,
    });
    return Response.json({ url: tx.authorization_url });
  } catch (err) {
    await db.from("orders").update({ payment_status: "failed", fulfillment_status: "cancelled" }).eq("id", order.id);
    return Response.json({ error: err instanceof Error ? err.message : "Payment could not start." }, { status: 502 });
  }
}
