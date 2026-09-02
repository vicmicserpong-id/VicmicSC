import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { TicketDetailView } from "@/components/shared/ticket-detail-view";

export const metadata = { title: "Detail Tiket" };
export const dynamic = "force-dynamic";

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("service_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!ticket) notFound();

  const [{ data: logs }, { data: tech }] = await Promise.all([
    supabase
      .from("service_ticket_logs")
      .select("id, previous_status, new_status, notes, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: false }),
    ticket.assigned_technician
      ? supabase
          .from("profiles")
          .select("full_name")
          .eq("id", ticket.assigned_technician)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <TicketDetailView
      ticket={ticket}
      logs={logs ?? []}
      mode="admin"
      assignedName={tech?.full_name ?? null}
      backHref="/admin/board"
      backLabel="Papan Status"
    />
  );
}
