import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { TicketDetailView } from "@/components/shared/ticket-detail-view";

export const metadata = { title: "Detail Tiket" };
export const dynamic = "force-dynamic";

export default async function TechTicketPage({
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

  const [{ data: logs }, { data: profiles }] = await Promise.all([
    supabase
      .from("service_ticket_logs")
      .select("id, previous_status, new_status, notes, created_at, changed_by")
      .eq("ticket_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const assignedName = ticket.assigned_technician
    ? (profiles ?? []).find((p) => p.id === ticket.assigned_technician)?.full_name ?? null
    : null;

  return (
    <TicketDetailView
      ticket={ticket}
      logs={logs ?? []}
      profiles={profiles ?? []}
      mode="technician"
      assignedName={assignedName}
      backHref="/tech/workbench"
      backLabel="Workbench"
    />
  );
}
