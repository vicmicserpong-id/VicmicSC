"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireFrontDesk } from "@/lib/auth";
import type { AccessoriesShape, WarrantyStatus } from "@/lib/constants";
import type { Json } from "@/lib/database.types";

export type TicketDataPatch = {
  customer_name: string;
  customer_phone: string;
  customer_phone_alt: string | null;
  customer_email: string | null;
  product_description: string;
  mtm_number: string | null;
  serial_number: string | null;
  wo_rma_number: string | null;
  warranty_status: WarrantyStatus;
  accessories: AccessoriesShape;
  complaint_description: string;
  physical_condition_tags: string[];
  physical_notes: string | null;
};

/** Koreksi data tiket (mis. salah ketik saat intake). Admin/owner saja, bukan teknisi. */
export async function updateTicketData(ticketId: string, patch: TicketDataPatch) {
  await requireFrontDesk();

  if (!patch.customer_name.trim() || !patch.customer_phone.trim()) {
    throw new Error("Nama dan nomor WhatsApp wajib diisi.");
  }
  if (!patch.product_description.trim() || !patch.complaint_description.trim()) {
    throw new Error("Deskripsi unit dan keluhan wajib diisi.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_tickets")
    .update({
      customer_name: patch.customer_name.trim(),
      customer_phone: patch.customer_phone.trim(),
      customer_phone_alt: patch.customer_phone_alt?.trim() || null,
      customer_email: patch.customer_email?.trim() || null,
      product_description: patch.product_description.trim(),
      mtm_number: patch.mtm_number?.trim() || null,
      serial_number: patch.serial_number?.trim() || null,
      wo_rma_number: patch.wo_rma_number?.trim() || null,
      warranty_status: patch.warranty_status,
      accessories: patch.accessories as unknown as Json,
      complaint_description: patch.complaint_description.trim(),
      physical_condition_tags: patch.physical_condition_tags,
      physical_notes: patch.physical_notes?.trim() || null,
    })
    .eq("id", ticketId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
  revalidatePath(`/tech/workbench/${ticketId}`);
  revalidatePath("/tech/workbench");
}

/** Hapus tiket servis (mis. salah input, tiket ganda). Admin/owner saja. */
export async function deleteTicket(ticketId: string) {
  await requireFrontDesk();

  const supabase = await createClient();
  const { error } = await supabase.from("service_tickets").delete().eq("id", ticketId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/tickets");
  revalidatePath("/tech/workbench");
}
