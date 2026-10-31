// app/admin/(panel)/homepage/page.tsx — pick and order the products on the home page
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { productImage } from "@/lib/mockups";
import { normalizeProduct } from "@/lib/products";
import { effectivePrice } from "@/lib/pricing";
import { saveHomepage } from "./actions";
import "../products/products.css";

export const metadata = { title: "Home page · Admin · Nova Edge" };

const HOME_LIMIT = 8;

export default async function AdminHomepage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const products = (data ?? []).map((r) => normalizeProduct(r));
  const chosen = products.filter((p) => p.featured);
  const shown = chosen.length > 0 ? chosen : products;

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Home page</h1>
          <p>Choose which products appear on the home page and in what order. The home page shows the first {HOME_LIMIT}. Smaller position numbers come first. If you choose none, the newest products show.</p>
        </div>
      </div>

      {sp.saved && <p className="ad-flash">Saved. The home page is updated.</p>}
      {sp.error && <p className="ad-flash err" role="alert">{sp.error}</p>}

      <h2>Preview</h2>
      {shown.length === 0 ? (
        <p className="empty-state">There are no live products yet, so the home page shows &ldquo;new pieces are on the way&rdquo;.</p>
      ) : (
        <>
          {chosen.length === 0 && <p className="ad-hint">Nothing is chosen, so the home page shows the newest products.</p>}
          {chosen.length > HOME_LIMIT && <p className="ad-hint">{chosen.length} products are chosen, but only the first {HOME_LIMIT} are shown. The faded ones are left out.</p>}
          <div className="hp-strip">
            {shown.map((p, i) => {
              const img = productImage(p);
              return (
                <div key={p.id} className={`hp-card${i >= HOME_LIMIT ? " extra" : ""}`}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" />
                  ) : (
                    <span className="pl-thumb-empty" />
                  )}
                  <span>{i + 1}. {p.title}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {products.length === 0 ? null : (
        <form action={saveHomepage}>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Product</th>
                  <th className="num">Price</th>
                  <th>Show on home page</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const img = productImage(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="pl-thumb" src={img} alt="" />
                        ) : (
                          <span className="pl-thumb-empty" />
                        )}
                      </td>
                      <td>
                        {p.title}
                        <span className="pl-sub">{p.category}</span>
                      </td>
                      <td className="num">{naira(effectivePrice(p))}</td>
                      <td>
                        <label className="sc-switch">
                          <input type="checkbox" name={`show_${p.id}`} defaultChecked={p.featured} />
                          <span>Show</span>
                        </label>
                      </td>
                      <td>
                        <input className="field hp-pos" type="number" step="1" name={`pos_${p.id}`} defaultValue={p.sort_order} aria-label={`Position for ${p.title}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: "1rem" }}><button type="submit" className="btn">Save home page</button></p>
        </form>
      )}
    </>
  );
}
