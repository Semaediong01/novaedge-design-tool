// app/(store)/design/DesignCanvas.tsx
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias -- Konva node handles are untyped */

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Stage, Layer, Group, Image as KonvaImage, Text, Rect, Circle, Shape, Transformer } from "react-konva";
import useImage from "use-image";
import { Type, Square, Circle as CircleIcon, ImagePlus, Trash2, Loader2, Check, Download, ShoppingCart, RotateCcw, LayoutTemplate, Sparkles, Frame as FrameIcon, Shapes } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/CartProvider";
import { naira } from "@/lib/format";
import { variantSoldOut } from "@/lib/pricing";
import {
  MONO_RATIO, SYMBOL_DEFAULT, SYMBOL_MAX, SYMBOL_MIN, printAreaFor,
  symbolSrc, teeColorHex, teeColorKey, garmentLayers,
  type GarmentBase, type SymbolTone, type TeeColor,
} from "@/lib/mockups";
import type { LibraryItem } from "@/lib/library";
import { TEE_COLOR_LIST } from "@/lib/mockups";
import { DESIGN_FONTS, DEFAULT_FONT, cssFamily, fontOf, loadFonts, warmFonts } from "@/lib/fonts";
import { STICKERS, stickerSrc } from "@/lib/stickers";
import { FRAME_SHAPES, coverFit, frameClip, frameThumbPath, type FrameShape } from "@/lib/frames";
import "@/components/mockups/mockups.css";

/** `side` is "back" for elements on the back of the tee; front elements have no side (so older designs stay valid). */
type ElementBase = { id: string; x: number; y: number; rotation: number; side?: "back" };
type TextEl = ElementBase & { type: "text"; text: string; fontSize: number; fill: string; fontFamily?: string; bold?: boolean };
type ImageEl = ElementBase & { type: "image"; src: string; width: number; height: number };
type ShapeEl = ElementBase & { type: "rect" | "circle"; width: number; height: number; fill: string };
type SymbolEl = ElementBase & { type: "symbol"; width: number; tone: SymbolTone };
type StickerEl = ElementBase & { type: "sticker"; key: string; width: number; fill: string };
/** A shape that crops a photo. `zoom` >= 1; `offX`/`offY` (-1..1) slide the photo inside the frame. */
type FrameEl = ElementBase & { type: "frame"; shape: FrameShape; width: number; height: number; src: string | null; zoom: number; offX: number; offY: number };
type DesignElement = TextEl | ImageEl | ShapeEl | SymbolEl | StickerEl | FrameEl;
type Tab = "text" | "graphics" | "frames" | "upload" | "shapes" | "templates";

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

/** Admin "Create product": a design placed on the standby mockup becomes a product. */
export type ProductSaveInput = {
  id: string;
  base: GarmentBase;
  title: string;
  description: string;
  price: number;
  colors: string[];
  customizable: boolean;
  elements: unknown[];
  art: { front: string | null; back: string | null };
  previews: Record<string, { front?: string; back?: string }>;
};
export type ProductDraft = {
  id: string | null;
  base?: GarmentBase;
  title: string;
  description: string;
  price: number;
  colors: string[];
  customizable: boolean;
  elements: unknown[];
  save: (input: ProductSaveInput) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
};

type Props = {
  userId: string;
  /** mockup = a plain tee drawn from the built-in realistic mockups; otherwise `image` is the admin's photo. `price` is what the customer pays (promo included). */
  product: {
    id: string; title: string; image: string | null; mockup: boolean; price: number; sizes: string[]; colors: string[];
    symbolDefault?: boolean; allowUploads?: boolean; soldOutVariants?: string[]; backPrice?: number; presetElements?: unknown[]; base?: GarmentBase;
  };
  initialDesign: { id: string; elements: DesignElement[]; printUrl: string | null; hasBack?: boolean } | null;
  initialSize: string;
  initialColor: string;
  mode?: "design" | "template" | "product";
  /** Active templates for this product's category (customer mode). */
  templates?: TemplateOption[];
  initialTemplateId?: string | null;
  /** Required when mode is "template". */
  templateDraft?: TemplateDraft;
  /** Required when mode is "product". */
  productDraft?: ProductDraft;
  /** Artwork the store owner uploaded in Admin -> Design library. */
  library?: LibraryItem[];
};

const ELEMENT_TYPES = new Set(["text", "image", "rect", "circle", "symbol", "sticker", "frame"]);
const newElementId = () => "e" + crypto.randomUUID().replace(/-/g, "");

const LOGICAL_SIZE = 500;
const PHOTO_PRINT_AREA = { x: 100, y: 85, width: 300, height: 365 };
type Area = { x: number; y: number; width: number; height: number };
const DEFAULT_FILL = "#1E3A1C";
type Side = "front" | "back";
const sideOf = (el: { side?: string }): Side => (el.side === "back" ? "back" : "front");

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

