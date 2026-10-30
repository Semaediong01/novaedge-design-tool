// app/admin/(panel)/templates/page.tsx — design templates customers can start from
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Template } from "@/lib/types";
import { templateCategories } from "./categories";
import ConfirmButton from "./ConfirmButton";
import { deleteTemplate, setTemplateActive, updateTemplateMeta } from "./actions";
import "./templates.css";

export const metadata = { title: "Design templates · Admin · Nova Edge" };

export default async function AdminTemplates({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string; error?: string }> }) {
  await requireAdmin();
  const { saved, deleted, error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("templates").select("*").order("sort_order").order("created_at", { ascending: false });
  const templates = (data ?? []) as Template[];
  const categories = await templateCategories();

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Design templates</h1>
          <p>Ready-made designs customers can start from in the designer. Only active templates for the product&apos;s category are shown. Lower sort numbers come first.</p>
        </div>
        <div className="ad-actions">
          <Link href="/admin/templates/new" className="btn">New template</Link>
        </div>
      </div>

      {saved && <p className="ad-flash">Saved.</p>}
      {deleted && <p className="ad-flash">Template deleted.</p>}
      {error && <p className="ad-flash err" role="alert">{error}</p>}

      {templates.length === 0 ? (
        <p className="empty-state">No templates yet. Build the first one in the designer.</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Title, category and order</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => {
                const cats = categories.includes(t.category) ? categories : [t.category, ...categories];
                return (
                  <tr key={t.id}>
                    <td>
                      {t.preview_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="tp-thumb" src={t.preview_url} alt="" loading="lazy" />
                      ) : (
                        <span className="tp-thumb-empty">No preview</span>
                      )}
                    </td>
                    <td>
                      <form action={updateTemplateMeta} className="tp-edit-form">
                        <input type="hidden" name="id" value={t.id} />
                        <input className="field" name="title" defaultValue={t.title} maxLength={80} required aria-label={`Title of ${t.title}`} />
                        <div className="tp-row">
                          <select className="field" name="category" defaultValue={t.category} aria-label="Category">
                            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input className="field tp-sort" name="sort_order" type="number" min={0} max={100000} step={1} defaultValue={t.sort_order} aria-label="Sort order" />
                          <button type="submit" className="btn btn-sm btn-ghost">Save</button>
                        </div>
                      </form>
                    </td>
                    <td>
                      <form action={setTemplateActive}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="active" value={t.active ? "0" : "1"} />
                        <button type="submit" className="btn btn-xs btn-ghost" aria-label={t.active ? `Switch off ${t.title}` : `Switch on ${t.title}`}>
                          <span className={`ad-badge ${t.active ? "good" : "dim"}`}>{t.active ? "Active" : "Off"}</span>
                          {" "}{t.active ? "Switch off" : "Switch on"}
                        </button>
                      </form>
                    </td>
                    <td>
                      <div className="tp-actions">
                        <Link href={`/admin/templates/${t.id}`} className="text-link">Edit design</Link>
                        <form action={deleteTemplate}>
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmButton className="btn btn-danger btn-xs" message={`Delete the template "${t.title}"? Designs customers already made from it are not affected.`}>Delete</ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
