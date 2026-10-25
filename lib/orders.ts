// lib/orders.ts — server-only order settlement (service role)
import { createServiceClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";

/**
 * Confirms a payment with Paystack and, if it is genuine and matches the order total,
 * marks the order paid and locks every design on it. Safe to call more than once.
 */
export async function settleOrder(reference: string, expectedUserId?: string) {
  const db = createServiceClient();

  const { data: order } = await db
    .from("orders")
    .select("id, user_id, status, total")
    .eq("reference", reference)
    .maybeSingle();

  if (!order) return { ok: false as const, reason: "not-found" };
  if (expectedUserId && order.user_id !== expectedUserId) return { ok: false as const, reason: "not-found" };
  if (order.status !== "pending") return { ok: true as const, orderId: order.id };

  const tx = await verifyTransaction(reference);
  const paidInFull = tx && tx.status === "success" && tx.currency === "NGN" && tx.amount === Math.round(Number(order.total) * 100);
  if (!paidInFull) return { ok: false as const, reason: "unpaid" };

  await db
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("status", "pending");

  const { data: items } = await db.from("order_items").select("design_id").eq("order_id", order.id);
  const designIds = (items ?? []).map((i) => i.design_id).filter(Boolean) as string[];
  if (designIds.length) await db.from("designs").update({ locked: true }).in("id", designIds);

  return { ok: true as const, orderId: order.id };
}
