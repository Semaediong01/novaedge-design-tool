// app/admin/(panel)/products/ProductForm.tsx — add / edit a product, with photo upload
"use client";

import { useActionState, useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveProduct, type FormState } from "../../actions";
import { CATEGORIES, type Product } from "@/lib/types";

export default function ProductForm({ product }: { product?: Product }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProduct, {});
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <form action={action} className="admin-form">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="images" value={images.join("\n")} />

      <section className="form-block">
        <h2>Photos</h2>
        <p className="form-note">
          The first photo is the main one. For customizable products it is also the garment in the designer, so use a square, front-facing photo of the plain garment on a clean background.
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
          <input className="field" name="title" required defaultValue={product?.title} placeholder="Classic tee, white" />
        </label>
        <label className="field-group">
          <span className="panel-label">Description</span>
          <textarea className="field" name="description" rows={4} defaultValue={product?.description} />
        </label>
        <div className="form-grid">
          <label className="field-group">
            <span className="panel-label">Category</span>
            <select className="field" name="category" defaultValue={product?.category ?? CATEGORIES[0]}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span className="panel-label">Price (₦)</span>
            <input className="field" name="price" type="number" min={0} step="1" required defaultValue={product?.price} placeholder="19850" />
          </label>
        </div>
        <div className="form-grid">
          <label className="field-group">
            <span className="panel-label">Sizes, separated by commas</span>
            <input className="field" name="sizes" defaultValue={(product?.sizes ?? ["S", "M", "L", "XL"]).join(", ")} />
          </label>
          <label className="field-group">
            <span className="panel-label">Colors, separated by commas</span>
            <input className="field" name="colors" defaultValue={product?.colors.join(", ")} placeholder="Black, White, Forest green" />
          </label>
        </div>
      </section>

      <section className="form-block">
        <h2>Visibility</h2>
        <label className="check"><input type="checkbox" name="active" defaultChecked={product?.active ?? true} /> Show in the shop</label>
        <label className="check"><input type="checkbox" name="in_stock" defaultChecked={product?.in_stock ?? true} /> In stock</label>
        <label className="check"><input type="checkbox" name="customizable" defaultChecked={product?.customizable ?? true} /> Customers can design on this product</label>
      </section>

      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-lg" disabled={pending || uploading}>
        {pending && <Loader2 size={18} className="spin" />} {product ? "Save changes" : "Publish product"}
      </button>
    </form>
  );
}
