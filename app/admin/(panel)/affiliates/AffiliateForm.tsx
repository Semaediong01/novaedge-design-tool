// AffiliateForm.tsx — add / edit an affiliate
"use client";

import { useActionState, useState } from "react";
import { saveAffiliate, type AffiliateFormState } from "./actions";
import "./affiliates.css";

export type FormAffiliate = {
  id: string;
  name: string;
  email: string;
  code: string;
  commission_rate: number;
  active: boolean;
  notes: string;
};

export default function AffiliateForm({ affiliate }: { affiliate?: FormAffiliate }) {
  const [state, action, pending] = useActionState<AffiliateFormState, FormData>(saveAffiliate, {});
  const [code, setCode] = useState(affiliate?.code ?? "");
  const [active, setActive] = useState(affiliate?.active ?? true);

  return (
    <form action={action} className="ad-form">
      {affiliate && <input type="hidden" name="id" value={affiliate.id} />}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}

      <div className="ad-card">
        <h2>Who</h2>
        <div className="ad-stack">
          <div className="field-group">
            <label className="panel-label" htmlFor="af-name">Name</label>
            <input id="af-name" name="name" className="field" defaultValue={affiliate?.name ?? ""} maxLength={120} required />
          </div>
          <div className="field-group">
            <label className="panel-label" htmlFor="af-email">Email (optional)</label>
            <input id="af-email" name="email" type="email" className="field" defaultValue={affiliate?.email ?? ""} maxLength={200} />
          </div>
          <div className="field-group">
            <label className="panel-label" htmlFor="af-notes">Notes (only you see this)</label>
            <textarea id="af-notes" name="notes" className="field" rows={3} defaultValue={affiliate?.notes ?? ""} maxLength={2000} placeholder="Bank details, how you agreed to pay, etc." />
          </div>
        </div>
      </div>

      <div className="ad-card">
        <h2>Referral code and rate</h2>
        <div className="ad-row">
          <div className="field-group">
            <label className="panel-label" htmlFor="af-code">Code</label>
            <input
              id="af-code"
              name="code"
              className="field af-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
              minLength={3}
              maxLength={30}
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="JESSE"
            />
          </div>
          <div className="field-group">
            <label className="panel-label" htmlFor="af-rate">Default commission rate (%)</label>
            <input id="af-rate" name="commission_rate" type="number" inputMode="decimal" className="field" min={0} max={100} step="0.01" defaultValue={affiliate ? affiliate.commission_rate : 12} required />
          </div>
        </div>
        <p className="ad-hint">3 to 30 letters, numbers, dashes or underscores. Changing a code later breaks links the affiliate has already shared. A product can have its own rate, which replaces this one for that product.</p>
      </div>

      <div className="ad-card">
        <label className="ad-switch">
          <input type="checkbox" name="active" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (new orders through their link earn commission)
        </label>
      </div>

      <div className="ad-actions">
        <button type="submit" className="btn" disabled={pending}>{pending ? "Saving..." : affiliate ? "Save changes" : "Create affiliate"}</button>
        <a href={affiliate ? `/admin/affiliates/${affiliate.id}` : "/admin/affiliates"} className="text-link">Cancel</a>
      </div>
    </form>
  );
}
