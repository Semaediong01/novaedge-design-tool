// lib/print-sizes.ts — real-world print sizes for each tee size, and print-quality checks.
// The designer's print area is 220 x 300 units, so every physical size keeps that exact shape (no stretching).
import { TEE_PRINT_AREA } from "@/lib/mockups";

export const PRINT_RATIO = TEE_PRINT_AREA.height / TEE_PRINT_AREA.width; // height / width

/** Starting widths in cm. These are sensible defaults: confirm them with your printer in Admin -> Print sizes. */
export const DEFAULT_PRINT_WIDTHS: Record<string, number> = { S: 26, M: 28, L: 30, XL: 32, XXL: 34 };

/** Dots per inch we aim for. Below MIN_DPI a print can look soft. */
export const GOOD_DPI = 150;
export const MIN_DPI = 100;

export type PrintWidths = Record<string, number>;

export function cleanWidths(input: unknown): PrintWidths {
  const out: PrintWidths = {};
  if (input && typeof input === "object") {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const n = Number(v);
      const key = k.trim().slice(0, 12);
      if (key && Number.isFinite(n) && n >= 5 && n <= 60) out[key] = Math.round(n * 10) / 10;
    }
  }
  return Object.keys(out).length ? out : { ...DEFAULT_PRINT_WIDTHS };
}

/** Width and height in cm for a garment size (case-insensitive), or null if that size has no setting. */
export function printSizeFor(size: string | null | undefined, widths: PrintWidths) {
  if (!size) return null;
  const hit = Object.keys(widths).find((k) => k.toLowerCase() === size.trim().toLowerCase());
  if (!hit) return null;
  const width = widths[hit];
  return { width, height: Math.round(width * PRINT_RATIO * 10) / 10 };
}

export function dpiFor(pixelWidth: number, widthCm: number) {
  return Math.round(pixelWidth / (widthCm / 2.54));
}

export function dpiVerdict(dpi: number): "good" | "ok" | "low" {
  return dpi >= GOOD_DPI ? "good" : dpi >= MIN_DPI ? "ok" : "low";
}

/** Reads width and height from the start of a PNG file. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((b, i) => bytes[i] === b)) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Returns a copy of the PNG that reports its print resolution (so Photoshop, Illustrator and RIP software open it
 * at the real size, e.g. 30 cm wide). The pixels are not changed.
 */
export function withPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (!pngSize(png)) return png;
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const v = new DataView(chunk.buffer);
  v.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  v.setUint32(8, ppm);
  v.setUint32(12, ppm);
  chunk[16] = 1; // pixels per metre
  v.setUint32(17, crc32(chunk.subarray(4, 17)));

  // Copy every chunk except any existing pHYs, and place the new one right after IHDR.
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  let pos = 8;
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  while (pos + 12 <= png.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    const end = pos + 12 + len;
    if (type !== "pHYs") parts.push(png.subarray(pos, end));
    if (type === "IHDR") parts.push(chunk);
    pos = end;
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    result.set(p, o);
    o += p.length;
  }
  return result;
}
