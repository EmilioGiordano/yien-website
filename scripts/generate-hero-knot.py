"""Generates public/hero-knot-*.webp: a mizuhiki knot cut as a white-line wood engraving.

Needs Python with numpy, scipy and Pillow.
Run it from the repository root: python scripts/generate-hero-knot.py
"""
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

INK = (13, 12, 11)
RED = (209, 31, 40)
SUPERSAMPLE = 2
LOBES = 5
LIGHT = np.array([-0.52, -0.62, 0.59])


@dataclass
class Plate:
    name: str
    size: tuple[int, int]
    center: tuple[float, float]
    radius: float
    swing: float
    opening: float  # where the knot opens, in degrees clockwise from east
    cords: list[float]  # black cord widths across the band
    thread: float  # width of the red thread
    pixels: int  # image pixels per unit
    thread_x: float  # the thread's left edge, on the window's left edge
    run_y: float  # height of the run towards the window
    corner: tuple[float, float]  # size of the run's turn into the window
    drop_x: float  # where the other tail leaves the plate
    pitch: float  # distance between engraved cuts


def bezier(p0, p1, p2, p3, n=500):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t**2 * p2 + t**3 * p3


def unit_vector(v):
    return v / np.linalg.norm(v)


def centerline(plate: Plate):
    """Returns the path, and which samples belong to the knot rather than its tails."""
    phi = math.radians(plate.opening)
    start = 0.55 * math.pi / LOBES
    t = np.linspace(start, 4 * math.pi - start, 4000)
    r = plate.radius + plate.swing * np.cos(LOBES * t / 2)
    knot = np.stack(
        [plate.center[0] + r * np.cos(t + phi), plate.center[1] + r * np.sin(t + phi)], axis=1
    )
    handle = plate.radius * 0.6
    bottom = plate.size[1] + 10.0

    # One tail drops straight behind the window.
    drop = np.array([plate.drop_x, bottom])
    head = bezier(
        drop,
        drop + [0, -plate.radius * 0.55],
        knot[0] + unit_vector(knot[0] - knot[1]) * handle,
        knot[0],
    )

    # The other runs under the title and turns into the window at the thread's x.
    x = plate.thread_x + (sum(plate.cords) + plate.thread) / 2
    rx, ry = plate.corner
    run_end = np.array([x + rx, plate.run_y])
    run = bezier(
        knot[-1],
        knot[-1] + unit_vector(knot[-1] - knot[-2]) * handle,
        run_end + [plate.radius * 0.9, 0],
        run_end,
    )
    turn_end = np.array([x, plate.run_y + ry])
    turn = bezier(run_end, run_end - [rx * 0.56, 0], turn_end - [0, ry * 0.56], turn_end)
    fall = np.linspace(turn_end, [x, bottom], 200)

    return np.concatenate([head, knot, run, turn, fall]), (len(head), len(head) + len(knot))


def resample(points, step, blur=6.0):
    keep = np.concatenate([[True], np.linalg.norm(np.diff(points, axis=0), axis=1) > 1e-6])
    points = points[keep]
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))])
    grid = np.arange(0, s[-1], step)
    return np.stack(
        [
            ndimage.gaussian_filter1d(np.interp(grid, s, points[:, i]), blur / step, mode="nearest")
            for i in range(2)
        ],
        axis=1,
    ), np.interp(grid, s, np.arange(len(points)))


def crossings(points, step, band):
    """Pairs of sample indices where the path crosses itself."""
    stride = max(1, int(3 / step))
    a, b = points[::stride][:-1], points[::stride][1:]
    found = []
    gap = int(band * 2 / (step * stride))
    for i in range(len(a)):
        j = np.arange(i + gap, len(a))
        if not len(j):
            continue
        d, e, w = b[i] - a[i], b[j] - a[j], a[j] - a[i]
        den = d[0] * e[:, 1] - d[1] * e[:, 0]
        den[den == 0] = 1e-9
        u = (w[:, 0] * e[:, 1] - w[:, 1] * e[:, 0]) / den
        v = (w[:, 0] * d[1] - w[:, 1] * d[0]) / den
        for k in np.nonzero((u >= 0) & (u < 1) & (v >= 0) & (v < 1))[0]:
            found.append((i * stride, int(j[k]) * stride))
    return found


def stamp(shape, points, normals, samples, offsets, unit, write):
    """Calls write(y, x, sample, offset) for every pixel of the ribbon across the given samples."""
    h, w = shape
    for i in samples:
        xy = points[i] + normals[i] * offsets[:, None]
        px, py = np.round(xy[:, 0] * unit).astype(int), np.round(xy[:, 1] * unit).astype(int)
        ok = (px >= 0) & (px < w) & (py >= 0) & (py < h)
        write(py[ok], px[ok], i, offsets[ok])


