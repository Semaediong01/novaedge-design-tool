// components/admin/TeeFullPreview.tsx — the whole tee with the customer's artwork placed on it, so you can
// check placement before printing. Built from the same layers the designer uses (no extra file is stored).
import { garmentLayers, printAreaFor, teeColorKey, type GarmentBase, type TeeSide } from "@/lib/mockups";

const pct = (n: number) => `${(n / 500) * 100}%`;

export default function TeeFullPreview({ color, artUrl, alt, side = "front", base = "tee" }: { color?: string | null; artUrl: string; alt: string; side?: TeeSide; base?: GarmentBase }) {
  const layers = garmentLayers(base, teeColorKey(color) ?? "white", side);
  const area = printAreaFor(base);
  /* eslint-disable @next/next/no-img-element */
  return (
    <div className="tfp" role="img" aria-label={alt}>
      <img src={layers.bare} alt="" className="tfp-layer" />
      <img
        src={artUrl}
        alt=""
        className="tfp-art"
        style={{ left: pct(area.x), top: pct(area.y), width: pct(area.width), height: pct(area.height) }}
      />
      <img src={layers.shade} alt="" className="tfp-layer" />
      {layers.lightOpacity > 0 && <img src={layers.light} alt="" className="tfp-layer" style={{ opacity: layers.lightOpacity }} />}
    </div>
  );
  /* eslint-enable @next/next/no-img-element */
}
