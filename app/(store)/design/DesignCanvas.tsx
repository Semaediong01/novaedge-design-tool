// app/(store)/design/DesignCanvas.tsx
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias -- Konva node handles are untyped */

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import { Stage, Layer, Image as KonvaImage, Text, Rect, Circle, Transformer } from "react-konva";
import useImage from "use-image";
import { Type, Square, Circle as CircleIcon, ImagePlus, Trash2, Loader2, Check, Download, ShoppingCart, RotateCcw, LayoutTemplate } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/CartProvider";
import { naira } from "@/lib/format";
import { variantSoldOut } from "@/lib/pricing";
import {
  MONO_RATIO, SYMBOL_DEFAULT, SYMBOL_MAX, SYMBOL_MIN, TEE_PRINT_AREA,
  symbolSrc, teeColorKey, teeLayers,
  type SymbolTone, type TeeColor,
} from "@/lib/mockups";
import "@/components/mockups/mockups.css";

type ElementBase = { id: string; x: number; y: number; rotation: number };
type TextEl = ElementBase & { type: "text"; text: string; fontSize: number; fill: string };
type ImageEl = ElementBase & { type: "image"; src: string; width: number; height: number };
type ShapeEl = ElementBase & { type: "rect" | "circle"; width: number; height: number; fill: string };
type SymbolEl = ElementBase & { type: "symbol"; width: number; tone: SymbolTone };
type DesignElement = TextEl | ImageEl | ShapeEl | SymbolEl;

export type TemplateOption = { id: string; title: string; preview_url: string | null; elements: unknown[] };

export type TemplateSaveInput = { id: string | null; title: string; category: string; elements: unknown[]; previewUrl: string | null };
export type TemplateSaveResult = { ok: true; id: string } | { ok: false; error: string };

/** Admin template editing: the same designer, without product, size or cart. */
export type TemplateDraft = {
  id: string | null;
  title: string;
  category: string;
  categories: string[];
  elements: unknown[];
  previewUrl: string | null;
  save: (input: TemplateSaveInput) => Promise<TemplateSaveResult>;
};

type Props = {
  userId: string;
  /** mockup = a plain tee drawn from the built-in realistic mockups; otherwise `image` is the admin's photo. `price` is what the customer pays (promo included). */
  product: {
    id: string; title: string; image: string | null; mockup: boolean; price: number; sizes: string[]; colors: string[];
    symbolDefault?: boolean; allowUploads?: boolean; soldOutVariants?: string[];
  };
  initialDesign: { id: string; elements: DesignElement[]; printUrl: string | null } | null;
  initialSize: string;
  initialColor: string;
  mode?: "design" | "template";
  /** Active templates for this product's category (customer mode). */
  templates?: TemplateOption[];
  initialTemplateId?: string | null;
  /** Required when mode is "template". */
  templateDraft?: TemplateDraft;
};

const ELEMENT_TYPES = new Set(["text", "image", "rect", "circle", "symbol"]);
const newElementId = () => "e" + crypto.randomUUID().replace(/-/g, "");

const LOGICAL_SIZE = 500;
const PHOTO_PRINT_AREA = { x: 100, y: 85, width: 300, height: 365 };
type Area = { x: number; y: number; width: number; height: number };
const DEFAULT_FILL = "#1E3A1C";

function makeClamp(area: Area) {
  return function clampDrag(this: any, pos: { x: number; y: number }) {
    const node = this;
    const rect = node.getClientRect({ relativeTo: node.getStage() });
    const w = rect.width || 0;
    const h = rect.height || 0;
    const minX = area.x;
    const minY = area.y;
    const maxX = Math.max(minX, area.x + area.width - w);
    const maxY = Math.max(minY, area.y + area.height - h);
    return {
      x: Math.min(Math.max(pos.x, minX), maxX),
      y: Math.min(Math.max(pos.y, minY), maxY),
    };
  };
}

function GarmentBackground({ url, opacity = 1 }: { url: string; opacity?: number }) {
  const [image] = useImage(url, "anonymous");
  return <KonvaImage image={image} name="garment" width={LOGICAL_SIZE} height={LOGICAL_SIZE} opacity={opacity} listening={false} />;
}

