import { createClient } from "@/lib/supabase/server";
import { todayWIB } from "@/lib/format";

import { TicketsTabs } from "../tickets-tabs";
import { HistoryTable, type HistoryRow } from "./history-table";

export const metadata = { title: "Riwayat Servis" };
export const dynamic = "force-dynamic";

/** Geser tanggal "YYYY-MM-DD" sebanyak `delta` hari (kalender, bebas timezone). */
function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const nd = new Date(Date.UTC(y, m - 1, d) + delta * 86_400_000);
  return `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, "0")}-${String(
    nd.getUTCDate(),
  ).padStart(2, "0")}`;
}

const isoStart = (day: string) => new Date(`${day}T00:00:00+07:00`).toISOString();
const isoEndExclusive = (day: string) =>
  new Date(new Date(`${day}T00:00:00+07:00`).getTime() + 86_400_000).toISOString();

const SELECT =
  "id, ticket_number, customer_name, customer_phone, product_description, serial_number, wo_rma_number, warranty_status, status, created_at, updated_at";

export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const today = todayWIB();
  const isValid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

  let from = isValid(sp.from) ? sp.from! : shiftDay(today, -30);
  let to = isValid(sp.to) ? sp.to! : today;
  if (from > to) [from, to] = [to, from];

  const supabase = await createClient();
  const { data } = await supabase
    .from("service_tickets")
    .select(SELECT)
    .in("status", ["CLOSED", "CANCELLED"])
    .gte("updated_at", isoStart(from))
    .lt("updated_at", isoEndExclusive(to))
    .order("updated_at", { ascending: false })
    .limit(2000);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-lg font-semibold">Daftar Servis</h1>
          <p className="text-sm text-muted-foreground">
            Riwayat tiket selesai &amp; dibatalkan, disaring berdasarkan tanggal selesai.
          </p>
        </div>
        <TicketsTabs />
      </div>

      <HistoryTable rows={(data as HistoryRow[]) ?? []} from={from} to={to} maxToday={today} />
    </div>
  );
}
