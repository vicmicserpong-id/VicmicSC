import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";

import { Workbench } from "./workbench";

export const metadata = { title: "Workbench Teknisi" };
export const dynamic = "force-dynamic";

export default async function WorkbenchPage() {
  const staff = await getStaff();
  const supabase = await createClient();

  const [{ data: mine }, { count: pool }] = await Promise.all([
    supabase
      .from("service_tickets")
      .select(
        "id, ticket_number, customer_name, product_description, status, complaint_description, created_at, updated_at",
      )
      .eq("assigned_technician", staff.id)
      .not("status", "in", "(CLOSED,CANCELLED)")
      .order("updated_at", { ascending: true }),
    supabase
      .from("service_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "INTAKE"),
  ]);

  return (
    <Workbench meId={staff.id} initialMine={mine ?? []} initialPool={pool ?? 0} />
  );
}
