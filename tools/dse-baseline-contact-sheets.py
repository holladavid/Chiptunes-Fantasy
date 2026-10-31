#!/usr/bin/env python3
"""Upscale baseline PNGs with nearest-neighbor and build visual review sheets."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/mnt/agents/output/DSE-Schritt-1-Baseline")
RESULTS = json.loads((ROOT / "baseline-results.json").read_text())
CONTACTS = ROOT / "contacts"
CONTACTS.mkdir(exist_ok=True)
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT = ImageFont.truetype(FONT_PATH, 17)
SMALL = ImageFont.truetype(FONT_PATH, 14)
BOLD = ImageFont.truetype(BOLD_PATH, 24)
BG = (15, 18, 24)
PANEL = (28, 33, 43)
TEXT = (235, 238, 243)
MUTED = (155, 165, 180)


def upscale(path: Path, raw_width: int, factor: int = 4) -> None:
    image = Image.open(path)
    if image.width == raw_width:
        image.resize((image.width * factor, image.height * factor), Image.Resampling.NEAREST).save(path)


for item in RESULTS["stills"]:
    upscale(ROOT / item["file"], item["buffer"]["width"])
for item in RESULTS["rotations"]:
    for phase in item["phases"]:
        upscale(ROOT / phase["file"], phase["buffer"]["width"])
for item in RESULTS.get("transitions", []):
    for phase in item["phases"]:
        upscale(ROOT / phase["file"], phase["buffer"]["width"])


def fit_image(path: Path, width: int, height: int) -> Image.Image:
    source = Image.open(path).convert("RGB")
    scale = min(width / source.width, height / source.height)
    resized = source.resize((max(1, round(source.width * scale)), max(1, round(source.height * scale))), Image.Resampling.NEAREST)
    panel = Image.new("RGB", (width, height), (0, 0, 0))
    panel.paste(resized, ((width - resized.width) // 2, (height - resized.height) // 2))
    return panel


def state_sheet(state: str, orientation: str) -> None:
    items = [item for item in RESULTS["stills"] if item["state"] == state and item["orientation"] == orientation]
    cell_w, cell_h, image_h, label_h = 340, 330, 270, 42
    sheet = Image.new("RGB", (cell_w * 4, 64 + cell_h * 5), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 17), f"DSE Baseline — {state} — {orientation}", font=BOLD, fill=TEXT)
    for index, item in enumerate(items):
        x, y = (index % 4) * cell_w, 64 + (index // 4) * cell_h
        draw.rectangle((x + 8, y + 6, x + cell_w - 8, y + cell_h - 8), fill=PANEL)
        image = fit_image(ROOT / item["file"], cell_w - 28, image_h)
        sheet.paste(image, (x + 14, y + 12))
        label = f'{item["dse"]} / {item["system"]}'
        draw.text((x + 15, y + image_h + 19), label, font=SMALL, fill=TEXT)
        draw.text((x + 15, y + image_h + 39), f'{item["buffer"]["width"]}×{item["buffer"]["height"]}', font=SMALL, fill=MUTED)
    sheet.save(CONTACTS / f"stills-{state}-{orientation}.png")


states = [state for state in ("playing", "buildup", "climax", "afterglow")
          if any(item["state"] == state for item in RESULTS["stills"])]
for state in states:
    for orientation in ("portrait", "landscape"):
        state_sheet(state, orientation)


def rotation_sheet(items, page: int) -> None:
    row_h, image_w, image_h = 330, 390, 238
    sheet = Image.new("RGB", (1280, 64 + row_h * len(items)), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 17), f"Live-Rotation, dieselbe Instanz — Übersicht {page}", font=BOLD, fill=TEXT)
    for row, item in enumerate(items):
        y = 64 + row * row_h
        draw.text((18, y + 16), f'{item["dse"]} / {item["system"]}', font=FONT, fill=TEXT)
        draw.text((18, y + 45), f'Instanz #{item["instanceId"]} — Fehler: {len(item["errors"])}', font=SMALL, fill=MUTED)
        for column, phase in enumerate(item["phases"]):
            x = 18 + column * (image_w + 20)
            image = fit_image(ROOT / phase["file"], image_w, image_h)
            sheet.paste(image, (x, y + 62))
            size = phase["buffer"]
            draw.text((x, y + 62 + image_h + 8), f'{phase["phase"]}: {size["width"]}×{size["height"]}', font=SMALL, fill=TEXT)
    sheet.save(CONTACTS / f"rotation-{page}.png")


rotations = RESULTS["rotations"]
for page in range((len(rotations) + 4) // 5):
    rotation_sheet(rotations[page * 5:(page + 1) * 5], page + 1)


def transition_sheet(items, page: int, orientation: str) -> None:
    row_h, image_w, image_h = 200, 185, 125
    sheet = Image.new("RGB", (1280, 64 + row_h * len(items)), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 17), f"Zustandssequenz, dieselbe Instanz — {orientation} — Übersicht {page}", font=BOLD, fill=TEXT)
    for row, item in enumerate(items):
        y = 64 + row * row_h
        draw.text((18, y + 8), f'{item["dse"]} / {item["system"]} — Instanz #{item["instanceId"]}', font=FONT, fill=TEXT)
        for column, phase in enumerate(item["phases"]):
            x = 18 + column * (image_w + 20)
            image = fit_image(ROOT / phase["file"], image_w, image_h)
            sheet.paste(image, (x, y + 38))
            draw.text((x, y + 38 + image_h + 6), phase["state"], font=SMALL, fill=TEXT)
    sheet.save(CONTACTS / f"transitions-{orientation}-{page}.png")


transitions = RESULTS.get("transitions", [])
for orientation in ("portrait", "landscape"):
    items = [item for item in transitions if item["orientation"] == orientation]
    for page in range((len(items) + 4) // 5):
        transition_sheet(items[page * 5:(page + 1) * 5], page + 1, orientation)

print(f"Kontaktübersichten: {CONTACTS}")
