// lib/frames.ts — photo frame shapes. A frame is a shape that crops the customer's photo; the photo can be zoomed and moved inside.
export type FrameShape = "rounded" | "circle" | "heart" | "star" | "hexagon" | "diamond" | "arch" | "square";
export const FRAME_SHAPES: { key: FrameShape; name: string }[] = [
  { key: "rounded", name: "Rounded" },
  { key: "square", name: "Square" },
  { key: "circle", name: "Circle" },
  { key: "heart", name: "Heart" },
  { key: "star", name: "Star" },
  { key: "hexagon", name: "Hexagon" },
  { key: "diamond", name: "Diamond" },
  { key: "arch", name: "Arch" },
];

type Ctx = { beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; bezierCurveTo(a: number, b: number, c: number, d: number, e: number, f: number): void; quadraticCurveTo(a: number, b: number, c: number, d: number): void; closePath(): void };

const K = 0.5523; // circle-to-bezier constant

function polygon(ctx: Ctx, pts: [number, number][], w: number, h: number) {
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * w, y * h) : ctx.lineTo(x * w, y * h)));
  ctx.closePath();
}

/** Draws the frame outline into a canvas context, for a frame w x h (used to clip the photo). */
export function frameClip(ctx: Ctx, shape: FrameShape, w: number, h: number) {
  ctx.beginPath();
  switch (shape) {
    case "square":
      polygon(ctx, [[0, 0], [1, 0], [1, 1], [0, 1]], w, h);
      break;
    case "circle": {
      const rx = w / 2, ry = h / 2;
      ctx.moveTo(w, ry);
      ctx.bezierCurveTo(w, ry + ry * K, rx + rx * K, h, rx, h);
      ctx.bezierCurveTo(rx - rx * K, h, 0, ry + ry * K, 0, ry);
      ctx.bezierCurveTo(0, ry - ry * K, rx - rx * K, 0, rx, 0);
      ctx.bezierCurveTo(rx + rx * K, 0, w, ry - ry * K, w, ry);
      ctx.closePath();
      break;
    }
    case "heart":
      ctx.moveTo(0.5 * w, 0.95 * h);
      ctx.bezierCurveTo(0.05 * w, 0.62 * h, -0.02 * w, 0.3 * h, 0.25 * w, 0.14 * h);
      ctx.bezierCurveTo(0.4 * w, 0.06 * h, 0.5 * w, 0.2 * h, 0.5 * w, 0.28 * h);
      ctx.bezierCurveTo(0.5 * w, 0.2 * h, 0.6 * w, 0.06 * h, 0.75 * w, 0.14 * h);
      ctx.bezierCurveTo(1.02 * w, 0.3 * h, 0.95 * w, 0.62 * h, 0.5 * w, 0.95 * h);
      ctx.closePath();
      break;
    case "star":
      polygon(ctx, [[0.5, 0.02], [0.62, 0.36], [0.98, 0.37], [0.69, 0.58], [0.8, 0.93], [0.5, 0.72], [0.2, 0.93], [0.31, 0.58], [0.02, 0.37], [0.38, 0.36]], w, h);
      break;
    case "hexagon":
      polygon(ctx, [[0.25, 0.02], [0.75, 0.02], [1, 0.5], [0.75, 0.98], [0.25, 0.98], [0, 0.5]], w, h);
      break;
    case "diamond":
      polygon(ctx, [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h);
      break;
    case "arch": {
      const rx = w / 2;
      ctx.moveTo(0, h);
      ctx.lineTo(0, rx);
      ctx.bezierCurveTo(0, rx - rx * K, rx - rx * K, 0, rx, 0);
      ctx.bezierCurveTo(rx + rx * K, 0, w, rx - rx * K, w, rx);
      ctx.lineTo(w, h);
      ctx.closePath();
      break;
    }
    default: {
      const r = Math.min(w, h) * 0.14;
      ctx.moveTo(r, 0);
      ctx.lineTo(w - r, 0);
      ctx.quadraticCurveTo(w, 0, w, r);
      ctx.lineTo(w, h - r);
      ctx.quadraticCurveTo(w, h, w - r, h);
      ctx.lineTo(r, h);
      ctx.quadraticCurveTo(0, h, 0, h - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
    }
  }
}

/** SVG path-ish preview for the picker, drawn on a 100x100 box. */
export function frameThumbPath(shape: FrameShape): string {
  const cmds: string[] = [];
  const rec: Ctx = {
    beginPath() {},
    moveTo: (x, y) => cmds.push(`M${x.toFixed(1)} ${y.toFixed(1)}`),
    lineTo: (x, y) => cmds.push(`L${x.toFixed(1)} ${y.toFixed(1)}`),
    bezierCurveTo: (a, b, c, d, e, f) => cmds.push(`C${a.toFixed(1)} ${b.toFixed(1)} ${c.toFixed(1)} ${d.toFixed(1)} ${e.toFixed(1)} ${f.toFixed(1)}`),
    quadraticCurveTo: (a, b, c, d) => cmds.push(`Q${a.toFixed(1)} ${b.toFixed(1)} ${c.toFixed(1)} ${d.toFixed(1)}`),
    closePath: () => cmds.push("Z"),
  };
  frameClip(rec, shape, 100, 100);
  return cmds.join(" ");
}

/** Scale and offset that make a photo cover a frame; `zoom` >= 1 zooms in, `offX`/`offY` (-1..1) move it. */
export function coverFit(iw: number, ih: number, w: number, h: number, zoom: number, offX: number, offY: number) {
  const s = Math.max(w / iw, h / ih) * Math.max(1, zoom);
  const dw = iw * s, dh = ih * s;
  return { width: dw, height: dh, x: (w - dw) / 2 + offX * Math.max(0, (dw - w) / 2), y: (h - dh) / 2 + offY * Math.max(0, (dh - h) / 2) };
}
