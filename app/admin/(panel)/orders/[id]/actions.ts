// app/admin/(panel)/orders/[id]/actions.ts — order changes. Payment is never marked paid by hand.
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { settleOrder } from "@/lib/orders";
import { FULFILLMENT_STATUSES, type FulfillmentStatus } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(id: string, key: "saved" | "error", value: string): never {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}?${key}=${value}`);
}

function orderId(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID_RE.test(id)) redirect("/admin/orders");
  return id;
}

async function loadOrder(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("id, reference, payment_status, fulfillment_status").eq("id", id).maybeSingle();
  if (!data) redirect("/admin/orders");
  return { supabase, order: data as { id: string; reference: string; payment_status: string; fulfillment_status: string } };
}

export async function setFulfillment(formData: FormData) {
  const user = await requireAdmin();
  const id = orderId(formData);
  const next = String(formData.get("status") ?? "");
  if (!(FULFILLMENT_STATUSES as readonly string[]).includes(next)) back(id, "error", "bad-status");

  const { supabase, order } = await loadOrder(id);
  if (order.fulfillment_status === next) back(id, "saved", "nochange");

  const paid = order.payment_status === "paid";
  const unpaid = order.payment_status === "pending" || order.payment_status === "failed";
  // Paid orders can move to any step. An unpaid order can only be cancelled. Refunded orders are closed.
  if (!(paid || (unpaid && next === "cancelled"))) back(id, "error", paid ? "bad-status" : "not-paid");

  const { data: changed } = await supabase
    .from("orders")
    .update({ fulfillment_status: next as FulfillmentStatus })
    .eq("id", id)
    .eq("payment_status", order.payment_status)
    .select("id");
  if (!changed || changed.length === 0) back(id, "error", "changed");

  await logAction(user, "order.fulfillment", "order", id, { reference: order.reference, from: order.fulfillment_status, to: next });
  back(id, "saved", "status");
}

export async function recheckPayment(formData: FormData) {
  const user = await requireAdmin();
  const id = orderId(formData);
  const { order } = await loadOrder(id);
  if (order.payment_status !== "pending") back(id, "error", "not-pending");

  let ok = false;
  try {
    const res = await settleOrder(order.reference);
    ok = res.ok;
  } catch {
    back(id, "error", "paystack");
  }
  await logAction(user, "order.recheck_payment", "order", id, { reference: order.reference, paid: ok });
  back(id, ok ? "saved" : "error", ok ? "paid" : "unpaid");
}

export async function markRefunded(formData: FormData) {
  const user = await requireAdmin();
  const id = orderId(formData);
  if (formData.get("confirm") !== "yes") back(id, "error", "confirm");

  const { supabase, order } = await loadOrder(id);
  if (order.payment_status !== "paid") back(id, "error", "not-refundable");

  const patch: { payment_status: string; fulfillment_status?: string } = { payment_status: "refunded" };
  if (order.fulfillment_status !== "delivered") patch.fulfillment_status = "cancelled";

  const { data: changed } = await supabase.from("orders").update(patch).eq("id", id).eq("payment_status", "paid").select("id");
  if (!changed || changed.length === 0) back(id, "error", "changed");

  await logAction(user, "order.refund", "order", id, { reference: order.reference, fulfillment_before: order.fulfillment_status, fulfillment_after: patch.fulfillment_status ?? order.fulfillment_status });
  back(id, "saved", "refunded");
}

export async function saveNote(formData: FormData) {
  const user = await requireAdmin();
  const id = orderId(formData);
  const note = String(formData.get("note") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 2000);

  const { supabase, order } = await loadOrder(id);
  const { error } = await supabase.from("orders").update({ admin_note: note }).eq("id", id);
  if (error) back(id, "error", "save");

  await logAction(user, "order.note", "order", id, { reference: order.reference, length: note.length });
  back(id, "saved", "note");
}
