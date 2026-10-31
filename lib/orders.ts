// lib/orders.ts — server-only order settlement (service role)
import { createServiceClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";

/**
 * Confirms a payment with Paystack and, if it is genuine and matches the order total,
 * marks the order paid, counts the discount code use and locks every design on it.
 * Safe to call more than once (the return page and the webhook both call it).
 */
export async function settleOrder(reference: string, expectedUserId?: string) {
  const db = createServiceClient();

  const { data: order } = await db
    .from("orders")
    .select("id, user_id, payment_status, total, discount_code")
    .eq("reference", reference)
    .maybeSingle();

  if (!order) return { ok: false as const, reason: "not-found" };
  if (expectedUserId && order.user_id !== expectedUserId) return { ok: false as const, reason: "not-found" };
  if (order.payment_status === "paid") return { ok: true as const, orderId: order.id };
  if (order.payment_status !== "pending") return { ok: false as const, reason: "unpaid" };

  // Never trust the browser: ask Paystack, and require the exact amount in naira.
  const tx = await verifyTransaction(reference);
  const paidInFull =
    tx && tx.status === "success" && tx.currency === "NGN" && tx.reference === reference && tx.amount === Math.round(Number(order.total) * 100);
  if (!paidInFull) return { ok: false as const, reason: "unpaid" };

  // Only the call that flips pending -> paid does the follow-up work, so nothing is counted twice.
  const { data: flipped } = await db
    .from("orders")
    .update({ payment_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("payment_status", "pending")
    .select("id");

  if (flipped && flipped.length > 0) {
    const { data: items } = await db.from("order_items").select("design_id").eq("order_id", order.id);
    const designIds = (items ?? []).map((i) => i.design_id).filter(Boolean) as string[];
    const notes: string[] = [];
    if (designIds.length) {
      const { error } = await db.from("designs").update({ locked: true }).in("id", designIds);
      if (error) notes.push("Could not lock the designs automatically.");
    }
    if (order.discount_code) {
      const { data: counted, error } = await db.rpc("bump_discount_use", { p_code: order.discount_code });
      if (error) notes.push(`Could not count the use of code ${order.discount_code}.`);
      else if (counted === false) notes.push(`Code ${order.discount_code} was over its limit or no longer active when this order was paid.`);
    }
    // Anything that needs a human look is written on the order so the admin sees it.
    if (notes.length) await db.from("orders").update({ admin_note: notes.join(" ") }).eq("id", order.id);
  }

  return { ok: true as const, orderId: order.id };
}
