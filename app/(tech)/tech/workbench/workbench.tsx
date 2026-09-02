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

import { pullNextTicket } from "./actions";

type Row = {
  id: string;
  ticket_number: string;
  customer_name: string;
  product_description: string;
  status: TicketStatus;
  complaint_description: string;
  created_at: string;
  updated_at: string;
};

export function Workbench({
  meId,
  initialMine,
  initialPool,
}: {
  meId: string;
  initialMine: Row[];
  initialPool: number;
}) {
  const router = useRouter();
  const [mine, setMine] = useState<Row[]>(initialMine);
  const [pool, setPool] = useState(initialPool);
  const [pending, startTransition] = useTransition();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const refetch = useCallback(async () => {
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("service_tickets")
        .select(
          "id, ticket_number, customer_name, product_description, status, complaint_description, created_at, updated_at",
        )
        .eq("assigned_technician", meId)
        .not("status", "in", "(CLOSED,CANCELLED)")
        .order("updated_at", { ascending: true }),
      supabase
        .from("service_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "INTAKE"),
    ]);
    setMine((data as Row[]) ?? []);
    setPool(count ?? 0);
  }, [supabase, meId]);

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
            {pool} unit menunggu diagnosa · {mine.length} tiket aktif Anda
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
        {mine.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-10 text-center ring-1 ring-foreground/10">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Belum ada tiket. Tekan &quot;Tarik Tiket Berikutnya&quot; untuk mulai.
            </p>
          </div>
        ) : (
          mine.map((row) => (
            <Link
              key={row.id}
              href={`/tech/workbench/${row.id}`}
              className="flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{row.ticket_number}</span>
                  <TicketStatusBadge status={row.status} />
                </div>
                <p className="truncate text-sm">{row.product_description}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.customer_name} · {row.complaint_description}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  diperbarui {sinceShort(row.updated_at)} lalu
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
