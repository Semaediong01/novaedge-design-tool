// lib/stickers.ts — small built-in graphics customers can place on a tee. Each is a one-colour SVG, so it can be recoloured.
export type Sticker = { key: string; name: string; body: (fill: string) => string };

const poly = (pts: string, f: string) => `<polygon points="${pts}" fill="${f}"/>`;
const path = (d: string, f: string, extra = "") => `<path d="${d}" fill="${f}" ${extra}/>`;
const ring = (f: string, r = 40, w = 10) => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${f}" stroke-width="${w}"/>`;

export const STICKERS: Sticker[] = [
  { key: "star", name: "Star", body: (f) => poly("50,5 61,38 96,38 68,59 79,93 50,72 21,93 32,59 4,38 39,38", f) },
  { key: "heart", name: "Heart", body: (f) => path("M50 90 C8 60 4 30 28 16 C40 10 50 20 50 28 C50 20 60 10 72 16 C96 30 92 60 50 90 Z", f) },
  { key: "bolt", name: "Lightning", body: (f) => poly("58,3 18,55 44,55 36,97 82,40 55,40", f) },
  { key: "flame", name: "Flame", body: (f) => path("M50 4 C58 25 80 38 80 62 C80 80 66 96 50 96 C34 96 20 80 20 62 C20 50 28 42 34 34 C36 44 42 48 46 48 C42 34 44 18 50 4 Z", f) },
  { key: "moon", name: "Moon", body: (f) => path("M70 8 C40 10 20 32 20 58 C20 80 38 94 60 94 C72 94 82 90 90 83 C60 83 42 66 42 44 C42 30 52 16 70 8 Z", f) },
  {
    key: "sun", name: "Sun",
    body: (f) => `<circle cx="50" cy="50" r="20" fill="${f}"/>` + Array.from({ length: 8 }, (_, i) => `<rect x="46" y="4" width="8" height="16" rx="4" fill="${f}" transform="rotate(${i * 45} 50 50)"/>`).join(""),
  },
  { key: "cloud", name: "Cloud", body: (f) => path("M28 76 C12 76 6 58 20 50 C20 34 40 26 52 38 C60 28 82 34 80 52 C94 54 94 76 78 76 Z", f) },
  { key: "crown", name: "Crown", body: (f) => poly("8,76 14,26 36,50 50,18 64,50 86,26 92,76", f) + `<rect x="8" y="80" width="84" height="10" rx="3" fill="${f}"/>` },
  { key: "diamond", name: "Diamond", body: (f) => poly("30,14 70,14 94,40 50,92 6,40", f) },
  { key: "sparkle", name: "Sparkle", body: (f) => path("M50 4 C54 32 68 46 96 50 C68 54 54 68 50 96 C46 68 32 54 4 50 C32 46 46 32 50 4 Z", f) },
  { key: "arrow", name: "Arrow", body: (f) => poly("6,38 58,38 58,16 94,50 58,84 58,62 6,62", f) },
  { key: "leaf", name: "Leaf", body: (f) => path("M14 86 C10 40 40 10 90 10 C90 60 60 90 14 86 Z", f) },
  { key: "wave", name: "Waves", body: (f) => path("M4 36 Q19 18 34 36 T64 36 T96 36", "none", `stroke="${f}" stroke-width="9" stroke-linecap="round"`) + path("M4 62 Q19 44 34 62 T64 62 T96 62", "none", `stroke="${f}" stroke-width="9" stroke-linecap="round"`) },
  { key: "mountain", name: "Mountain", body: (f) => poly("4,86 36,30 52,56 66,38 96,86", f) },
  { key: "ring", name: "Ring", body: (f) => ring(f) },
  { key: "triangle", name: "Triangle", body: (f) => poly("50,8 94,88 6,88", f) },
  { key: "hexagon", name: "Hexagon", body: (f) => poly("27,8 73,8 96,50 73,92 27,92 4,50", f) },
  { key: "plus", name: "Plus", body: (f) => poly("38,6 62,6 62,38 94,38 94,62 62,62 62,94 38,94 38,62 6,62 6,38 38,38", f) },
  { key: "smile", name: "Smile", body: (f) => `<path fill-rule="evenodd" fill="${f}" d="M50 4 A46 46 0 1 0 50.01 4 Z M32 34 A7 7 0 1 1 31.99 34 Z M68 34 A7 7 0 1 1 67.99 34 Z M24 58 C32 82 68 82 76 58 C62 70 38 70 24 58 Z"/>` },
  { key: "note", name: "Music note", body: (f) => path("M36 12 L84 4 V66 C84 78 74 86 62 86 C50 86 42 78 46 68 C50 58 62 56 72 60 V26 L48 31 V76 C48 88 38 96 26 96 C14 96 8 86 12 76 C16 66 28 62 36 66 Z", f) },
  { key: "check", name: "Check badge", body: (f) => `<circle cx="50" cy="50" r="46" fill="${f}"/>` + path("M28 52 L44 68 L74 34", "none", 'stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"') },
  { key: "bubble", name: "Speech bubble", body: (f) => path("M14 14 H86 C92 14 96 18 96 24 V62 C96 68 92 72 86 72 H46 L24 92 V72 H14 C8 72 4 68 4 62 V24 C4 18 8 14 14 14 Z", f) },
  { key: "eye", name: "Eye", body: (f) => `<path d="M4 50 C22 22 78 22 96 50 C78 78 22 78 4 50 Z" fill="${f}"/><circle cx="50" cy="50" r="14" fill="#ffffff"/><circle cx="50" cy="50" r="7" fill="${f}"/>` },
];

export const stickerOf = (key: string) => STICKERS.find((s) => s.key === key);

/** The sticker drawn as an SVG data URL in the given colour (used by the canvas and the picker). */
export function stickerSrc(key: string, fill: string): string {
  const s = stickerOf(key);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400">${s ? s.body(fill) : ""}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
