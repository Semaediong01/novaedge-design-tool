// ContentForm.tsx — store wording form with a live hero preview
"use client";

import { useState } from "react";
import type { SiteContent } from "@/lib/types";
import { saveContent } from "./actions";
import "../products/products.css";

function Count({ value, max }: { value: string; max: number }) {
  return <span className="ct-count" style={{ display: "block" }}>{value.length} / {max}</span>;
}

export default function ContentForm({ content }: { content: SiteContent }) {
  const [v, setV] = useState({
    hero_eyebrow: content.hero_eyebrow,
    hero_title: content.hero_title,
    hero_accent: content.hero_accent,
    hero_sub: content.hero_sub,
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((c) => ({ ...c, [k]: e.target.value }));
  const lines = [0, 1, 2, 3].map((i) => content.announcements[i] ?? "");

  return (
    <form action={saveContent} className="admin-form pf">
      <section className="form-block">
        <h2>Announcement bar</h2>
        <p className="form-note">Up to 4 short lines that rotate at the top of the store. Leave a line blank to skip it.</p>
        {lines.map((line, i) => (
          <label key={i} className="field-group">
            <span className="panel-label">Line {i + 1}</span>
            <input className="field" name={`announcement_${i + 1}`} maxLength={80} defaultValue={line} />
          </label>
        ))}
      </section>

      <section className="form-block">
        <h2>Home page hero</h2>
        <div className="ct-preview" aria-label="Hero preview">
          <div className="eyebrow">{v.hero_eyebrow}</div>
          <h3>{v.hero_title}<em>{v.hero_accent}</em></h3>
          <p>{v.hero_sub}</p>
        </div>
        <label className="field-group">
          <span className="panel-label">Small heading</span>
          <input className="field" name="hero_eyebrow" maxLength={40} value={v.hero_eyebrow} onChange={set("hero_eyebrow")} />
          <Count value={v.hero_eyebrow} max={40} />
        </label>
        <div className="form-grid">
          <label className="field-group">
            <span className="panel-label">Title</span>
            <input className="field" name="hero_title" required maxLength={60} value={v.hero_title} onChange={set("hero_title")} />
            <Count value={v.hero_title} max={60} />
          </label>
          <label className="field-group">
            <span className="panel-label">Accent line (shown in green)</span>
            <input className="field" name="hero_accent" maxLength={60} value={v.hero_accent} onChange={set("hero_accent")} />
            <Count value={v.hero_accent} max={60} />
          </label>
        </div>
        <label className="field-group">
          <span className="panel-label">Text under the title</span>
          <textarea className="field" name="hero_sub" rows={3} maxLength={240} value={v.hero_sub} onChange={set("hero_sub")} />
          <Count value={v.hero_sub} max={240} />
        </label>
      </section>

      <section className="form-block">
        <h2>Footer and contact</h2>
        <label className="field-group">
          <span className="panel-label">Footer tagline</span>
          <input className="field" name="footer_tagline" maxLength={140} defaultValue={content.footer_tagline} />
        </label>
        <div className="form-grid">
          <label className="field-group">
            <span className="panel-label">Contact email</span>
            <input className="field" name="contact_email" type="email" maxLength={120} defaultValue={content.contact_email} />
          </label>
          <label className="field-group">
            <span className="panel-label">Contact phone</span>
            <input className="field" name="contact_phone" maxLength={30} defaultValue={content.contact_phone} />
          </label>
        </div>
        <label className="field-group">
          <span className="panel-label">Instagram (handle or link)</span>
          <input className="field" name="instagram" maxLength={100} defaultValue={content.instagram} placeholder="@novaedge" />
        </label>
      </section>

      <button type="submit" className="btn btn-lg">Save wording</button>
    </form>
  );
}
