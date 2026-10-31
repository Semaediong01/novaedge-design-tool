// ZoneForm.tsx — add / edit a delivery zone
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import { saveZone, type ZoneFormState } from "./actions";
import "./delivery.css";

export type FormZone = {
  id: string;
  name: string;
  fee: number;
  active: boolean;
  states: string[]; // already matched to the official names
  fallback: boolean;
};

const label = (s: string) => (s === "FCT" ? "Abuja (FCT)" : s);

export default function ZoneForm({ zone, takenBy }: { zone?: FormZone; takenBy: Record<string, string> }) {
  const [state, action, pending] = useActionState<ZoneFormState, FormData>(saveZone, {});
  const [picked, setPicked] = useState<string[]>(zone?.states ?? []);
  const [active, setActive] = useState(zone?.active ?? true);
  const fallback = zone?.fallback ?? false;

  const toggle = (s: string) => setPicked((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <form action={action} className="ad-form">
      {zone && <input type="hidden" name="id" value={zone.id} />}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}

      <div className="ad-card">
        <h2>The zone</h2>
        <div className="ad-row">
          <div className="field-group">
            <label className="panel-label" htmlFor="dl-name">Name</label>
            {fallback ? (
              <>
                <input id="dl-name" className="field" value={zone?.name ?? ""} readOnly disabled />
                <p className="ad-hint">This special zone can&apos;t be renamed or deleted.</p>
              </>
            ) : (
              <input id="dl-name" name="name" className="field" defaultValue={zone?.name ?? ""} maxLength={60} required placeholder="e.g. South-South" />
            )}
          </div>
          <div className="field-group">
            <label className="panel-label" htmlFor="dl-fee">Delivery fee (₦)</label>
            <input id="dl-fee" name="fee" className="field" type="number" inputMode="decimal" min={0} step="1" defaultValue={zone ? zone.fee : ""} required />
          </div>
        </div>
        <label className="ad-switch dl-note">
          <input type="checkbox" name="active" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (used at checkout)
        </label>
      </div>

      {fallback ? (
        <div className="ad-card">
          <h2>States</h2>
          <p className="muted">&quot;Everywhere else&quot; has no states of its own. It is the fee for every state that isn&apos;t listed in another active zone.</p>
        </div>
      ) : (
        <div className="ad-card">
          <h2>States in this zone</h2>
          <p className="ad-hint">A state can be in only one active zone. States already used by another active zone are marked.</p>
          <div className="dl-states" role="group" aria-label="States in this zone">
            {NIGERIAN_STATES.map((s) => {
              const other = takenBy[s];
              return (
                <label key={s} className="check dl-state">
                  <input type="checkbox" name="states" value={s} checked={picked.includes(s)} onChange={() => toggle(s)} />
                  <span>{label(s)}{other && <small> (in {other})</small>}</span>
                </label>
              );
            })}
          </div>
          <p className="ad-hint">
            {picked.length} state{picked.length === 1 ? "" : "s"} ticked.{" "}
            {picked.length > 0 && <button type="button" className="text-link text-link-btn" onClick={() => setPicked([])}>Clear</button>}
          </p>
        </div>
      )}

      <div className="ad-actions">
        <button type="submit" className="btn" disabled={pending}>{pending ? "Saving..." : zone ? "Save changes" : "Create zone"}</button>
        <Link href="/admin/delivery" className="text-link">Cancel</Link>
      </div>
    </form>
  );
}
