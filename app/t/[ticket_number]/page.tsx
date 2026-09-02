import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Tautan pendek hasil scan QR di label unit — satu QR per tiket, tapi
 * mengarahkan ke halaman detail yang benar tergantung siapa yang scan
 * (teknisi -> Workbench, admin/owner -> Daftar Servis).
 */
export default async function TicketShortlinkPage({
  params,
}: {
  params: Promise<{ ticket_number: string }>;
}) {
  const { ticket_number } = await params;
  const staff = await getStaff(); // redirect ke /login kalau belum masuk

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("service_tickets")
    .select("id")
    .eq("ticket_number", decodeURIComponent(ticket_number))
    .maybeSingle();
  if (!ticket) notFound();

  redirect(staff.role === "technician" ? `/tech/workbench/${ticket.id}` : `/admin/tickets/${ticket.id}`);
}
