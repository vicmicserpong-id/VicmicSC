"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { AccessoriesShape, WarrantyStatus } from "@/lib/constants";
import type { Json } from "@/lib/database.types";

export type IntakePayload = {
  queue_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_phone_alt: string | null;
  customer_email: string | null;
  product_description: string;
  mtm_number: string | null;
  serial_number: string | null;
  warranty_status: WarrantyStatus;
  accessories: AccessoriesShape;
  complaint_description: string;
  physical_condition_tags: string[];
  physical_notes: string | null;
  photos_url: string[];
  customer_signature_url: string | null;
  terms_accepted: boolean;
};

export async function createServiceTicket(
  payload: IntakePayload,
): Promise<{ id: string; ticket_number: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi berakhir. Silakan masuk ulang.");

  if (!payload.product_description.trim() || !payload.complaint_description.trim()) {
    throw new Error("Deskripsi unit dan keluhan wajib diisi.");
  }
  if (!payload.terms_accepted) {
    throw new Error("Pelanggan harus menyetujui syarat & ketentuan.");
  }

  const { data: ticketNumber, error: tnErr } = await supabase.rpc("next_ticket_number");
  if (tnErr || !ticketNumber) {
    throw new Error(tnErr?.message ?? "Gagal membuat nomor tiket.");
  }

  const { data: ticket, error } = await supabase
    .from("service_tickets")
    .insert({
      ticket_number: ticketNumber,
      queue_id: payload.queue_id,
      customer_name: payload.customer_name,
      customer_phone: payload.customer_phone,
      customer_phone_alt: payload.customer_phone_alt,
      customer_email: payload.customer_email,
      product_description: payload.product_description,
      mtm_number: payload.mtm_number,
      serial_number: payload.serial_number,
      warranty_status: payload.warranty_status,
      accessories: payload.accessories as unknown as Json,
      complaint_description: payload.complaint_description,
      physical_condition_tags: payload.physical_condition_tags,
      physical_notes: payload.physical_notes,
      photos_url: payload.photos_url,
      customer_signature_url: payload.customer_signature_url,
      terms_accepted: payload.terms_accepted,
      status: "INTAKE",
      intake_by: user.id,
    })
    .select("id, ticket_number")
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Gagal menyimpan tiket.");

  await supabase.from("service_ticket_logs").insert({
    ticket_id: ticket.id,
    previous_status: null,
    new_status: "INTAKE",
    changed_by: user.id,
    notes: "Unit diterima di meja depan",
  });

  if (payload.queue_id) {
    await supabase
      .from("queues")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", payload.queue_id);
  }

  revalidatePath("/admin/queue");
  return { id: ticket.id, ticket_number: ticket.ticket_number };
}
