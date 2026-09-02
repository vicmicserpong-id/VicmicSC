import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { EditTicketForm } from "./edit-ticket-form";

export const metadata = { title: "Edit Tiket" };
export const dynamic = "force-dynamic";

export default async function EditTicketPage({
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

  return <EditTicketForm ticket={ticket} />;
}
