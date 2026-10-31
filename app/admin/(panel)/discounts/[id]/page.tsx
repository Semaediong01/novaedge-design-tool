// app/admin/(panel)/discounts/[id]/page.tsx — edit a discount code
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Discount } from "@/lib/types";
import DiscountForm from "../DiscountForm";
import ConfirmButton from "../ConfirmButton";
import { deleteDiscount } from "../actions";
import { isoToLagosInput } from "../lagos";
import "../discounts.css";

export const metadata = { title: "Edit discount code · Admin · Nova Edge" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditDiscount({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data }, { data: products }] = await Promise.all([
    supabase.from("discounts").select("*").eq("id", id).maybeSingle(),
    supabase.from("products").select("id, title, active").order("title"),
  ]);
  if (!data) notFound();
  const d = data as Discount;

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Edit <span className="dc-code">{d.code}</span></h1>
        </div>
      </div>

      <DiscountForm
        key={d.id}
        products={(products ?? []) as { id: string; title: string; active: boolean }[]}
        discount={{
          id: d.id,
          code: d.code,
          description: d.description,
          type: d.type,
          value: Number(d.value),
          min_order: Number(d.min_order),
          product_ids: d.product_ids,
          starts_at: isoToLagosInput(d.starts_at),
          ends_at: isoToLagosInput(d.ends_at),
          usage_limit: d.usage_limit,
          used_count: d.used_count,
          active: d.active,
        }}
      />

      <div className="ad-card dc-danger" style={{ maxWidth: 760 }}>
        <h2>Delete this code</h2>
        {d.used_count > 0 ? (
          <p className="muted">
            This code has been used {d.used_count} time{d.used_count === 1 ? "" : "s"}, so it can&apos;t be deleted (past orders refer to it). Untick &quot;Active&quot; above and save to stop customers using it.
          </p>
        ) : (
          <form action={deleteDiscount}>
            <input type="hidden" name="id" value={d.id} />
            <p className="muted">This code has never been used, so it can be removed completely.</p>
            <ConfirmButton className="btn btn-danger btn-sm" message={`Delete the code ${d.code}? This can't be undone.`}>Delete code</ConfirmButton>
          </form>
        )}
      </div>
    </>
  );
}
