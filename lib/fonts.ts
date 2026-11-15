// lib/fonts.ts — the Google Fonts offered in the designer. Loaded on demand in the browser (see loadFonts).
export type DesignFont = { name: string; group: "Bold" | "Clean" | "Elegant" | "Script" | "Fun"; bold: boolean };

export const DEFAULT_FONT = "Montserrat";
/** Older designs saved before fonts existed were drawn in Arial. */
export const LEGACY_FONT = "Arial";

export const DESIGN_FONTS: DesignFont[] = [
  { name: "Montserrat", group: "Clean", bold: true },
  { name: "Poppins", group: "Clean", bold: true },
  { name: "Inter", group: "Clean", bold: true },
  { name: "Oswald", group: "Bold", bold: true },
  { name: "Bebas Neue", group: "Bold", bold: false },
  { name: "Anton", group: "Bold", bold: false },
  { name: "Archivo Black", group: "Bold", bold: false },
  { name: "Russo One", group: "Bold", bold: false },
  { name: "Rubik Mono One", group: "Bold", bold: false },
  { name: "Playfair Display", group: "Elegant", bold: true },
  { name: "Cinzel", group: "Elegant", bold: true },
  { name: "Abril Fatface", group: "Elegant", bold: false },
  { name: "Roboto Slab", group: "Elegant", bold: true },
  { name: "Lobster", group: "Script", bold: false },
  { name: "Pacifico", group: "Script", bold: false },
  { name: "Dancing Script", group: "Script", bold: true },
  { name: "Satisfy", group: "Script", bold: false },
  { name: "Caveat", group: "Script", bold: true },
  { name: "Shadows Into Light", group: "Script", bold: false },
  { name: "Permanent Marker", group: "Fun", bold: false },
  { name: "Bangers", group: "Fun", bold: false },
  { name: "Righteous", group: "Fun", bold: false },
  { name: "Fredoka", group: "Fun", bold: true },
  { name: "Lilita One", group: "Fun", bold: false },
  { name: "Orbitron", group: "Fun", bold: true },
  { name: "Press Start 2P", group: "Fun", bold: false },
];

export const FONT_NAMES = new Set(DESIGN_FONTS.map((f) => f.name));
export const fontOf = (name?: string) => DESIGN_FONTS.find((f) => f.name === name);
/** The CSS font-family value for a font name (falls back to a generic family while the font loads). */
export const cssFamily = (name?: string) => (name && FONT_NAMES.has(name) ? `"${name}", sans-serif` : name || LEGACY_FONT);

const SHEET_ID = "ne-design-fonts";
let sheetReady: Promise<void> | null = null;

/** Adds the Google Fonts stylesheet once (browser only). */
function ensureSheet(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (sheetReady) return sheetReady;
  sheetReady = new Promise<void>((resolve) => {
    if (document.getElementById(SHEET_ID)) return resolve();
    const families = DESIGN_FONTS.map((f) => `family=${f.name.replace(/ /g, "+")}${f.bold ? ":wght@400;700" : ""}`).join("&");
    const link = document.createElement("link");
    link.id = SHEET_ID;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    link.onload = () => resolve();
    link.onerror = () => resolve(); // offline or blocked: designs still work with the fallback font
    document.head.appendChild(link);
  });
  return sheetReady;
}

/** Makes sure the given fonts are ready to draw on the canvas. Never throws. */
export async function loadFonts(uses: { name?: string; bold?: boolean }[]): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    await ensureSheet();
    const wanted = uses.filter((u) => u.name && FONT_NAMES.has(u.name));
    await Promise.all(wanted.map((u) => document.fonts.load(`${u.bold ? "700" : "400"} 24px "${u.name}"`, "Aa")));
  } catch {
    /* fall back to the generic font */
  }
}

/** Starts loading the whole list so the picker previews show in their own fonts. */
export const warmFonts = () => ensureSheet();
