import { redirect } from "next/navigation";

import { getStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayBoundsWIB } from "@/lib/format";
import type { AppRole } from "@/lib/constants";

import { StaffManager, type StaffRow } from "./staff-manager";
import { DangerZone } from "./danger-zone";

export const metadata = { title: "Kelola Staf" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const me = await getStaff();
  if (me.role !== "owner") redirect("/admin/queue");

  const admin = createAdminClient();
  const { day, start, end } = todayBoundsWIB();

  const [
    { data: list },
    { data: profiles },
    { count: queueCount },
    { count: ticketCount },
    { count: totalQueueCount },
    { count: totalTicketCount },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin.from("profiles").select("id, full_name, role, created_at"),
    admin.from("queues").select("id", { count: "exact", head: true }).eq("queue_date", day),
    admin
      .from("service_tickets")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", end),
    admin.from("queues").select("id", { count: "exact", head: true }),
    admin.from("service_tickets").select("id", { count: "exact", head: true }),
  ]);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const staff: StaffRow[] = (list?.users ?? [])
    .map((u) => {
      const p = byId.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "-",
        full_name: p?.full_name ?? u.email ?? "-",
        role: (p?.role ?? "admin") as AppRole,
        created_at: p?.created_at ?? u.created_at ?? "",
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="flex flex-col gap-8">
      <StaffManager meId={me.id} initial={staff} />
      <DangerZone
        todayQueues={queueCount ?? 0}
        todayTickets={ticketCount ?? 0}
        totalQueues={totalQueueCount ?? 0}
        totalTickets={totalTicketCount ?? 0}
      />
    </div>
  );
}
