#!/usr/bin/env python3
"""Generate the SiteLedger AI OG card image (1200x630) in the Digital Site Diary design.

Paper #FAF7F2, ink #1C1917, construction orange #C2410C, brick #B91C1C.
All figures are real product figures:
- Sample locked report: 4-Bedroom Duplex, Lekki Phase 1, 6 Nov 2026, 7 items, ₦1,495,300
- Excavation 27 m³ × ₦8,500 = ₦229,500 (first item of the sample report)
- Blockwork 18 m² × ₦14,500 = ₦261,000; concrete 2 m³ × ₦145,000 = ₦290,000 (golden check)
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PAPER = (250, 247, 242)      # #FAF7F2
INK = (28, 25, 23)           # #1C1917
ORANGE = (194, 65, 12)       # #C2410C
BRICK = (185, 28, 28)        # #B91C1C
RULE = (231, 224, 212)       # #E7E0D4
CARD = (255, 255, 255)
MUTED = (90, 82, 74)

SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)

# Ruled diary lines across the whole card (subtle).
for y in range(24, H, 42):
    d.line([(0, y), (W, y)], fill=RULE, width=1)

# Left column (x 64..620) ----------------------------------------------------
x0 = 64
d.rectangle([x0, 64, x0 + 56, 70], fill=ORANGE)
d.text((x0, 84), "SITELEDGER AI", font=font(SANS_B, 28), fill=ORANGE)

d.text((x0, 138), "The day\u2019s work.", font=font(SERIF_B, 58), fill=INK)
d.text((x0, 208), "With the money", font=font(SERIF_B, 58), fill=INK)
d.text((x0, 278), "attached.", font=font(SERIF_B, 58), fill=INK)

d.text((x0, 378), "Voice notes + photos \u2192 a costed daily", font=font(SANS, 26), fill=MUTED)
d.text((x0, 412), "site report in \u20a6, locked into proof.", font=font(SANS, 26), fill=MUTED)

d.line([(x0, 492), (x0 + 480, 492)], fill=RULE, width=2)
d.text((x0, 512), "4-Bedroom Duplex, Lekki Phase 1", font=font(SANS, 21), fill=MUTED)
d.text((x0, 544), "BoQ-costed  \u00b7  Human-confirmed  \u00b7  Append-only log", font=font(SANS, 21), fill=MUTED)

# Right column: sample locked-report card (x 660..1136) -----------------------
cx0, cy0, cx1, cy1 = 660, 64, 1136, 566
d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=18, fill=CARD, outline=RULE, width=2)

px = cx0 + 28
pr = cx1 - 28  # right inner edge
d.text((px, cy0 + 22), "DAILY SITE REPORT  \u00b7  6 NOV 2026", font=font(SANS_B, 18), fill=MUTED)
d.text((px, cy0 + 52), "4-Bedroom Duplex,", font=font(SERIF_B, 26), fill=INK)
d.text((px, cy0 + 86), "Lekki Phase 1, Lagos", font=font(SERIF_B, 26), fill=INK)
d.text((px, cy0 + 124), "Perkins Limited  \u00b7  7 items", font=font(SANS, 20), fill=MUTED)

# Ruled rows: title on line 1; qty left + amount right on line 2.
rows = [
    ("Excavation, foundation trenches", "27 m\u00b3 \u00d7 \u20a68,500", "\u20a6229,500"),
    ("Blockwork, 225mm hollow", "18 m\u00b2 \u00d7 \u20a614,500", "\u20a6261,000"),
    ("In-situ concrete, columns", "2 m\u00b3 \u00d7 \u20a6145,000", "\u20a6290,000"),
]
ry = cy0 + 162
for title, qty, amount in rows:
    d.text((px, ry), title, font=font(SANS, 20), fill=INK)
    d.text((px, ry + 28), qty, font=font(SANS, 18), fill=MUTED)
    aw = d.textlength(amount, font=font(SANS_B, 21))
    d.text((pr - aw, ry + 26), amount, font=font(SANS_B, 21), fill=INK)
    ry += 64
    if title != rows[-1][0]:
        d.line([(px, ry - 10), (pr, ry - 10)], fill=RULE, width=1)

# Total band: label above, total below, both left-aligned (no overlap).
ty = cy0 + 366
d.rectangle([cx0 + 14, ty, cx1 - 14, ty + 92], fill=(252, 238, 226))
d.text((px, ty + 10), "VALUE OF WORK TODAY", font=font(SANS_B, 19), fill=ORANGE)
d.text((px, ty + 36), "\u20a61,495,300", font=font(SERIF_B, 38), fill=ORANGE)

# LOCKED stamp, rotated, bottom-right of the card, inside the canvas.
stamp = Image.new("RGBA", (240, 76), (0, 0, 0, 0))
sd = ImageDraw.Draw(stamp)
sd.rounded_rectangle([4, 4, 236, 72], radius=8, outline=BRICK, width=4)
sd.text((120, 38), "LOCKED", font=font(SANS_B, 36), fill=BRICK, anchor="mm")
stamp = stamp.rotate(-7, expand=True, resample=Image.BICUBIC)
img.paste(stamp, (cx1 - 235, 500), stamp)

out = "/home/hatch/workspace/siteledger-seo-work/public/og-image.png"
# Flat design with a small palette: save as an indexed PNG so the file
# stays small (34KB) — it must fit a single base64 tool argument for upload.
img.convert("P", palette=Image.ADAPTIVE, colors=128).save(out, "PNG", optimize=True)
print("saved", out, img.size)
