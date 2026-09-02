import { createClient } from "@/lib/supabase/server";

import { CustomerDirectory } from "./customer-directory";

export const metadata = { title: "Pelanggan" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customer_directory")
    .select("phone, name, email, total_tickets, first_visit, last_visit, last_product, last_status")
    .order("last_visit", { ascending: false });

  return <CustomerDirectory initialCustomers={customers ?? []} />;
}
