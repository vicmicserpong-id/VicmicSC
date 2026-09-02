// Generator ikon PWA tanpa dependency (pakai zlib bawaan Node).
// Menggambar logo "V" putih di atas latar navy (#0F172A).
// Jalankan: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/icons");
mkdirSync(OUT, { recursive: true });

const BG = [0x0f, 0x17, 0x2a];
const FG = [0xf8, 0xfa, 0xfc];

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function renderRGBA(size) {
  const data = Buffer.alloc(size * size * 4);
  const stroke = size * 0.12;
  const topY = size * 0.30;
  const botY = size * 0.70;
  const lx = size * 0.28;
  const rx = size * 0.72;
  const mx = size * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(
        distToSegment(x, y, lx, topY, mx, botY),
        distToSegment(x, y, rx, topY, mx, botY),
      );
      // anti-alias tepi 1px
      const a = Math.max(0, Math.min(1, stroke / 2 - d + 0.5));
      const [r, g, b] = a >= 1 ? FG : a <= 0 ? BG : [
        Math.round(BG[0] + (FG[0] - BG[0]) * a),
        Math.round(BG[1] + (FG[1] - BG[1]) * a),
        Math.round(BG[2] + (FG[2] - BG[2]) * a),
      ];
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const png = encodePNG(size, renderRGBA(size));
  writeFileSync(resolve(OUT, `icon-${size}x${size}.png`), png);
  console.log(`✓ icons/icon-${size}x${size}.png (${png.length} B)`);
}
const maskable = encodePNG(512, renderRGBA(512));
writeFileSync(resolve(OUT, "maskable-512x512.png"), maskable);
console.log(`✓ icons/maskable-512x512.png (${maskable.length} B)`);

// apple-touch-icon 180x180
const apple = encodePNG(180, renderRGBA(180));
writeFileSync(resolve(__dirname, "../public/apple-touch-icon.png"), apple);
console.log(`✓ apple-touch-icon.png (${apple.length} B)`);
