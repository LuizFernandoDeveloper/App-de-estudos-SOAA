"""Generates assets/demo-loop.gif — a small animated "live dashboard" loop.

Pure Pillow, no external assets. Render at 2x and downscale for crisp edges.
Run: python scripts/generate_demo_gif.py
"""

from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw, ImageFont

W, H = 640, 420
SS = 2  # supersample factor
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "demo-loop.gif")

BG = (8, 17, 31)
PANEL = (13, 27, 46)
PANEL_BORDER = (33, 49, 72)
TEXT = (230, 239, 252)
MUTED = (147, 171, 200)
INDIGO = (127, 115, 231)
VIOLET = (167, 138, 250)
CYAN = (34, 211, 238)
PINK = (244, 114, 182)
GREEN = (52, 211, 153)
AMBER = (255, 202, 118)
RED = (255, 90, 113)
WHITE = (255, 255, 255)

ROWS = [
    ("Matematica · Geometria Analitica", INDIGO, RED, "Z-1", 0.62, "R 54%"),
    ("Fisica · Eletromagnetismo", PINK, AMBER, "Z-2", 0.46, "R 68%"),
    ("Quimica · Estequiometria", CYAN, GREEN, "Z-3", 0.81, "R 81%"),
]


def font(sz: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = os.path.join(os.environ.get("WINDIR", "C:/Windows"), "Fonts", name)
    try:
        return ImageFont.truetype(path, sz)
    except OSError:
        return ImageFont.load_default()


def frame(phase: float, total_frames: int) -> Image.Image:
    img = Image.new("RGB", (W * SS, H * SS), BG)
    d = ImageDraw.Draw(img)
    f_head = font(15 * SS, bold=True)
    f_panel = font(12 * SS, bold=True)
    f_body = font(11 * SS)
    f_small = font(9 * SS)
    f_tiny = font(8 * SS)

    cx = lambda x: x * SS   # noqa: E731 — scale helper
    cy = lambda y: y * SS

    # header
    d.rounded_rectangle([cx(24), cy(22), cx(W - 24), cy(66)], radius=cx(14), fill=(40, 32, 94), outline=(61, 70, 144))
    for i in range(0, cx(40), 2):
        pass
    d.rounded_rectangle([cx(40), cy(34), cx(72), cy(54)], radius=cx(10), outline=(185, 177, 255), width=max(1, int(2 * SS)))
    d.ellipse([cx(48), cy(42), cx(64), cy(58)], outline=(185, 177, 255), width=max(1, int(2 * SS)))
    d.ellipse([cx(53), cy(47), cx(59), cy(53)], fill=(34, 211, 238))
    d.text((cx(86), cy(30)), "SOAA", font=f_head, fill=(239, 246, 255))
    d.text((cx(86), cy(50)), "painel de estudo ao vivo < demo >", font=f_small, fill=(147, 171, 200))

    # live pulse
    pulse = 0.5 + 0.5 * math.sin(2 * math.pi * (phase / total_frames))
    r = int(cx(4 + pulse * 2))
    d.ellipse([cx(556) - r, cy(40) - r, cx(556) + r, cy(40) + r], fill=(52, 211, 153))
    d.text((cx(570), cy(36)), "LIVE", font=f_small, fill=(87, 230, 170))

    # ---- chart panel ----
    d.rounded_rectangle([cx(24), cy(82), cx(W - 24), cy(250)], radius=cx(14), fill=PANEL, outline=PANEL_BORDER)
    d.text((cx(40), cy(96)), "Retencao por Materia e Nicho", font=f_panel, fill=(223, 228, 242))

    x0, x1 = cx(52), cx(W - 52)
    y_top, y_bot = cy(130), cy(220)
    # grid lines
    for gy in range(4):
        yy = y_top + (y_bot - y_top) * gy / 3
        d.line([x0, yy, x1, yy], fill=(32, 48, 68), width=max(1, SS // 2))
    # alert line at 90%
    alert_y = y_top + (y_bot - y_top) * 0.10
    d.line([x0, alert_y, x1, alert_y], fill=RED, width=max(1, int(1.2 * SS)))
    d.rounded_rectangle([x0, cy(138), x0 + cx(148), cy(150)], radius=cx(6), fill=(75, 32, 44), outline=(215, 92, 116))
    d.text((x0 + cx(10), cy(139)), "Alerta 90% · ponto otimo de revisao", font=f_tiny, fill=(255, 211, 218))

    n = 40
    def curve(amp: float, base: float, seed: float, dash: bool = False):
        pts = []
        for i in range(n):
            t = i / (n - 1)
            yy = y_bot - (y_bot - y_top) * (base - amp * math.sin(seed + t * math.pi + phase / 6))
            pts.append((x0 + (x1 - x0) * t, yy))
        if dash:
            step = int(4 * SS)
            for i in range(0, len(pts) - 1, 2):
                d.line([pts[i], pts[i + 1]], fill=(34, 211, 238), width=max(1, int(2 * SS)))
        else:
            d.line(pts, fill=(129, 140, 184), width=max(1, int(3 * SS)))
            d.line(pts, fill=(255, 90, 113), width=max(1, int(2.4 * SS)))

    curve(0.05, 0.92 if phase % 2 else 0.9, 0.0)          # global (grey path drawn twice = accent)
    curve(0.25, 0.62, 0.9)                                # subject
    curve(0.45, 0.45, 1.7, dash=True)                     # topic + FSRS fita cyan
    # crossing marker
    mx = x0 + (x1 - x0) * 0.30
    d.ellipse([mx - cx(6), alert_y - cx(6), mx + cx(6), alert_y + cx(6)], outline=RED, width=max(1, int(3 * SS)))
    d.ellipse([mx - cx(2), alert_y - cx(2), mx + cx(2), alert_y + cx(2)], fill=RED)

    d.text((x0, cy(232)), "D0", font=f_tiny, fill=MUTED)
    d.text((x0 + (x1 - x0) * 0.5, cy(232)), "D30", font=f_tiny, fill=MUTED)
    d.text((x1 - cx(20), cy(232)), "D60", font=f_tiny, fill=MUTED)

    # ---- ranking rows ----
    top = 270
    row_h = 40
    for i, (name, color, zone_color, zone, pct, r_txt) in enumerate(ROWS):
        yy = cy(top + i * row_h)
        row_bg = {
            0: (38, 17, 24),
            1: (32, 26, 16),
            2: (14, 34, 26),
        }[i]
        d.rounded_rectangle([cx(24), yy, cx(W - 24), yy + cy(row_h - 6)], radius=cx(8), fill=row_bg, outline=PANEL_BORDER)
        d.rectangle([cx(24), yy + 1, cx(27), yy + cy(row_h - 8)], fill=zone_color)
        # rank badge
        d.rounded_rectangle([cx(36), yy + cy(6), cx(56), yy + cy(24)], radius=cx(4), fill=(95, 82, 199))
        d.text((cx(44), yy + cy(8)), str(i + 1), font=f_small, fill=WHITE, anchor="mm")
        # color dot + name
        d.ellipse([cx(66), yy + cy(11), cx(74), yy + cy(19)], fill=color)
        d.text((cx(82), yy + cy(11)), name, font=f_body, fill=(233, 241, 255))
        # zone pill
        zh = int(cy(18))
        d.rounded_rectangle([cx(W - 200), yy + cy(7), cx(W - 132), yy + cy(25)], radius=zh, fill=(26, 35, 50), outline=(42, 57, 77))
        d.ellipse([cx(W - 190), yy + cy(11), cx(W - 182), yy + cy(19)], fill=zone_color)
        d.text((cx(W - 176), yy + cy(12)), zone, font=f_small, fill=(224, 233, 244))
        # R text
        d.text((cx(W - 66), yy + cy(11)), r_txt, font=f_small, fill=(87, 230, 170) if zone_color == GREEN else (255, 202, 118))
        # progress bar
        bar_x, bar_w, bar_h = cx(40), cx(180), cy(6)
        by = yy + cy(30)
        d.rounded_rectangle([bar_x, by, bar_x + bar_w, by + bar_h], radius=bar_h, fill=(34, 51, 74))
        growth = 0.62 + 0.12 * math.sin(2 * math.pi * (phase / total_frames) + i)
        fill_w = int(bar_w * max(0.05, min(1, pct * growth)))
        d.rounded_rectangle([bar_x, by, bar_x + fill_w, by + bar_h], radius=bar_h, fill=zone_color)

    # footer
    d.text((cx(24), cy(396)), "FSRS + curva de Ebbinghaus · tudo offline", font=f_tiny, fill=MUTED)
    d.line([cx(24), cy(388), cx(W - 24), cy(388)], fill=(22, 38, 59), width=max(1, SS))

    # downscale with lanczos
    img = img.resize((W, H), Image.LANCZOS)
    return img


def main() -> None:
    total = 10
    frames = [frame(p, total) for p in range(total)]
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=140,
        loop=0,
        optimize=True,
    )
    print("wrote", os.path.abspath(OUT), f"({total} frames)")


if __name__ == "__main__":
    main()