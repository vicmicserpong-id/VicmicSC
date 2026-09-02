"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/constants";
import { sinceShort } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

const SELECT_COLUMNS =
  "id, ticket_number, customer_name, product_description, status, assigned_technician, updated_at";

export function Board({
  initialTickets,
  initialProfiles,
}: {
  initialTickets: Row[];
  initialProfiles: Profile[];
}) {
  const [tickets, setTickets] = useState<Row[]>(initialTickets);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name ?? "Staf"]));

  const refetch = useCallback(async () => {
    const [{ data }, { data: profs }] = await Promise.all([
      supabase
        .from("service_tickets")
        .select(SELECT_COLUMNS)
        .order("updated_at", { ascending: true })
        .limit(300),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setTickets((data as Row[]) ?? []);
    if (profs) setProfiles(profs);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-board")
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Papan Status Servis</h1>
        <p className="text-sm text-muted-foreground">
          {tickets.length} tiket · diperbarui realtime
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((status) => {
          const items = tickets.filter((t) => t.status === status);
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
                  items.map((t) => (
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
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
