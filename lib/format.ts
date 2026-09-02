/** Format angka ke Rupiah, mis. 150000 -> "Rp 150.000". */
export function formatRupiah(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

/** Tanggal + jam dalam zona WIB, mis. "2 Sep 2026, 11.30". */
export function formatDateTimeWIB(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

/** Tanggal saja dalam zona WIB. */
export function formatDateWIB(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

/** Tanggal hari ini (YYYY-MM-DD) menurut zona WIB. */
export function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

/** Selisih waktu singkat dari `iso` sampai sekarang, mis. "12 mnt". */
export function sinceShort(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} mnt`;
  const h = Math.floor(mins / 60);
  return `${h} jam ${mins % 60} mnt`;
}

/** Normalisasi nomor telepon Indonesia ke format wa.me (62xxxxxxxxxx). */
export function toWaNumber(phone: string): string {
  let p = (phone ?? "").replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  else if (p.startsWith("62")) {
    /* sudah benar */
  } else if (p.startsWith("8")) p = "62" + p;
  return p;
}

/** Link chat WhatsApp dengan teks awal. */
export function waLink(phone: string, text: string): string {
  return `https://wa.me/${toWaNumber(phone)}?text=${encodeURIComponent(text)}`;
}

/** Inisial untuk avatar, mis. "Budi Santoso" -> "BS". */
export function initials(name: string): string {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
