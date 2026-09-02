"use client";

import { useTransition } from "react";
import { Download, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadTextFile } from "@/lib/download";
import { exportMonthlyClosedCsvAction, sendMonthlyReportNowAction } from "@/lib/actions/reports";

export function ReportActions({ yearMonth }: { yearMonth: string }) {
  const [exporting, startExport] = useTransition();
  const [sending, startSend] = useTransition();

  function exportCsv() {
    startExport(async () => {
      try {
        const csv = await exportMonthlyClosedCsvAction(yearMonth);
        downloadTextFile(`vicmic-selesai-${yearMonth}.csv`, csv);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function sendNow() {
    startSend(async () => {
      try {
        const r = await sendMonthlyReportNowAction(yearMonth);
        toast.success(`Rekap terkirim ke ${r.recipient} (${r.count} unit selesai).`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
        {exporting ? <Loader2 className="animate-spin" /> : <Download className="size-3.5" />}
        Ekspor CSV (selesai bulan ini)
      </Button>
      <Button variant="outline" size="sm" onClick={sendNow} disabled={sending}>
        {sending ? <Loader2 className="animate-spin" /> : <Mail className="size-3.5" />}
        Kirim ke Email Sekarang
      </Button>
    </div>
  );
}
