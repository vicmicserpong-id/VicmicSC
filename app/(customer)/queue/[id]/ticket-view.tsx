"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, BellRing } from "lucide-react";

import { PageShell } from "@/components/shared/page-shell";
import { QueueStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPE_LABEL, type QueueStatus, type ServiceType } from "@/lib/constants";
import { formatDateTimeWIB } from "@/lib/format";

type QueueRow = {
  id: string;
  queue_number: string;
  daily_seq: number;
  service_type: ServiceType;
  service_code: string | null;
  customer_name: string;
  status: QueueStatus;
  queue_date: string;
  created_at: string;
};

export function TicketView({ id }: { id: string }) {
  const [row, setRow] = useState<QueueRow | null>(null);
  const [ahead, setAhead] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("queues")
      .select(
        "id, queue_number, daily_seq, service_type, service_code, customer_name, status, queue_date, created_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      setState("notfound");
      return;
    }
    setRow(data as QueueRow);
    setState("ready");

    if (data.status === "waiting") {
      const { count } = await supabase
        .from("queues")
        .select("id", { count: "exact", head: true })
        .eq("queue_date", data.queue_date)
        .eq("service_type", data.service_type)
        .eq("status", "waiting")
        .lt("daily_seq", data.daily_seq);
      setAhead(count ?? 0);
    } else {
      setAhead(0);
    }
  }, [id, supabase]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`queue-watch-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queues" },
        () => load(),
      )
      .subscribe();

    // Fallback polling bila realtime tidak tersambung
    const poll = setInterval(load, 20_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [id, load, supabase]);

  if (state === "loading") {
    return (
      <PageShell>
        <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Memuat tiket…
        </div>
      </PageShell>
    );
  }

  if (state === "notfound" || !row) {
    return (
      <PageShell back={{ href: "/" }}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <XCircle className="size-10 text-muted-foreground" />
          <p className="font-medium">Tiket tidak ditemukan</p>
          <p className="text-sm text-muted-foreground">
            Tiket antrean hanya berlaku pada hari yang sama. Silakan ambil nomor baru.
          </p>
          <Button render={<Link href="/queue/new" />} className="mt-2">
            Ambil Nomor Antrean
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell back={{ href: "/" }}>
      <div className="flex flex-col items-center rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/10">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Nomor Antrean Anda
        </span>
        <span className="my-2 text-6xl font-bold tracking-tight tabular-nums">
          {row.queue_number}
        </span>
        <QueueStatusBadge status={row.status} />
        <span className="mt-3 text-sm text-muted-foreground">
          {SERVICE_TYPE_LABEL[row.service_type]}
        </span>
      </div>

      {row.status === "waiting" ? (
        <div className="mt-4 flex flex-col items-center rounded-xl bg-amber-50 p-5 text-center ring-1 ring-amber-200">
          <span className="text-sm text-amber-800">Antrean di depan Anda</span>
          <span className="text-4xl font-bold tabular-nums text-amber-900">
            {ahead ?? <Loader2 className="inline size-6 animate-spin" />}
          </span>
          <span className="mt-1 text-xs text-amber-700">
            Nomor diperbarui otomatis. Mohon tetap di area toko.
          </span>
        </div>
      ) : null}

      {row.status === "serving" ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
          <BellRing className="size-6 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-800">Giliran Anda!</p>
            <p className="text-sm text-emerald-700">Silakan menuju meja depan.</p>
          </div>
        </div>
      ) : null}

      {row.status === "completed" ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <CheckCircle2 className="size-6 shrink-0 text-slate-500" />
          <p className="text-sm text-slate-600">
            Antrean selesai dilayani. Terima kasih.
          </p>
        </div>
      ) : null}

      {row.status === "canceled" ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-rose-50 p-5 ring-1 ring-rose-200">
          <XCircle className="size-6 shrink-0 text-rose-500" />
          <p className="text-sm text-rose-700">Antrean dibatalkan.</p>
        </div>
      ) : null}

      <dl className="mt-4 space-y-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Nama</dt>
          <dd className="font-medium">{row.customer_name}</dd>
        </div>
        {row.service_code ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">No. Tiket Servis</dt>
            <dd className="font-medium">{row.service_code}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Waktu ambil</dt>
          <dd className="font-medium">{formatDateTimeWIB(row.created_at)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Simpan atau screenshot halaman ini sebagai bukti antrean.
      </p>
    </PageShell>
  );
}
