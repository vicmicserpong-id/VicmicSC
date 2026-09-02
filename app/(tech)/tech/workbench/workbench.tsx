"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Loader2, ChevronRight, Inbox } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TicketStatusBadge } from "@/components/shared/status-badge";
import { createClient } from "@/lib/supabase/client";
import { sinceShort } from "@/lib/format";
import type { TicketStatus } from "@/lib/constants";
import { pullNextTicket } from "@/lib/actions/tickets";

type Row = {
  id: string;
  ticket_number: string;
  customer_name: string;
  product_description: string;
  status: TicketStatus;
  complaint_description: string;
  assigned_technician: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = { id: string; full_name: string | null };

const SELECT_COLUMNS =
  "id, ticket_number, customer_name, product_description, status, complaint_description, assigned_technician, created_at, updated_at";

export function Workbench({
  meId,
  initialTickets,
  initialPool,
  initialProfiles,
}: {
  meId: string;
  initialTickets: Row[];
  initialPool: number;
  initialProfiles: Profile[];
}) {
  const router = useRouter();
  const [tickets, setTickets] = useState<Row[]>(initialTickets);
  const [pool, setPool] = useState(initialPool);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [pending, startTransition] = useTransition();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name ?? "Staf"]));

  const refetch = useCallback(async () => {
    const [{ data }, { count }, { data: profs }] = await Promise.all([
      supabase
        .from("service_tickets")
        .select(SELECT_COLUMNS)
        .not("status", "in", "(CLOSED,CANCELLED)")
        .order("updated_at", { ascending: true }),
      supabase
        .from("service_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "INTAKE"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setTickets((data as Row[]) ?? []);
    setPool(count ?? 0);
    if (profs) setProfiles(profs);
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
    <div className="flex flex-col gap-6">
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

      <div className="flex flex-col gap-2">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-10 text-center ring-1 ring-foreground/10">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Belum ada tiket aktif. Tekan &quot;Tarik Tiket Berikutnya&quot; untuk mulai.
            </p>
          </div>
        ) : (
          tickets.map((row) => {
            const assignedName = row.assigned_technician
              ? nameById.get(row.assigned_technician)
              : null;
            const isMine = row.assigned_technician === meId;
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
                    {assignedName ? `${assignedName} · ` : ""}diperbarui{" "}
                    {sinceShort(row.updated_at)} lalu
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
