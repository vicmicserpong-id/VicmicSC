"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, X, Download, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/constants";
import { formatDateWIB, waLink, todayWIB } from "@/lib/format";
import { downloadTextFile } from "@/lib/download";
import { exportCustomersCsvAction } from "@/lib/actions/reports";

type Customer = {
  phone: string | null;
  name: string | null;
  email: string | null;
  total_tickets: number | null;
  first_visit: string | null;
  last_visit: string | null;
  last_product: string | null;
  last_status: TicketStatus | null;
};

export function CustomerDirectory({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [exporting, startExport] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return initialCustomers;
    return initialCustomers.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.last_product ?? "").toLowerCase().includes(q),
    );
  }, [initialCustomers, q]);

  function exportCsv() {
    startExport(async () => {
      try {
        const csv = await exportCustomersCsvAction();
        downloadTextFile(`vicmic-pelanggan-${todayWIB()}.csv`, csv);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Pelanggan</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length}
            {q ? ` dari ${initialCustomers.length}` : ""} pelanggan — bank data untuk keperluan
            promo/remarketing (nomor WhatsApp bisa langsung diklik)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, no. WhatsApp, produk…"
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
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download className="size-3.5" />}
            Ekspor CSV
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-10 text-center ring-1 ring-foreground/10">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {initialCustomers.length === 0
              ? "Belum ada data pelanggan."
              : "Tidak ada pelanggan yang cocok dengan pencarian."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>No. WhatsApp</TableHead>
                <TableHead>Total Servis</TableHead>
                <TableHead>Kunjungan Terakhir</TableHead>
                <TableHead>Produk Terakhir</TableHead>
                <TableHead>Status Terakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.phone}>
                  <TableCell className="font-medium">{c.name || "-"}</TableCell>
                  <TableCell>
                    {c.phone ? (
                      <a
                        href={waLink(c.phone, "")}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                      >
                        {c.phone}
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{c.total_tickets ?? 0}</TableCell>
                  <TableCell>{formatDateWIB(c.last_visit)}</TableCell>
                  <TableCell className="max-w-48 truncate">{c.last_product || "-"}</TableCell>
                  <TableCell>
                    {c.last_status ? TICKET_STATUS_LABEL[c.last_status] : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
