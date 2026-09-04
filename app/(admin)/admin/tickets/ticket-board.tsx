"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, X, Download, Loader2, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WarrantyBadge } from "@/components/shared/status-badge";
import {
  TICKET_STATUS_LABEL,
  type TicketStatus,
  type PartRequestStatus,
  type WarrantyStatus,
} from "@/lib/constants";
import { sinceShort, todayWIB, formatDateWIB } from "@/lib/format";
import { downloadTextFile } from "@/lib/download";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { exportTicketsCsvAction } from "@/lib/actions/reports";

// Kanban hanya untuk tiket AKTIF. CLOSED & CANCELLED pindah ke tabel riwayat di bawah.
const BOARD_COLUMNS: TicketStatus[] = [
  "INTAKE",
  "DIAGNOSING",
  "WAITING_APPROVAL",
  "WAITING_PART",
  "PART_ARRIVED",
  "PART_INSTALLING",
  "IN_REPAIR",
  "QC_TESTING",
  "READY_FOR_PICKUP",
];

const DOT_COLOR: Record<TicketStatus, string> = {
  INTAKE: "bg-slate-400",
  DIAGNOSING: "bg-blue-400",
  WAITING_APPROVAL: "bg-amber-400",
  WAITING_PART: "bg-amber-400",
  PART_ARRIVED: "bg-cyan-400",
  PART_INSTALLING: "bg-indigo-400",
  IN_REPAIR: "bg-blue-400",
  QC_TESTING: "bg-violet-400",
  READY_FOR_PICKUP: "bg-emerald-400",
  CLOSED: "bg-emerald-400",
  CANCELLED: "bg-rose-400",
};

type Row = {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_phone: string;
  product_description: string;
  serial_number: string | null;
  wo_rma_number: string | null;
  status: TicketStatus;
  warranty_status: WarrantyStatus;
  assigned_technician: string | null;
  created_at: string;
  updated_at: string;
  part_status: PartRequestStatus;
};

type Profile = { id: string; full_name: string | null };
type LastChange = { ticket_id: string | null; changed_by: string | null; changed_at: string | null };

const SELECT_COLUMNS =
  "id, ticket_number, customer_name, customer_phone, product_description, serial_number, wo_rma_number, status, warranty_status, assigned_technician, created_at, updated_at, part_status";

// Kartu ditandai "Baru" kalau status terakhir berubah dalam rentang ini …
const NEW_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 jam
// … dan ditandai butuh perhatian (tanda seru) kalau sudah diam lebih lama dari ini.
const STALE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 2 hari

const HISTORY_LIMIT = 100;

