// app/admin/(panel)/library/page.tsx — artwork customers can add from the designer's Graphics tab
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLibrary } from "@/lib/library";
import ConfirmButton from "../templates/ConfirmButton";
import UploadForm from "./UploadForm";
import { deleteLibraryItem, toggleLibraryItem } from "./actions";
import "./library.css";

export const metadata = { title: "Design library · Admin · Nova Edge" };

export default async function AdminLibrary({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;

  // getLibrary never throws, so check the table separately to tell "empty" from "not set up yet".
  const supabase = await createClient();
  const { error: tableError } = await supabase.from("design_library").select("id").limit(1);
  const items = tableError ? [] : await getLibrary({ all: true });
  const categories = [...new Set(items.map((i) => i.category))].sort();

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Design library</h1>
          <p>
            Artwork you upload here shows up in the designer&apos;s Graphics tab, where customers can drop it onto their design.
            Hide an item to take it off the designer without deleting it. Small PNG, SVG, JPG or WEBP files work best (up to 5 MB).
          </p>
        </div>
      </div>

      {sp.saved && <p className="ad-flash">Saved.</p>}
      {sp.error && <p className="ad-flash err" role="alert">{sp.error}</p>}

      {tableError ? (
        <p className="ad-flash err" role="alert">Run the latest supabase/schema.sql in the SQL Editor to turn this on.</p>
      ) : (
        <>
          <UploadForm categories={categories} />

          {items.length === 0 ? (
            <p className="empty-state">No artwork yet. Upload the first piece above.</p>
          ) : (
            <div className="lib-grid">
              {items.map((it) => (
                <div key={it.id} className={`lib-card${it.active ? "" : " off"}`}>
                  <div className="lib-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.image_url} alt={it.title} loading="lazy" />
                  </div>
                  <div>
                    <div className="lib-title">{it.title}</div>
                    <div className="lib-meta">{it.category}{it.active ? "" : " · Hidden"}</div>
                  </div>
                  <div className="lib-actions">
                    <form action={toggleLibraryItem}>
                      <input type="hidden" name="id" value={it.id} />
                      <button type="submit" className="btn btn-xs btn-ghost">{it.active ? "Hide" : "Show"}</button>
                    </form>
                    <form action={deleteLibraryItem}>
                      <input type="hidden" name="id" value={it.id} />
                      <ConfirmButton message={`Delete "${it.title}"? This can't be undone.`} className="btn btn-xs btn-danger">Delete</ConfirmButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
