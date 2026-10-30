// DiscountForm.tsx — add / edit a discount code
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveDiscount, type DiscountFormState } from "./actions";
import "./discounts.css";

export type FormProduct = { id: string; title: string; active: boolean };
export type FormDiscount = {
  id: string;
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  product_ids: string[] | null;
  starts_at: string; // already converted to Lagos time for the input
  ends_at: string;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export default function DiscountForm({ discount, products }: { discount?: FormDiscount; products: FormProduct[] }) {
  const [state, action, pending] = useActionState<DiscountFormState, FormData>(saveDiscount, {});

  const [code, setCode] = useState(discount?.code ?? "");
  const [description, setDescription] = useState(discount?.description ?? "");
  const [type, setType] = useState<"percent" | "fixed">(discount?.type ?? "percent");
  const [value, setValue] = useState(discount ? String(discount.value) : "");
  const [minOrder, setMinOrder] = useState(discount && discount.min_order > 0 ? String(discount.min_order) : "");
  const [picked, setPicked] = useState<string[]>(discount?.product_ids ?? []);
  const [startsAt, setStartsAt] = useState(discount?.starts_at ?? "");
  const [endsAt, setEndsAt] = useState(discount?.ends_at ?? "");
  const [limit, setLimit] = useState(discount?.usage_limit != null ? String(discount.usage_limit) : "");
  const [active, setActive] = useState(discount?.active ?? true);

  const toggleProduct = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <form action={action} className="ad-form">
      {discount && <input type="hidden" name="id" value={discount.id} />}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}

      <div className="ad-card">
        <h2>The code</h2>
        <div className="ad-stack">
          <div className="field-group">
            <label className="panel-label" htmlFor="dc-code">Code</label>
            <div className="dc-code-row">
              <input
                id="dc-code"
                name="code"
                className="field dc-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                minLength={3}
                maxLength={30}
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="WELCOME10"
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCode(generateCode())}>Generate</button>
            </div>
            <p className="ad-hint">3 to 30 letters, numbers, dashes or underscores. Customers can type it in any case.</p>
          </div>

          <div className="field-group">
            <label className="panel-label" htmlFor="dc-desc">Description (only you see this)</label>
            <input id="dc-desc" name="description" className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="e.g. Instagram giveaway, November" />
          </div>
        </div>
      </div>

      <div className="ad-card">
        <h2>What it takes off</h2>
        <div className="ad-row">
          <div className="field-group">
            <label className="panel-label" htmlFor="dc-type">Type</label>
            <select id="dc-type" name="type" className="field" value={type} onChange={(e) => setType(e.target.value === "fixed" ? "fixed" : "percent")}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off (₦)</option>
            </select>
          </div>
          <div className="field-group">
            <label className="panel-label" htmlFor="dc-value">{type === "percent" ? "Percent (1 to 100)" : "Amount (₦)"}</label>
            <input
              id="dc-value"
              name="value"
              className="field"
              type="number"
              inputMode="decimal"
              step={type === "percent" ? "0.01" : "1"}
              min={1}
              max={type === "percent" ? 100 : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label className="panel-label" htmlFor="dc-min">Minimum order (₦)</label>
            <input id="dc-min" name="min_order" className="field" type="number" inputMode="decimal" min={0} step="1" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="0" />
          </div>
        </div>
        <p className="ad-hint">
          The minimum is checked against the cart total before the code is applied. A code stacks with a product&apos;s own promo price: the customer gets the promo price first, then this code comes off that.
          A fixed amount never takes off more than the eligible products cost.
        </p>
      </div>

      <div className="ad-card">
        <h2>Which products</h2>
        <p className="ad-hint dc-tight">Tick products to limit the code to them. Tick none and it works on every product.</p>
        <div className="dc-products" role="group" aria-label="Products this code applies to">
          {products.length === 0 && <p className="muted">No products yet.</p>}
          {products.map((p) => (
            <label key={p.id} className="check dc-product">
              <input type="checkbox" name="product_ids" value={p.id} checked={picked.includes(p.id)} onChange={() => toggleProduct(p.id)} />
              <span>{p.title}{!p.active && <small className="muted"> (hidden)</small>}</span>
            </label>
          ))}
        </div>
        <p className="ad-hint">
          {picked.length === 0 ? "Applies to all products." : `Applies to ${picked.length} product${picked.length === 1 ? "" : "s"}.`}{" "}
          {picked.length > 0 && <button type="button" className="text-link text-link-btn" onClick={() => setPicked([])}>Clear selection</button>}
        </p>
      </div>

      <div className="ad-card">
        <h2>When and how often</h2>
        <div className="ad-row">
          <div className="field-group">
            <label className="panel-label" htmlFor="dc-start">Starts (Lagos time)</label>
            <input id="dc-start" name="starts_at" className="field" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="panel-label" htmlFor="dc-end">Ends (Lagos time)</label>
            <input id="dc-end" name="ends_at" className="field" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="panel-label" htmlFor="dc-limit">Usage limit</label>
            <input id="dc-limit" name="usage_limit" className="field" type="number" inputMode="numeric" min={1} step="1" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Unlimited" />
          </div>
        </div>
        <p className="ad-hint">Leave a date blank for no start or no end. The limit counts paid orders across all customers; blank means unlimited.</p>
        {discount && (
          <p className="dc-used">Used so far: <strong>{discount.used_count}</strong>{discount.usage_limit != null ? ` of ${discount.usage_limit}` : ""} (counted automatically, can&apos;t be edited)</p>
        )}
      </div>

      <div className="ad-card">
        <label className="ad-switch">
          <input type="checkbox" name="active" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (customers can use this code)
        </label>
      </div>

      <div className="ad-actions">
        <button type="submit" className="btn" disabled={pending}>{pending ? "Saving..." : discount ? "Save changes" : "Create code"}</button>
        <Link href="/admin/discounts" className="text-link">Cancel</Link>
      </div>
    </form>
  );
}
