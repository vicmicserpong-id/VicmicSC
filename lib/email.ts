import "server-only";

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || "Vicmic Service <onboarding@resend.dev>";

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Kirim email via Resend. Jika RESEND_API_KEY belum diset, dilewati (tidak error). */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  /** Lampiran, mis. rekap CSV. `content` boleh string (base64) atau Buffer. */
  attachments?: { filename: string; content: string | Buffer }[];
}): Promise<{ skipped: boolean; id?: string }> {
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY belum diset — dilewati:", opts.subject);
    return { skipped: true };
  }
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({ from: FROM, ...opts });
  if (error) throw new Error(error.message);
  return { skipped: false, id: data?.id };
}

/** Encode teks (mis. CSV) ke base64 untuk lampiran email. */
export function toBase64Attachment(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64");
}

// ── Template: unit siap diambil ─────────────────────────────────────
export function readyEmailHtml(t: {
  ticket_number: string;
  customer_name: string;
  product_description: string;
}): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;color:#0f172a">
  <h2 style="margin:0 0 12px">Unit Anda Siap Diambil ✅</h2>
  <p>Halo ${escapeHtml(t.customer_name)},</p>
  <p>Unit servis Anda sudah selesai dan siap diambil di <strong>Vicmic Service</strong>.</p>
  <table style="border-collapse:collapse;margin:12px 0;font-size:14px">
    <tr><td style="padding:4px 12px 4px 0;color:#64748b">No. Tiket</td><td style="padding:4px 0"><strong>${escapeHtml(t.ticket_number)}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#64748b">Unit</td><td style="padding:4px 0">${escapeHtml(t.product_description)}</td></tr>
  </table>
  <p style="color:#64748b;font-size:13px">Mohon tunjukkan email ini atau sebutkan nomor tiket saat pengambilan. Terima kasih.</p>
</div>`;
}

// ── Template: rekap harian ─────────────────────────────────────────
export type RecapData = {
  day: string;
  queues: { service_baru: number; pengambilan_unit: number; lain_lain: number };
  queueTotal: number;
  newTickets: number;
  doneTotal: number;
  perTech: { name: string; count: number }[];
  /** Ringkasan pembersihan foto tiket lama (opsional — lihat lib/cleanup.ts). */
  photoCleanup?: { ticketsCleaned: number; filesDeleted: number };
};

export function recapEmailHtml(d: RecapData): string {
  const row = (a: string, b: string | number) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#64748b">${a}</td><td style="padding:6px 0;text-align:right"><strong>${b}</strong></td></tr>`;
  const techRows =
    d.perTech.length > 0
      ? d.perTech
          .map((t) => row(escapeHtml(t.name), t.count))
          .join("")
      : `<tr><td colspan="2" style="padding:6px 0;color:#94a3b8">Belum ada unit selesai.</td></tr>`;

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#0f172a">
  <h2 style="margin:0 0 4px">Rekap Harian Vicmic Service</h2>
  <p style="margin:0 0 16px;color:#64748b">${d.day} (WIB)</p>

  <h3 style="margin:16px 0 4px;font-size:14px">Antrean Meja Depan</h3>
  <table style="border-collapse:collapse;font-size:14px;width:100%">
    ${row("Servis Baru (A)", d.queues.service_baru)}
    ${row("Pengambilan Unit (B)", d.queues.pengambilan_unit)}
    ${row("Konsultasi / Lain-lain (C)", d.queues.lain_lain)}
    ${row("Total antrean", d.queueTotal)}
  </table>

  <h3 style="margin:16px 0 4px;font-size:14px">Servis</h3>
  <table style="border-collapse:collapse;font-size:14px;width:100%">
    ${row("Tiket servis baru masuk", d.newTickets)}
    ${row("Unit selesai (siap ambil + diserahkan)", d.doneTotal)}
  </table>

  <h3 style="margin:16px 0 4px;font-size:14px">Unit Selesai per Teknisi</h3>
  <table style="border-collapse:collapse;font-size:14px;width:100%">
    ${techRows}
  </table>
  ${
    d.photoCleanup && d.photoCleanup.filesDeleted > 0
      ? `<p style="margin:16px 0 0;color:#94a3b8;font-size:12px">Pemeliharaan: ${d.photoCleanup.filesDeleted} foto pada ${d.photoCleanup.ticketsCleaned} tiket lama (selesai/dibatalkan, tidak berubah &gt;14 hari) dihapus otomatis dari penyimpanan.</p>`
      : ""
  }
</div>`;
}

// ── Template: rekap bulanan (dengan lampiran CSV) ────────────────────
export type MonthlyRecapData = {
  monthLabel: string;
  newCount: number;
  closedCount: number;
  cancelledCount: number;
  avgTurnaroundDays: number | null;
  warrantyBreakdown: { label: string; count: number }[];
};

export function monthlyRecapEmailHtml(d: MonthlyRecapData): string {
  const row = (a: string, b: string | number) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#64748b">${a}</td><td style="padding:6px 0;text-align:right"><strong>${b}</strong></td></tr>`;
  const warrantyRows = d.warrantyBreakdown.map((w) => row(w.label, w.count)).join("");

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#0f172a">
  <h2 style="margin:0 0 4px">Rekap Bulanan Vicmic Service</h2>
  <p style="margin:0 0 16px;color:#64748b">${escapeHtml(d.monthLabel)}</p>

  <table style="border-collapse:collapse;font-size:14px;width:100%">
    ${row("Unit masuk", d.newCount)}
    ${row("Unit selesai (sudah diambil)", d.closedCount)}
    ${row("Dibatalkan", d.cancelledCount)}
    ${row(
      "Rata-rata waktu pengerjaan",
      d.avgTurnaroundDays === null ? "—" : `${d.avgTurnaroundDays.toFixed(1)} hari`,
    )}
  </table>

  <h3 style="margin:16px 0 4px;font-size:14px">Unit Masuk per Status Garansi</h3>
  <table style="border-collapse:collapse;font-size:14px;width:100%">
    ${warrantyRows}
  </table>

  <p style="margin:16px 0 0;color:#64748b;font-size:13px">
    Daftar lengkap unit yang sudah diambil bulan ini terlampir sebagai CSV (bisa dibuka di Excel).
  </p>
</div>`;
}
