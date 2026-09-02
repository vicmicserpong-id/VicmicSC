import { createClient } from "@/lib/supabase/server";

import { Board } from "./board";

export const metadata = { title: "Papan Status" };
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const supabase = await createClient();

  const [{ data: tickets }, { data: profiles }] = await Promise.all([
    supabase
      .from("service_tickets")
      .select(
        "id, ticket_number, customer_name, product_description, status, assigned_technician, updated_at",
      )
      .order("updated_at", { ascending: true })
      .limit(300),
    supabase.from("profiles").select("id, full_name"),
  ]);

  return <Board initialTickets={tickets ?? []} initialProfiles={profiles ?? []} />;
}