export function TicketBoard({
  initialTickets,
  initialProfiles,
  initialLastChange,
}: {
  initialTickets: Row[];
  initialProfiles: Profile[];
  initialLastChange: LastChange[];
}) {
  const [tickets, setTickets] = useState<Row[]>(initialTickets);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [lastChange, setLastChange] = useState<LastChange[]>(initialLastChange);
  const [query, setQuery] = useState("");
  const [exporting, startExport] = useTransition();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name ?? "Staf"]));
  const lastChangeById = new Map(
    lastChange
      .filter((l): l is { ticket_id: string; changed_by: string | null; changed_at: string | null } => !!l.ticket_id)
      .map((l) => [l.ticket_id, { changedBy: l.changed_by, changedAt: l.changed_at }]),
  );

  const refetch = useCallback(async () => {
    const [{ data }, { data: profs }, { data: lastChanges }] = await Promise.all([
      supabase
        .from("service_tickets")
        .select(SELECT_COLUMNS)
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("service_ticket_last_change").select("ticket_id, changed_by, changed_at"),
    ]);
    setTickets((data as Row[]) ?? []);
    if (profs) setProfiles(profs);
    if (lastChanges) setLastChange(lastChanges);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_tickets" },
        () => refetch(),
      )
      .subscribe();
    const poll = setInterval(refetch, 20_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [supabase, refetch]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        t.ticket_number.toLowerCase().includes(q) ||
        t.customer_name.toLowerCase().includes(q) ||
        t.customer_phone.toLowerCase().includes(q) ||
        t.product_description.toLowerCase().includes(q) ||
        (t.serial_number?.toLowerCase().includes(q) ?? false) ||
        (t.wo_rma_number?.toLowerCase().includes(q) ?? false),
    );
  }, [tickets, q]);

  const doneAt = (t: Row) => lastChangeById.get(t.id)?.changedAt ?? t.updated_at;

  const activeRows = filtered.filter((t) => t.status !== "CLOSED" && t.status !== "CANCELLED");
  const historyRows = filtered
    .filter((t) => t.status === "CLOSED" || t.status === "CANCELLED")
    .slice()
    .sort((a, b) => new Date(doneAt(b)).getTime() - new Date(doneAt(a)).getTime());

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Daftar Servis</h1>
          <p className="text-sm text-muted-foreground">
            {activeRows.length} aktif · {historyRows.length} selesai
            {q ? ` (hasil filter dari ${tickets.length})` : ""} · realtime
          </p>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
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
          <Button
            variant="outline"
            size="icon-sm"
            onClick={exportCsv}
            disabled={exporting}
            title="Ekspor CSV"
            aria-label="Ekspor CSV"
            className="shrink-0"
          >
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── Kanban tiket aktif ─────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((status) => {
          // Paling baru (terakhir berubah) di atas. Tiket yang lama diam tetap
          // ditandai lewat badge ">2 hari" di kartunya, cuma tidak didahulukan urutannya.
          const items = activeRows
            .filter((t) => t.status === status)
            .slice()
            .sort((a, b) => new Date(doneAt(b)).getTime() - new Date(doneAt(a)).getTime());
          return (
            <div
              key={status}
              className="flex w-52 shrink-0 flex-col gap-1.5 rounded-xl bg-muted/40 p-2"
            >
              <div className="flex items-center gap-1.5 px-1">
                <span className={cn("size-2 rounded-full", DOT_COLOR[status])} />
                <h2 className="text-xs font-semibold">{TICKET_STATUS_LABEL[status]}</h2>
                <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
              </div>

              <div className="flex max-h-[62vh] flex-col gap-1.5 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">—</p>
                ) : (
                  items.map((t) => {
                    const change = lastChangeById.get(t.id);
                    const changedAt = change?.changedAt ?? t.updated_at;
                    const age = Date.now() - new Date(changedAt).getTime();
                    const isNew = age < NEW_THRESHOLD_MS;
                    const isStale = age > STALE_THRESHOLD_MS;
                    const needsPart = t.part_status === "requested";
                    return (
                      <Link
                        key={t.id}
                        href={`/admin/tickets/${t.id}`}
                        className={cn(
                          "flex flex-col gap-0.5 rounded-md bg-card px-2 py-1.5 text-xs ring-1 transition-colors hover:bg-muted/60",
                          isStale
                            ? "bg-rose-50/60 ring-rose-400 dark:bg-rose-950/20"
                            : "ring-foreground/10",
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <span className="shrink-0 font-semibold">{t.ticket_number}</span>
                          <WarrantyBadge
                            status={t.warranty_status}
                            className="h-4 border-0 px-1 text-[10px]"
                          />
                          {needsPart && (
                            <Package
                              className="size-3 shrink-0 text-amber-600"
                              aria-label="Perlu order sparepart"
                            />
                          )}
                          {isNew && (
                            <span className="ml-auto shrink-0 rounded-full bg-blue-500/15 px-1 text-[10px] font-medium text-blue-600">
                              Baru
                            </span>
                          )}
                          {isStale && (
                            <AlertTriangle
                              className={cn("size-3 shrink-0 text-rose-600", !isNew && "ml-auto")}
                              aria-label="Diam lebih dari 2 hari"
                            />
                          )}
                        </div>
                        <span className="truncate text-muted-foreground">
                          {t.product_description}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span className="truncate">
                            {t.assigned_technician
                              ? (nameById.get(t.assigned_technician) ?? "Staf")
                              : "Belum ditugaskan"}
                          </span>
                          <span className="ml-auto shrink-0 tabular-nums">{sinceShort(changedAt)}</span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Riwayat tiket selesai / dibatalkan ─────────────────────── */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">
          Riwayat Selesai{" "}
          <span className="font-normal text-muted-foreground">({historyRows.length})</span>
        </h2>
        {historyRows.length === 0 ? (
          <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            Belum ada tiket yang selesai.
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
                {historyRows.slice(0, HISTORY_LIMIT).map((t) => (
                  <tr key={t.id} className="border-t border-foreground/5 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDateWIB(t.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDateWIB(doneAt(t))}
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
                        <span className={cn("size-1.5 rounded-full", DOT_COLOR[t.status])} />
                        {TICKET_STATUS_LABEL[t.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {historyRows.length > HISTORY_LIMIT && (
              <p className="border-t border-foreground/5 px-3 py-2 text-center text-xs text-muted-foreground">
                Menampilkan {HISTORY_LIMIT} terbaru dari {historyRows.length}. Gunakan pencarian
                atau Ekspor CSV untuk data lengkap.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
