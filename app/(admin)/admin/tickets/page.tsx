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
        "id, ticket_number, customer_name, product_description, status, assigned_technician, updated_at",
      )
      .order("updated_at", { ascending: true })
      .limit(300),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("service_ticket_last_change").select("ticket_id, changed_by"),
  ]);

  return (
    <TicketBoard
      initialTickets={tickets ?? []}
      initialProfiles={profiles ?? []}
      initialLastChange={lastChange ?? []}
    />
  );
}
