// app/admin/(panel)/bundles/page.tsx — "buy this, get that cheaper" offers
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { loadBundleRules } from "@/lib/bundles";
import { normalizeProduct } from "@/lib/products";
import ConfirmButton from "../products/ConfirmButton";
import Link from "next/link";
import { addBundleRule, deleteBundleRule, toggleBundleRule, updateBundleRule } from "./actions";

export const metadata = { title: "Bundle offers · Admin · Nova Edge" };

export default async function AdminBundles({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; edit?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, rules] = await Promise.all([
    supabase.from("products").select("*").order("sort_order", { ascending: true }),
    loadBundleRules(supabase, { all: true }),
  ]);
  const products = (data ?? []).map((r) => normalizeProduct(r));
  const editing = sp.edit ? rules.find((r) => r.id === sp.edit) : undefined;
  const name = (id: string) => products.find((p) => p.id === id)?.title ?? "(removed product)";

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Bundle offers</h1>
          <p>Make one product cheaper when another is bought. For every one of the first product in the cart, one of the second gets the discount. It applies automatically at checkout, before any discount code, and affiliate commission is worked out after it.</p>
        </div>
      </div>
      {sp.saved && <p className="form-ok" role="status">Saved.</p>}
      {sp.error && <p className="form-error" role="alert">{sp.error}</p>}

      {products.length < 2 ? (
        <p className="empty-state">Add at least two products to make a bundle offer.</p>
      ) : (
        <form key={editing?.id ?? "new"} action={editing ? updateBundleRule : addBundleRule} className="ad-form">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <h2>{editing ? "Edit offer" : "New offer"}</h2>
          <div className="option-row">
            <label className="field-group">
              <span className="panel-label">When the customer buys</span>
              <select className="field" name="trigger" required defaultValue={editing?.trigger_product_id ?? ""}>
                <option value="" disabled>Choose a product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <label className="field-group">
              <span className="panel-label">This product gets cheaper</span>
              <select className="field" name="target" required defaultValue={editing?.target_product_id ?? ""}>
                <option value="" disabled>Choose a product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <label className="field-group">
              <span className="panel-label">Discount type</span>
              <select className="field" name="type" defaultValue={editing?.type ?? "percent"}>
                <option value="percent">Percent off (%)</option>
                <option value="fixed">Naira off (₦)</option>
              </select>
            </label>
            <label className="field-group">
              <span className="panel-label">Amount</span>
              <input className="field" name="value" type="number" step="any" min="0" required defaultValue={editing?.value} style={{ width: "110px" }} />
            </label>
            <label className="field-group grow">
              <span className="panel-label">Shown to customers at checkout</span>
              <input className="field" name="label" type="text" maxLength={80} defaultValue={editing?.label ?? ""} placeholder="e.g. Pair it and save" />
            </label>
          </div>
          <div className="ad-actions">
            <button type="submit" className="btn">{editing ? "Save changes" : "Add offer"}</button>
            {editing && <Link href="/admin/bundles" className="btn btn-ghost">Cancel</Link>}
          </div>
        </form>
      )}

      <h2 style={{ marginTop: "2rem" }}>Your offers</h2>
      {rules.length === 0 ? (
        <p className="empty-state">No offers yet.</p>
      ) : (
        <ul className="ad-list">
          {rules.map((r) => (
            <li key={r.id} className="ad-row">
              <div>
                <strong>Buy {name(r.trigger_product_id)}</strong>, get {name(r.target_product_id)} {r.type === "percent" ? `${r.value}% off` : `${naira(r.value)} off`}
                {r.label && <span className="muted"> · &ldquo;{r.label}&rdquo;</span>}{" "}
                <span className={`ad-badge ${r.active ? "ok" : ""}`}>{r.active ? "On" : "Off"}</span>
              </div>
              <div className="ad-actions">
                <Link href={`/admin/bundles?edit=${r.id}`} className="btn btn-ghost btn-xs">Edit</Link>
                <form action={toggleBundleRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="btn btn-ghost btn-xs">{r.active ? "Turn off" : "Turn on"}</button>
                </form>
                <form action={deleteBundleRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <ConfirmButton message="Delete this offer?" className="btn btn-ghost btn-xs">Delete</ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
