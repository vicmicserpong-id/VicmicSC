import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";

import { Workbench } from "./workbench";

export const metadata = { title: "Workbench Teknisi" };
export const dynamic = "force-dynamic";

export default async function WorkbenchPage() {
  const staff = await getStaff();
  const supabase = await createClient();

  const [{ data: active }, { count: pool }, { data: profiles }, { data: lastChange }] =
    await Promise.all([
      supabase
        .from("service_tickets")
        .select(
          "id, ticket_number, customer_name, product_description, status, warranty_status, serial_number, wo_rma_number, complaint_description, assigned_technician, created_at, updated_at",
        )
        .not("status", "in", "(INTAKE,CLOSED,CANCELLED)")
        .order("updated_at", { ascending: true }),
      supabase
        .from("service_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "INTAKE"),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("service_ticket_last_change").select("ticket_id, changed_by"),
    ]);

  return (
    <Workbench
      meId={staff.id}
      initialTickets={active ?? []}
      initialPool={pool ?? 0}
      initialProfiles={profiles ?? []}
      initialLastChange={lastChange ?? []}
    />
  );
}
