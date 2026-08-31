/**
 * Rebuild circular favicons from the high-res brand mark
 * (public/images/logo.png — black UD on transparent).
 *
 * - Perfect geometric circle centered on the canvas
 * - Glyph bbox centered, then optically nudged for italic UD
 * - Transparent corners (no black square)
 *
 * Run: node scripts/rebuild-favicons.cjs
 */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const SOURCE = path.join(PUBLIC, "images", "logo.png");
const VERSION = "v9";

function loadPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function writePng(file, png) {
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log("wrote", path.relative(ROOT, file), `${png.width}x${png.height}`);
}

function findOpaqueBBox(src) {
  let minX = src.width;
  let minY = src.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const a = src.data[((src.width * y + x) << 2) + 3];
      if (a > 20) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

function crop(src, bbox, pad = 8) {
  const x0 = Math.max(0, bbox.minX - pad);
  const y0 = Math.max(0, bbox.minY - pad);
  const x1 = Math.min(src.width - 1, bbox.maxX + pad);
  const y1 = Math.min(src.height - 1, bbox.maxY + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (src.width * (y0 + y) + (x0 + x)) << 2;
      const di = (w * y + x) << 2;
      // Force ink to near-black; keep source alpha (anti-alias)
      const a = src.data[si + 3];
      out.data[di] = 17;
      out.data[di + 1] = 17;
      out.data[di + 2] = 17;
      out.data[di + 3] = a;
    }
  }
  return out;
}

function sample(src, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, src.width - 1);
  const y1 = Math.min(y0 + 1, src.height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const idx = (xx, yy) => (src.width * yy + xx) << 2;
  const mix = (a, b, t) => a + (b - a) * t;
  const i00 = idx(x0, y0);
  const i10 = idx(x1, y0);
  const i01 = idx(x0, y1);
  const i11 = idx(x1, y1);
  return [0, 1, 2, 3].map((c) => {
    const top = mix(src.data[i00 + c], src.data[i10 + c], fx);
    const bot = mix(src.data[i01 + c], src.data[i11 + c], fx);
    return mix(top, bot, fy);
  });
}

function resize(src, tw, th) {
  const out = new PNG({ width: tw, height: th });
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const sx = ((x + 0.5) * src.width) / tw - 0.5;
      const sy = ((y + 0.5) * src.height) / th - 0.5;
      const [r, g, b, a] = sample(
        src,
        Math.max(0, Math.min(src.width - 1, sx)),
        Math.max(0, Math.min(src.height - 1, sy)),
      );
      const i = (tw * y + x) << 2;
      out.data[i] = Math.round(r);
      out.data[i + 1] = Math.round(g);
      out.data[i + 2] = Math.round(b);
      out.data[i + 3] = Math.round(a);
    }
  }
  return out;
}

function placeGlyph(glyphCrop, size, fillRatio) {
  const maxGlyph = size * fillRatio;
  const scale = Math.min(maxGlyph / glyphCrop.width, maxGlyph / glyphCrop.height);
  const gw = Math.max(1, Math.round(glyphCrop.width * scale));
  const gh = Math.max(1, Math.round(glyphCrop.height * scale));
  const scaled = resize(glyphCrop, gw, gh);
  const ox = Math.round((size - gw) / 2);
  const oy = Math.round((size - gh) / 2);
  return { scaled, gw, gh, ox, oy };
}

function makeCircularIcon(glyphCrop, size) {
  const out = new PNG({ width: size, height: size });
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size / 2;
  const { scaled, gw, gh, ox, oy } = placeGlyph(glyphCrop, radius * 2, 0.64);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let circleA = 0;
      if (dist <= radius - 1) circleA = 255;
      else if (dist < radius + 0.5) {
        circleA = Math.round(255 * Math.max(0, 1 - (dist - (radius - 1)) / 1.5));
      }

      let r = 255;
      let g = 255;
      let b = 255;
      let a = circleA;

      const gx = x - ox;
      const gy = y - oy;
      if (circleA > 0 && gx >= 0 && gy >= 0 && gx < gw && gy < gh) {
        const gi = (gw * gy + gx) << 2;
        const ga = scaled.data[gi + 3] / 255;
        if (ga > 0) {
          r = Math.round(scaled.data[gi] * ga + 255 * (1 - ga));
          g = Math.round(scaled.data[gi + 1] * ga + 255 * (1 - ga));
          b = Math.round(scaled.data[gi + 2] * ga + 255 * (1 - ga));
        }
      }

      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = a;
    }
  }

  return out;
}

