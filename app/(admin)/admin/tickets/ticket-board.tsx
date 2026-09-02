"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, X, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/constants";
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
};

type Profile = { id: string; full_name: string | null };
type LastChange = { ticket_id: string | null; changed_by: string | null };

const SELECT_COLUMNS =
  "id, ticket_number, customer_name, product_description, status, assigned_technician, updated_at";

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
      .filter((l): l is { ticket_id: string; changed_by: string } => !!l.ticket_id && !!l.changed_by)
      .map((l) => [l.ticket_id, l.changed_by]),
  );

  const refetch = useCallback(async () => {
    const [{ data }, { data: profs }, { data: lastChanges }] = await Promise.all([
      supabase
        .from("service_tickets")
        .select(SELECT_COLUMNS)
        .order("updated_at", { ascending: true })
        .limit(300),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("service_ticket_last_change").select("ticket_id, changed_by"),
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
          const items = filtered.filter((t) => t.status === status);
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
                    const changerId = lastChangeById.get(t.id);
                    const changerName = changerId ? (nameById.get(changerId) ?? "Staf") : null;
                    return (
                      <Link
                        key={t.id}
                        href={`/admin/tickets/${t.id}`}
                        className="flex flex-col gap-0.5 rounded-lg bg-card p-3 text-xs ring-1 ring-foreground/10 transition-colors hover:bg-muted/60"
                      >
                        <span className="font-semibold">{t.ticket_number}</span>
                        <span className="truncate">{t.product_description}</span>
                        <span className="truncate text-muted-foreground">{t.customer_name}</span>
                        <span className="mt-1 text-muted-foreground">
                          {t.assigned_technician
                            ? (nameById.get(t.assigned_technician) ?? "Staf")
                            : "Belum ditugaskan"}{" "}
                          · {sinceShort(t.updated_at)} lalu
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
