// Membangun semua aset ikon dari public/logo-source.png (1040x1040, RGBA).
// Jalankan: node scripts/generate-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "public", "logo-source.png");

// Warna dari brand: hijau gear #2e9e4c, kotak latar hijau pucat #f4fbf5.
const PALE = { r: 244, g: 251, b: 245, alpha: 1 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

const src = await readFile(SRC);

/** Sumber diratakan ke satu warna latar (buang sudut transparan), ukuran full. */
async function flat(size, bg) {
  return sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flatten({ background: bg })
    .png()
    .toBuffer();
}

async function out(name, buf) {
  const p = path.join(ROOT, "public", name);
  await writeFile(p, buf);
  console.log("✓", name, `(${buf.length} B)`);
}

// --- Ikon "any": full-bleed hijau pucat + mark ---
await out("icons/icon-192x192.png", await flat(192, PALE));
await out("icons/icon-512x512.png", await flat(512, PALE));

// --- Ikon maskable: mark diperkecil ke ~78% dengan area aman di sekeliling ---
const base512 = await flat(512, PALE);
const inner = Math.round(512 * 0.78);
const maskable = await sharp({
  create: { width: 512, height: 512, channels: 4, background: PALE },
})
  .composite([{ input: await sharp(base512).resize(inner, inner).toBuffer(), gravity: "centre" }])
  .png()
  .toBuffer();
await out("icons/maskable-512x512.png", maskable);

// --- Apple touch icon (iOS memakai sudut membulatnya sendiri) ---
await out("apple-touch-icon.png", await flat(180, PALE));

// --- Logo dalam aplikasi ---
// logo-mark: transparan, dipakai kecil di sebelah teks -> latar dibiarkan tembus.
await out(
  "logo-mark.png",
  await sharp(src).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
);
// logo.png: versi umum di atas putih.
await out("logo.png", await flat(512, WHITE));

// --- Favicon: PNG 32px dibungkus kontainer ICO (PNG-in-ICO, didukung semua browser modern) ---
const fav = await flat(32, PALE);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // jumlah gambar
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); // width
entry.writeUInt8(32, 1); // height
entry.writeUInt8(0, 2); // palet
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bpp
entry.writeUInt32LE(fav.length, 8); // ukuran data
entry.writeUInt32LE(22, 12); // offset data
const ico = Buffer.concat([header, entry, fav]);
await writeFile(path.join(ROOT, "app", "favicon.ico"), ico);
console.log("✓", "app/favicon.ico", `(${ico.length} B)`);

console.log("\nSelesai.");
