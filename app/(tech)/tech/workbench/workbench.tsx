"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Loader2, ChevronRight, Inbox, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TicketStatusBadge, WarrantyBadge } from "@/components/shared/status-badge";
import { createClient } from "@/lib/supabase/client";
import { sinceShort } from "@/lib/format";
import { TICKET_STATUS_LABEL, type TicketStatus, type WarrantyStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { pullNextTicket } from "@/lib/actions/tickets";

type Row = {
  id: string;
  ticket_number: string;
  customer_name: string;
  product_description: string;
  status: TicketStatus;
  warranty_status: WarrantyStatus;
  serial_number: string | null;
  wo_rma_number: string | null;
  complaint_description: string;
  assigned_technician: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = { id: string; full_name: string | null };
type LastChange = { ticket_id: string | null; changed_by: string | null };
type OwnerTab = "mine" | "others";
type StatusFilter = TicketStatus | "all";

const SELECT_COLUMNS =
  "id, ticket_number, customer_name, product_description, status, warranty_status, serial_number, wo_rma_number, complaint_description, assigned_technician, created_at, updated_at";

// Urutan status aktif di workbench (INTAKE, CLOSED, CANCELLED tidak masuk daftar ini).
const STATUS_ORDER: TicketStatus[] = [
  "DIAGNOSING",
  "WAITING_APPROVAL",
  "WAITING_PART",
  "PART_ARRIVED",
  "PART_INSTALLING",
  "IN_REPAIR",
  "QC_TESTING",
  "READY_FOR_PICKUP",
];

export function Workbench({
  meId,
  initialTickets,
  initialPool,
  initialProfiles,
  initialLastChange,
}: {
  meId: string;
  initialTickets: Row[];
  initialPool: number;
  initialProfiles: Profile[];
  initialLastChange: LastChange[];
}) {
  const router = useRouter();
  const [tickets, setTickets] = useState<Row[]>(initialTickets);
  const [pool, setPool] = useState(initialPool);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [lastChange, setLastChange] = useState<LastChange[]>(initialLastChange);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<OwnerTab>("mine");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pending, startTransition] = useTransition();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name ?? "Staf"]));
  const lastChangeById = new Map(
    lastChange.filter((l): l is { ticket_id: string; changed_by: string } => !!l.ticket_id && !!l.changed_by)
      .map((l) => [l.ticket_id, l.changed_by]),
  );

  const refetch = useCallback(async () => {
    const [{ data }, { count }, { data: profs }, { data: lastChanges }] = await Promise.all([
      supabase
        .from("service_tickets")
        .select(SELECT_COLUMNS)
        .not("status", "in", "(INTAKE,CLOSED,CANCELLED)")
        .order("updated_at", { ascending: true }),
      supabase
        .from("service_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "INTAKE"),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("service_ticket_last_change").select("ticket_id, changed_by"),
    ]);
    setTickets((data as Row[]) ?? []);
    setPool(count ?? 0);
    if (profs) setProfiles(profs);
    if (lastChanges) setLastChange(lastChanges);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("tech-workbench")
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
  const searched = useMemo(() => {
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        t.ticket_number.toLowerCase().includes(q) ||
        t.customer_name.toLowerCase().includes(q) ||
        t.product_description.toLowerCase().includes(q) ||
        (t.serial_number?.toLowerCase().includes(q) ?? false) ||
        (t.wo_rma_number?.toLowerCase().includes(q) ?? false),
    );
  }, [tickets, q]);

  const mine = useMemo(
    () => searched.filter((t) => t.assigned_technician === meId),
    [searched, meId],
  );
  const others = useMemo(
    () => searched.filter((t) => t.assigned_technician !== meId),
    [searched, meId],
  );

  const ownerList = owner === "mine" ? mine : others;

  // Hitung jumlah per status untuk chip filter (dari tab yang sedang aktif).
  const statusCounts = useMemo(() => {
    const c = new Map<TicketStatus, number>();
    for (const t of ownerList) c.set(t.status, (c.get(t.status) ?? 0) + 1);
    return c;
  }, [ownerList]);

  const visible =
    statusFilter === "all" ? ownerList : ownerList.filter((t) => t.status === statusFilter);

  function switchOwner(next: OwnerTab) {
    setOwner(next);
    setStatusFilter("all");
  }

  function pull() {
    startTransition(async () => {
      try {
        const t = await pullNextTicket();
        if (!t) {
          toast.info("Tidak ada unit berstatus INTAKE.");
          await refetch();
          return;
        }
        toast.success(`Tiket ${t.ticket_number} ditarik.`);
        router.push(`/tech/workbench/${t.id}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Workbench</h1>
          <p className="text-sm text-muted-foreground">
            {pool} unit menunggu diagnosa · {tickets.length} tiket aktif — semua teknisi bisa
            melihat &amp; mengubah status
          </p>
        </div>
        <Button size="lg" onClick={pull} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" /> Menarik…
            </>
          ) : (
            <>
              <Download /> Tarik Tiket Berikutnya (FIFO)
            </>
          )}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari no. tiket, nama, unit, SN, WO/RMA…"
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

      {/* Tab: tarikan sendiri vs teknisi lain */}
      <div className="inline-flex w-fit rounded-lg bg-muted p-[3px] text-sm">
        <button
          type="button"
          onClick={() => switchOwner("mine")}
          className={cn(
            "rounded-md px-3 py-1 font-medium transition-colors",
            owner === "mine"
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground/60 hover:text-foreground",
          )}
        >
          Tarikan Saya <span className="tabular-nums">({mine.length})</span>
        </button>
        <button
          type="button"
          onClick={() => switchOwner("others")}
          className={cn(
            "rounded-md px-3 py-1 font-medium transition-colors",
            owner === "others"
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground/60 hover:text-foreground",
          )}
        >
          Teknisi Lain <span className="tabular-nums">({others.length})</span>
        </button>
      </div>

      {/* Filter status */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
          label="Semua"
          count={ownerList.length}
        />
        {STATUS_ORDER.filter((s) => (statusCounts.get(s) ?? 0) > 0).map((s) => (
          <FilterChip
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            label={TICKET_STATUS_LABEL[s]}
            count={statusCounts.get(s) ?? 0}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-10 text-center ring-1 ring-foreground/10">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {ownerList.length === 0
                ? owner === "mine"
                  ? 'Belum ada tiket yang kamu tangani. Tekan "Tarik Tiket Berikutnya" untuk mulai.'
                  : "Belum ada tiket aktif milik teknisi lain."
                : "Tidak ada tiket pada status ini."}
            </p>
          </div>
        ) : (
          visible.map((row) => {
            const assignedName = row.assigned_technician
              ? nameById.get(row.assigned_technician)
              : null;
            const isMine = row.assigned_technician === meId;
            const changerId = lastChangeById.get(row.id);
            const changerName = changerId ? (nameById.get(changerId) ?? "Staf") : null;
            return (
              <Link
                key={row.id}
                href={`/tech/workbench/${row.id}`}
                className="flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{row.ticket_number}</span>
                    <TicketStatusBadge status={row.status} />
                    <WarrantyBadge status={row.warranty_status} />
                    {isMine && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Anda
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm">{row.product_description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.customer_name} · {row.complaint_description}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {assignedName ? `Ditugaskan ${assignedName} · ` : ""}
                    diubah oleh {changerName ?? "—"} · {sinceShort(row.updated_at)} lalu
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors",
        active
          ? "bg-foreground text-background ring-foreground"
          : "bg-card text-muted-foreground ring-foreground/15 hover:bg-muted",
      )}
    >
      {label} <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
