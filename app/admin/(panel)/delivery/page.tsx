// app/admin/(panel)/delivery/page.tsx — delivery zones and what each state pays
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { naira } from "@/lib/format";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import ConfirmButton from "./ConfirmButton";
import { createFallbackZone, deleteZone } from "./actions";
import { loadZones, takenByMap } from "./data";
import { FALLBACK_NAME, isFallback, stateLabel } from "./zones";
import "./delivery.css";

export const metadata = { title: "Delivery · Admin · Nova Edge" };

export default async function AdminDelivery({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string; error?: string }> }) {
  await requireAdmin();
  const { saved, deleted, error } = await searchParams;
  const zones = await loadZones();

  const fallback = zones.find(isFallback);
  const fallbackLive = Boolean(fallback?.active);
  const covered = takenByMap(zones);
  const uncovered = NIGERIAN_STATES.filter((s) => !covered[s]);

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Delivery</h1>
          <p>The delivery fee is picked from the state in the customer&apos;s address. A state in an active zone pays that zone&apos;s fee; any other state pays the &quot;{FALLBACK_NAME}&quot; fee.</p>
        </div>
        <div className="ad-actions">
          <Link href="/admin/delivery/new" className="btn">New zone</Link>
        </div>
      </div>

      {saved && <p className="ad-flash">Saved.</p>}
      {deleted && <p className="ad-flash">Zone deleted.</p>}
      {error && <p className="ad-flash err" role="alert">{error}</p>}

      {!fallback && (
        <div className="dl-warn" role="alert">
          <strong>The &quot;{FALLBACK_NAME}&quot; zone is missing.</strong>
          <span>Any state that isn&apos;t in a zone below gets free delivery until you create it.</span>
          <form action={createFallbackZone} className="dl-create">
            <div className="field-group">
              <label className="panel-label" htmlFor="dl-fb-fee">Fee (₦)</label>
              <input id="dl-fb-fee" name="fee" className="field" type="number" inputMode="decimal" min={0} step="1" defaultValue={5000} required />
            </div>
            <button type="submit" className="btn">Create &quot;{FALLBACK_NAME}&quot;</button>
          </form>
        </div>
      )}
      {fallback && !fallback.active && (
        <div className="dl-warn" role="alert">
          <strong>&quot;{FALLBACK_NAME}&quot; is switched off.</strong>
          <span>States that aren&apos;t in an active zone currently get free delivery.</span>
          <Link href={`/admin/delivery/${fallback.id}`} className="btn btn-sm">Switch it on</Link>
        </div>
      )}

      {zones.length === 0 ? (
        <p className="empty-state">No delivery zones yet.</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Zone</th>
                <th className="num">Fee</th>
                <th>States</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => {
                const fb = isFallback(z);
                return (
                  <tr key={z.id}>
                    <td><Link href={`/admin/delivery/${z.id}`} className="row-link dl-name">{z.name}</Link></td>
                    <td className="num">{naira(z.fee)}</td>
                    <td>
                      {fb ? <span className="muted">Every state not listed in an active zone</span> : (
                        <>
                          {z.states.length} state{z.states.length === 1 ? "" : "s"}
                          <span className="dl-sub">{z.states.map(stateLabel).join(", ")}</span>
                        </>
                      )}
                    </td>
                    <td><span className={`ad-badge ${z.active ? "good" : "dim"}`}>{z.active ? "Active" : "Off"}</span></td>
                    <td>
                      <div className="dl-row-actions">
                        <Link href={`/admin/delivery/${z.id}`} className="text-link">Edit</Link>
                        {fb ? (
                          <span className="dl-locked" title="This zone can't be deleted">Fixed</span>
                        ) : (
                          <form action={deleteZone}>
                            <input type="hidden" name="id" value={z.id} />
                            <ConfirmButton className="btn btn-danger btn-xs" message={`Delete the zone "${z.name}"? Its states will fall back to "${FALLBACK_NAME}".`}>Delete</ConfirmButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="ad-card dl-section">
        <h2>States not in any zone</h2>
        {uncovered.length === 0 ? (
          <p className="muted">Every state is in an active zone.</p>
        ) : (
          <>
            <p className="muted">
              {uncovered.length} of {NIGERIAN_STATES.length} states are not in an active zone and{" "}
              {fallbackLive && fallback ? <>pay the &quot;{FALLBACK_NAME}&quot; fee of <strong>{naira(fallback.fee)}</strong>.</> : <strong>currently get free delivery</strong>}
            </p>
            <p className="dl-sub">{uncovered.map(stateLabel).join(", ")}</p>
          </>
        )}
      </div>
      <p className="ad-hint dl-note">Changes apply to new checkouts straight away. Orders already placed keep the fee they were charged.</p>
    </>
  );
}
