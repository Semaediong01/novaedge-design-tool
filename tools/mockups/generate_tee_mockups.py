#!/usr/bin/env python3
"""Procedural, photo-style T-shirt mockups for the designer and the shop.

Outputs (public/mockups/), all 1000x1000 = the designer's 500x500 logical space at 2x:
  tee-bare-{color}.png      flat fabric colour + knit texture + collar/seam detail, no lighting
  tee-shade.png             black overlay (alpha = folds, creases, occlusion)
  tee-light.png             white overlay (alpha = highlights)
  tee-{color}.png           baked plain tee (bare + shade + light + soft ground shadow) for shop cards
  tee-{color}-symbol.png    same, with the small NE symbol printed on the left chest

The designer stacks bare -> customer art -> shade -> light, so folds and shadows pass over the print.
Run:  python3 tools/mockups/generate_tee_mockups.py   (needs numpy, scipy, pillow)
Geometry constants below are mirrored in lib/mockups.ts. Change one, change both.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "mockups")
BRAND = os.path.join(ROOT, "public", "brand")
os.makedirs(OUT, exist_ok=True)

N = 1000            # output size in px
K = 2               # px per logical unit
SS = 2              # supersampling for shape masks
rng = np.random.default_rng(7)

COLORS = {
    # name: (rgb, highlight strength, texture kind, symbol tone)
    "white": ((247, 247, 245), 0.00, "plain", "green"),
    "ash":   ((171, 174, 172), 0.10, "heather", "black"),
    "black": ((24, 25, 24),    0.55, "plain", "white"),
}

# Symbol: wearer's left chest = viewer's right. Logical units, top-left + width.
SYMBOL = {"x": 298, "y": 127, "width": 24}
MONO_RATIO = 328 / 389


def bez(p0, p1, p2, p3, n=48):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = map(np.array, (p0, p1, p2, p3))
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t ** 2 * p2 + (t ** 3) * p3


def mirror(pts):
    pts = np.array(pts)
    m = pts.copy()
    m[:, 0] = 500 - m[:, 0]
    return m


def px(pts):
    return [(float(x) * K * SS, float(y) * K * SS) for x, y in pts]


def draw_mask(polys=(), lines=(), width=0):
    im = Image.new("L", (N * SS, N * SS), 0)
    d = ImageDraw.Draw(im)
    for p in polys:
        d.polygon(px(p), fill=255)
    for p in lines:
        d.line(px(p), fill=255, width=int(width * K * SS), joint="curve")
    im = im.resize((N, N), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


# ---------------------------------------------------------------- geometry (logical 500x500)
def left_outline():
    pts = []
    pts += list(bez((206, 60), (180, 66), (150, 76), (126, 86)))            # shoulder
    pts += list(bez((126, 86), (98, 106), (62, 146), (38, 178)))            # sleeve outer
    pts += list(bez((38, 178), (52, 192), (68, 206), (84, 220)))            # sleeve cuff
    pts += list(bez((84, 220), (98, 206), (110, 196), (120, 188)))          # sleeve underside
    pts += list(bez((120, 188), (121, 270), (116, 370), (112, 452)))        # side seam
    return pts


def silhouette_poly():
    left = left_outline()
    back_collar = list(bez((250, 48), (230, 48), (216, 52), (206, 60)))     # centre -> left neck
    hem = list(bez((112, 452), (190, 460), (310, 460), (388, 452)))
    poly = []
    poly += back_collar[::-1][::-1]  # centre -> left neck
    poly = back_collar + left[1:] + hem[1:] + list(mirror(left)[::-1][1:]) + list(mirror(back_collar)[::-1][1:])
    return poly


SIL = silhouette_poly()
FRONT_OUTER = list(bez((208, 62), (212, 110), (288, 110), (292, 62)))
FRONT_INNER = list(bez((214, 60), (219, 100), (281, 100), (286, 60)))
BACK_INNER = list(bez((214, 61), (232, 55), (268, 55), (286, 61)))
BACK_CENTER = list(bez((210, 54), (232, 50), (268, 50), (290, 54)))
FRONT_CENTER = list(bez((211, 62), (216, 104), (284, 104), (289, 62)))


def build_masks():
    m_sil = draw_mask(polys=[SIL])
    hole_poly = BACK_INNER + FRONT_INNER[::-1]
    m_hole = draw_mask(polys=[hole_poly])
    m_ring = np.clip(draw_mask(lines=[FRONT_CENTER], width=9) + draw_mask(lines=[BACK_CENTER], width=8), 0, 1) * m_sil
    m_ring = np.clip(m_ring - m_hole, 0, 1)
    left_sleeve = [(126, 86), (38, 178), (84, 220), (120, 188), (124, 120)]
    m_sleeve = draw_mask(polys=[left_sleeve, [(500 - x, y) for x, y in left_sleeve]]) * m_sil
    return m_sil, m_hole, m_ring, m_sleeve


def blur(a, s):
    return ndi.gaussian_filter(a, s)


def ridged(shape_sigma, seed_scale=1.0):
    n = blur(rng.standard_normal((N, N)).astype(np.float32), shape_sigma)
    n /= np.abs(n).max()
    return (1 - np.abs(n)) ** 2 * 2 - 1       # thin ridges where the noise crosses zero


def fold_field(m_sil, m_sleeve, yy, xx):
    """Pseudo height field for cloth: sparse drapes, armpit fans, sleeve ridges, hem roll."""
    body = np.clip(m_sil - m_sleeve, 0, 1)
    interior = blur(body, 30)
    f = np.zeros((N, N), np.float32)
    # a few long vertical drapes down the torso
    f += 0.75 * ridged((150, 20)) * interior * np.clip((yy - 200) / 200, 0, 1)
    # soft horizontal creases low on the torso
    f += 0.20 * ridged((22, 120)) * interior * np.clip((yy - 520) / 250, 0, 1)
    # fans of wrinkles radiating from each armpit, falling down and inwards
    jitter = blur(rng.standard_normal((N, N)).astype(np.float32), 40) * 60
    for ax, ay, dirx in ((246, 380, 1.0), (754, 380, -1.0)):
        dx, dy = xx - ax, yy - ay
        r = np.hypot(dx, dy) + 1e-3
        th = np.arctan2(dy, dx)
        base = np.arctan2(1.0, 0.9 * dirx)
        d = np.angle(np.exp(1j * (th - base)))
        fan = np.sin(d * 8.0 + jitter / 50.0) * np.exp(-r / 130.0) * np.clip(1 - np.abs(d) / 0.9, 0, 1)
        f += 0.8 * fan * body
    # sleeve ridges
    f += 0.45 * ridged((30, 30)) * blur(m_sleeve, 8)
    # hem roll
    f += 0.35 * np.sin((yy - 880) / 16.0) * np.exp(-((yy - 905) / 30.0) ** 2) * body
    return blur(f, 2.0)


def render_fields():
    m_sil, m_hole, m_ring, m_sleeve = build_masks()
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    solid = np.clip(m_sil - m_hole, 0, 1)
    dist = ndi.distance_transform_edt(solid > 0.5).astype(np.float32)
    folds = fold_field(m_sil, m_sleeve, yy, xx)
    H = blur(folds * 2.6, 1.0)
    # gentle roundness so the shoulders and chest read as 3D (very low amplitude)
    cx = (xx - 500) / 270.0
    H += 1.2 * np.sqrt(np.clip(1 - cx ** 2, 0, 1)) * (m_sil - m_sleeve)
    gy, gx = np.gradient(H)
    kscale = 1.6
    nx, ny, nz = -gx * kscale, -gy * kscale, np.ones_like(H)
    nrm = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    nx, ny, nz = nx / nrm, ny / nrm, nz / nrm
    L = np.array([-0.28, -0.38, 0.88])
    L = L / np.linalg.norm(L)
    s = nx * L[0] + ny * L[1] + nz * L[2] - L[2]

    # symmetric occlusion: collar shadow, sleeve seams, hem, a soft darkening near the edges
    ao = np.zeros_like(H)
    ao += 0.28 * blur(m_ring, 6) * (m_sil - m_ring)
    arm = list(bez((126, 86), (124, 120), (122, 160), (120, 188)))
    seam = np.clip(draw_mask(lines=[arm], width=2.0) + draw_mask(lines=[list(mirror(np.array(arm)))], width=2.0), 0, 1)
    ao += 0.20 * blur(seam, 6) * m_sil
    ao += 0.22 * blur(seam, 1.2)
    edge = 1 - np.tanh(dist / 22.0)
    ao += 0.10 * edge * m_sil
    # underarm: the body is shaded where the sleeve folds over it
    under = draw_mask(polys=[[(120, 188), (84, 220), (100, 238), (128, 214)], [(380, 188), (416, 220), (400, 238), (372, 214)]])
    ao += 0.30 * blur(under, 5) * m_sil
    # the sleeve underside (cuff interior) is darker
    cuff = draw_mask(polys=[[(38, 178), (84, 220), (74, 214), (44, 183)], [(462, 178), (416, 220), (426, 214), (456, 183)]])
    ao += 0.22 * blur(cuff, 2.0)
    hem_line = draw_mask(lines=[list(bez((113, 436), (190, 444), (310, 444), (387, 436)))], width=1.4)
    ao += 0.12 * hem_line
    shade = np.clip(-s * 3.0 + ao, 0, 0.6) * m_sil
    light = np.clip(s * 2.2, 0, 0.5) * m_sil * (1 - 0.7 * m_hole)
    shade = np.clip(shade + 0.30 * m_hole, 0, 0.7)
    return dict(sil=m_sil, hole=m_hole, ring=m_ring, sleeve=m_sleeve, shade=shade, light=light, seam=seam, hem_line=hem_line, xx=xx, yy=yy)


def stitch_line(pts, off, dash=7, gap=5, width=1.3):
    """Dashed stitching as a mask (logical-unit polyline, offset in logical units)."""
    arr = np.array(pts)
    d = np.gradient(arr, axis=0)
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    nrm /= (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-6)
    p = arr + nrm * off
    im = Image.new("L", (N * SS, N * SS), 0)
    dr = ImageDraw.Draw(im)
    seg = 0.0
    on = True
    for a, b in zip(p[:-1], p[1:]):
        ln = np.linalg.norm(b - a) * K
        seg += ln
        lim = dash if on else gap
        if on:
            dr.line([(a[0] * K * SS, a[1] * K * SS), (b[0] * K * SS, b[1] * K * SS)], fill=255, width=int(width * SS))
        if seg > lim:
            seg = 0
            on = not on
    im = im.resize((N, N), Image.LANCZOS)
    return np.asarray(im, np.float32) / 255.0


def fabric_texture(kind, f):
    xx, yy = f["xx"], f["yy"]
    tex = 0.016 * np.sin(xx * 2 * np.pi / 3.1) * (0.6 + 0.4 * np.sin(yy * 2 * np.pi / 5.0))
    tex += 0.010 * blur(rng.standard_normal((N, N)).astype(np.float32), 0.6) * 2.2
    if kind == "heather":
        tex += 0.060 * blur(rng.standard_normal((N, N)).astype(np.float32), 1.4) * 3.0
        tex += 0.030 * blur(rng.standard_normal((N, N)).astype(np.float32), 9.0) * 6.0
    return tex.astype(np.float32)


def collar_detail(f):
    """Multiplicative detail map: collar rib lines, seams, stitching, dark neck interior."""
    d = np.ones((N, N), np.float32)
    ring = f["ring"]
    ribs = 0.05 * np.sin(f["xx"] * 2 * np.pi / 5.0) * ring
    d += ribs - 0.045 * ring
    d *= 1 - 0.40 * f["hole"]
    d *= 1 - 0.20 * f["seam"]
    for pts, off in ((FRONT_CENTER, 6.2), (BACK_CENTER, 5.4)):
        st = stitch_line(pts, off, dash=5, gap=3.2, width=0.9)
        d *= 1 - 0.20 * st * f["sil"]
    hem = stitch_line(list(bez((113, 441), (190, 449), (310, 449), (387, 441))), 0, dash=6, gap=3, width=1.0)
    hem2 = stitch_line(list(bez((113, 446), (190, 454), (310, 454), (387, 446))), 0, dash=6, gap=3, width=1.0)
    d *= 1 - 0.17 * np.clip(hem + hem2, 0, 1)
    for sign in (1, -1):
        cuff = [(38 + 6, 178 + 5), (84 - 4, 220 - 3)] if sign == 1 else [(500 - (38 + 6), 178 + 5), (500 - (84 - 4), 220 - 3)]
        a, b = np.array(cuff[0], float), np.array(cuff[1], float)
        line = [tuple(a + (b - a) * t) for t in np.linspace(0, 1, 30)]
        st = stitch_line(line, 0, dash=5, gap=3, width=0.9)
        d *= 1 - 0.17 * st * f["sil"]
    return d


def save_png(arr_rgba, name):
    im = Image.fromarray(np.clip(arr_rgba * 255 + 0.5, 0, 255).astype(np.uint8), "RGBA")
    im.save(os.path.join(OUT, name), optimize=True)


def paste_symbol(rgb, tone, f, tex):
    src = Image.open(os.path.join(BRAND, {"white": "ne-monogram-white.png", "black": "ne-monogram-black.png", "green": "ne-monogram.png"}[tone])).convert("RGBA")
    w = int(SYMBOL["width"] * K)
    h = int(w * MONO_RATIO)
    src = src.resize((w * 4, int(w * 4 * MONO_RATIO)), Image.LANCZOS).resize((w, h), Image.LANCZOS)
    layer = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    layer.paste(src, (int(SYMBOL["x"] * K), int(SYMBOL["y"] * K)), src)
    la = np.asarray(layer, np.float32) / 255.0
    a = la[..., 3:4] * 0.94
    ink = la[..., :3] * (1 + 0.8 * tex[..., None])  # print sits in the weave
    return rgb * (1 - a) + ink * a


def main():
    f = render_fields()
    save_png(np.dstack([np.zeros((N, N, 3), np.float32), f["shade"]]), "tee-shade.png")
    save_png(np.dstack([np.ones((N, N, 3), np.float32), f["light"]]), "tee-light.png")
    detail = collar_detail(f)
    for name, (rgb, light_strength, kind, tone) in COLORS.items():
        tex = fabric_texture(kind, f)
        base = np.array(rgb, np.float32)[None, None, :] / 255.0 * (1 + tex[..., None]) * detail[..., None]
        base = np.clip(base, 0, 1)
        save_png(np.dstack([base, f["sil"]]), f"tee-bare-{name}.png")

        def bake(rgb_in):
            out = rgb_in * (1 - f["shade"][..., None])
            out = out * (1 - f["light"][..., None] * light_strength) + f["light"][..., None] * light_strength
            return np.clip(out, 0, 1)

        # soft ground shadow under the garment
        ground = blur(np.roll(f["sil"], 10, axis=0), 14) * 0.22
        for variant, rgb_in in (("", base), ("-symbol", paste_symbol(base, tone, f, tex))):
            lit = bake(rgb_in)
            a = np.clip(f["sil"] + (1 - f["sil"]) * ground, 0, 1)
            col = lit * f["sil"][..., None]
            col = col + (1 - f["sil"][..., None]) * 0.0
            save_png(np.dstack([col, a]), f"tee-{name}{variant}.png")
    print("wrote mockups to", OUT)


if __name__ == "__main__":
    main()
