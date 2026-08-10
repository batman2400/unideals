"""Build a maskable PWA icon with white full-bleed and safe-zone padding."""

from PIL import Image

SIZE = 512
# Safe zone diameter is 80% of the icon. Keep content slightly inside that.
CONTENT_DIAMETER = int(SIZE * 0.72)

src = Image.open("public/icon-512-v9.png").convert("RGBA")
# Source is black square + white circle + black UD.
# For a white maskable icon: place the (scaled) mark on a white canvas.
# The source's black corners would show as black triangles if pasted as-is,
# so scale the full mark onto white — then flood-fill / replace outer black
# with white by compositing only the circular content.

# Simpler approach: scale source, then replace near-black background pixels
# outside the white circle with white by starting from a white canvas and
# keeping only non-black pixels from the scaled source... but UD is black.
# Best: draw white canvas, paste scaled source with black treated as transparent.

pixels = src.load()
w, h = src.size
transparent = Image.new("RGBA", (w, h), (0, 0, 0, 0))
tp = transparent.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        # Treat the outer black square as transparent; keep white circle + black UD
        if r < 30 and g < 30 and b < 30:
            # Could be UD letter or corner — corners are outside the circle
            cx, cy = (w - 1) / 2, (h - 1) / 2
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if dist > (min(w, h) / 2) - 1:
                tp[x, y] = (0, 0, 0, 0)
            else:
                tp[x, y] = (r, g, b, a)  # black UD inside circle
        else:
            tp[x, y] = (r, g, b, a)

scaled = transparent.resize((CONTENT_DIAMETER, CONTENT_DIAMETER), Image.Resampling.LANCZOS)
out = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
offset = ((SIZE - CONTENT_DIAMETER) // 2, (SIZE - CONTENT_DIAMETER) // 2)
out.paste(scaled, offset, scaled)

out_path = "public/icon-512-maskable-v9.png"
out.convert("RGB").save(out_path, "PNG", optimize=True)
print(f"Wrote {out_path}")
print(f"Content diameter: {CONTENT_DIAMETER}px ({CONTENT_DIAMETER / SIZE * 100:.1f}% of canvas)")
print(f"Safe zone diameter: {SIZE * 0.8:.0f}px")
print(f"Padding from edge: {offset[0]}px each side")
