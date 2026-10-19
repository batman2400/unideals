"""Build website logo, favicon, PWA, and share images from the two-colour UD mark.

Source: unideals-app/assets/new finalized logo with 2 colours.jpeg
U is black, D is teal. Icons that browsers cache for a year are written as v13.
"""

from __future__ import annotations

import base64
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SRC = (
    ROOT.parent
    / "unideals-app"
    / "assets"
    / "new finalized logo with 2 colours.jpeg"
)

# Site theme. The D in the source file is a close neighbour of this green.
THEME = (41, 105, 91)
WHITE = (255, 255, 255, 255)
INK_DARKNESS = 18

ICON_FRACTION = 0.70
MASKABLE_FRACTION = 0.62


def load_glyph() -> Image.Image:
    src = Image.open(SRC).convert("RGB")
    px = src.load()
    w, h = src.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if max(255 - r, 255 - g, 255 - b) < INK_DARKNESS:
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if max_x <= min_x:
        raise SystemExit(f"No logo pixels found in {SRC}")

    pad = 8
    box = (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(w, max_x + 1 + pad),
        min(h, max_y + 1 + pad),
    )
    crop = src.crop(box)
    out = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    sp = crop.load()
    dp = out.load()
    for y in range(crop.size[1]):
        for x in range(crop.size[0]):
            r, g, b = sp[x, y]
            darkness = max(255 - r, 255 - g, 255 - b)
            if darkness < INK_DARKNESS:
                continue
            # Soften the JPEG fringe against white without punching holes in the teal.
            alpha = 255 if darkness >= 36 else int(darkness / 36 * 255)
            dp[x, y] = (r, g, b, alpha)
    return out


def square_icon(glyph: Image.Image, size: int, fraction: float) -> Image.Image:
    gw, gh = glyph.size
    scale = (size * fraction) / max(gw, gh)
    nw = max(1, int(round(gw * scale)))
    nh = max(1, int(round(gh * scale)))
    scaled = glyph.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), WHITE)
    canvas.paste(scaled, ((size - nw) // 2, (size - nh) // 2), scaled)
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)
    print(f"Wrote {path.relative_to(ROOT)} {image.size}")


def save_svg(icon_512: Image.Image, path: Path) -> None:
    payload = base64.b64encode(_png_bytes(icon_512)).decode("ascii")
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Uni Deals">\n'
        f'  <image width="512" height="512" href="data:image/png;base64,{payload}"/>\n'
        "</svg>\n"
    )
    path.write_text(svg, encoding="utf-8")
    print(f"Wrote {path.relative_to(ROOT)}")


def _png_bytes(image: Image.Image) -> bytes:
    from io import BytesIO

    buf = BytesIO()
    image.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def save_ico(icon_48: Image.Image) -> None:
    path = PUBLIC / "favicon.ico"
    icon_48.save(
        path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print(f"Wrote {path.relative_to(ROOT)}")


def save_og(glyph: Image.Image) -> None:
    width, height = 1200, 630
    canvas = Image.new("RGB", (width, height), THEME)
    plate = 300
    plate_img = Image.new("RGBA", (plate, plate), (0, 0, 0, 0))
    plate_draw = ImageDraw.Draw(plate_img)
    plate_draw.rounded_rectangle((0, 0, plate - 1, plate - 1), radius=56, fill=(255, 255, 255, 255))

    gw, gh = glyph.size
    scale = (plate * 0.72) / max(gw, gh)
    nw = max(1, int(round(gw * scale)))
    nh = max(1, int(round(gh * scale)))
    mark = glyph.resize((nw, nh), Image.Resampling.LANCZOS)
    plate_img.paste(mark, ((plate - nw) // 2, (plate - nh) // 2), mark)

    plate_x, plate_y = 88, (height - plate) // 2
    canvas.paste(plate_img, (plate_x, plate_y), plate_img)

    bold = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 92)
    regular = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 32)
    draw = ImageDraw.Draw(canvas)
    text_x = plate_x + plate + 56
    title = "Uni Deals"
    subtitle = "Student discounts in Sri Lanka"
    title_box = draw.textbbox((0, 0), title, font=bold)
    sub_box = draw.textbbox((0, 0), subtitle, font=regular)
    title_h = title_box[3] - title_box[1]
    sub_h = sub_box[3] - sub_box[1]
    gap = 28
    block_h = title_h + gap + sub_h
    title_top = (height - block_h) // 2
    draw.text((text_x, title_top - title_box[1]), title, font=bold, fill=(255, 255, 255))
    sub_top = title_top + title_h + gap
    draw.text((text_x, sub_top - sub_box[1]), subtitle, font=regular, fill=(232, 241, 238))

    for rel in (PUBLIC / "og-default.png", PUBLIC / "images" / "og-default.png"):
        save_png(canvas, rel)


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source logo: {SRC}")

    glyph = load_glyph()
    save_png(glyph, PUBLIC / "images" / "logo.png")

    sizes = {
        16: ["favicon-16.png", "favicon-16-v13.png"],
        32: ["favicon-32.png", "favicon-32-v13.png"],
        48: ["favicon-48.png", "favicon-48-v13.png"],
        96: ["favicon-96.png", "favicon-96-v13.png", "google-favicon.png"],
        180: ["apple-touch-icon.png", "apple-touch-icon-v13.png"],
        192: ["icon-192.png", "icon-192-v13.png"],
        512: ["icon-512.png", "icon-512-v13.png", "logo.png", "logo-512.png", "logo-512-v13.png"],
    }
    built: dict[int, Image.Image] = {}
    for size, names in sizes.items():
        icon = square_icon(glyph, size, ICON_FRACTION)
        built[size] = icon
        for name in names:
            save_png(icon, PUBLIC / name)

    maskable = square_icon(glyph, 512, MASKABLE_FRACTION).convert("RGB")
    save_png(maskable, PUBLIC / "icon-512-maskable-v13.png")

    save_svg(built[512], PUBLIC / "favicon.svg")
    save_svg(built[512], PUBLIC / "logo.svg")
    save_ico(built[48])
    save_og(glyph)
    print(f"Glyph {glyph.size[0]}x{glyph.size[1]}")


if __name__ == "__main__":
    main()
