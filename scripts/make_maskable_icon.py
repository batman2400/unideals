"""Build a maskable PWA icon with white full-bleed and larger UD mark."""

from PIL import Image

SIZE = 512
# Fit UD near the full safe-zone width so it reads large on Android home screens.
TARGET_FRACTION = 0.88
OUT_PATH = "public/icon-512-maskable-v10.png"

src = Image.open("public/icon-512-v9.png").convert("RGBA")
w, h = src.size
pixels = src.load()

# Isolate black UD inside the white circle; drop outer black square.
transparent = Image.new("RGBA", (w, h), (0, 0, 0, 0))
tp = transparent.load()
black_coords = []
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if r < 30 and g < 30 and b < 30:
            cx, cy = (w - 1) / 2, (h - 1) / 2
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if dist <= (min(w, h) / 2) - 1:
                tp[x, y] = (0, 0, 0, 255)
                black_coords.append((x, y))

if not black_coords:
    raise SystemExit("Could not find UD glyph pixels")

xs = [p[0] for p in black_coords]
ys = [p[1] for p in black_coords]
min_x, max_x = min(xs), max(xs)
min_y, max_y = min(ys), max(ys)
pad = 4
min_x = max(0, min_x - pad)
min_y = max(0, min_y - pad)
max_x = min(w - 1, max_x + pad)
max_y = min(h - 1, max_y + pad)

glyph = transparent.crop((min_x, min_y, max_x + 1, max_y + 1))
gw, gh = glyph.size
scale = (SIZE * TARGET_FRACTION) / max(gw, gh)
new_w = max(1, int(round(gw * scale)))
new_h = max(1, int(round(gh * scale)))
scaled = glyph.resize((new_w, new_h), Image.Resampling.LANCZOS)

out = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
offset = ((SIZE - new_w) // 2, (SIZE - new_h) // 2)
out.paste(scaled, offset, scaled)

out.convert("RGB").save(OUT_PATH, "PNG", optimize=True)
print(f"Wrote {OUT_PATH}")
print(f"Glyph bbox: {gw}x{gh} -> {new_w}x{new_h} ({TARGET_FRACTION * 100:.0f}% of canvas)")
print(f"Padding from edge: ~{(SIZE - max(new_w, new_h)) // 2}px")
