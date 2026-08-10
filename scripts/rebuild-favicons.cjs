/**
 * One-shot favicon rebuild:
 * - Punch true transparent corners on the circular UD mark
 * - Emit crisp PNG sizes + multi-resolution favicon.ico
 * - Emit a matching SVG for modern browsers
 *
 * Run: node scripts/rebuild-favicons.js
 */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const SOURCE = path.join(PUBLIC, "icon-192-v6.png");
const VERSION = "v7";

function loadPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function writePng(file, png) {
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log("wrote", path.relative(ROOT, file), `${png.width}x${png.height}`);
}

/** Keep white circle + UD; make outside fully transparent. */
function punchTransparentCircle(src) {
  const out = new PNG({ width: src.width, height: src.height });
  const cx = (src.width - 1) / 2;
  const cy = (src.height - 1) / 2;
  // Slight inset so the antialiased edge of the circle stays, corners go clear
  const radius = Math.min(cx, cy) - 0.5;

  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (src.width * y + x) << 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      out.data[i] = src.data[i];
      out.data[i + 1] = src.data[i + 1];
      out.data[i + 2] = src.data[i + 2];

      if (dist > radius + 0.75) {
        out.data[i + 3] = 0;
      } else if (dist > radius - 0.75) {
        // Soft edge: fade existing alpha so black corner residue disappears
        const t = 1 - (dist - (radius - 0.75)) / 1.5;
        const a = Math.round(src.data[i + 3] * Math.max(0, Math.min(1, t)));
        out.data[i + 3] = a;
      } else {
        out.data[i + 3] = src.data[i + 3];
      }
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

  const channels = [0, 1, 2, 3].map((c) => {
    const top = mix(src.data[i00 + c], src.data[i10 + c], fx);
    const bot = mix(src.data[i01 + c], src.data[i11 + c], fx);
    return mix(top, bot, fy);
  });
  return channels;
}

/** High-quality bilinear resize with premultiplied alpha. */
function resize(src, size) {
  const out = new PNG({ width: size, height: size });
  const scale = src.width / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = (x + 0.5) * scale - 0.5;
      const sy = (y + 0.5) * scale - 0.5;
      const [r, g, b, a] = sample(src, Math.max(0, sx), Math.max(0, sy));
      const i = (size * y + x) << 2;
      out.data[i] = Math.round(r);
      out.data[i + 1] = Math.round(g);
      out.data[i + 2] = Math.round(b);
      out.data[i + 3] = Math.round(a);
    }
  }
  return out;
}

function writeSvg(file) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="256" fill="#ffffff"/>
  <text
    x="256"
    y="318"
    text-anchor="middle"
    font-family="Arial Black, Arial, Helvetica, sans-serif"
    font-size="260"
    font-weight="900"
    font-style="italic"
    letter-spacing="-12"
    fill="#111111"
  >UD</text>
</svg>
`;
  fs.writeFileSync(file, svg);
  console.log("wrote", path.relative(ROOT, file));
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing source ${SOURCE}`);
  }

  const pngToIco = (await import(pathToFileURL(
    require.resolve("png-to-ico"),
  ).href)).default;

  const punched = punchTransparentCircle(loadPng(SOURCE));
  const sizes = {
    16: resize(punched, 16),
    32: resize(punched, 32),
    48: resize(punched, 48),
    96: resize(punched, 96),
    180: resize(punched, 180),
    192: resize(punched, 192),
    512: resize(punched, 512),
  };

  // Versioned + unversioned aliases browsers/crawlers hit by habit
  writePng(path.join(PUBLIC, `favicon-16-${VERSION}.png`), sizes[16]);
  writePng(path.join(PUBLIC, `favicon-32-${VERSION}.png`), sizes[32]);
  writePng(path.join(PUBLIC, `favicon-48-${VERSION}.png`), sizes[48]);
  writePng(path.join(PUBLIC, `favicon-96-${VERSION}.png`), sizes[96]);
  writePng(path.join(PUBLIC, `icon-192-${VERSION}.png`), sizes[192]);
  writePng(path.join(PUBLIC, `icon-512-${VERSION}.png`), sizes[512]);
  writePng(path.join(PUBLIC, `apple-touch-icon-${VERSION}.png`), sizes[180]);

  writePng(path.join(PUBLIC, "favicon-16.png"), sizes[16]);
  writePng(path.join(PUBLIC, "favicon-32.png"), sizes[32]);
  writePng(path.join(PUBLIC, "favicon-48.png"), sizes[48]);
  writePng(path.join(PUBLIC, "favicon-96.png"), sizes[96]);
  writePng(path.join(PUBLIC, "icon-192.png"), sizes[192]);
  writePng(path.join(PUBLIC, "icon-512.png"), sizes[512]);
  writePng(path.join(PUBLIC, "apple-touch-icon.png"), sizes[180]);

  // Multi-size ICO — browsers request /favicon.ico before parsing <link> tags
  const tmpDir = path.join(PUBLIC, ".ico-tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFiles = [16, 32, 48].map((s) => {
    const f = path.join(tmpDir, `${s}.png`);
    writePng(f, sizes[s]);
    return f;
  });
  const icoBuf = await pngToIco(tmpFiles);
  fs.writeFileSync(path.join(PUBLIC, "favicon.ico"), icoBuf);
  for (const f of tmpFiles) fs.unlinkSync(f);
  fs.rmdirSync(tmpDir);
  console.log("wrote public/favicon.ico", icoBuf.length, "bytes (16/32/48)");

  writeSvg(path.join(PUBLIC, "favicon.svg"));
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
