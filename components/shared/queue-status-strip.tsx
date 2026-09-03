"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Users, Megaphone, RefreshCw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import type { ServiceType } from "@/lib/constants";
import { formatDateTimeWIB } from "@/lib/format";

export type QueueSummary = {
  waiting_total: number;
  serving_total: number;
  waiting_by_type: Partial<Record<ServiceType, number>>;
  now_serving: string[];
  as_of: string;
};

const TYPE_SHORT: Record<ServiceType, string> = {
  service_baru: "Servis baru",
  pengambilan_unit: "Pengambilan",
  lain_lain: "Lain-lain",
};

function normalize(raw: unknown): QueueSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    waiting_total: Number(r.waiting_total ?? 0),
    serving_total: Number(r.serving_total ?? 0),
    waiting_by_type: (r.waiting_by_type as QueueSummary["waiting_by_type"]) ?? {},
    now_serving: Array.isArray(r.now_serving) ? (r.now_serving as string[]) : [],
    as_of: typeof r.as_of === "string" ? r.as_of : new Date().toISOString(),
  };
}

export function QueueStatusStrip({ initial }: { initial: QueueSummary | null }) {
  const [data, setData] = useState<QueueSummary | null>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data: raw } = await supabase.rpc("public_queue_summary");
    const next = normalize(raw);
    if (next) setData(next);
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("portal-queue-summary")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queues" },
        () => load(),
      )
      .subscribe();

    // Fallback bila realtime tidak tersambung
    const poll = setInterval(load, 20_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [load, supabase]);

  if (!data) return null;

  const byType = (Object.keys(TYPE_SHORT) as ServiceType[])
    .map((t) => ({ label: TYPE_SHORT[t], n: data.waiting_by_type[t] ?? 0 }))
    .filter((x) => x.n > 0);

  const quiet = data.waiting_total === 0 && data.serving_total === 0;

  return (
    <div className="mb-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      {quiet ? (
        <p className="text-center text-sm text-muted-foreground">
          Belum ada antrean hari ini. Silakan langsung ambil nomor.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
              <Users className="size-5" />
            </span>
            <div className="leading-tight">
              <span className="text-2xl font-bold tabular-nums">{data.waiting_total}</span>{" "}
              <span className="text-sm text-muted-foreground">orang menunggu</span>
              {byType.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {byType.map((x) => `${x.label} ${x.n}`).join(" · ")}
                </p>
              )}
            </div>
          </div>

          {data.now_serving.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm ring-1 ring-emerald-200">
              <Megaphone className="size-4 shrink-0 text-emerald-600" />
              <span className="text-emerald-800">
                Sedang dipanggil:{" "}
                <span className="font-semibold tabular-nums">
                  {data.now_serving.join(", ")}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
        Diperbarui {formatDateTimeWIB(data.as_of)} WIB
      </p>
    </div>
  );
}
