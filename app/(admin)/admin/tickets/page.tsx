import { createClient } from "@/lib/supabase/server";

import { TicketBoard } from "./ticket-board";

export const metadata = { title: "Daftar Servis" };
export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  const supabase = await createClient();

  const [{ data: tickets }, { data: profiles }, { data: lastChange }] = await Promise.all([
    supabase
      .from("service_tickets")
      .select(
        "id, ticket_number, customer_name, customer_phone, product_description, status, assigned_technician, created_at, updated_at, part_status",
      )
      .order("updated_at", { ascending: true })
      .limit(500),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("service_ticket_last_change").select("ticket_id, changed_by, changed_at"),
  ]);

  return (
    <TicketBoard
      initialTickets={tickets ?? []}
      initialProfiles={profiles ?? []}
      initialLastChange={lastChange ?? []}
    />
  );
}
