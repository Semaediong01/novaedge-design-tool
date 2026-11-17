#!/usr/bin/env python3
"""Procedural, photo-style front-view baseball / dad cap mockups for the designer and the shop.

Outputs (public/mockups/), all 1000x1000 = the designer's 500x500 logical space at 2x:
  cap-bare-{color}.png   flat fabric colour + twill texture + seams, stitching, eyelets, button, brim rows. No lighting.
  cap-shade.png          black overlay (alpha = dome shading, seam grooves, brim shadow, button shadow)
  cap-light.png          white overlay (alpha = highlights)
  cap-{color}.png        baked plain cap (bare + shade + light + soft ground shadow) for shop cards

The designer stacks bare -> customer art -> shade -> light (light drawn at the per-colour opacity below).
Run:  python3 tools/mockups/generate_cap_mockups.py   (needs numpy, scipy, pillow)
Geometry constants below (PRINT_AREA) should be mirrored in lib/mockups.ts. Change one, change both.

The cap is a five-panel dad cap: one seamless front panel (the print area), two side panels, curved brim.
"""
import os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "mockups")
os.makedirs(OUT, exist_ok=True)

N = 1000            # output size in px
K = 2               # px per logical unit
SS = 2              # supersampling for shape masks
rng = np.random.default_rng(11)

COLORS = {
    # name: (rgb, highlight strength, texture kind)  -- same table as the tee generator
    "white": ((247, 247, 245), 0.00, "plain"),
    "ash":   ((171, 174, 172), 0.10, "heather"),
    "black": ((24, 25, 24),    0.55, "plain"),
    "navy":  ((28, 42, 76),    0.40, "plain"),
    "royal": ((38, 84, 170),   0.30, "plain"),
    "forest": ((34, 77, 52),   0.40, "plain"),
    "red":   ((190, 38, 45),   0.25, "plain"),
    "maroon": ((100, 26, 38),  0.40, "plain"),
    "sand":  ((214, 196, 164), 0.05, "plain"),
}

# Front-panel print area, logical units (500x500 space): flat rectangle on the front panel above the brim.
PRINT_AREA = {"x": 175, "y": 166, "width": 150, "height": 90}


# ---------------------------------------------------------------- helpers (same style as the tee script)
def bez(p0, p1, p2, p3, n=64):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = map(np.array, (p0, p1, p2, p3))
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t ** 2 * p2 + (t ** 3) * p3


def mirror(pts):
    pts = np.array(pts, float)
    m = pts.copy()
    m[:, 0] = 500 - m[:, 0]
    return m


def px(pts):
    return [(float(x) * K * SS, float(y) * K * SS) for x, y in pts]


