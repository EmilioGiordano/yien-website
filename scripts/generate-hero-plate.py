"""Generates public/hero-plate.svg: the kanji 縁 cut as an engraving, inside a ring of rays.

Needs Python with Playwright, and network access for the font.
Run it from the repository root: python scripts/generate-hero-plate.py
"""
import math
import random
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path("public/hero-plate.svg")
SIZE = 1000
CENTER = SIZE / 2
GLYPH = 640
STEP = 6
RAYS = 180
INK = "#0d0c0b"
PAPER = "#f7f6f0"

MASK_PAGE = """<!doctype html>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@800&display=swap" rel="stylesheet">
<canvas id="c"></canvas>"""

READ_MASK = """async ([size, glyph]) => {
  await document.fonts.load('800 100px "Shippori Mincho B1"', '縁');
  await document.fonts.ready;
  const canvas = document.getElementById('c');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `800 ${glyph}px "Shippori Mincho B1"`;
  context.fillText('縁', size / 2, size / 2 + glyph * 0.02);
  const pixels = context.getImageData(0, 0, size, size).data;
  const rows = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) row += pixels[(y * size + x) * 4 + 3] > 110 ? '1' : '0';
    rows.push(row);
  }
  return rows;
}"""


def read_mask():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.set_content(MASK_PAGE, wait_until="networkidle")
        mask = page.evaluate(READ_MASK, [SIZE, GLYPH])
        browser.close()
    if sum(row.count("1") for row in mask) < 20000:
        raise SystemExit("The font did not load.")
    return mask


def cuts(mask):
    """Flat horizontal cuts keep the kanji's edges; they thicken downwards to give it a tone."""
    top = next(i for i, row in enumerate(mask) if "1" in row)
    bottom = SIZE - next(i for i, row in enumerate(reversed(mask)) if "1" in row)
    paths = []
    y = float(top)
    while y < bottom:
        row = mask[int(y)]
        height = STEP * (0.5 + 0.42 * (y - top) / (bottom - top))
        x = 0
        while x < SIZE:
            if row[x] == "1":
                start = x
                while x < SIZE and row[x] == "1":
                    x += 1
                paths.append(f"M{start} {y - height / 2:.2f}H{x}V{y + height / 2:.2f}H{start}Z")
            x += 1
        y += STEP
    return paths


def rays():
    paths = []
    for i in range(RAYS):
        angle = i / RAYS * math.tau
        inner = 408 + random.uniform(-3, 3)
        outer = (492 if i % 2 == 0 else 452) + random.uniform(-6, 6)
        cos, sin = math.cos(angle), math.sin(angle)
        paths.append(
            f"M{CENTER + inner * cos:.1f} {CENTER + inner * sin:.1f}"
            f"L{CENTER + outer * cos:.1f} {CENTER + outer * sin:.1f}"
        )
    return paths


random.seed(11)
OUT.write_text(
    f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">
<path fill="none" stroke="{INK}" stroke-width="2.2" stroke-linecap="round" d="{''.join(rays())}"/>
<path fill="{PAPER}" d="{''.join(cuts(read_mask()))}"/>
</svg>
""",
    encoding="utf-8",
)