function SymbolNode({ el, color, clamp, onSelect, onChange }: { el: SymbolEl; color: TeeColor; clamp: any; onSelect: () => void; onChange: (el: SymbolEl) => void }) {
  const [image] = useImage(symbolSrc(el.tone, color), "anonymous");
  const ref = useRef<any>(null);
  return (
    <KonvaImage
      ref={ref}
      image={image}
      name={el.id}
      x={el.x} y={el.y} width={el.width} height={el.width * MONO_RATIO} rotation={el.rotation}
      draggable dragBoundFunc={clamp}
      onClick={onSelect} onTap={onSelect}
      onDragEnd={(e: any) => onChange({ ...el, x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current;
        onChange({ ...el, x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.min(SYMBOL_MAX, Math.max(SYMBOL_MIN, node.width() * node.scaleX())) });
        node.scaleX(1); node.scaleY(1);
      }}
    />
  );
}

function UploadedImage({ el, onSelect, onChange, clamp }: any) {
  const [image] = useImage(el.src, "anonymous");
  const shapeRef = useRef<any>(null);
  return (
    <KonvaImage
      ref={shapeRef}
      image={image}
      name={el.id}
      x={el.x} y={el.y} width={el.width} height={el.height} rotation={el.rotation}
      draggable dragBoundFunc={clamp}
      onClick={onSelect} onTap={onSelect}
      onDragEnd={(e: any) => onChange({ ...el, x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = shapeRef.current;
        onChange({
          ...el, x: node.x(), y: node.y(), rotation: node.rotation(),
          width: node.width() * node.scaleX(), height: node.height() * node.scaleY(),
        });
        node.scaleX(1); node.scaleY(1);
      }}
    />
  );
}

export default function DesignCanvas({ userId, product, initialDesign, initialSize, initialColor, mode = "design", templates = [], initialTemplateId = null, templateDraft }: Props) {
  const { upsertDesignLine } = useCart();
  const isTemplateMode = mode === "template" && Boolean(templateDraft);
  const symbolAllowed = product.symbolDefault !== false;
  const uploadsAllowed = isTemplateMode || product.allowUploads !== false;

  const isTee = product.mockup;
  const area: Area = isTee ? TEE_PRINT_AREA : PHOTO_PRINT_AREA;
  const clampDrag = useMemo(() => makeClamp(area), [isTee]); // eslint-disable-line react-hooks/exhaustive-deps

  // Plain tees open with the small Nova Edge symbol on the chest; the customer can resize, move or remove it.
  const newSymbol = (): SymbolEl => ({ id: newElementId(), type: "symbol", x: SYMBOL_DEFAULT.x, y: SYMBOL_DEFAULT.y, rotation: 0, width: SYMBOL_DEFAULT.width, tone: "auto" });
  // Copies a template's elements with fresh ids; drops the symbol when this product doesn't start with one.
  const fromTemplate = (raw: unknown[]): DesignElement[] =>
    raw
      .filter((el): el is DesignElement => Boolean(el) && typeof el === "object" && ELEMENT_TYPES.has((el as { type?: string }).type ?? ""))
      .filter((el) => el.type !== "symbol" || (isTee && symbolAllowed))
      .map((el) => ({ ...el, id: newElementId() }));

  const [elements, setElements] = useState<DesignElement[]>(() => {
    if (isTemplateMode && templateDraft) return (templateDraft.elements as DesignElement[]) ?? [];
    if (initialDesign) return initialDesign.elements;
    const tpl = initialTemplateId ? templates.find((t) => t.id === initialTemplateId) : null;
    if (tpl) return fromTemplate(tpl.elements);
    return isTee && symbolAllowed ? [newSymbol()] : [];
  });
  const [tplTitle, setTplTitle] = useState(templateDraft?.title ?? "");
  const [tplCategory, setTplCategory] = useState(templateDraft?.category ?? "T-Shirts");
  const [templateId, setTemplateId] = useState<string | null>(templateDraft?.id ?? null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(initialDesign?.id ?? null);
  const [printUrl, setPrintUrl] = useState<string | null>(initialDesign?.printUrl ?? null);
  const [size, setSize] = useState(initialSize);
  const [color, setColor] = useState(initialColor);
  const colorKey: TeeColor = teeColorKey(color) ?? "white";
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [printPreview, setPrintPreview] = useState<string | null>(null);
  const [cartStatus, setCartStatus] = useState<string>("");
  const [added, setAdded] = useState(false);
  const [scale, setScale] = useState(1);

  const transformerRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const guideRectRef = useRef<any>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const propertiesBarRef = useRef<HTMLDivElement>(null);
  const symbolPanelRef = useRef<HTMLDivElement>(null);
  const toolRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateScale() {
      if (!canvasWrapRef.current) return;
      const w = canvasWrapRef.current.offsetWidth;
      setScale(Math.min(w, LOGICAL_SIZE * 1.2) / LOGICAL_SIZE);
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const attachTransformer = () => {
    if (!transformerRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    const selectedNode = selectedId ? stage.findOne(`.${selectedId}`) : null;
    transformerRef.current.nodes(selectedNode ? [selectedNode] : []);
    transformerRef.current.getLayer().batchDraw();
  };

  useEffect(() => {
    attachTransformer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, elements]);

  // Click anywhere that isn't the canvas, the properties bar, or the tool rail clears the selection.
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideCanvas = canvasWrapRef.current?.contains(target);
      const insidePanel = propertiesBarRef.current?.contains(target) || symbolPanelRef.current?.contains(target);
      const insideRail = toolRailRef.current?.contains(target);
      if (!insideCanvas && !insidePanel && !insideRail) {
        setSelectedId(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const updateElement = (updated: DesignElement) =>
    setElements((els) => els.map((el) => (el.id === updated.id ? updated : el)));

  // New text and shapes start in a colour that shows up on the chosen garment.
  const newFill = isTee && colorKey === "black" ? "#FFFFFF" : DEFAULT_FILL;

  const addText = () =>
    setElements((els) => [...els, { id: newElementId(), type: "text", text: "New Text", x: 170, y: 220, rotation: 0, fontSize: 28, fill: newFill }]);

  const addShape = (type: "rect" | "circle") =>
    setElements((els) => [...els, { id: newElementId(), type, x: 170, y: 170, rotation: 0, width: 100, height: 100, fill: newFill }]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setSaveStatus("Choose an image file.");
    if (file.size > 8 * 1024 * 1024) return setSaveStatus("Image is over 8 MB. Pick a smaller one.");

    setSaveStatus("Uploading image…");
    const supabase = createClient();
    // Customers write to their own folder in design-uploads; admins (template mode) write to product-images.
    const bucket = isTemplateMode ? "product-images" : "design-uploads";
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = isTemplateMode ? `templates/${crypto.randomUUID()}.${ext}` : `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (error) return setSaveStatus("Upload failed. Try again.");

    const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    setElements((els) => [...els, { id: newElementId(), type: "image", src: url, x: 170, y: 170, rotation: 0, width: 150, height: 150 }]);
    setSaveStatus("");
  };

  const deleteSelected = () => {
    setElements((els) => els.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  // Hides the guide and selection (and optionally the garment), snaps a PNG, then restores the UI.
  // `ratio` is output pixels per logical unit; `crop` limits the shot to the print area.
  const snapshot = (opts: { ratio: number; crop: boolean; hideGarment: boolean }): string | null => {
    const stage = stageRef.current;
    const guide = guideRectRef.current;
    if (!stage || !guide) return null;

    const garments: any[] = opts.hideGarment ? stage.find(".garment") : [];
    guide.visible(false);
    garments.forEach((n) => n.visible(false));
    transformerRef.current?.nodes([]);
    guide.getLayer().batchDraw();

    try {
      return stage.toDataURL({
        ...(opts.crop ? { x: area.x * scale, y: area.y * scale, width: area.width * scale, height: area.height * scale } : {}),
        pixelRatio: scale > 0 ? opts.ratio / scale : opts.ratio,
      });
    } finally {
      guide.visible(true);
      garments.forEach((n) => n.visible(true));
      guide.getLayer().batchDraw();
      attachTransformer();
    }
  };

  const capturePrintReady = (): string | null => {
    const dataUrl = snapshot({ ratio: 2, crop: true, hideGarment: false });
    if (dataUrl) setPrintPreview(dataUrl);
    return dataUrl;
  };

  // Garment-free, transparent artwork at ~4x. Never blocks saving: any failure just means no production file.
  const exportProduction = async (designIdValue: string): Promise<string | null> => {
    try {
      const dataUrl = snapshot({ ratio: 4, crop: true, hideGarment: true });
      if (!dataUrl) return null;
      const blob = await (await fetch(dataUrl)).blob();
      const supabase = createClient();
      const stable = `${userId}/${designIdValue}-production.png`;
      let usedPath = stable;
      let { error } = await supabase.storage.from("print-files").upload(stable, blob, { contentType: "image/png", upsert: true });
      if (error) {
        // Overwriting needs an update policy; without it, fall back to a fresh file name.
        usedPath = `${userId}/${designIdValue}-production-${Date.now()}.png`;
        ({ error } = await supabase.storage.from("print-files").upload(usedPath, blob, { contentType: "image/png" }));
      }
      if (error) return null;
      const base = supabase.storage.from("print-files").getPublicUrl(usedPath).data.publicUrl;
      const url = usedPath === stable ? `${base}?v=${Date.now()}` : base;
      const { error: updateError } = await supabase.from("designs").update({ production_url: url }).eq("id", designIdValue);
      return updateError ? null : url;
    } catch {
      return null;
    }
  };

  // Saves the layout and the print-ready PNG to Supabase.
  const handleSave = async (): Promise<{ id: string; printUrl: string } | null> => {
    setSaving(true);
    setSaveStatus("");
    setCartStatus("");
    try {
      const dataUrl = capturePrintReady();
      if (!dataUrl) throw new Error("The canvas isn't ready yet.");

      const supabase = createClient();
      let id = designId;
      if (!id) {
        const { data, error } = await supabase
          .from("designs")
          .insert({ user_id: userId, product_id: product.id, elements })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("Could not create the design.");
        id = data.id as string;
      }

      const blob = await (await fetch(dataUrl)).blob();
      const path = `${userId}/${id}-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from("print-files").upload(path, blob, { contentType: "image/png" });
      if (uploadError) throw uploadError;
      const url = supabase.storage.from("print-files").getPublicUrl(path).data.publicUrl;

      const { error: updateError } = await supabase.from("designs").update({ elements, print_url: url }).eq("id", id);
      if (updateError) throw updateError;

      await exportProduction(id);

      setDesignId(id);
      setPrintUrl(url);
      setSaveStatus("Saved");
      return { id, printUrl: url };
    } catch {
      setSaveStatus("Couldn't save. Check your connection and try again.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const soldOut = !isTemplateMode && variantSoldOut(product.soldOutVariants, color, size);

  const handleAddToCart = async () => {
    if (soldOut) return setCartStatus(`${color} in ${size} is sold out. Pick another size or colour.`);
    const saved = await handleSave(); // always save first so the cart gets the latest version
    if (!saved) return;
    upsertDesignLine({
      productId: product.id,
      title: product.title,
      image: isTee ? `/mockups/tee-${colorKey}${hasSymbol ? "-symbol" : ""}.png` : product.image,
      price: product.price, // already the effective (promo-aware) price from the page
      size,
      color,
      quantity: 1,
      designId: saved.id,
      printUrl: saved.printUrl,
    });
    setAdded(true);
    setCartStatus("Added to your cart.");
  };

  const handleSaveTemplate = async () => {
    if (!templateDraft) return;
    setSaving(true);
    setSaveStatus("");
    try {
      const title = tplTitle.trim();
      if (!title) throw new Error("Give the template a title first.");
      const dataUrl = snapshot({ ratio: 1.2, crop: false, hideGarment: false });
      let previewUrl = templateDraft.previewUrl;
      if (dataUrl) {
        const supabase = createClient();
        const blob = await (await fetch(dataUrl)).blob();
        const path = `templates/preview-${crypto.randomUUID()}.png`;
        const { error } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/png" });
        if (!error) previewUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      }
      const result = await templateDraft.save({ id: templateId, title, category: tplCategory, elements, previewUrl });
      if (!result.ok) throw new Error(result.error);
      if (!templateId) window.history.replaceState(null, "", `/admin/templates/${result.id}`);
      setTemplateId(result.id);
      setSaveStatus("Saved");
    } catch (e) {
      setSaveStatus(e instanceof Error && e.message ? e.message : "Couldn't save the template. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const pickTemplate = (tpl: TemplateOption) => {
    const hasOwnWork = elements.some((el) => el.type !== "symbol");
    if (hasOwnWork && !window.confirm("Replace what's on the shirt with this template? Your current design will be lost.")) return;
    setElements(fromTemplate(tpl.elements));
    setSelectedId(null);
    setTemplatesOpen(false);
  };

  const symbolEl = elements.find((el) => el.type === "symbol") as SymbolEl | undefined;
  const hasSymbol = Boolean(symbolEl);
  const addSymbol = () => {
    const sym = newSymbol();
    setElements((els) => [...els, sym]);
    setSelectedId(sym.id);
  };
  const removeSymbol = () => {
    setElements((els) => els.filter((el) => el.type !== "symbol"));
    setSelectedId(null);
  };
  // Resizing from the slider keeps the symbol centred on the same spot.
  const setSymbolWidth = (w: number) => {
    if (!symbolEl) return;
    const oldH = symbolEl.width * MONO_RATIO;
    const newH = w * MONO_RATIO;
    updateElement({ ...symbolEl, width: w, x: symbolEl.x + (symbolEl.width - w) / 2, y: symbolEl.y + (oldH - newH) / 2 });
  };

  const selectedEl = elements.find((el) => el.id === selectedId && el.type !== "symbol" && el.type !== "image") as TextEl | ShapeEl | undefined;

  return (
    <div className="workspace">
      <h1 className="workspace-title">{isTemplateMode ? (templateId ? "Edit template" : "New template") : product.title}</h1>

      {isTemplateMode && templateDraft && (
        <div className="template-meta">
          <label className="field-group grow">
            <span className="panel-label">Title</span>
            <input type="text" className="field" value={tplTitle} maxLength={80} onChange={(e) => setTplTitle(e.target.value)} placeholder="e.g. Sunday Service" />
          </label>
          <label className="field-group">
            <span className="panel-label">Category</span>
            <select className="field" value={tplCategory} onChange={(e) => setTplCategory(e.target.value)}>
              {(templateDraft.categories.includes(tplCategory) ? templateDraft.categories : [tplCategory, ...templateDraft.categories]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="design-options">
        {!isTemplateMode && <span className="design-price">{naira(product.price)} · customizing is included</span>}
        {isTemplateMode && <span className="design-price">Tee colour</span>}
        {!isTemplateMode && product.sizes.length > 0 && (
          <div className="option-row" role="group" aria-label="Size">
            {product.sizes.map((s) => (
              <button key={s} type="button" className={`chip${s === size ? " active" : ""}`} aria-pressed={s === size} onClick={() => setSize(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {product.colors.length > 0 && (
          <div className="option-row" role="group" aria-label="Color">
            {product.colors.map((c) => (
              <button key={c} type="button" className={`chip${c === color ? " active" : ""}`} aria-pressed={c === color} onClick={() => setColor(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="workspace-grid">
        {/* Tool rail */}
        <div className="workspace-rail tool-rail" ref={toolRailRef}>
          <button className="tool-btn" onClick={addText}>
            <Type size={18} /> Text
          </button>
          <button className="tool-btn" onClick={() => addShape("rect")}>
            <Square size={18} /> Box
          </button>
          <button className="tool-btn" onClick={() => addShape("circle")}>
            <CircleIcon size={18} /> Circle
          </button>
          {uploadsAllowed && (
            <label className="tool-btn" style={{ cursor: "pointer" }}>
              <ImagePlus size={18} /> Upload
              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
            </label>
          )}
          {selectedId && (
            <button className="tool-btn danger" onClick={deleteSelected}>
              <Trash2 size={18} /> Delete
            </button>
          )}

          <div className="rail-divider" />

          <button className="tool-btn tool-btn-primary" onClick={isTemplateMode ? handleSaveTemplate : handleSave} disabled={saving}>
            {saving ? <Loader2 size={18} className="spin" /> : <Check size={18} />}
            {isTemplateMode ? "Save template" : "Save"}
          </button>
          {!isTemplateMode && (
            <button className="tool-btn tool-btn-primary" onClick={handleAddToCart} disabled={saving || soldOut || (!isTee && elements.length === 0)}>
              <ShoppingCart size={18} />
              {added ? "Update cart" : "Add to cart"}
            </button>
          )}
          {saveStatus && <p className="save-status" role="status">{saveStatus}</p>}
        </div>

        {/* Canvas + properties */}
        <div className="workspace-canvas">
          {soldOut && <p className="form-note" role="status">{color} in {size} is sold out. Pick another size or colour.</p>}
          {!isTemplateMode && templates.length > 0 && (
            <div className="template-picker">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setTemplatesOpen((o) => !o)} aria-expanded={templatesOpen}>
                <LayoutTemplate size={15} /> Start from a template
              </button>
              {templatesOpen && (
                <ul className="template-grid">
                  {templates.map((t) => (
                    <li key={t.id}>
                      <button type="button" className="template-card" onClick={() => pickTemplate(t)}>
                        {t.preview_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.preview_url} alt="" loading="lazy" />
                        ) : (
                          <span className="template-card-empty">No preview</span>
                        )}
                        <span>{t.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="canvas-frame">
            <div className="canvas-inner" ref={canvasWrapRef}>
              <Stage
                width={LOGICAL_SIZE * scale}
                height={LOGICAL_SIZE * scale}
                scaleX={scale}
                scaleY={scale}
                ref={stageRef}
                style={{ borderRadius: "8px", overflow: "hidden", display: "block" }}
                onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
              >
                <Layer>
                  {isTee ? <GarmentBackground url={teeLayers(colorKey).bare} /> : product.image ? <GarmentBackground url={product.image} /> : null}

                  {elements.map((el) => {
                    const commonProps = {
                      draggable: true,
                      dragBoundFunc: clampDrag,
                      onClick: () => setSelectedId(el.id),
                      onTap: () => setSelectedId(el.id),
                      onDragEnd: (e: any) => updateElement({ ...el, x: e.target.x(), y: e.target.y() }),
                      name: el.id,
                    };

                    if (el.type === "text") {
                      return (
                        <Text
                          key={el.id}
                          {...commonProps}
                          text={el.text} x={el.x} y={el.y} fontSize={el.fontSize} fill={el.fill} rotation={el.rotation}
                          onTransformEnd={(e: any) => {
                            const node = e.target;
                            updateElement({ ...el, x: node.x(), y: node.y(), rotation: node.rotation(), fontSize: Math.round(el.fontSize * node.scaleX()) });
                            node.scaleX(1); node.scaleY(1);
                          }}
                        />
                      );
                    }
                    if (el.type === "symbol") {
                      return <SymbolNode key={el.id} el={el} color={colorKey} clamp={clampDrag} onSelect={() => setSelectedId(el.id)} onChange={updateElement as (e: SymbolEl) => void} />;
                    }
                    if (el.type === "image") {
                      return <UploadedImage key={el.id} el={el} clamp={clampDrag} onSelect={() => setSelectedId(el.id)} onChange={updateElement} />;
                    }
                    if (el.type === "rect") {
                      return (
                        <Rect
                          key={el.id}
                          {...commonProps}
                          x={el.x} y={el.y} width={el.width} height={el.height} fill={el.fill} rotation={el.rotation}
                          onTransformEnd={(e: any) => {
                            const node = e.target;
                            updateElement({ ...el, x: node.x(), y: node.y(), rotation: node.rotation(), width: node.width() * node.scaleX(), height: node.height() * node.scaleY() });
                            node.scaleX(1); node.scaleY(1);
                          }}
                        />
                      );
                    }
                    if (el.type === "circle") {
                      return (
                        <Circle
                          key={el.id}
                          {...commonProps}
                          x={el.x} y={el.y} radius={el.width / 2} fill={el.fill} rotation={el.rotation}
                          onTransformEnd={(e: any) => {
                            const node = e.target;
                            updateElement({ ...el, x: node.x(), y: node.y(), rotation: node.rotation(), width: el.width * node.scaleX() });
                            node.scaleX(1); node.scaleY(1);
                          }}
                        />
                      );
                    }
                    return null;
                  })}

                  {/* Folds and highlights sit above the artwork so the print follows the cloth. */}
                  {isTee && <GarmentBackground url={teeLayers(colorKey).shade} />}
                  {isTee && teeLayers(colorKey).lightOpacity > 0 && <GarmentBackground url={teeLayers(colorKey).light} opacity={teeLayers(colorKey).lightOpacity} />}

                  <Rect
                    ref={guideRectRef}
                    x={area.x} y={area.y} width={area.width} height={area.height}
                    stroke="#1E3A1C" strokeWidth={1.5} dash={[7, 5]}
                    listening={false}
                  />

                  <Transformer
                    ref={transformerRef}
                    anchorStroke="#1E3A1C"
                    anchorFill="#FFFFFF"
                    anchorSize={9}
                    anchorCornerRadius={4}
                    borderStroke="#1E3A1C"
                    borderDash={[5, 4]}
                    borderStrokeWidth={1.5}
                    rotateAnchorOffset={24}
                    boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
                  />
                </Layer>
              </Stage>
            </div>
          </div>

          {isTee && (
            <div className="symbol-panel" ref={symbolPanelRef}>
              <div className="symbol-panel-head">
                <strong>Nova Edge symbol</strong>
                <span className="muted">{hasSymbol ? "On your chest. Drag it on the shirt, or use these controls." : "Removed. Your tee will be completely plain."}</span>
              </div>
              {hasSymbol && symbolEl ? (
                <div className="symbol-controls">
                  <label className="field-group grow">
                    <span className="panel-label">Size</span>
                    <input type="range" min={SYMBOL_MIN} max={SYMBOL_MAX} step={1} value={Math.round(symbolEl.width)} onChange={(e) => setSymbolWidth(Number(e.target.value))} aria-label="Symbol size" />
                  </label>
                  <div className="field-group">
                    <span className="panel-label">Colour</span>
                    <div className="option-row" role="group" aria-label="Symbol colour">
                      {(["auto", "white", "black", "green"] as SymbolTone[]).map((t) => (
                        <button key={t} type="button" className={`chip${symbolEl.tone === t ? " active" : ""}`} aria-pressed={symbolEl.tone === t} onClick={() => updateElement({ ...symbolEl, tone: t })}>
                          {t === "auto" ? "Auto" : t[0].toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="symbol-actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => updateElement({ ...symbolEl, x: SYMBOL_DEFAULT.x, y: SYMBOL_DEFAULT.y, width: SYMBOL_DEFAULT.width, rotation: 0 })}>
                      <RotateCcw size={14} /> Reset
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={removeSymbol}>
                      <Trash2 size={14} /> Remove symbol
                    </button>
                  </div>
                </div>
              ) : (
                <div className="symbol-actions">
                  <button type="button" className="btn btn-sm" onClick={addSymbol}>
                    Add the symbol back
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedEl && (
            <div className="properties-bar" ref={propertiesBarRef}>
              <div className="field-group">
                <span className="panel-label">Color</span>
                <input
                  type="color" className="swatch"
                  value={selectedEl.fill ?? DEFAULT_FILL}
                  onChange={(e) => updateElement({ ...selectedEl, fill: e.target.value })}
                />
              </div>
              {selectedEl.type === "text" && (
                <>
                  <div className="field-group grow">
                    <span className="panel-label">Text</span>
                    <input
                      type="text" className="field"
                      value={selectedEl.text ?? ""}
                      onChange={(e) => updateElement({ ...selectedEl, text: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <span className="panel-label">Size</span>
                    <input
                      type="number" className="field" style={{ width: "70px" }}
                      value={selectedEl.fontSize ?? 28}
                      onChange={(e) => updateElement({ ...selectedEl, fontSize: Number(e.target.value) })}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {!selectedEl && !printPreview && !printUrl && (
            <p className="empty-hint">Select an element on the shirt to edit its color, text, or size. Drag the corners to resize.</p>
          )}

          {!isTemplateMode && (printPreview || printUrl) && (
            <div className="print-ready">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={(printPreview ?? printUrl) as string} alt="Print-ready design" />
              <div className="print-ready-actions">
                <span className="panel-label" style={{ marginBottom: "0.1rem" }}>Print-ready file</span>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <a href={(printPreview ?? printUrl) as string} download={`novaedge-design-${designId ?? "draft"}.png`} className="btn btn-sm btn-ghost">
                    <Download size={15} /> Download
                  </a>
                  <button className="btn btn-sm" onClick={handleAddToCart} disabled={saving || soldOut || (!isTee && elements.length === 0)}>
                    <ShoppingCart size={15} /> {added ? "Update cart" : "Add to cart"}
                  </button>
                  {added && (
                    <Link href="/cart" className="btn btn-sm btn-green">
                      View cart
                    </Link>
                  )}
                </div>
                {cartStatus && <p className="cart-status" role="status">{cartStatus}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
