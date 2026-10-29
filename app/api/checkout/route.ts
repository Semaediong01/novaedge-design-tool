// app/api/checkout/route.ts — builds the order from trusted data and starts the Paystack payment
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { initializeTransaction } from "@/lib/paystack";
import { productImage } from "@/lib/mockups";

type Item = { productId: string; size: string; color: string; quantity: number; designId: string | null };

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return Response.json({ error: "Log in to check out." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items: Item[] = Array.isArray(body?.items) ? body.items.slice(0, 30) : [];
  const shipping = {
    name: text(body?.shipping?.name),
    phone: text(body?.shipping?.phone, 30),
    address: text(body?.shipping?.address),
    city: text(body?.shipping?.city),
    state: text(body?.shipping?.state),
  };

  if (items.length === 0) return Response.json({ error: "Your cart is empty." }, { status: 400 });
  if (Object.values(shipping).some((v) => !v)) return Response.json({ error: "Fill in every delivery field." }, { status: 400 });

  const db = createServiceClient();

  // Prices always come from the database, never from the browser.
  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data: products } = await db.from("products").select("*").in("id", productIds).eq("active", true);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const designIds = items.map((i) => i.designId).filter(Boolean) as string[];
  const { data: designs } = designIds.length
    ? await db.from("designs").select("id, user_id, product_id, print_url, locked").in("id", designIds)
    : { data: [] as { id: string; user_id: string; product_id: string; print_url: string | null; locked: boolean }[] };
  const designById = new Map((designs ?? []).map((d) => [d.id, d]));

  const rows = [];
  let total = 0;

  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product || !product.in_stock) {
      return Response.json({ error: "An item in your cart is no longer available. Remove it and try again." }, { status: 400 });
    }
    const quantity = Math.max(1, Math.min(Math.floor(Number(item.quantity) || 1), 20));

    let design = null;
    if (item.designId) {
      design = designById.get(item.designId) ?? null;
      if (!design || design.user_id !== user.id || design.product_id !== product.id || design.locked || !design.print_url) {
        return Response.json({ error: "One of your designs can't be used. Open it in the designer and save it again." }, { status: 400 });
      }
    }

    total += Number(product.price) * (design ? 1 : quantity);
    rows.push({
      product_id: product.id,
      title: product.title,
      image: productImage(product, text(item.color, 40)) ?? null,
      size: text(item.size, 20) || null,
      color: text(item.color, 40) || null,
      quantity: design ? 1 : quantity,
      unit_price: product.price,
      design_id: design?.id ?? null,
      print_url: design?.print_url ?? null,
    });
  }

  const reference = `NE-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  const { data: order, error } = await db
    .from("orders")
    .insert({ user_id: user.id, email: user.email, reference, total, shipping })
    .select("id")
    .single();
  if (error || !order) return Response.json({ error: "We couldn't create your order. Try again." }, { status: 500 });

  const { error: itemsError } = await db.from("order_items").insert(rows.map((r) => ({ ...r, order_id: order.id })));
  if (itemsError) {
    await db.from("orders").delete().eq("id", order.id);
    return Response.json({ error: "We couldn't save your order items. Try again." }, { status: 500 });
  }

  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const tx = await initializeTransaction({
      email: user.email,
      amountNaira: total,
      reference,
      callbackUrl: `${origin}/checkout/verify`,
    });
    return Response.json({ url: tx.authorization_url });
  } catch (err) {
    await db.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return Response.json({ error: err instanceof Error ? err.message : "Payment could not start." }, { status: 502 });
  }
}
