import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, monthlyRecapEmailHtml, toBase64Attachment } from "@/lib/email";
import { buildMonthlyReport, exportMonthlyClosedCsv } from "@/lib/reports";
import { currentMonthWIB, shiftMonth } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Dijadwalkan lewat vercel.json: "0 1 1 * *" (01:00 UTC tgl 1 = 08:00 WIB) —
// mengirim rekap bulan SEBELUMNYA (bulan yang baru saja tutup).
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const yearMonth = shiftMonth(currentMonthWIB(), -1);
  const supabase = createAdminClient();

  const [report, { csv, count }] = await Promise.all([
    buildMonthlyReport(supabase, yearMonth),
    exportMonthlyClosedCsv(supabase, yearMonth),
  ]);

  const to = process.env.RECAP_EMAIL_RECIPIENT;
  let email: { skipped: boolean; id?: string; error?: string; reason?: string };
  if (!to) {
    email = { skipped: true, reason: "RECAP_EMAIL_RECIPIENT belum diset" };
  } else {
    try {
      email = await sendEmail({
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
    } catch (e) {
      // Kegagalan email tidak menggagalkan cron.
      console.error("[cron monthly-report] email gagal:", e);
      email = { skipped: true, error: (e as Error).message };
    }
  }

  return NextResponse.json({ ok: true, yearMonth, closedCount: count, report, email });
}
