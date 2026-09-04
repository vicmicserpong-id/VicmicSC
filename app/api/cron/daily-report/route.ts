import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, recapEmailHtml, type RecapData } from "@/lib/email";
import { cleanupOldTicketPhotos } from "@/lib/cleanup";
import { todayWIB } from "@/lib/format";
import type { ServiceType } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Dijadwalkan lewat vercel.json: "0 15 * * *" (15:00 UTC = 22:00 WIB).
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const day = todayWIB();
  const startUtc = new Date(`${day}T00:00:00+07:00`);
  const start = startUtc.toISOString();
  const end = new Date(startUtc.getTime() + 86_400_000).toISOString();

  const [{ data: queues }, { count: newTickets }, { data: doneTickets }, { data: profiles }] =
    await Promise.all([
      supabase.from("queues").select("service_type").eq("queue_date", day),
      supabase
        .from("service_tickets")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start)
        .lt("created_at", end),
      supabase
        .from("service_tickets")
        .select("assigned_technician")
        .in("status", ["READY_FOR_PICKUP", "CLOSED"])
        .gte("updated_at", start)
        .lt("updated_at", end),
      supabase.from("profiles").select("id, full_name"),
    ]);

  const qByType: Record<ServiceType, number> = {
    service_baru: 0,
    pengambilan_unit: 0,
    lain_lain: 0,
  };
  (queues ?? []).forEach((q) => {
    qByType[q.service_type] += 1;
  });

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "—"]));
  const perTechMap = new Map<string, number>();
  (doneTickets ?? []).forEach((t) => {
    if (t.assigned_technician) {
      perTechMap.set(
        t.assigned_technician,
        (perTechMap.get(t.assigned_technician) ?? 0) + 1,
      );
    }
  });

  // Hapus foto tiket lama yang sudah tuntas — jaga kuota Supabase Storage
  // (best-effort, gagal di sini tidak menggagalkan rekap/email).
  let photoCleanup: { ticketsCleaned: number; filesDeleted: number; errors: string[] };
  try {
    photoCleanup = await cleanupOldTicketPhotos();
    if (photoCleanup.errors.length > 0) {
      console.error("[cron daily-report] sebagian pembersihan foto gagal:", photoCleanup.errors);
    }
  } catch (e) {
    console.error("[cron daily-report] pembersihan foto gagal:", e);
    photoCleanup = { ticketsCleaned: 0, filesDeleted: 0, errors: [(e as Error).message] };
  }

  const data: RecapData = {
    day,
    queues: qByType,
    queueTotal: (queues ?? []).length,
    newTickets: newTickets ?? 0,
    doneTotal: (doneTickets ?? []).length,
    perTech: [...perTechMap.entries()]
      .map(([id, count]) => ({ name: nameById.get(id) ?? "—", count }))
      .sort((a, b) => b.count - a.count),
    photoCleanup,
  };

  const to = process.env.RECAP_EMAIL_RECIPIENT;
  let email: { skipped: boolean; id?: string; error?: string; reason?: string };
  if (!to) {
    email = { skipped: true, reason: "RECAP_EMAIL_RECIPIENT belum diset" };
  } else {
    try {
      email = await sendEmail({
        to,
        subject: `Rekap Harian Vicmic — ${day}`,
        html: recapEmailHtml(data),
      });
    } catch (e) {
      // Kegagalan email tidak menggagalkan cron.
      console.error("[cron daily-report] email gagal:", e);
      email = { skipped: true, error: (e as Error).message };
    }
  }

  return NextResponse.json({ ok: true, data, email });
}
