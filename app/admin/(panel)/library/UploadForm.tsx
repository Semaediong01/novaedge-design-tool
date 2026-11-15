// UploadForm.tsx — pick artwork, upload it to storage from the browser, then save it to the library
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addLibraryItem } from "./actions";

const MAX_BYTES = 5 * 1024 * 1024;

export default function UploadForm({ categories }: { categories: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && !title.trim()) {
      setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 60));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("");
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Choose an image first."); return; }
    if (!["image/png", "image/svg+xml", "image/jpeg", "image/webp"].includes(file.type)) { setError("Use a PNG, SVG, JPG or WEBP image."); return; }
    if (file.size > MAX_BYTES) { setError("Image is over 5 MB. Pick a smaller one."); return; }
    if (!title.trim()) { setError("Give it a title."); return; }

    setBusy(true);
    setStatus("Uploading…");
    const supabase = createClient();
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `library/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
    if (upErr) { setBusy(false); setStatus(""); setError("Upload failed. Try again."); return; }
    const url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;

    setStatus("Saving…");
    const res = await addLibraryItem({ title: title.trim(), category: category.trim() || "General", url });
    setBusy(false);
    if (!res.ok) { setStatus(""); setError(res.error); return; }
    setStatus("Added to the library.");
    setTitle("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="ad-form lib-form">
      <label className="field-group">
        <span className="panel-label">Image (PNG, SVG, JPG or WEBP, up to 5 MB)</span>
        <input ref={fileRef} className="field" type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={onFile} required />
      </label>
      <label className="field-group">
        <span className="panel-label">Title</span>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required />
      </label>
      <label className="field-group">
        <span className="panel-label">Category</span>
        <input className="field" list="lib-categories" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} required />
        <datalist id="lib-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </label>
      <div className="ad-actions">
        <button type="submit" className="btn" disabled={busy}>{busy ? "Working…" : "Add to library"}</button>
      </div>
      {status && <p className="ad-hint" role="status">{status}</p>}
      {error && <p className="ad-flash err" role="alert">{error}</p>}
    </form>
  );
}