/** Solid white square + black UD — schema / OG logo only. */
function makeSolidSquareIcon(glyphCrop, size) {
  const out = new PNG({ width: size, height: size });
  const { scaled, gw, gh, ox, oy } = placeGlyph(glyphCrop, size, 0.72);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2;
      let r = 255;
      let g = 255;
      let b = 255;

      const gx = x - ox;
      const gy = y - oy;
      if (gx >= 0 && gy >= 0 && gx < gw && gy < gh) {
        const gi = (gw * gy + gx) << 2;
        const ga = scaled.data[gi + 3] / 255;
        if (ga > 0) {
          r = Math.round(scaled.data[gi] * ga + 255 * (1 - ga));
          g = Math.round(scaled.data[gi + 1] * ga + 255 * (1 - ga));
          b = Math.round(scaled.data[gi + 2] * ga + 255 * (1 - ga));
        }
      }

      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = 255;
    }
  }

  return out;
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing ${SOURCE}`);

  const pngToIco = (
    await import(pathToFileURL(require.resolve("png-to-ico")).href)
  ).default;

  const src = loadPng(SOURCE);
  const bbox = findOpaqueBBox(src);
  console.log("source", src.width + "x" + src.height, "glyph bbox", bbox);
  const cropped = crop(src, bbox, 12);

  const circular = {};
  for (const size of [16, 32, 48, 96, 180, 192, 512]) {
    circular[size] = makeCircularIcon(cropped, size);
  }

  // Schema / OG logo only — not used as a Search favicon.
  writePng(path.join(PUBLIC, "logo-512.png"), makeSolidSquareIcon(cropped, 512));

  // Versioned circular marks for browser tabs / PWA / Apple.
  for (const [name, png] of [
    [`favicon-16-${VERSION}.png`, circular[16]],
    [`favicon-32-${VERSION}.png`, circular[32]],
    [`favicon-48-${VERSION}.png`, circular[48]],
    [`favicon-96-${VERSION}.png`, circular[96]],
    [`icon-192-${VERSION}.png`, circular[192]],
    [`icon-512-${VERSION}.png`, circular[512]],
    [`apple-touch-icon-${VERSION}.png`, circular[180]],
    ["favicon-16.png", circular[16]],
    ["favicon-32.png", circular[32]],
    ["icon-192.png", circular[192]],
    ["icon-512.png", circular[512]],
    ["apple-touch-icon.png", circular[180]],
  ]) {
    writePng(path.join(PUBLIC, name), png);
  }

  const tmpDir = path.join(PUBLIC, ".ico-tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFiles = [16, 32, 48].map((s) => {
    const f = path.join(tmpDir, `${s}.png`);
    writePng(f, circular[s]);
    return f;
  });
  const icoBuf = await pngToIco(tmpFiles);
  fs.writeFileSync(path.join(PUBLIC, "favicon.ico"), icoBuf);
  for (const f of tmpFiles) fs.unlinkSync(f);
  fs.rmdirSync(tmpDir);
  console.log("wrote public/favicon.ico", icoBuf.length, "bytes");

  const b64 = fs
    .readFileSync(path.join(PUBLIC, `icon-512-${VERSION}.png`))
    .toString("base64");
  fs.writeFileSync(
    path.join(PUBLIC, "favicon.svg"),
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image width="512" height="512" href="data:image/png;base64,${b64}"/>
</svg>
`,
  );
  console.log("wrote public/favicon.svg");
  console.log("done", VERSION);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