def draw_mask(polys=(), lines=(), width=0, ellipses=()):
    im = Image.new("L", (N * SS, N * SS), 0)
    d = ImageDraw.Draw(im)
    for p in polys:
        d.polygon(px(p), fill=255)
    for p in lines:
        d.line(px(p), fill=255, width=max(1, int(round(width * K * SS))), joint="curve")
    for cx, cy, rx, ry in ellipses:
        d.ellipse([(cx - rx) * K * SS, (cy - ry) * K * SS, (cx + rx) * K * SS, (cy + ry) * K * SS], fill=255)
    im = im.resize((N, N), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def blur(a, s):
    return ndi.gaussian_filter(a, s)


def stitch_line(pts, off, dash=7, gap=5, width=1.3):
    """Dashed stitching as a mask (logical-unit polyline, offset in logical units along the normal)."""
    arr = np.array(pts, float)
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
            dr.line([(a[0] * K * SS, a[1] * K * SS), (b[0] * K * SS, b[1] * K * SS)], fill=255, width=max(1, int(width * SS)))
        if seg > lim:
            seg = 0
            on = not on
    im = im.resize((N, N), Image.LANCZOS)
    return np.asarray(im, np.float32) / 255.0


# ---------------------------------------------------------------- geometry (logical 500x500)
CROWN_BOTTOM = bez((92, 264), (160, 294), (340, 294), (408, 264))            # where the crown meets the brim
_cl = bez((92, 264), (84, 150), (158, 96), (250, 96))                       # crown left side up to the top
CROWN = np.vstack([_cl, mirror(_cl)[::-1][1:], CROWN_BOTTOM[::-1][1:]])
BRIM_LOWER = bez((90, 266), (104, 358), (396, 358), (410, 266))               # visor outer edge
BRIM_UPPER = bez((90, 266), (160, 280), (340, 280), (410, 266))               # hidden under the crown in the middle
BRIM = np.vstack([BRIM_LOWER, BRIM_UPPER[::-1][1:]])
SEAM_L = bez((246, 97), (172, 108), (136, 196), (146, 276))                  # front panel / left side panel
SEAM_R = mirror(SEAM_L)
BUTTON = (250, 95, 10.5, 7.0)
EYELETS = [(116, 178), (384, 178)]


def build_masks():
    m_crown = draw_mask(polys=[CROWN])
    m_brim_full = draw_mask(polys=[BRIM])
    m_button = draw_mask(ellipses=[BUTTON])
    m_brim = np.clip(m_brim_full * (1 - m_crown), 0, 1)
    m_sil = np.clip(m_crown + m_brim + m_button, 0, 1)
    return m_crown, m_brim, m_button, m_sil


def eyelet_masks():
    hole = draw_mask(ellipses=[(x, y, 3.0, 3.0) for x, y in EYELETS])
    ring = draw_mask(ellipses=[(x, y, 5.6, 5.6) for x, y in EYELETS]) - draw_mask(ellipses=[(x, y, 3.0, 3.0) for x, y in EYELETS])
    return hole, np.clip(ring, 0, 1)


def render_fields():
    m_crown, m_brim, m_button, m_sil = build_masks()
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    hole, ring = eyelet_masks()
    m_brim_full = draw_mask(polys=[BRIM])

    seam = np.clip(draw_mask(lines=[SEAM_L, SEAM_R], width=1.6), 0, 1) * m_crown
    seam_top = np.clip(draw_mask(lines=[bez((240, 104), (200, 108), (210, 110), (250, 101))], width=1), 0, 1)
    crown_edge = np.clip(draw_mask(lines=[CROWN_BOTTOM], width=2.4), 0, 1) * m_sil

    # ---- crown dome: ellipsoid normals (compressed, so the flat print panel stays flat-ish)
    u = (xx / K - 250.0) / 168.0
    v = (yy / K - 272.0) / 176.0
    r2 = np.clip(u ** 2 + v ** 2, 0, 0.97)
    h = np.sqrt(1 - r2)
    c = 0.62
    nx, ny, nz = u * c, v * c, h
    # cloth: low-frequency puckering + panel pillowing
    pk = blur(rng.standard_normal((N, N)).astype(np.float32), 26)
    pk /= np.abs(pk).max()
    # each panel pillows slightly between its seams (stuffed buckram), so seams read as grooves
    dseam = ndi.distance_transform_edt(draw_mask(lines=[SEAM_L, SEAM_R], width=1.6) < 0.5).astype(np.float32)
    pillow = blur(np.tanh(dseam / 70.0) * m_crown, 6)
    nx = nx - 0.55 * np.gradient(pillow, axis=1) * 12 * m_crown
    ny = ny - 0.55 * np.gradient(pillow, axis=0) * 12 * m_crown
    nx = nx + 0.10 * np.gradient(pk, axis=1) * 26 * m_crown
    ny = ny + 0.10 * np.gradient(pk, axis=0) * 26 * m_crown
    nrm = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    nx, ny, nz = nx / nrm, ny / nrm, nz / nrm
    L = np.array([-0.12, -0.42, 0.90])
    L = L / np.linalg.norm(L)
    s = nx * L[0] + ny * L[1] + nz * L[2] - L[2]

    shade = np.clip(-s * 2.0, 0, 0.55) * m_crown
    light = np.clip(s * 1.6, 0, 0.45) * m_crown

    # soft rim darkening on the crown near the silhouette sides
    dist = ndi.distance_transform_edt(m_crown > 0.5).astype(np.float32)
    shade += 0.10 * (1 - np.tanh(dist / 26.0)) * m_crown

    # seams: groove + occlusion on both sides, tiny lift just beside them
    shade += 0.30 * blur(seam, 1.0) + 0.10 * blur(seam, 5.0) * m_crown
    light += 0.10 * np.clip(blur(seam, 4.0) - blur(seam, 1.4) * 1.2, 0, 1) * m_crown
    # crown/brim junction: crease on the crown just above the visor
    shade += 0.20 * blur(crown_edge, 3.0) + 0.08 * blur(m_brim, 9.0) * m_crown
    # eyelets: shadowed lower rim, dark hole
    shade += 0.55 * hole + 0.20 * blur(ring, 1.2)
    light += 0.22 * np.clip(blur(np.roll(ring, 2, axis=0), 1.0) - ring * 0.5, 0, 1) * m_crown * 0.5

    # ---- brim: slightly darker overall, darker towards the curled tips and the underside edge
    bx = np.abs(xx / K - 250.0) / 170.0
    by = (yy / K - 284.0) / 62.0
    brim_shade = 0.16 + 0.20 * bx ** 2 + 0.10 * np.clip(by, 0, 1)
    # cast shadow of the crown onto the visor, fading away from the junction
    cast = blur(m_crown, 7.0) * 0.30 + blur(m_crown, 18.0) * 0.20
    # broad soft sheen across the middle of the visor
    sheen = np.exp(-(((xx / K - 235.0) / 85.0) ** 2 + ((yy / K - 313.0) / 17.0) ** 2))
    # outer edge binding: thin dark lip + tiny rim light
    edge_dist = ndi.distance_transform_edt(m_brim_full > 0.5).astype(np.float32)
    lip = np.clip(1 - edge_dist / 5.0, 0, 1) * (yy / K > 282)
    shade = shade + m_brim * (brim_shade + cast + 0.22 * lip)
    light = light + m_brim * (0.34 * sheen * (1 - 0.6 * cast) + 0.12 * np.clip(1 - np.abs(edge_dist - 7.0) / 2.5, 0, 1) * (yy / K > 300))

    # ---- button: domed, lit top-left, shaded bottom-right, contact shadow around the base
    bxx = (xx / K - BUTTON[0]) / BUTTON[2]
    byy = (yy / K - BUTTON[1]) / BUTTON[3]
    bh = np.sqrt(np.clip(1 - bxx ** 2 - byy ** 2, 0, 1))
    bs = (-0.45 * bxx - 0.6 * byy) * 0.6
    contact = blur(m_button, 2.2) * (1 - m_button) * m_crown
    shade = shade * (1 - m_button) + m_button * np.clip(-bs * 1.6 + 0.12 * (1 - bh), 0, 0.5) + 0.40 * contact
    light = light * (1 - m_button) + m_button * np.clip(bs * 1.8, 0, 0.55)

    shade = np.clip(shade, 0, 0.78) * np.clip(m_sil + 0.0, 0, 1)
    light = np.clip(light, 0, 0.6) * m_sil
    return dict(sil=m_sil, crown=m_crown, brim=m_brim, button=m_button, shade=shade, light=light, seam=seam,
                hole=hole, ring=ring, crown_edge=crown_edge, xx=xx, yy=yy)


def fabric_texture(kind, f):
    xx, yy = f["xx"], f["yy"]
    # cotton twill: fine diagonal ribs + light grain
    diag = np.sin((xx + 1.6 * yy) * 2 * np.pi / 3.6)
    tex = 0.020 * diag * (0.7 + 0.3 * np.sin(yy * 2 * np.pi / 7.0))
    tex += 0.010 * blur(rng.standard_normal((N, N)).astype(np.float32), 0.6) * 2.2
    if kind == "heather":
        tex += 0.055 * blur(rng.standard_normal((N, N)).astype(np.float32), 1.4) * 3.0
        tex += 0.028 * blur(rng.standard_normal((N, N)).astype(np.float32), 9.0) * 6.0
    # the visor is smoother (board covered in twill): calm the texture there
    tex = tex * (1 - 0.45 * f["brim"])
    return tex.astype(np.float32)


def detail_map(f):
    """Multiplicative detail map: seams, stitching, eyelets, brim rows, crown/brim seam."""
    d = np.ones((N, N), np.float32)
    # panel seams: slightly darker groove with a double row of stitches either side
    d *= 1 - 0.08 * f["seam"]
    for seam_pts in (SEAM_L, SEAM_R):
        for off in (-2.8, 2.8):
            st = stitch_line(seam_pts, off, dash=6, gap=2.4, width=0.9)
            d *= 1 - 0.20 * st * f["crown"]
    # crown-to-visor seam: stitch rows on the crown just above the brim
    for off in (-3.4, -6.0):
        st = stitch_line(CROWN_BOTTOM, off, dash=6, gap=2.4, width=0.9)
        d *= 1 - 0.18 * st * f["crown"]
    d *= 1 - 0.20 * f["crown_edge"]
    # visor rows of stitching following the outer edge
    low = BRIM_LOWER
    inner = f["brim"]
    for k, dy in enumerate((-10.0, -17.0, -24.0, -31.0)):
        row = low.copy()
        row[:, 1] += dy * (0.9 + 0.1 * (1 - np.abs(row[:, 0] - 250.0) / 170.0))
        row[:, 0] = 250 + (row[:, 0] - 250.0) * (0.96 - 0.012 * k)
        ln = draw_mask(lines=[row], width=0.9)
        d *= 1 - 0.13 * ln * inner
    # visor outer edge binding
    edge = np.clip(draw_mask(lines=[BRIM_LOWER], width=5.0), 0, 1) * f["brim"]
    d *= 1 - 0.10 * edge
    # eyelets: stitched ring + deep hole
    d *= 1 - 0.14 * f["ring"]
    d *= 1 - 0.80 * f["hole"]
    # button top: a touch of radial stitching
    ang = np.arctan2(f["yy"] / K - BUTTON[1], f["xx"] / K - BUTTON[0])
    d *= 1 - 0.06 * f["button"] * np.sin(ang * 8)
    return d


def save_png(arr_rgba, name):
    im = Image.fromarray(np.clip(arr_rgba * 255 + 0.5, 0, 255).astype(np.uint8), "RGBA")
    im.save(os.path.join(OUT, name), optimize=True)


def main():
    f = render_fields()
    save_png(np.dstack([np.zeros((N, N, 3), np.float32), f["shade"]]), "cap-shade.png")
    save_png(np.dstack([np.ones((N, N, 3), np.float32), f["light"]]), "cap-light.png")
    detail = detail_map(f)
    for name, (rgb, light_strength, kind) in COLORS.items():
        tex = fabric_texture(kind, f)
        base = np.clip(np.array(rgb, np.float32)[None, None, :] / 255.0 * (1 + tex[..., None]) * detail[..., None], 0, 1)
        save_png(np.dstack([base, f["sil"]]), f"cap-bare-{name}.png")

        out = base * (1 - f["shade"][..., None])
        out = out * (1 - f["light"][..., None] * light_strength) + f["light"][..., None] * light_strength
        out = np.clip(out, 0, 1)
        ground = blur(np.roll(f["sil"], 10, axis=0), 14) * 0.22
        a = np.clip(f["sil"] + (1 - f["sil"]) * ground, 0, 1)
        save_png(np.dstack([out * f["sil"][..., None], a]), f"cap-{name}.png")
    print("wrote cap mockups to", OUT)
    print("cap print area (logical units, 500x500 space):", PRINT_AREA)


if __name__ == "__main__":
    main()
