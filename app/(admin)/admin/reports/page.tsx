import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { buildMonthlyReport } from "@/lib/reports";
import { currentMonthWIB, shiftMonth } from "@/lib/format";

import { ReportActions } from "./report-actions";

export const metadata = { title: "Laporan" };
export const dynamic = "force-dynamic";

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 truncate text-muted-foreground">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[#0f172a]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-medium tabular-nums">{count}</span>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const current = currentMonthWIB();
  const yearMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : current;

  const supabase = await createClient();
  const report = await buildMonthlyReport(supabase, yearMonth);

  const prevMonth = shiftMonth(yearMonth, -1);
  const nextMonth = shiftMonth(yearMonth, 1);
  const hasNext = nextMonth <= current;

  const trendMax = Math.max(1, ...report.trend.flatMap((t) => [t.newCount, t.closedCount]));
  const warrantyMax = Math.max(1, ...report.warrantyBreakdown.map((w) => w.count));
  const statusMax = Math.max(1, ...report.statusDistribution.map((s) => s.count));
  const techMax = Math.max(1, ...report.perTechnicianClosed.map((t) => t.count));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Laporan</h1>
          <p className="text-sm text-muted-foreground">Analisa untuk pengambilan keputusan</p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/admin/reports?month=${prevMonth}`}
            className="grid size-8 place-items-center rounded-lg ring-1 ring-foreground/10 hover:bg-muted/50"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="w-40 text-center text-sm font-medium">{report.monthLabel}</span>
          {hasNext ? (
            <Link
              href={`/admin/reports?month=${nextMonth}`}
              className="grid size-8 place-items-center rounded-lg ring-1 ring-foreground/10 hover:bg-muted/50"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className="grid size-8 place-items-center rounded-lg text-muted-foreground/30">
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Unit masuk" value={report.newCount} />
        <Tile label="Unit selesai (diambil)" value={report.closedCount} />
        <Tile label="Dibatalkan" value={report.cancelledCount} />
        <Tile label="Sedang berjalan (sekarang)" value={report.activeNow} sub="snapshot saat ini" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Tile
          label="Rata-rata waktu pengerjaan"
          value={report.avgTurnaroundDays === null ? "—" : `${report.avgTurnaroundDays.toFixed(1)} hari`}
          sub="dari unit masuk sampai diambil, bulan ini"
        />
        <div className="flex flex-col justify-center gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Ekspor & kirim laporan</p>
          <ReportActions yearMonth={yearMonth} />
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div>
          <h2 className="text-sm font-semibold">Tren 6 Bulan Terakhir</h2>
          <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#0f172a]" /> Unit masuk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" /> Unit selesai
            </span>
          </div>
        </div>
        <div className="flex items-end justify-between gap-3 pt-2" style={{ height: 160 }}>
          {report.trend.map((t) => (
            <div key={t.yearMonth} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-full items-end gap-1">
                <div className="flex flex-col items-center justify-end gap-0.5">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{t.newCount}</span>
                  <div
                    className="w-4 rounded-t bg-[#0f172a]"
                    style={{ height: `${Math.max(2, (t.newCount / trendMax) * 120)}px` }}
                  />
                </div>
                <div className="flex flex-col items-center justify-end gap-0.5">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{t.closedCount}</span>
                  <div
                    className="w-4 rounded-t bg-emerald-500"
                    style={{ height: `${Math.max(2, (t.closedCount / trendMax) * 120)}px` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {t.monthLabel.split(" ")[0].slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="text-sm font-semibold">Unit Masuk per Status Garansi</h2>
          <p className="text-xs text-muted-foreground">Bulan {report.monthLabel}</p>
          <div className="mt-1 flex flex-col gap-2.5">
            {report.warrantyBreakdown.map((w) => (
              <Bar key={w.status} label={w.label} count={w.count} max={warrantyMax} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="text-sm font-semibold">Sebaran Status Saat Ini</h2>
          <p className="text-xs text-muted-foreground">Semua tiket aktif (belum selesai/batal)</p>
          <div className="mt-1 flex flex-col gap-2.5">
            {report.statusDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada tiket aktif.</p>
            ) : (
              report.statusDistribution.map((s) => (
                <Bar key={s.status} label={s.label} count={s.count} max={statusMax} />
              ))
            )}
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-sm font-semibold">Unit Selesai per Teknisi</h2>
        <p className="text-xs text-muted-foreground">Bulan {report.monthLabel}</p>
        <div className="mt-1 flex flex-col gap-2.5">
          {report.perTechnicianClosed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada unit selesai bulan ini.</p>
          ) : (
            report.perTechnicianClosed.map((t) => (
              <Bar key={t.name} label={t.name} count={t.count} max={techMax} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
