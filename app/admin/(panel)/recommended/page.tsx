// app/admin/(panel)/recommended/page.tsx — choose what shows under "You may also like" on product pages
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeProduct } from "@/lib/products";
import { getRecommendedConfig } from "@/lib/recommended";
import { saveRecommended } from "./actions";

export const metadata = { title: "Recommended products · Admin · Nova Edge" };

export default async function AdminRecommended({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  const products = (data ?? []).map((r) => normalizeProduct(r));
  const config = await getRecommendedConfig();

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Recommended products</h1>
          <p>The &ldquo;You may also like&rdquo; row on every product page. Pick the products to show by default, or give any product its own list. Anything you leave empty is filled in automatically with products from the same section.</p>
        </div>
      </div>
      {sp.saved && <p className="form-ok" role="status">Saved.</p>}
      {sp.error && <p className="form-error" role="alert">{sp.error}</p>}

      {products.length < 2 ? (
        <p className="empty-state">Add at least two products to choose recommendations.</p>
      ) : (
        <form action={saveRecommended} className="ad-form">
          <h2>Shown by default</h2>
          <p className="ad-hint">Used on every product that doesn&rsquo;t have its own list below. Up to 4 are shown.</p>
          <div className="option-row">
            {products.map((p) => (
              <label key={p.id} className="chip-check">
                <input type="checkbox" name="default" value={p.id} defaultChecked={config.default.includes(p.id)} /> {p.title}
              </label>
            ))}
          </div>

          <h2 style={{ marginTop: "2rem" }}>Its own list, per product</h2>
          {products.map((p) => (
            <details key={p.id} className="ad-details">
              <summary>
                {p.title} {(config.by_product[p.id]?.length ?? 0) > 0 && <span className="ad-badge info">{config.by_product[p.id].length} chosen</span>}
              </summary>
              <div className="option-row">
                {products.filter((o) => o.id !== p.id).map((o) => (
                  <label key={o.id} className="chip-check">
                    <input type="checkbox" name={`for_${p.id}`} value={o.id} defaultChecked={config.by_product[p.id]?.includes(o.id)} /> {o.title}
                  </label>
                ))}
              </div>
            </details>
          ))}
          <div className="ad-actions">
            <button type="submit" className="btn">Save recommendations</button>
          </div>
        </form>
      )}
    </>
  );
}