function StickerNode({ el, clamp, onSelect, onChange }: { el: StickerEl; clamp: any; onSelect: () => void; onChange: (el: StickerEl) => void }) {
  const [image] = useImage(stickerSrc(el.key, el.fill), "anonymous");
  const ref = useRef<any>(null);
  return (
    <KonvaImage
      ref={ref}
      image={image}
      name={el.id}
      x={el.x} y={el.y} width={el.width} height={el.width} rotation={el.rotation}
      draggable dragBoundFunc={clamp}
      onClick={onSelect} onTap={onSelect}
      onDragEnd={(e: any) => onChange({ ...el, x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current;
        onChange({ ...el, x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(12, node.width() * node.scaleX()) });
        node.scaleX(1); node.scaleY(1);
      }}
    />
  );
}

/** A frame: the photo is drawn inside the frame's outline, covering it. Empty frames show a placeholder that never prints. */
function FrameNode({ el, clamp, onSelect, onChange }: { el: FrameEl; clamp: any; onSelect: () => void; onChange: (el: FrameEl) => void }) {
  const [image] = useImage(el.src ?? "", "anonymous");
  const ref = useRef<any>(null);
  const filled = Boolean(el.src && image);
  return (
    <Shape
      ref={ref}
      name={filled || el.src ? el.id : `${el.id} placeholder`}
      x={el.x} y={el.y} width={el.width} height={el.height} rotation={el.rotation}
      fill="#E6EAE6"
      draggable dragBoundFunc={clamp}
      onClick={onSelect} onTap={onSelect}
      onDragEnd={(e: any) => onChange({ ...el, x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current;
        onChange({ ...el, x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(30, node.width() * node.scaleX()), height: Math.max(30, node.height() * node.scaleY()) });
        node.scaleX(1); node.scaleY(1);
      }}
      sceneFunc={(ctx: any, shape: any) => {
        frameClip(ctx, el.shape, el.width, el.height);
        if (filled && image) {
          const fit = coverFit(image.width, image.height, el.width, el.height, el.zoom, el.offX, el.offY);
          ctx.save();
          ctx.clip();
          ctx.drawImage(image, fit.x, fit.y, fit.width, fit.height);
          ctx.restore();
        } else if (!el.src) {
          ctx.fillShape(shape);
          const c = ctx._context as CanvasRenderingContext2D;
          c.save();
          c.fillStyle = "#6B756B";
          c.font = "600 13px sans-serif";
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText("Add photo", el.width / 2, el.height / 2);
          c.restore();
        }
      }}
      hitFunc={(ctx: any, shape: any) => {
        frameClip(ctx, el.shape, el.width, el.height);
        ctx.fillShape(shape);
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

export default function DesignCanvas({ userId, product, initialDesign, initialSize, initialColor, mode = "design", templates = [], initialTemplateId = null, templateDraft, productDraft, library = [] }: Props) {
  const { upsertDesignLine } = useCart();
  const router = useRouter();
  const isTemplateMode = mode === "template" && Boolean(templateDraft);
  const isProductMode = mode === "product" && Boolean(productDraft);
  const isAdminMode = isTemplateMode || isProductMode;
  const symbolAllowed = product.symbolDefault !== false && (product.base ?? "tee") === "tee";
  const uploadsAllowed = isAdminMode || product.allowUploads !== false;

  const isTee = product.mockup;
  const base: GarmentBase = (isTemplateMode || isProductMode) && productDraft ? (productDraft.base ?? "tee") : (product.base ?? "tee");
  const isCap = isTee && base === "cap";
  const area: Area = isTee ? printAreaFor(base) : PHOTO_PRINT_AREA;
  const clampDrag = useMemo(() => makeClamp(area), [isTee, isCap]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (isProductMode && productDraft) return (productDraft.elements as DesignElement[]) ?? [];
    if (initialDesign) return initialDesign.elements;
    const tpl = initialTemplateId ? templates.find((t) => t.id === initialTemplateId) : null;
    if (tpl) return fromTemplate(tpl.elements);
    // A product made from a design opens with that design; the brand symbol sits underneath when this product has one.
    if (product.presetElements) return [...(isTee && symbolAllowed ? [newSymbol()] : []), ...fromTemplate(product.presetElements)];
    return isTee && symbolAllowed ? [newSymbol()] : [];
  });
  const [tplTitle, setTplTitle] = useState(templateDraft?.title ?? "");
  const [pTitle, setPTitle] = useState(productDraft?.title ?? "");
  const [pDesc, setPDesc] = useState(productDraft?.description ?? "");
  const [pPrice, setPPrice] = useState(productDraft?.price ? String(productDraft.price) : "");
  const [pColors, setPColors] = useState<string[]>(productDraft?.colors ?? ["White", "Black", "Ash"]);
  const [pCustomizable, setPCustomizable] = useState(productDraft?.customizable ?? false);
  const productId = productDraft?.id ?? null;
  const [tplCategory, setTplCategory] = useState(templateDraft?.category ?? "T-Shirts");
  const [templateId, setTemplateId] = useState<string | null>(templateDraft?.id ?? null);
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
  const [tab, setTab] = useState<Tab>("text");
  const [side, setSide] = useState<Side>("front");
  const [savedBack, setSavedBack] = useState(Boolean(initialDesign?.hasBack));
  const [fontTick, setFontTick] = useState(0);
  const [uploads, setUploads] = useState<string[]>([]);

  const transformerRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const guideRectRef = useRef<any>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const propertiesBarRef = useRef<HTMLDivElement>(null);
  const symbolPanelRef = useRef<HTMLDivElement>(null);
  const toolRailRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const framePhotoRef = useRef<HTMLInputElement>(null);

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
  }, [selectedId, elements, fontTick]);

  // Click anywhere that isn't the canvas, the properties bar, or the tool rail clears the selection.
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideCanvas = canvasWrapRef.current?.contains(target);
      const insidePanel = propertiesBarRef.current?.contains(target) || symbolPanelRef.current?.contains(target);
      const insideRail = toolRailRef.current?.contains(target) || drawerRef.current?.contains(target);
      if (!insideCanvas && !insidePanel && !insideRail) {
        setSelectedId(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const updateElement = (updated: DesignElement) =>
    setElements((els) => els.map((el) => (el.id === updated.id ? updated : el)));

  // Fonts: load the ones this design uses, then redraw the text once they're ready.
  const fontUses = useMemo(
    () => elements.filter((el): el is TextEl => el.type === "text").map((el) => ({ name: el.fontFamily, bold: el.bold })),
    [elements]
  );
  const fontKey = fontUses.map((u) => `${u.name ?? ""}:${u.bold ? 1 : 0}`).join("|");
  useEffect(() => {
    let live = true;
    loadFonts(fontUses).then(() => live && setFontTick((t) => t + 1));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);
  useEffect(() => {
    if (tab === "text") warmFonts();
  }, [tab]);

  // Selecting something opens the matching tool drawer, like Printify's side panel.
  const selectEl = (el: { id: string; type: string }) => {
    setSelectedId(el.id);
    if (el.type === "text") setTab("text");
    else if (el.type === "frame") setTab("frames");
    else if (el.type === "sticker") setTab("graphics");
  };

  // New text and shapes start in a colour that shows up on the chosen garment.
  const newFill = isTee && ["black", "navy", "royal", "forest", "red", "maroon"].includes(colorKey) ? "#FFFFFF" : DEFAULT_FILL;

  const CENTER = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
  const addAndSelect = (el: DesignElement) => {
    const placed = side === "back" ? ({ ...el, side: "back" } as DesignElement) : el;
    setElements((els) => [...els, placed]);
    selectEl(placed);
  };

  const addText = (preset: { text: string; fontSize: number; fontFamily: string; bold?: boolean } = { text: "New Text", fontSize: 28, fontFamily: DEFAULT_FONT, bold: true }) =>
    addAndSelect({ id: newElementId(), type: "text", text: preset.text, x: CENTER.x - 70, y: CENTER.y - 20, rotation: 0, fontSize: preset.fontSize, fill: newFill, fontFamily: preset.fontFamily, bold: preset.bold });

  const addShape = (type: "rect" | "circle") =>
    addAndSelect({ id: newElementId(), type, x: CENTER.x - 50, y: CENTER.y - 50, rotation: 0, width: 100, height: 100, fill: newFill });

  const addSticker = (key: string) =>
    addAndSelect({ id: newElementId(), type: "sticker", key, x: CENTER.x - 35, y: CENTER.y - 35, rotation: 0, width: 70, fill: newFill });

  const addFrame = (shape: FrameShape) =>
    addAndSelect({ id: newElementId(), type: "frame", shape, x: CENTER.x - 75, y: CENTER.y - 75, rotation: 0, width: 150, height: shape === "arch" ? 190 : 150, src: null, zoom: 1, offX: 0, offY: 0 });

  const chooseFont = (name: string) => {
    const el = elements.find((e) => e.id === selectedId);
    if (!el || el.type !== "text") return;
    const font = fontOf(name);
    updateElement({ ...el, fontFamily: name, bold: font?.bold ? el.bold : false });
    loadFonts([{ name, bold: el.bold }]).then(() => setFontTick((t) => t + 1));
  };

  // Uploads a customer photo (or an admin image in template mode) and returns its public URL.
  const uploadImage = async (file: File | undefined): Promise<string | null> => {
    if (!file) return null;
    if (!file.type.startsWith("image/")) { setSaveStatus("Choose an image file."); return null; }
    if (file.size > 8 * 1024 * 1024) { setSaveStatus("Image is over 8 MB. Pick a smaller one."); return null; }

    setSaveStatus("Uploading image…");
    const supabase = createClient();
    // Customers write to their own folder in design-uploads; admins (template mode) write to product-images.
    const bucket = isAdminMode ? "product-images" : "design-uploads";
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = isAdminMode ? `${isProductMode ? "products" : "templates"}/${crypto.randomUUID()}.${ext}` : `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (error) { setSaveStatus("Upload failed. Try again."); return null; }
    setSaveStatus("");
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const placeImage = (url: string) =>
    addAndSelect({ id: newElementId(), type: "image", src: url, x: CENTER.x - 75, y: CENTER.y - 75, rotation: 0, width: 150, height: 150 });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const url = await uploadImage(file);
    if (!url) return;
    setUploads((u) => [url, ...u]);
    placeImage(url);
  };

  const handleFramePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = elements.find((el) => el.id === selectedId);
    if (!target || target.type !== "frame") return;
    const url = await uploadImage(file);
    if (!url) return;
    setElements((els) => els.map((el) => (el.id === target.id && el.type === "frame" ? { ...el, src: url, zoom: 1, offX: 0, offY: 0 } : el)));
  };

  const deleteSelected = () => {
    setElements((els) => els.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  // Hides the guide and selection (and optionally the garment), snaps a PNG, then restores the UI.
  // `ratio` is output pixels per logical unit; `crop` limits the shot to the print area.
  const snapshot = (opts: { ratio: number; crop: boolean; hideGarment: boolean; side?: Side }): string | null => {
    const stage = stageRef.current;
    const guide = guideRectRef.current;
    if (!stage || !guide) return null;

    const garments: any[] = [...(opts.hideGarment ? stage.find(".garment") : []), ...stage.find(".placeholder")];
    // Only the chosen side of the tee goes into the picture (front by default).
    const target = opts.side ?? "front";
    const sideGroups: any[] = stage.find(".side-front, .side-back");
    const wasVisible = sideGroups.map((g) => g.visible());
    sideGroups.forEach((g) => g.visible(g.hasName(`side-${target}`)));
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
      sideGroups.forEach((g, i) => g.visible(wasVisible[i]));
      guide.visible(true);
      garments.forEach((n) => n.visible(true));
      guide.getLayer().batchDraw();
      attachTransformer();
    }
  };

  const capturePrintReady = (): string | null => {
    const dataUrl = snapshot({ ratio: 2, crop: true, hideGarment: false, side: "front" });
    if (dataUrl) setPrintPreview(dataUrl);
    return dataUrl;
  };

  // Garment-free, transparent artwork. Printers want about 150+ dpi, so we export as sharp as the device allows
  // (12 pixels per design unit = 2640 x 3600 px) and step down on phones that can't make a canvas that large.
  // Never blocks saving: any failure just means no production file.
  const exportProduction = async (designIdValue: string, which: Side = "front"): Promise<string | null> => {
    try {
      let dataUrl: string | null = null;
      for (const ratio of [12, 8, 5, 3]) {
        const shot = snapshot({ ratio, crop: true, hideGarment: true, side: which });
        if (shot && shot.length > 2000) {
          dataUrl = shot;
          break;
        }
      }
      if (!dataUrl) return null;
      const blob = await (await fetch(dataUrl)).blob();
      const supabase = createClient();
      const tag = which === "back" ? "-back" : "";
      const stable = `${userId}/${designIdValue}${tag}-production.png`;
      let usedPath = stable;
      let { error } = await supabase.storage.from("print-files").upload(stable, blob, { contentType: "image/png", upsert: true });
      if (error) {
        // Overwriting needs an update policy; without it, fall back to a fresh file name.
        usedPath = `${userId}/${designIdValue}${tag}-production-${Date.now()}.png`;
        ({ error } = await supabase.storage.from("print-files").upload(usedPath, blob, { contentType: "image/png" }));
      }
      if (error) return null;
      const base = supabase.storage.from("print-files").getPublicUrl(usedPath).data.publicUrl;
      const url = usedPath === stable ? `${base}?v=${Date.now()}` : base;
      const { error: updateError } = await supabase.from("designs").update(which === "back" ? { back_production_url: url } : { production_url: url }).eq("id", designIdValue);
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
      await loadFonts(fontUses); // text must be drawn in its real font before the print file is made
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

      // The back of the tee has its own files. They are removed again if the back design is emptied.
      const hasBack = elements.some((el) => sideOf(el) === "back");
      if (hasBack) {
        const backShot = snapshot({ ratio: 2, crop: true, hideGarment: true, side: "back" });
        if (!backShot) throw new Error("back");
        const backBlob = await (await fetch(backShot)).blob();
        const backPath = `${userId}/${id}-back-${Date.now()}.png`;
        const { error: backUpload } = await supabase.storage.from("print-files").upload(backPath, backBlob, { contentType: "image/png" });
        if (backUpload) throw backUpload;
        const backUrl = supabase.storage.from("print-files").getPublicUrl(backPath).data.publicUrl;
        const { error: backError } = await supabase.from("designs").update({ back_print_url: backUrl }).eq("id", id);
        if (backError) throw new Error("back");
        const backProduction = await exportProduction(id, "back");
        if (!backProduction) throw new Error("back");
      } else if (savedBack) {
        await supabase.from("designs").update({ back_print_url: null, back_production_url: null }).eq("id", id);
      }
      setSavedBack(hasBack);

      setDesignId(id);
      setPrintUrl(url);
      setSaveStatus("Saved");
      return { id, printUrl: url };
    } catch (e) {
      setSaveStatus(e instanceof Error && e.message === "back" ? "Couldn't save the back of your design yet. Please try again shortly." : "Couldn't save. Check your connection and try again.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const soldOut = !isAdminMode && variantSoldOut(product.soldOutVariants, color, size);
  const hasBackDesign = elements.some((el) => sideOf(el) === "back");

  const handleAddToCart = async () => {
    if (soldOut) return setCartStatus(`${color} in ${size} is sold out. Pick another size or colour.`);
    const saved = await handleSave(); // always save first so the cart gets the latest version
    if (!saved) return;
    upsertDesignLine({
      productId: product.id,
      title: product.title,
      image: isCap ? `/mockups/cap-${colorKey}.png` : isTee ? `/mockups/tee-${colorKey}${hasSymbol ? "-symbol" : ""}.png` : product.image,
      price: product.price + (hasBackDesign ? (product.backPrice ?? 0) : 0), // promo-aware price from the page, plus the back print if used
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

  // Library artwork: placed at its own proportions.
  const placeLibrary = (item: LibraryItem) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = 150;
      const h = Math.min(220, Math.max(20, (w * img.naturalHeight) / Math.max(1, img.naturalWidth)));
      addAndSelect({ id: newElementId(), type: "image", src: item.image_url, x: CENTER.x - w / 2, y: CENTER.y - h / 2, rotation: 0, width: w, height: h });
    };
    img.onerror = () => setSaveStatus("That design couldn't be loaded.");
    img.src = item.image_url;
  };

  // Admin: turn the design on the mockup into a product. Makes print artwork and a preview for every colour sold.
  const handleSaveProduct = async () => {
    if (!productDraft) return;
    setSaving(true);
    setSaveStatus("Preparing the product…");
    try {
      const title = pTitle.trim();
      const price = Number(pPrice);
      if (!title) throw new Error("Give the product a name first.");
      if (!Number.isFinite(price) || price <= 0) throw new Error("Enter the price.");
      if (pColors.length === 0) throw new Error("Pick at least one colour to sell.");
      const mine = elements.filter((el) => el.type !== "symbol");
      if (mine.length === 0) throw new Error("Add a design to the tee first.");

      await loadFonts(fontUses);
      const supabase = createClient();
      const pid = productId ?? crypto.randomUUID();
      const stamp = Date.now();
      const put = async (blob: Blob, name: string) => {
        const path = `products/${pid}/${name}-${stamp}.png`;
        const { error } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/png" });
        if (error) throw new Error("Upload failed. Try again.");
        return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      };
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("A mockup picture couldn't be loaded."));
          img.src = src;
        });

      const sides: Side[] = ["front", ...(!isCap && mine.some((el) => sideOf(el) === "back") ? (["back"] as Side[]) : [])];
      const art: { front: string | null; back: string | null } = { front: null, back: null };
      const shots: Partial<Record<Side, HTMLImageElement>> = {};
      for (const sd of sides) {
        setSaveStatus(`Making the ${sd} print artwork…`);
        let shot: string | null = null;
        for (const ratio of [8, 5, 3]) {
          const candidate = snapshot({ ratio, crop: true, hideGarment: true, side: sd });
          if (candidate && candidate.length > 2000) { shot = candidate; break; }
        }
        if (!shot) throw new Error("The canvas isn't ready yet.");
        art[sd] = await put(await (await fetch(shot)).blob(), `${sd}-art`);
        shots[sd] = await load(shot);
      }

      // A preview of the design on every colour, built from the same mockup layers the designer uses.
      const previews: Record<string, { front?: string; back?: string }> = {};
      const keys = [...new Set(pColors.map((c) => teeColorKey(c)).filter((k): k is TeeColor => Boolean(k)))];
      let done = 0;
      for (const key of keys) {
        for (const sd of sides) {
          setSaveStatus(`Making previews (${++done}/${keys.length * sides.length})…`);
          const layers = garmentLayers(base, key, sd);
          const [bare, shade, light] = await Promise.all([load(layers.bare), load(layers.shade), load(layers.light)]);
          const canvas = document.createElement("canvas");
          canvas.width = 1000; canvas.height = 1000;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Couldn't make the previews.");
          const k = 1000 / LOGICAL_SIZE;
          ctx.drawImage(bare, 0, 0, 1000, 1000);
          const a = shots[sd];
          if (a) ctx.drawImage(a, area.x * k, area.y * k, area.width * k, area.height * k);
          ctx.drawImage(shade, 0, 0, 1000, 1000);
          if (layers.lightOpacity > 0) { ctx.globalAlpha = layers.lightOpacity; ctx.drawImage(light, 0, 0, 1000, 1000); ctx.globalAlpha = 1; }
          const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
          if (!blob) throw new Error("Couldn't make the previews.");
          previews[key] = { ...previews[key], [sd]: await put(blob, `${key}-${sd}`) };
        }
      }

      setSaveStatus("Saving the product…");
      const result = await productDraft.save({ id: pid, base, title, description: pDesc.trim(), price, colors: pColors, customizable: pCustomizable, elements: mine, art, previews });
      if (!result.ok) throw new Error(result.error);
      if (!productId) {
        router.push(`/admin/products/${result.id}?saved=1`); // set promo, affiliate rate and stock there
        return;
      }
      setSaveStatus("Saved");
    } catch (e) {
      setSaveStatus(e instanceof Error && e.message ? e.message : "Couldn't save the product. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const pickTemplate = (tpl: TemplateOption) => {
    const hasOwnWork = elements.some((el) => el.type !== "symbol" && sideOf(el) === side);
    if (hasOwnWork && !window.confirm(`Replace what's on the ${side} of the shirt with this template? Your current design there will be lost.`)) return;
    const others = elements.filter((el) => sideOf(el) !== side);
    const fresh = fromTemplate(tpl.elements)
      .filter((el) => side === "front" || el.type !== "symbol")
      .map((el) => (side === "back" ? ({ ...el, side: "back" } as DesignElement) : el));
    setElements(side === "front" ? [...fresh, ...others] : [...others, ...fresh]);
    setSelectedId(null);
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

  const selectedEl = elements.find((el) => el.id === selectedId && el.type !== "symbol" && el.type !== "image") as TextEl | ShapeEl | StickerEl | FrameEl | undefined;
  const selectedText = selectedEl?.type === "text" ? selectedEl : undefined;
  const selectedFrame = selectedEl?.type === "frame" ? selectedEl : undefined;

  const renderEl = (el: DesignElement) => {
        const commonProps = {
          draggable: true,
          dragBoundFunc: clampDrag,
          onClick: () => selectEl(el),
          onTap: () => selectEl(el),
          onDragEnd: (e: any) => updateElement({ ...el, x: e.target.x(), y: e.target.y() }),
          name: el.id,
        };

        if (el.type === "text") {
          return (
            <Text
              {...commonProps}
              key={`${el.id}-${fontTick}`}
              text={el.text} x={el.x} y={el.y} fontSize={el.fontSize} fill={el.fill} rotation={el.rotation}
              fontFamily={cssFamily(el.fontFamily)} fontStyle={el.bold ? "bold" : "normal"}
              onTransformEnd={(e: any) => {
                const node = e.target;
                updateElement({ ...el, x: node.x(), y: node.y(), rotation: node.rotation(), fontSize: Math.round(el.fontSize * node.scaleX()) });
                node.scaleX(1); node.scaleY(1);
              }}
            />
          );
        }
        if (el.type === "symbol") {
          return <SymbolNode key={el.id} el={el} color={colorKey} clamp={clampDrag} onSelect={() => selectEl(el)} onChange={updateElement as (e: SymbolEl) => void} />;
        }
        if (el.type === "sticker") {
          return <StickerNode key={el.id} el={el} clamp={clampDrag} onSelect={() => selectEl(el)} onChange={updateElement as (e: StickerEl) => void} />;
        }
        if (el.type === "frame") {
          return <FrameNode key={el.id} el={el} clamp={clampDrag} onSelect={() => selectEl(el)} onChange={updateElement as (e: FrameEl) => void} />;
        }
        if (el.type === "image") {
          return <UploadedImage key={el.id} el={el} clamp={clampDrag} onSelect={() => selectEl(el)} onChange={updateElement} />;
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
  };

  return (
    <div className="workspace">
      <h1 className="workspace-title">{isTemplateMode ? (templateId ? "Edit template" : "New template") : isProductMode ? (productId ? "Edit design product" : `Create ${isCap ? "cap" : "tee"} from a design`) : product.title}</h1>

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

      {isProductMode && productDraft && (
        <div className="template-meta product-meta">
          <label className="field-group grow">
            <span className="panel-label">Product name</span>
            <input type="text" className="field" value={pTitle} maxLength={80} onChange={(e) => setPTitle(e.target.value)} placeholder="e.g. Sunday Service Tee" />
          </label>
          <label className="field-group">
            <span className="panel-label">Price (₦)</span>
            <input type="number" className="field" style={{ width: "130px" }} min={0} step={100} value={pPrice} onChange={(e) => setPPrice(e.target.value)} />
          </label>
          <label className="field-group grow">
            <span className="panel-label">Description (optional)</span>
            <input type="text" className="field" value={pDesc} maxLength={300} onChange={(e) => setPDesc(e.target.value)} />
          </label>
          <div className="field-group">
            <span className="panel-label">Colours to sell</span>
            <div className="option-row" role="group" aria-label="Colours to sell">
              {TEE_COLOR_LIST.map((c) => {
                const on = pColors.includes(c.name);
                return (
                  <button key={c.key} type="button" className={`color-dot${on ? " active" : ""}`} style={{ background: c.hex }} title={c.name} aria-label={`${c.name}${on ? ", selected" : ""}`} aria-pressed={on}
                    onClick={() => setPColors((cur) => (on ? cur.filter((x) => x !== c.name) : [...cur, c.name]))} />
                );
              })}
            </div>
          </div>
          <label className="field-group">
            <span className="panel-label">Customers</span>
            <span className="option-row">
              <input type="checkbox" checked={pCustomizable} onChange={(e) => setPCustomizable(e.target.checked)} />
              <span>Can change this design</span>
            </span>
          </label>
        </div>
      )}

      <div className="design-options">
        {!isAdminMode && <span className="design-price">{naira(product.price)} · customizing is included</span>}
        {isAdminMode && <span className="design-price">Preview colour</span>}
        {!isAdminMode && product.sizes.length > 0 && (
          <div className="option-row" role="group" aria-label="Size">
            {product.sizes.map((s) => (
              <button key={s} type="button" className={`chip${s === size ? " active" : ""}`} aria-pressed={s === size} onClick={() => setSize(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {product.colors.length > 0 && (
          <div className="swatch-row" role="group" aria-label="Color">
            {product.colors.map((c) => {
              const hex = isTee ? teeColorHex(c) : null;
              return hex ? (
                <button key={c} type="button" className={`color-dot${c === color ? " active" : ""}`} style={{ background: hex }} title={c} aria-label={c} aria-pressed={c === color} onClick={() => setColor(c)} />
              ) : (
                <button key={c} type="button" className={`chip${c === color ? " active" : ""}`} aria-pressed={c === color} onClick={() => setColor(c)}>
                  {c}
                </button>
              );
            })}
            <span className="swatch-name">{color}</span>
          </div>
        )}
      </div>

      <div className="workspace-grid">
        {/* Tool rail */}
        <div className="workspace-rail tool-rail" ref={toolRailRef}>
          {([
            ["text", "Text", Type],
            ["graphics", "Graphics", Sparkles],
            ["frames", "Frames", FrameIcon],
            ...(uploadsAllowed ? [["upload", "Upload", ImagePlus]] : []),
            ["shapes", "Shapes", Shapes],
            ...(!isAdminMode && templates.length > 0 ? [["templates", "Templates", LayoutTemplate]] : []),
          ] as [Tab, string, typeof Type][]).map(([key, label, Icon]) => (
            <button key={key} type="button" className={`tool-btn${tab === key ? " tool-btn-on" : ""}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
              <Icon size={18} /> {label}
            </button>
          ))}
          {selectedId && (
            <button className="tool-btn danger" onClick={deleteSelected}>
              <Trash2 size={18} /> Delete
            </button>
          )}

          <div className="rail-divider" />

          <button className="tool-btn tool-btn-primary" onClick={isTemplateMode ? handleSaveTemplate : isProductMode ? handleSaveProduct : handleSave} disabled={saving}>
            {saving ? <Loader2 size={18} className="spin" /> : <Check size={18} />}
            {isTemplateMode ? "Save template" : isProductMode ? "Save product" : "Save"}
          </button>
          {!isAdminMode && (
            <button className="tool-btn tool-btn-primary" onClick={handleAddToCart} disabled={saving || soldOut || (!isTee && elements.length === 0)}>
              <ShoppingCart size={18} />
              {added ? "Update cart" : "Add to cart"}
            </button>
          )}
          {saveStatus && <p className="save-status" role="status">{saveStatus}</p>}
        </div>

        {/* Tool drawer: what the chosen tool offers */}
        <div className="tool-drawer" ref={drawerRef}>
          {tab === "text" && (
            <>
              <h2 className="drawer-title">Text</h2>
              <div className="drawer-stack">
                <button type="button" className="btn btn-sm" onClick={() => addText({ text: "HEADING", fontSize: 44, fontFamily: "Bebas Neue" })}>Add a heading</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => addText({ text: "Subheading", fontSize: 28, fontFamily: "Montserrat", bold: true })}>Add a subheading</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => addText({ text: "Your text", fontSize: 20, fontFamily: "Montserrat" })}>Add body text</button>
              </div>
              {selectedText ? (
                <>
                  <h3 className="drawer-sub">Font</h3>
                  <ul className="font-list">
                    {DESIGN_FONTS.map((f) => (
                      <li key={f.name}>
                        <button type="button" className={`font-btn${(selectedText.fontFamily ?? "") === f.name ? " active" : ""}`} style={{ fontFamily: cssFamily(f.name) }} onClick={() => chooseFont(f.name)}>
                          {f.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="drawer-note">Add text, or tap a text on the shirt to change its font.</p>
              )}
            </>
          )}

          {tab === "graphics" && (
            <>
              <h2 className="drawer-title">Graphics</h2>
              <p className="drawer-note">Small designs to add to your tee. Tap one to place it, then change its colour.</p>
              {library.length > 0 && (
                <>
                  <h3 className="drawer-sub">Nova Edge designs</h3>
                  <ul className="thumb-grid">
                    {library.map((item) => (
                      <li key={item.id}>
                        <button type="button" className="thumb-btn thumb-art" title={item.title} aria-label={`Add ${item.title}`} onClick={() => placeLibrary(item)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.image_url} alt="" loading="lazy" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <h3 className="drawer-sub">Shapes and icons</h3>
                </>
              )}
              <ul className="thumb-grid">
                {STICKERS.map((st) => (
                  <li key={st.key}>
                    <button type="button" className="thumb-btn" title={st.name} aria-label={`Add ${st.name}`} onClick={() => addSticker(st.key)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={stickerSrc(st.key, "#1E3A1C")} alt="" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === "frames" && (
            <>
              <h2 className="drawer-title">Photo frames</h2>
              <p className="drawer-note">{selectedFrame ? "Tap a shape to change this frame." : "Tap a shape to add a frame, then add your photo into it."}</p>
              <ul className="thumb-grid">
                {FRAME_SHAPES.map((fr) => (
                  <li key={fr.key}>
                    <button
                      type="button"
                      className={`thumb-btn${selectedFrame?.shape === fr.key ? " active" : ""}`}
                      title={fr.name}
                      aria-label={`${selectedFrame ? "Change to" : "Add"} ${fr.name} frame`}
                      onClick={() => (selectedFrame ? updateElement({ ...selectedFrame, shape: fr.key }) : addFrame(fr.key))}
                    >
                      <svg viewBox="0 0 100 100" aria-hidden="true"><path d={frameThumbPath(fr.key)} fill="#C9D6C8" stroke="#1E3A1C" strokeWidth="3" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
              {selectedFrame && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => addFrame(selectedFrame.shape)}>Add another frame</button>
              )}
            </>
          )}

          {tab === "upload" && uploadsAllowed && (
            <>
              <h2 className="drawer-title">Upload</h2>
              <label className="btn btn-sm" style={{ cursor: "pointer" }}>
                <ImagePlus size={15} /> Upload an image
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
              </label>
              <p className="drawer-note">PNG or JPG up to 8 MB. Larger, sharper pictures print better. To crop a photo into a shape, use Frames.</p>
              {uploads.length > 0 && (
                <ul className="thumb-grid">
                  {uploads.map((u) => (
                    <li key={u}>
                      <button type="button" className="thumb-btn" aria-label="Add this image again" onClick={() => placeImage(u)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "shapes" && (
            <>
              <h2 className="drawer-title">Shapes</h2>
              <div className="drawer-stack">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => addShape("rect")}><Square size={15} /> Box</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => addShape("circle")}><CircleIcon size={15} /> Circle</button>
              </div>
            </>
          )}

          {tab === "templates" && !isAdminMode && (
            <>
              <h2 className="drawer-title">Templates</h2>
              <p className="drawer-note">Start from a ready-made design.</p>
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
            </>
          )}
        </div>

        {/* Canvas + properties */}
        <div className="workspace-canvas">
          {soldOut && <p className="form-note" role="status">{color} in {size} is sold out. Pick another size or colour.</p>}
          {isTee && !isCap && !isTemplateMode && (
            <div className="side-switch" role="group" aria-label="Which side of the tee">
              {(["front", "back"] as Side[]).map((sd) => (
                <button key={sd} type="button" className={`chip${side === sd ? " active" : ""}`} aria-pressed={side === sd} onClick={() => { setSide(sd); setSelectedId(null); }}>
                  {sd === "front" ? "Front" : "Back"}
                  {sd === "back" && (product.backPrice ?? 0) > 0 && <span className="chip-note"> +{naira(product.backPrice ?? 0)}</span>}
                  {sd === "back" && elements.some((el) => sideOf(el) === "back") && <span className="chip-note"> · designed</span>}
                </button>
              ))}
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
                  {(isTee && !isCap ? (["front", "back"] as Side[]) : (["front"] as Side[])).map((sd) => {
                    const layers = garmentLayers(base, colorKey, sd);
                    return (
                      <Group key={sd} name={`side-${sd}`} visible={side === sd}>
                        {isTee ? <GarmentBackground url={layers.bare} /> : product.image ? <GarmentBackground url={product.image} /> : null}
                        {elements.filter((el) => sideOf(el) === sd).map(renderEl)}
                        {/* Folds and highlights sit above the artwork so the print follows the cloth. */}
                        {isTee && <GarmentBackground url={layers.shade} />}
                        {isTee && layers.lightOpacity > 0 && <GarmentBackground url={layers.light} opacity={layers.lightOpacity} />}
                      </Group>
                    );
                  })}

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

          {isTee && !isCap && side === "front" && (
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
              {selectedEl.type !== "frame" && (
                <div className="field-group">
                  <span className="panel-label">Color</span>
                  <input
                    type="color" className="swatch"
                    value={selectedEl.fill ?? DEFAULT_FILL}
                    onChange={(e) => updateElement({ ...selectedEl, fill: e.target.value })}
                  />
                </div>
              )}
              {selectedText && (
                <>
                  <div className="field-group grow">
                    <span className="panel-label">Text</span>
                    <input
                      type="text" className="field"
                      value={selectedText.text ?? ""}
                      onChange={(e) => updateElement({ ...selectedText, text: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <span className="panel-label">Size</span>
                    <input
                      type="number" className="field" style={{ width: "70px" }}
                      value={selectedText.fontSize ?? 28}
                      onChange={(e) => updateElement({ ...selectedText, fontSize: Number(e.target.value) })}
                    />
                  </div>
                  {(fontOf(selectedText.fontFamily)?.bold || !selectedText.fontFamily) && (
                    <div className="field-group">
                      <span className="panel-label">Style</span>
                      <button type="button" className={`chip${selectedText.bold ? " active" : ""}`} aria-pressed={Boolean(selectedText.bold)} onClick={() => { updateElement({ ...selectedText, bold: !selectedText.bold }); loadFonts([{ name: selectedText.fontFamily, bold: !selectedText.bold }]).then(() => setFontTick((t) => t + 1)); }}>
                        Bold
                      </button>
                    </div>
                  )}
                </>
              )}
              {selectedFrame && (
                <>
                  <div className="field-group">
                    <span className="panel-label">Photo</span>
                    <div className="option-row">
                      <button type="button" className="btn btn-sm" onClick={() => framePhotoRef.current?.click()}>
                        <ImagePlus size={15} /> {selectedFrame.src ? "Change photo" : "Add photo"}
                      </button>
                      {selectedFrame.src && (
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => updateElement({ ...selectedFrame, src: null, zoom: 1, offX: 0, offY: 0 })}>Remove photo</button>
                      )}
                    </div>
                    <input ref={framePhotoRef} type="file" accept="image/*" onChange={handleFramePhoto} style={{ display: "none" }} />
                  </div>
                  {selectedFrame.src && (
                    <>
                      <label className="field-group grow">
                        <span className="panel-label">Zoom</span>
                        <input type="range" min={1} max={4} step={0.05} value={selectedFrame.zoom} onChange={(e) => updateElement({ ...selectedFrame, zoom: Number(e.target.value) })} />
                      </label>
                      <label className="field-group grow">
                        <span className="panel-label">Move left / right</span>
                        <input type="range" min={-1} max={1} step={0.02} value={selectedFrame.offX} onChange={(e) => updateElement({ ...selectedFrame, offX: Number(e.target.value) })} />
                      </label>
                      <label className="field-group grow">
                        <span className="panel-label">Move up / down</span>
                        <input type="range" min={-1} max={1} step={0.02} value={selectedFrame.offY} onChange={(e) => updateElement({ ...selectedFrame, offY: Number(e.target.value) })} />
                      </label>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {!selectedEl && !printPreview && !printUrl && (
            <p className="empty-hint">Select something on the shirt to edit it. Drag the corners to resize.</p>
          )}

          {!isAdminMode && (printPreview || printUrl) && (
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
