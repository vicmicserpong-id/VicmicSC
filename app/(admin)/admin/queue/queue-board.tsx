"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, ArrowRight, Undo2, X, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPE_LABEL, SERVICE_TYPE_PREFIX } from "@/lib/constants";
import { todayWIB, sinceShort, waLink } from "@/lib/format";
import type { Database } from "@/lib/database.types";

import { callQueue, recallQueue, completeQueue, cancelQueue } from "./actions";

type QueueRow = Database["public"]["Tables"]["queues"]["Row"];

export function QueueBoard({ initial }: { initial: QueueRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<QueueRow[]>(initial);
  const [actingId, setActingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("queues")
      .select("*")
      .eq("queue_date", todayWIB())
      .in("status", ["waiting", "serving"])
      .order("created_at", { ascending: true });
    setRows(data ?? []);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queues" },
        () => refetch(),
      )
      .subscribe();
    const poll = setInterval(refetch, 15_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [supabase, refetch]);

  function run(id: string, fn: () => Promise<void>) {
    setActingId(id);
    startTransition(async () => {
      try {
        await fn();
        await refetch();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setActingId(null);
      }
    });
  }

  const serving = rows.filter((r) => r.status === "serving");
  const waiting = rows.filter((r) => r.status === "waiting");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Papan Antrean</h1>
        <p className="text-sm text-muted-foreground">
          {waiting.length} menunggu · {serving.length} dilayani
        </p>
      </div>

      {serving.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sedang dilayani
          </h2>
          {serving.map((row) => (
            <QueueCard
              key={row.id}
              row={row}
              acting={actingId === row.id}
              onCall={() => run(row.id, () => callQueue(row.id))}
              onRecall={() => run(row.id, () => recallQueue(row.id))}
              onComplete={() => run(row.id, () => completeQueue(row.id))}
              onCancel={() => run(row.id, () => cancelQueue(row.id))}
              onAccept={() => {
                if (row.service_type === "service_baru") {
                  router.push(`/admin/intake/new?queue_id=${row.id}`);
                } else if (row.service_type === "pengambilan_unit") {
                  router.push(
                    `/admin/pickup?code=${encodeURIComponent(row.service_code ?? "")}`,
                  );
                }
              }}
            />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Menunggu
        </h2>
        {waiting.length === 0 ? (
          <p className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            Tidak ada antrean menunggu.
          </p>
        ) : (
          waiting.map((row) => (
            <QueueCard
              key={row.id}
              row={row}
              acting={actingId === row.id}
              onCall={() => run(row.id, () => callQueue(row.id))}
              onRecall={() => run(row.id, () => recallQueue(row.id))}
              onComplete={() => run(row.id, () => completeQueue(row.id))}
              onCancel={() => run(row.id, () => cancelQueue(row.id))}
              onAccept={() => {}}
            />
          ))
        )}
      </section>
    </div>
  );
}

function QueueCard({
  row,
  acting,
  onCall,
  onRecall,
  onComplete,
  onCancel,
  onAccept,
}: {
  row: QueueRow;
  acting: boolean;
  onCall: () => void;
  onRecall: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onAccept: () => void;
}) {
  const isServing = row.status === "serving";

  return (
    <div className="flex items-center gap-4 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <div className="flex w-16 shrink-0 flex-col items-center">
        <span className="text-2xl font-bold tabular-nums">{row.queue_number}</span>
        <span className="text-[10px] font-medium uppercase text-muted-foreground">
          {SERVICE_TYPE_PREFIX[row.service_type]}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.customer_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {SERVICE_TYPE_LABEL[row.service_type]}
          {row.service_code ? ` · ${row.service_code}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <a
            href={waLink(row.customer_phone, "")}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {row.customer_phone}
          </a>{" "}
          · menunggu {sinceShort(row.created_at)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {acting ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : isServing ? (
          <>
            {row.service_type === "lain_lain" ? (
              <Button size="sm" onClick={onComplete}>
                <Check className="size-3.5" /> Selesai
              </Button>
            ) : (
              <Button size="sm" onClick={onAccept}>
                Terima <ArrowRight className="size-3.5" />
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" onClick={onRecall} title="Kembalikan ke antrean">
              <Undo2 className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onCancel}
              title="Batalkan"
              className="text-destructive"
            >
              <X className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={onCall}>
              <PhoneCall className="size-3.5" /> Panggil
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onCancel}
              title="Batalkan"
              className="text-destructive"
            >
              <X className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
