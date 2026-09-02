import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { TicketDetail } from "./ticket-detail";

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

  const { data: logs } = await supabase
    .from("service_ticket_logs")
    .select("id, previous_status, new_status, notes, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: false });

  return <TicketDetail ticket={ticket} logs={logs ?? []} />;
}