def render(plate: Plate, seed: int = 7):
    unit = plate.pixels * SUPERSAMPLE
    shape = (plate.size[1] * unit, plate.size[0] * unit)
    step = 0.5 / unit
    cords = plate.cords + [plate.thread]
    band = sum(cords)
    halo = max(2.0, band * 0.045)

    path, (knot_from, knot_to) = centerline(plate)
    points, source = resample(path, step)
    tangents = np.gradient(points, axis=0)
    tangents /= np.linalg.norm(tangents, axis=1, keepdims=True)
    normals = np.stack([-tangents[:, 1], tangents[:, 0]], axis=1)  # the traveller's right

    # Alternate over and under along the path, and shade the cord where it goes under.
    pairs = crossings(points, step, band)
    visits = sorted(
        [(i, n) for n, (i, _) in enumerate(pairs)] + [(j, n) for n, (_, j) in enumerate(pairs)]
    )
    # The run passes under the last crossing: the thread changes places there, out of sight.
    under = (len(visits) - 1) % 2
    over = np.zeros(len(points), bool)
    shadow = np.zeros(len(points))
    for order, (i, n) in enumerate(visits):
        a, b = pairs[n]
        sine = abs(tangents[a, 0] * tangents[b, 1] - tangents[a, 1] * tangents[b, 0])
        reach = (band / 2 + halo) / max(sine, 0.3) + band * 0.6
        if order % 2 != under:
            over[max(0, i - int(reach / step)) : i + int(reach / step)] = True
        else:
            spread = int((reach + band * 0.6) / step)
            lo, hi = max(0, i - spread), min(len(points), i + spread)
            distance = np.abs(np.arange(lo, hi) - i) / spread
            shadow[lo:hi] = np.maximum(shadow[lo:hi], np.clip(1.25 - 1.25 * distance, 0, 1))
    print(plate.name, "crossings:", len(pairs))

    index = np.full(shape, -1, np.int32)
    offset = np.zeros(shape, np.float32)

    def write(y, x, i, off):
        index[y, x] = i
        offset[y, x] = off

    samples = np.arange(len(points))
    fine = 0.4 / unit
    across = np.arange(-band / 2, band / 2, fine)
    stamp(shape, points, normals, samples[~over], across, unit, write)

    # Knock a gap out around the cord that passes over, then lay that cord down.
    edge = np.concatenate(
        [np.arange(-band / 2 - halo, -band / 2, fine), np.arange(band / 2, band / 2 + halo, fine)]
    )

    def clear(y, x, i, off):
        index[y, x] = -1

    stamp(shape, points, normals, samples[over], edge, unit, clear)
    stamp(shape, points, normals, samples[over], across, unit, write)

    filled = index >= 0
    sample = np.where(filled, index, 0)
    s = sample * step
    nx, ny = normals[sample, 0], normals[sample, 1]

    # Which cord each pixel belongs to, and where it sits across that cord.
    edges = np.concatenate([[0], np.cumsum(cords)]) - band / 2
    cord = np.clip(np.searchsorted(edges, offset, side="right") - 1, 0, len(cords) - 1)
    u = (offset - edges[cord]) / np.array(cords)[cord] * 2 - 1

    # Round each cord, then let the band turn towards and away from the light.
    nz = np.sqrt(np.clip(1 - u * u, 0, 1))
    roundness = u * nx * LIGHT[0] + u * ny * LIGHT[1] + nz * LIGHT[2]
    angle = np.arctan2(tangents[sample, 1], tangents[sample, 0])
    turning = np.cos(2 * (angle - math.radians(62)))
    source_index = source[sample]
    in_knot = np.clip(
        np.minimum(source_index - knot_from, knot_to - source_index) / 160 + 0.5, 0, 1
    )
    tone = 0.62 * roundness + 0.34 * turning - 0.06 - 0.08 * (1 - in_knot) - 0.95 * shadow[sample]

    # Cuts wrap around each cord like its twist, and swell where the light is strongest.
    phase = (s + u * plate.pitch * 1.15 + cord * plate.pitch * 0.37) / plate.pitch
    wave = np.abs((phase % 1) - 0.5) * 2
    cuts = wave < np.clip((tone - 0.14) * 1.35, 0, 0.62)

    groove = np.abs(u) > 0.87
    edge_stripe = cord == len(cords) - 1
    past_swap = sample > visits[-1][0]
    middle = np.abs(offset + plate.thread / 2) < plate.thread / 2
    red = filled & ((edge_stripe & past_swap) | (middle & ~past_swap))
    ink = filled & ~cuts & ~groove & ~edge_stripe & ~red

    # The block's own texture: a little paper showing through the ink.
    rng = np.random.default_rng(seed)
    specks = ndimage.gaussian_filter(rng.standard_normal(shape), 0.38 * unit)
    ink &= specks / specks.std() < 3.2

    return flatten(ink, red)


def flatten(ink, red):
    h, w = ink.shape

    def shrink(mask):
        return (
            mask.astype(np.float32)
            .reshape(h // SUPERSAMPLE, SUPERSAMPLE, w // SUPERSAMPLE, SUPERSAMPLE)
            .mean((1, 3))
        )

    a_ink, a_red = shrink(ink), shrink(red)
    alpha = np.clip(a_ink + a_red, 0, 1)
    share = np.divide(a_red, alpha, out=np.zeros_like(alpha), where=alpha > 0)[..., None]
    color = np.array(INK) * (1 - share) + np.array(RED) * share
    return np.dstack([color, alpha * 255]).round().astype(np.uint8)


PLATES = [
    Plate(
        name="wide",
        size=(1360, 640),
        center=(1040, 318),
        radius=205,
        swing=62,
        opening=168,
        cords=[14] * 6,
        thread=3.5,
        pixels=2,
        thread_x=20,
        run_y=408,
        corner=(170, 100),
        drop_x=690,
        pitch=5.2,
    ),
    Plate(
        name="narrow",
        size=(410, 400),
        center=(245, 180),
        radius=112,
        swing=34,
        opening=150,
        cords=[7.6] * 6,
        thread=2.4,
        pixels=3,
        thread_x=10,
        run_y=232,
        corner=(20, 62),
        drop_x=102,
        pitch=3.6,
    ),
]

for plate in PLATES:
    image = Image.fromarray(render(plate), "RGBA")
    out = Path(f"public/hero-knot-{plate.name}.webp")
    image.save(out, lossless=True, method=6)
    print(out, image.size, out.stat().st_size // 1024, "KB")
