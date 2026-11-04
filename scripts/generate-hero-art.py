"""Generates src/assets/hero-art.svg: the kanji 縁 as a mask over the agents' own terminal output.

Needs Python with fontTools, Pillow and NumPy, and network access for the font.
Run it from the repository root: python scripts/generate-hero-art.py
"""
import html
import io
import re
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

OUT = Path("src/assets/hero-art.svg")
SOURCES = [Path("src/data/workspaces.ts"), Path("src/data/fileContents.ts")]
KANJI = "縁"
CELL_W, CELL_H = 6, 12
COLS, ROWS = 180, 94
MARGIN_X, MARGIN_Y = 8 * CELL_W, 4 * CELL_H


def fetch_font():
    query = urllib.parse.urlencode({"family": "Shippori Mincho B1:wght@800", "text": KANJI})
    css = urllib.request.urlopen(f"https://fonts.googleapis.com/css2?{query}").read().decode()
    url = re.search(r"url\((https://[^)]+)\)", css).group(1)
    return urllib.request.urlopen(url).read()


def outline(font_bytes):
    """The kanji's outline fitted to the plate, and the transform that placed it."""
    font = TTFont(io.BytesIO(font_bytes))
    glyphs = font.getGlyphSet()
    name = font.getBestCmap()[ord(KANJI)]
    bounds = BoundsPen(glyphs)
    glyphs[name].draw(bounds)
    x0, y0, x1, y1 = bounds.bounds
    width, height = COLS * CELL_W, ROWS * CELL_H
    scale = min((width - 2 * MARGIN_X) / (x1 - x0), (height - 2 * MARGIN_Y) / (y1 - y0))
    left = (width - (x1 - x0) * scale) / 2
    top = (height - (y1 - y0) * scale) / 2
    pen = SVGPathPen(glyphs, ntos=lambda value: f"{value:.1f}".rstrip("0").rstrip("."))
    glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, left - x0 * scale, top + y1 * scale)))
    return pen.getCommands(), (left, top, (x1 - x0) * scale, (y1 - y0) * scale)


def find_stem(font_bytes, box):
    """Where the vertical stroke of the thread radical 糸 runs, as fractions of the plate."""
    left, top, width, height = box
    size = 1400
    font = ImageFont.truetype(io.BytesIO(font_bytes), size)
    x0, y0, x1, y1 = font.getbbox(KANJI)
    image = Image.new("L", (x1 - x0, y1 - y0))
    ImageDraw.Draw(image).text((-x0, -y0), KANJI, fill=255, font=font)
    mask = np.array(image) > 128
    h, w = mask.shape
    best = (0, 0, 0)
    for x in range(int(w * 0.05), int(w * 0.36)):
        run = 0
        for y in range(int(h * 0.45), h):
            if mask[y, x]:
                run += 1
                if run > best[0]:
                    best = (run, x, y - run + 1)
            else:
                run = 0
    columns = [x for x in range(w) if mask[best[2] + best[0] // 2, x] and abs(x - best[1]) < w * 0.06]
    center = (min(columns) + max(columns)) / 2
    plate_x = (left + center / w * width) / (COLS * CELL_W)
    plate_y = (top + best[2] / h * height) / (ROWS * CELL_H)
    return plate_x, plate_y


def output_stream():
    """One long line of what the agents print: prompts, commands, diffs, commit messages."""
    strings = []
    for source in SOURCES:
        strings += re.findall(r'"((?:[^"\\\n]|\\.){4,})"', source.read_text(encoding="utf8"))
        strings += re.findall(r"`([^`]{4,})`", source.read_text(encoding="utf8"))
    text = " ".join(re.sub(r"\\n|\s+", " ", s) for s in strings)
    return re.sub(r" +", " ", re.sub(r"[^\x21-\x7e ]", "", text))


def rows(stream):
    needed = COLS * ROWS
    stream = (stream * (needed // len(stream) + 1))[:needed]
    for i in range(ROWS):
        yield stream[i * COLS : (i + 1) * COLS]


def main():
    font = fetch_font()
    path, box = outline(font)
    stem_x, stem_y = find_stem(font, box)
    width, height = COLS * CELL_W, ROWS * CELL_H
    lines = "".join(
        f'<text y="{(i + 1) * CELL_H - 2}">{html.escape(row, quote=False)}</text>'
        for i, row in enumerate(rows(output_stream()))
    )
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">'
        f'<defs><g id="hero-output" xml:space="preserve">{lines}</g>'
        f'<path id="hero-glyph" d="{path}"/>'
        '<clipPath id="hero-kanji" clipPathUnits="objectBoundingBox">'
        f'<use href="#hero-glyph" transform="scale({1 / width:.7f} {1 / height:.7f})"/>'
        "</clipPath></defs></svg>\n",
        encoding="utf8",
    )
    print(f"{OUT}: {OUT.stat().st_size} bytes, {width}x{height}, stem at {stem_x:.4f} x, {stem_y:.4f} y")


if __name__ == "__main__":
    main()
