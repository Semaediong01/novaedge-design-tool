// app/admin/(panel)/sections/page.tsx — the shop menu: order, Soon and visibility
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SECTIONS } from "@/lib/store-data";
import type { Section } from "@/lib/types";
import { addSection, deleteSection, moveSection, saveDefaultSections, toggleSection } from "./actions";
import ConfirmButton from "../products/ConfirmButton";
import "../products/products.css";

export const metadata = { title: "Sections · Admin · Nova Edge" };

type SP = { saved?: string; deleted?: string; error?: string };

function Switch({ name, field, value, label }: { name: string; field: "soon" | "visible"; value: boolean; label: string }) {
  return (
    <form action={toggleSection}>
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(!value)} />
      <button type="submit" className={`btn btn-xs ${value ? "" : "btn-ghost"}`} aria-pressed={value} aria-label={`${label} for ${name}: ${value ? "on" : "off"}`}>
        {value ? "On" : "Off"}
      </button>
    </form>
  );
}

export default async function AdminSections({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: sData }, { data: pData }] = await Promise.all([
    supabase.from("sections").select("*").order("sort_order", { ascending: true }).order("name"),
    supabase.from("products").select("category, active"),
  ]);
  const saved = (sData ?? []) as Section[];
  const usingDefaults = saved.length === 0;
  const sections = usingDefaults ? DEFAULT_SECTIONS : saved;

  const total = new Map<string, number>();
  const live = new Map<string, number>();
  for (const p of (pData ?? []) as { category: string; active: boolean }[]) {
    total.set(p.category, (total.get(p.category) ?? 0) + 1);
    if (p.active) live.set(p.category, (live.get(p.category) ?? 0) + 1);
  }

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Sections</h1>
          <p>Turn Soon off when the section has products ready.</p>
        </div>
      </div>

      {sp.saved && <p className="ad-flash">Saved.</p>}
      {sp.deleted && <p className="ad-flash">Section deleted.</p>}
      {sp.error && <p className="ad-flash err" role="alert">{sp.error}</p>}

      {usingDefaults && (
        <form action={saveDefaultSections} className="pf-note warn" style={{ marginBottom: "1rem" }}>
          <p style={{ margin: "0 0 0.6rem" }}>No sections are saved yet, so the shop is showing these starting sections. Save them to be able to change them.</p>
          <button type="submit" className="btn btn-sm">Save these sections</button>
        </form>
      )}

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Section</th>
              <th className="num">Products</th>
              <th>Order</th>
              <th>Soon</th>
              <th>Visible in menu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s, i) => {
              const count = total.get(s.name) ?? 0;
              const liveCount = live.get(s.name) ?? 0;
              return (
                <tr key={s.name}>
                  <td>
                    <strong>{s.name}</strong>
                    {s.soon && <span className="ad-badge warn" style={{ marginLeft: "0.4rem" }}>Soon</span>}
                    {!usingDefaults && !s.soon && liveCount === 0 && (
                      <span className="sc-warn">This section is open but has no live products. Customers will see an empty page. Switch Soon back on, or add products.</span>
                    )}
                    {!usingDefaults && s.soon && count > 0 && (
                      <span className="sc-warn">This section has {count} product{count === 1 ? "" : "s"} but is marked Soon, so customers can&apos;t see them. Switch Soon off to open it.</span>
                    )}
                  </td>
                  <td className="num">{count}</td>
                  <td>
                    {usingDefaults ? (
                      s.sort_order
                    ) : (
                      <div className="sc-order">
                        <form action={moveSection}>
                          <input type="hidden" name="name" value={s.name} />
                          <input type="hidden" name="dir" value="up" />
                          <button type="submit" className="btn btn-ghost btn-xs" disabled={i === 0} aria-label={`Move ${s.name} up`}>Up</button>
                        </form>
                        <form action={moveSection}>
                          <input type="hidden" name="name" value={s.name} />
                          <input type="hidden" name="dir" value="down" />
                          <button type="submit" className="btn btn-ghost btn-xs" disabled={i === sections.length - 1} aria-label={`Move ${s.name} down`}>Down</button>
                        </form>
                      </div>
                    )}
                  </td>
                  <td>{usingDefaults ? (s.soon ? "On" : "Off") : <Switch name={s.name} field="soon" value={s.soon} label="Soon" />}</td>
                  <td>{usingDefaults ? (s.visible ? "Yes" : "No") : <Switch name={s.name} field="visible" value={s.visible} label="Visible in menu" />}</td>
                  <td>
                    {!usingDefaults &&
                      (count === 0 ? (
                        <form action={deleteSection}>
                          <input type="hidden" name="name" value={s.name} />
                          <ConfirmButton message={`Delete the ${s.name} section?`} className="btn btn-danger btn-xs">Delete</ConfirmButton>
                        </form>
                      ) : (
                        <span className="pl-sub">In use</span>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!usingDefaults && (
        <form action={addSection} className="sc-add">
          <label className="field-group">
            <span className="panel-label">New section name</span>
            <input className="field" name="name" maxLength={30} required placeholder="Sweatshirts" />
          </label>
          <button type="submit" className="btn">Add section</button>
          <p className="ad-hint" style={{ flexBasis: "100%" }}>New sections start as Soon, so they are hidden behind a coming-soon page until you switch Soon off.</p>
        </form>
      )}
    </>
  );
}
