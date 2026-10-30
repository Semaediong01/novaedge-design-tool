// app/admin/(panel)/products/ProductForm.tsx — add / edit a product: photos, details, price and promo, commission, variants, personalization, visibility
"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { naira } from "@/lib/format";
import { promoActive } from "@/lib/pricing";
import type { Product, Section } from "@/lib/types";
import { saveProduct, type ProductFormState } from "./actions";
import { isoToLagosInput, lagosInputToIso, lagosLabel } from "./lagos";
import "./products.css";

function splitList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const v = part.trim();
    if (!v || v.includes("|") || v === "*" || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

export default function ProductForm({ product, sections }: { product?: Product; sections: Section[] }) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, {});
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState(product?.category ?? sections[0]?.name ?? "T-Shirts");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [promoPrice, setPromoPrice] = useState(product?.promo_price != null ? String(product.promo_price) : "");
  const [promoStart, setPromoStart] = useState(isoToLagosInput(product?.promo_starts_at ?? null));
  const [promoEnd, setPromoEnd] = useState(isoToLagosInput(product?.promo_ends_at ?? null));
  const [sizesText, setSizesText] = useState((product?.sizes ?? ["S", "M", "L", "XL"]).join(", "));
  const [colorsText, setColorsText] = useState((product?.colors ?? []).join(", "));
  const [soldOut, setSoldOut] = useState<Set<string>>(new Set(product?.sold_out_variants ?? []));

  const sizes = useMemo(() => splitList(sizesText), [sizesText]);
  const colors = useMemo(() => splitList(colorsText), [colorsText]);

  // Section names: all sections, plus the product's current category if it is no longer a section.
  const names = sections.map((s) => s.name);
  if (product && !names.includes(product.category)) names.push(product.category);
  const currentSection = sections.find((s) => s.name === category);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setUploadError("");

    const supabase = createClient();
    const added: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
        setUploadError(`${file.name}: use an image under 10 MB.`);
        continue;
      }
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (error) {
        setUploadError(`${file.name} didn't upload. Try again.`);
        continue;
      }
      added.push(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
    }
    setImages((current) => [...current, ...added]);
    setUploading(false);
  };

  const makeMain = (index: number) => setImages((cur) => [cur[index], ...cur.filter((_, i) => i !== index)]);
  const remove = (index: number) => setImages((cur) => cur.filter((_, i) => i !== index));

  const toggleSold = (key: string) =>
    setSoldOut((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Only entries that still match a colour and size in the lists are sent.
  const validSoldOut = useMemo(() => {
    const out: string[] = [];
    for (const key of soldOut) {
      const [c, s] = key.split("|");
      const cOk = c === "*" || colors.includes(c);
      const sOk = s === "*" || sizes.includes(s);
      if (cOk && sOk && !(c === "*" && s === "*")) out.push(key);
    }
    return out;
  }, [soldOut, colors, sizes]);

  // "Customers pay" preview
  const preview = useMemo(() => {
    const p = Number(price);
    if (price.trim() === "" || !Number.isFinite(p) || p < 0) return { text: "Enter a price to see what customers pay.", tone: "dim" as const };
    const promo = promoPrice.trim() === "" ? null : Number(promoPrice);
    if (promo == null) return { text: `Customers pay ${naira(p)}.`, tone: "good" as const };
    if (!Number.isFinite(promo) || promo < 0) return { text: "The promo price is not a valid amount.", tone: "bad" as const };
    if (!(promo < p)) return { text: "The promo price must be lower than the normal price.", tone: "bad" as const };
    const s = lagosInputToIso(promoStart);
    const e = lagosInputToIso(promoEnd);
    if (s === "invalid" || e === "invalid") return { text: "Check the promo dates.", tone: "bad" as const };
    if (s && e && new Date(e) <= new Date(s)) return { text: "The promo end must be after its start.", tone: "bad" as const };
    const fields = { price: p, promo_price: promo, promo_label: null, promo_starts_at: s, promo_ends_at: e };
    if (promoActive(fields)) {
      return { text: `Customers pay ${naira(promo)} now (normal price ${naira(p)}, ${Math.round(((p - promo) / p) * 100)}% off).${e ? ` Promo ends ${lagosLabel(e)}.` : ""}`, tone: "good" as const };
    }
    if (s && new Date(s) > new Date()) return { text: `Customers pay ${naira(p)} until ${lagosLabel(s)}, then ${naira(promo)}.`, tone: "warn" as const };
    return { text: `The promo has ended, so customers pay ${naira(p)}.`, tone: "warn" as const };
  }, [price, promoPrice, promoStart, promoEnd]);

  return (
    <form action={action} className="admin-form pf">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="images" value={images.join("\n")} />
      {validSoldOut.map((k) => (
        <input key={k} type="hidden" name="sold_out" value={k} />
      ))}

      <section className="form-block">
        <h2>Photos</h2>
        <p className="form-note">
          The first photo is the main one. For customizable products it is also the garment in the designer, so use a square, front-facing photo of the plain garment on a clean background. T-Shirts can skip photos and use the built-in mockups.
        </p>
        <div className="photo-grid">
          {images.map((src, i) => (
            <div key={src} className="photo-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Product photo ${i + 1}`} />
              {i === 0 ? (
                <span className="tag tag-inline">Main</span>
              ) : (
                <button type="button" className="text-link text-link-btn" onClick={() => makeMain(i)}>Make main</button>
              )}
              <button type="button" className="icon-btn icon-btn-sm photo-remove" onClick={() => remove(i)} aria-label="Remove photo">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="photo-add" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 size={20} className="spin" /> : <Upload size={20} />}
            {uploading ? "Uploading…" : "Add photos"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
        {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
      </section>

      <section className="form-block">
        <h2>Details</h2>
        <label className="field-group">
          <span className="panel-label">Product name</span>
          <input className="field" name="title" required maxLength={120} defaultValue={product?.title} placeholder="Classic tee, white" />
        </label>
        <label className="field-group">
          <span className="panel-label">Description</span>
          <textarea className="field" name="description" rows={4} maxLength={4000} defaultValue={product?.description} />
        </label>
        <label className="field-group">
          <span className="panel-label">Category</span>
          <select className="field" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {names.map((c) => {
              const s = sections.find((x) => x.name === c);
              return <option key={c} value={c}>{c}{s?.soon ? " (Soon)" : ""}{!s ? " (not a section)" : ""}</option>;
            })}
          </select>
        </label>
        {currentSection?.soon && (
          <p className="pf-note warn">
            {currentSection.name} is marked Soon, so customers see &ldquo;coming soon&rdquo; for this section until Soon is switched off in <a href="/admin/sections" className="text-link">Sections</a>.
          </p>
        )}
        {product && !currentSection && (
          <p className="pf-note warn">{category} is no longer a section. Pick one of the sections above, or add it in <a href="/admin/sections" className="text-link">Sections</a>.</p>
        )}
      </section>

      <section className="form-block">
        <h2>Price and promo</h2>
        <label className="field-group">
          <span className="panel-label">Price (₦)</span>
          <input className="field" name="price" type="number" inputMode="decimal" min={0} step="1" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="19850" />
        </label>
        <div className="form-grid">
          <label className="field-group">
            <span className="panel-label">Promo price (₦), optional</span>
            <input className="field" name="promo_price" type="number" inputMode="decimal" min={0} step="1" value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} placeholder="Leave blank for no promo" />
          </label>
          <label className="field-group">
            <span className="panel-label">Promo label</span>
            <input className="field" name="promo_label" maxLength={40} defaultValue={product?.promo_label ?? ""} placeholder="Black Friday" />
          </label>
        </div>
        <div className="form-grid">
          <label className="field-group">
            <span className="panel-label">Promo starts (Lagos time), optional</span>
            <input className="field" name="promo_starts_at" type="datetime-local" value={promoStart} onChange={(e) => setPromoStart(e.target.value)} />
          </label>
          <label className="field-group">
            <span className="panel-label">Promo ends (Lagos time), optional</span>
            <input className="field" name="promo_ends_at" type="datetime-local" value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)} />
          </label>
        </div>
        <p className={`pf-note ${preview.tone}`} aria-live="polite"><strong>Customers pay:</strong> {preview.text}</p>
      </section>

      <section className="form-block">
        <h2>Affiliate commission</h2>
        <label className="field-group">
          <span className="panel-label">Commission for this product (%), optional</span>
          <input className="field" name="affiliate_rate" type="number" inputMode="decimal" min={0} max={100} step="0.1" defaultValue={product?.affiliate_rate ?? ""} placeholder="Blank = the affiliate's own rate" />
        </label>
        <p className="form-note">Leave blank and each affiliate earns their own rate on this product. Type 0 for no commission on it.</p>
      </section>

      <section className="form-block">
        <h2>Variants</h2>
        <div className="form-grid">
          <label className="field-group">
            <span className="panel-label">Sizes, separated by commas</span>
            <input className="field" name="sizes" value={sizesText} onChange={(e) => setSizesText(e.target.value)} />
          </label>
          <label className="field-group">
            <span className="panel-label">Colours, separated by commas</span>
            <input className="field" name="colors" value={colorsText} onChange={(e) => setColorsText(e.target.value)} placeholder="Black, White, Forest green" />
          </label>
        </div>

        <div className="pf-sold">
          <h3>Sold out combinations</h3>
          {sizes.length === 0 && colors.length === 0 ? (
            <p className="form-note">Add sizes or colours above to mark combinations as sold out.</p>
          ) : (
            <>
              <p className="form-note">Tick what is sold out. Customers can still pick it but can&apos;t buy it. The &ldquo;All&rdquo; boxes mark a whole colour or size.</p>
              <div className="ad-table-wrap">
                <table className="ad-table pf-grid">
                  <thead>
                    <tr>
                      <th>{colors.length > 0 && sizes.length > 0 ? "Colour \\ Size" : colors.length > 0 ? "Colour" : "Size"}</th>
                      {colors.length > 0 && sizes.map((s) => <th key={s}>{s}</th>)}
                      {colors.length > 0 && sizes.length > 0 && <th>All sizes</th>}
                      {colors.length > 0 && sizes.length === 0 && <th>Sold out</th>}
                      {colors.length === 0 && <th>Sold out</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {colors.length > 0 ? (
                      colors.map((c) => (
                        <tr key={c}>
                          <th scope="row">{c}</th>
                          {sizes.map((s) => (
                            <td key={s}>
                              <input type="checkbox" aria-label={`${c} ${s} sold out`} checked={soldOut.has(`${c}|${s}`) || soldOut.has(`${c}|*`)} disabled={soldOut.has(`${c}|*`)} onChange={() => toggleSold(`${c}|${s}`)} />
                            </td>
                          ))}
                          <td>
                            <input type="checkbox" aria-label={`All ${c} sold out`} checked={soldOut.has(`${c}|*`)} onChange={() => toggleSold(`${c}|*`)} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      sizes.map((s) => (
                        <tr key={s}>
                          <th scope="row">{s}</th>
                          <td>
                            <input type="checkbox" aria-label={`Size ${s} sold out`} checked={soldOut.has(`*|${s}`)} onChange={() => toggleSold(`*|${s}`)} />
                          </td>
                        </tr>
                      ))
                    )}
                    {colors.length > 0 && sizes.length > 0 && (
                      <tr>
                        <th scope="row">All colours</th>
                        {sizes.map((s) => (
                          <td key={s}>
                            <input type="checkbox" aria-label={`All colours in ${s} sold out`} checked={soldOut.has(`*|${s}`)} onChange={() => toggleSold(`*|${s}`)} />
                          </td>
                        ))}
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="form-block">
        <h2>Personalization</h2>
        <label className="check"><input type="checkbox" name="customizable" defaultChecked={product?.customizable ?? true} /> Customers can design on this product</label>
        <label className="check"><input type="checkbox" name="symbol_default" defaultChecked={product?.symbol_default ?? true} /> Design starts with the Nova Edge symbol</label>
        <label className="check"><input type="checkbox" name="allow_uploads" defaultChecked={product?.allow_uploads ?? true} /> Customers can upload their own images</label>
      </section>

      <section className="form-block">
        <h2>Visibility</h2>
        <label className="check"><input type="checkbox" name="active" defaultChecked={product?.active ?? true} /> Show in the shop</label>
        <label className="check"><input type="checkbox" name="in_stock" defaultChecked={product?.in_stock ?? true} /> In stock</label>
        <label className="check"><input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} /> Show on home page</label>
        <label className="field-group">
          <span className="panel-label">Order (smaller numbers come first)</span>
          <input className="field pf-narrow" name="sort_order" type="number" step="1" defaultValue={product?.sort_order ?? 0} />
        </label>
      </section>

      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-lg" disabled={pending || uploading}>
        {pending && <Loader2 size={18} className="spin" />} {product ? "Save changes" : "Publish product"}
      </button>
    </form>
  );
}
