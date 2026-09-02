import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/url";

import { PrintLabel } from "./print-label";

export const metadata = { title: "Cetak Label" };
export const dynamic = "force-dynamic";

export default async function PrintTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("service_tickets")
    .select("ticket_number, customer_name, product_description, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!ticket) notFound();

  const qrValue = `${getAppUrl()}/t/${encodeURIComponent(ticket.ticket_number)}`;

  return <PrintLabel ticket={ticket} qrValue={qrValue} />;
}
