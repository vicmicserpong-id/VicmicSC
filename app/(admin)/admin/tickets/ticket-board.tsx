"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, X, Download, Loader2, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TICKET_STATUS_LABEL, type TicketStatus, type PartRequestStatus } from "@/lib/constants";
import { sinceShort, todayWIB } from "@/lib/format";
import { downloadTextFile } from "@/lib/download";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { exportTicketsCsvAction } from "@/lib/actions/reports";

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
  "CLOSED",
  "CANCELLED",
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
  product_description: string;
  status: TicketStatus;
  assigned_technician: string | null;
  updated_at: string;
  part_status: PartRequestStatus;
};

type Profile = { id: string; full_name: string | null };
type LastChange = { ticket_id: string | null; changed_by: string | null; changed_at: string | null };

const SELECT_COLUMNS =
  "id, ticket_number, customer_name, product_description, status, assigned_technician, updated_at, part_status";

// Kartu ditandai "Baru" kalau status terakhir berubah dalam rentang ini …
const NEW_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 jam
// … dan ditandai butuh perhatian (tanda seru) kalau sudah diam lebih lama dari ini.
const STALE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 2 hari

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
        .order("updated_at", { ascending: true })
        .limit(300),
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
        t.product_description.toLowerCase().includes(q),
    );
  }, [tickets, q]);

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
            {filtered.length}
            {q ? ` dari ${tickets.length}` : ""} tiket · diperbarui realtime
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari no. tiket, nama, unit…"
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

      <div className="flex gap-3 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((status) => {
          const items = filtered
            .filter((t) => t.status === status)
            .slice()
            .sort((a, b) => {
              const ca = lastChangeById.get(a.id)?.changedAt ?? a.updated_at;
              const cb = lastChangeById.get(b.id)?.changedAt ?? b.updated_at;
              // Paling lama belum berubah status di paling atas — itu yang paling butuh perhatian.
              return new Date(ca).getTime() - new Date(cb).getTime();
            });
          return (
            <div
              key={status}
              className="flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/40 p-3"
            >
              <div className="flex items-center gap-2 px-1">
                <span className={cn("size-2 rounded-full", DOT_COLOR[status])} />
                <h2 className="text-xs font-semibold">{TICKET_STATUS_LABEL[status]}</h2>
                <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
              </div>

              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground">Kosong</p>
                ) : (
                  items.map((t) => {
                    const change = lastChangeById.get(t.id);
                    const changedAt = change?.changedAt ?? t.updated_at;
                    const changerName = change?.changedBy ? (nameById.get(change.changedBy) ?? "Staf") : null;
                    const age = Date.now() - new Date(changedAt).getTime();
                    const isTerminal = status === "CLOSED" || status === "CANCELLED";
                    const isNew = age < NEW_THRESHOLD_MS;
                    // Tiket yang sudah selesai/dibatalkan tidak perlu ditandai "butuh perhatian".
                    const isStale = !isTerminal && age > STALE_THRESHOLD_MS;
                    const needsPart = t.part_status === "requested";
                    return (
                      <Link
                        key={t.id}
                        href={`/admin/tickets/${t.id}`}
                        className={cn(
                          "flex flex-col gap-0.5 rounded-lg bg-card p-3 text-xs ring-1 transition-colors hover:bg-muted/60",
                          isStale ? "ring-rose-400 bg-rose-50/60 dark:bg-rose-950/20" : "ring-foreground/10",
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{t.ticket_number}</span>
                          {isNew && (
                            <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                              Baru
                            </span>
                          )}
                          {isStale && (
                            <span
                              className="ml-auto flex items-center gap-0.5 text-[10px] font-medium text-rose-600"
                              title="Belum ada perubahan status lebih dari 2 hari"
                            >
                              <AlertTriangle className="size-3" /> &gt;2 hari
                            </span>
                          )}
                        </div>
                        {needsPart && (
                          <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            <Package className="size-3" /> Perlu order sparepart
                          </span>
                        )}
                        <span className="truncate">{t.product_description}</span>
                        <span className="truncate text-muted-foreground">{t.customer_name}</span>
                        <span className={cn("mt-1", isStale ? "font-medium text-rose-600" : "text-muted-foreground")}>
                          {t.assigned_technician
                            ? (nameById.get(t.assigned_technician) ?? "Staf")
                            : "Belum ditugaskan"}{" "}
                          · {sinceShort(changedAt)} lalu
                        </span>
                        {changerName && (
                          <span className="text-muted-foreground">diubah oleh {changerName}</span>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
