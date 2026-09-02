"use server";

import { createClient } from "@/lib/supabase/server";
import { requireFrontDesk } from "@/lib/auth";
import { sendEmail, monthlyRecapEmailHtml, toBase64Attachment } from "@/lib/email";
import { exportAllTicketsCsv, exportMonthlyClosedCsv, buildMonthlyReport } from "@/lib/reports";

/** CSV seluruh tiket servis — untuk tombol "Ekspor CSV" di Daftar Servis. Admin/owner saja. */
export async function exportTicketsCsvAction(): Promise<string> {
  await requireFrontDesk();
  const supabase = await createClient();
  return exportAllTicketsCsv(supabase);
}

/** CSV tiket CLOSED bulan tertentu ("YYYY-MM"). Admin/owner saja. */
export async function exportMonthlyClosedCsvAction(yearMonth: string): Promise<string> {
  await requireFrontDesk();
  const supabase = await createClient();
  const { csv } = await exportMonthlyClosedCsv(supabase, yearMonth);
  return csv;
}

/**
 * Kirim rekap bulanan (ringkasan + lampiran CSV unit yang sudah diambil) ke
 * RECAP_EMAIL_RECIPIENT sekarang juga — sama seperti cron bulanan, tapi manual
 * & bisa untuk bulan mana pun. Admin/owner saja.
 */
export async function sendMonthlyReportNowAction(
  yearMonth: string,
): Promise<{ sent: boolean; recipient?: string; count: number }> {
  await requireFrontDesk();
  const supabase = await createClient();

  const [report, { csv, count }] = await Promise.all([
    buildMonthlyReport(supabase, yearMonth),
    exportMonthlyClosedCsv(supabase, yearMonth),
  ]);

  const to = process.env.RECAP_EMAIL_RECIPIENT;
  if (!to) {
    throw new Error("RECAP_EMAIL_RECIPIENT belum diset di environment variable.");
  }

  const result = await sendEmail({
    to,
    subject: `Rekap Bulanan Vicmic — ${report.monthLabel}`,
    html: monthlyRecapEmailHtml({
      monthLabel: report.monthLabel,
      newCount: report.newCount,
      closedCount: report.closedCount,
      cancelledCount: report.cancelledCount,
      avgTurnaroundDays: report.avgTurnaroundDays,
      warrantyBreakdown: report.warrantyBreakdown,
    }),
    attachments: [
      { filename: `vicmic-selesai-${yearMonth}.csv`, content: toBase64Attachment(csv) },
    ],
  });

  if (result.skipped) {
    throw new Error("Email belum terkirim — RESEND_API_KEY belum diset di server.");
  }

  return { sent: true, recipient: to, count };
}
