// components/admin/TeeFullPreview.tsx — the whole tee with the customer's artwork placed on it, so you can
// check placement before printing. Built from the same layers the designer uses (no extra file is stored).
import { TEE_PRINT_AREA, teeColorKey, teeLayers } from "@/lib/mockups";

const pct = (n: number) => `${(n / 500) * 100}%`;

export default function TeeFullPreview({ color, artUrl, alt }: { color?: string | null; artUrl: string; alt: string }) {
  const layers = teeLayers(teeColorKey(color) ?? "white");
  /* eslint-disable @next/next/no-img-element */
  return (
    <div className="tfp" role="img" aria-label={alt}>
      <img src={layers.bare} alt="" className="tfp-layer" />
      <img
        src={artUrl}
        alt=""
        className="tfp-art"
        style={{ left: pct(TEE_PRINT_AREA.x), top: pct(TEE_PRINT_AREA.y), width: pct(TEE_PRINT_AREA.width), height: pct(TEE_PRINT_AREA.height) }}
      />
      <img src={layers.shade} alt="" className="tfp-layer" />
      {layers.lightOpacity > 0 && <img src={layers.light} alt="" className="tfp-layer" style={{ opacity: layers.lightOpacity }} />}
    </div>
  );
  /* eslint-enable @next/next/no-img-element */
}
