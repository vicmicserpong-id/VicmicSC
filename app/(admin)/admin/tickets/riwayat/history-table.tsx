"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WarrantyBadge } from "@/components/shared/status-badge";
import { TICKET_STATUS_LABEL, type TicketStatus, type WarrantyStatus } from "@/lib/constants";
import { formatDateWIB, todayWIB } from "@/lib/format";
import { downloadTextFile } from "@/lib/download";
import { cn } from "@/lib/utils";
import { exportTicketsCsvAction } from "@/lib/actions/reports";

export type HistoryRow = {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_phone: string;
  product_description: string;
  serial_number: string | null;
  wo_rma_number: string | null;
  warranty_status: WarrantyStatus;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
};

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const nd = new Date(Date.UTC(y, m - 1, d) + delta * 86_400_000);
  return `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, "0")}-${String(
    nd.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function HistoryTable({
  rows,
  from,
  to,
  maxToday,
}: {
  rows: HistoryRow[];
  from: string;
  to: string;
  maxToday: string;
}) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [query, setQuery] = useState("");
  const [navPending, startNav] = useTransition();
  const [exporting, startExport] = useTransition();

  function apply(f = fromDate, t = toDate) {
    startNav(() => {
      router.push(`/admin/tickets/riwayat?from=${f}&to=${t}`);
    });
  }

  function preset(days: number) {
    const t = todayWIB();
    const f = shiftDay(t, -(days - 1));
    setFromDate(f);
    setToDate(t);
    apply(f, t);
  }

  function presetThisMonth() {
    const t = todayWIB();
    const f = t.slice(0, 8) + "01";
    setFromDate(f);
    setToDate(t);
    apply(f, t);
  }

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.ticket_number.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.customer_phone.toLowerCase().includes(q) ||
        r.product_description.toLowerCase().includes(q) ||
        (r.serial_number?.toLowerCase().includes(q) ?? false) ||
        (r.wo_rma_number?.toLowerCase().includes(q) ?? false),
    );
  }, [rows, q]);

  function exportCsv() {
    startExport(async () => {
      try {
        const csv = await exportTicketsCsvAction();
        downloadTextFile(`vicmic-daftar-servis-${todayWIB()}.csv`, csv);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter tanggal */}
      <div className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Dari tanggal
            <Input
              type="date"
              value={fromDate}
              max={toDate || maxToday}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Sampai tanggal
            <Input
              type="date"
              value={toDate}
              min={fromDate}
              max={maxToday}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
            />
          </label>
          <Button size="sm" onClick={() => apply()} disabled={navPending}>
            {navPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Terapkan
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "7 hari", fn: () => preset(7) },
            { label: "30 hari", fn: () => preset(30) },
            { label: "90 hari", fn: () => preset(90) },
            { label: "Bulan ini", fn: presetThisMonth },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.fn}
              disabled={navPending}
              className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pencarian + ekspor + jumlah */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari no. tiket, nama, telepon, unit, SN, WO/RMA…"
            className="pl-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Hapus pencarian"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length}
          {q ? ` / ${rows.length}` : ""} tiket
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={exportCsv}
          disabled={exporting}
          title="Ekspor CSV (semua data)"
          aria-label="Ekspor CSV"
          className="ml-auto shrink-0"
        >
          {exporting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          Tidak ada tiket selesai/dibatalkan pada rentang tanggal ini.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Masuk</th>
                <th className="px-3 py-2 text-left font-medium">Selesai</th>
                <th className="px-3 py-2 text-left font-medium">No. Servis</th>
                <th className="px-3 py-2 text-left font-medium">Garansi</th>
                <th className="px-3 py-2 text-left font-medium">Nama</th>
                <th className="px-3 py-2 text-left font-medium">Telepon</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-foreground/5 hover:bg-muted/40">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateWIB(t.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateWIB(t.updated_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    <Link href={`/admin/tickets/${t.id}`} className="hover:underline">
                      {t.ticket_number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <WarrantyBadge status={t.warranty_status} />
                  </td>
                  <td className="px-3 py-2">{t.customer_name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {t.customer_phone}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs",
                        t.status === "CANCELLED" ? "text-rose-600" : "text-emerald-600",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          t.status === "CANCELLED" ? "bg-rose-400" : "bg-emerald-400",
                        )}
                      />
                      {TICKET_STATUS_LABEL[t.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length >= 2000 && (
            <p className="border-t border-foreground/5 px-3 py-2 text-center text-xs text-muted-foreground">
              Rentang ini melebihi 2000 tiket — persempit tanggal untuk melihat semuanya.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
