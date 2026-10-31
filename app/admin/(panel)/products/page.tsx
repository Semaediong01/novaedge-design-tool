// app/admin/(panel)/products/page.tsx — every product, with search, category filter and one-click quick actions
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { effectivePrice, promoActive } from "@/lib/pricing";
import { productImage } from "@/lib/mockups";
import { normalizeProduct } from "@/lib/products";
import { getAllSections } from "@/lib/store-data";
import { quickProductAction } from "./actions";
import "./products.css";

export const metadata = { title: "Products · Admin · Nova Edge" };

type SP = { q?: string; cat?: string; saved?: string; deleted?: string; hidden?: string; error?: string };

function Quick({ id, field, value, label, q, cat }: { id: string; field: string; value: boolean; label: string; q: string; cat: string }) {
  return (
    <form action={quickProductAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(value)} />
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="cat" value={cat} />
      <button type="submit" className="btn btn-ghost btn-xs">{label}</button>
    </form>
  );
}

export default async function AdminProducts({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const cat = (sp.cat ?? "").trim().slice(0, 60);

  const supabase = await createClient();
  const [{ data }, sections] = await Promise.all([
    supabase.from("products").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
    getAllSections(),
  ]);
  const all = (data ?? []).map((r) => normalizeProduct(r));

  const categories = sections.map((s) => s.name);
  for (const p of all) if (!categories.includes(p.category)) categories.push(p.category);

  const needle = q.toLowerCase();
  const products = all.filter((p) => (!cat || p.category === cat) && (!needle || p.title.toLowerCase().includes(needle)));
  const now = new Date();

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Products</h1>
          <p>{all.length} product{all.length === 1 ? "" : "s"}. Use the buttons on each row for quick changes, or open a product to edit everything.</p>
        </div>
        <div className="ad-actions">
          <Link href="/admin/products/new" className="btn">Add product</Link>
        </div>
      </div>

      {sp.saved && <p className="ad-flash">Saved.</p>}
      {sp.deleted && <p className="ad-flash">Product deleted.</p>}
      {sp.hidden && <p className="ad-flash">This product is on past orders, so it was hidden instead of deleted.</p>}
      {sp.error && <p className="ad-flash err" role="alert">{sp.error}</p>}

      <form method="get" className="ad-toolbar">
        <input className="field" type="search" name="q" defaultValue={q} placeholder="Search by name" aria-label="Search products" />
        <select className="field" name="cat" defaultValue={cat} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className="btn btn-ghost btn-sm">Filter</button>
        {(q || cat) && <Link href="/admin/products" className="text-link">Clear</Link>}
      </form>

      {products.length === 0 ? (
        <p className="empty-state">{all.length === 0 ? "No products yet. Add your first one to put it in the shop." : "No products match that search."}</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table pl-table">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Category</th>
                <th className="num">Price</th>
                <th>Variants</th>
                <th>Status</th>
                <th>Quick actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const img = productImage(p);
                const onPromo = promoActive(p, now);
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
                      <Link href={`/admin/products/${p.id}`} className="pl-name">{p.title}</Link>
                      <span className="pl-sub">{p.customizable ? "Customizable" : "Ready-made"}</span>
                    </td>
                    <td>{p.category}</td>
                    <td className="num">
                      {onPromo && <span className="pl-old">{naira(p.price)}</span>}
                      {naira(effectivePrice(p, now))}
                      {onPromo && p.promo_label && <span className="pl-sub">{p.promo_label}</span>}
                    </td>
                    <td>
                      {p.sizes.length ? p.sizes.join(", ") : "No sizes"}
                      <span className="pl-sub">{p.colors.length ? p.colors.join(", ") : "No colours"}</span>
                    </td>
                    <td>
                      <div className="pl-badges">
                        <span className={`ad-badge ${p.active ? "good" : "dim"}`}>{p.active ? "live" : "hidden"}</span>
                        {!p.in_stock && <span className="ad-badge bad">sold out</span>}
                        {onPromo && <span className="ad-badge warn">on promo</span>}
                        {p.featured && <span className="ad-badge info">on home page</span>}
                      </div>
                    </td>
                    <td>
                      <div className="pl-actions">
                        <Link href={`/admin/products/${p.id}`} className="text-link">Edit</Link>
                        <Quick id={p.id} field="active" value={!p.active} label={p.active ? "Hide" : "Show"} q={q} cat={cat} />
                        <Quick id={p.id} field="in_stock" value={!p.in_stock} label={p.in_stock ? "Mark sold out" : "Mark in stock"} q={q} cat={cat} />
                        <Quick id={p.id} field="featured" value={!p.featured} label={p.featured ? "Remove from home" : "Add to home"} q={q} cat={cat} />
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
