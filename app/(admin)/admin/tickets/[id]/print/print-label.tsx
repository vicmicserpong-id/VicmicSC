"use client";

import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateWIB } from "@/lib/format";

type Ticket = {
  ticket_number: string;
  customer_name: string;
  product_description: string;
  created_at: string;
};

export function PrintLabel({ ticket, qrValue }: { ticket: Ticket; qrValue: string }) {
  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-4 py-6">
      {/* Ukuran kertas print khusus halaman ini — label thermal 58mm continuous roll.
          Kalau printer-nya beda ukuran, ini tinggal disesuaikan (mis. jadi 80mm). */}
      <style>{`@media print { @page { size: 58mm auto; margin: 2mm; } }`}</style>
      <div className="no-print flex w-full items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Ukuran cetak: label thermal 58mm. Scan QR untuk langsung buka tiket ini.
        </p>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" /> Cetak
        </Button>
      </div>

      <div className="flex w-[58mm] flex-col items-center gap-1 rounded-lg bg-white p-3 text-center text-black ring-1 ring-foreground/10 print:w-full print:rounded-none print:p-0 print:ring-0">
        <QRCodeSVG value={qrValue} size={130} />
        <p className="mt-1 text-base font-bold tracking-wide">{ticket.ticket_number}</p>
        <p className="text-xs font-medium">{ticket.customer_name}</p>
        <p className="max-w-[52mm] text-[10px] leading-tight text-neutral-600">
          {ticket.product_description}
        </p>
        <p className="text-[9px] text-neutral-500">{formatDateWIB(ticket.created_at)}</p>
        <p className="text-[8px] text-neutral-400">Vicmic Service — scan untuk lihat status</p>
      </div>
    </div>
  );
}
