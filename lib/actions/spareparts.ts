"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireWorkbench, requireFrontDesk } from "@/lib/auth";
import { PART_REQUEST_ELIGIBLE_STATUSES } from "@/lib/constants";

function revalidateTicketPaths(ticketId: string) {
  revalidatePath(`/tech/workbench/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/tech/workbench");
  revalidatePath("/admin/tickets");
}

/**
 * Teknisi/owner mengajukan permintaan sparepart — TIDAK mengubah status tiket,
 * hanya mencatat kebutuhan part + notifikasi ke admin. Admin yang lanjut
 * memindahkan status lewat markPartOrdered/markPartArrived di bawah.
 */
export async function requestSparepart(ticketId: string, note: string) {
  const staff = await requireWorkbench();
  if (!note.trim()) throw new Error("Sebutkan sparepart yang dibutuhkan.");

  const supabase = await createClient();
  const { data: ticket, error: readErr } = await supabase
    .from("service_tickets")
    .select("id, ticket_number, status")
    .eq("id", ticketId)
    .single();
  if (readErr || !ticket) throw new Error("Tiket tidak ditemukan.");
  if (!PART_REQUEST_ELIGIBLE_STATUSES.includes(ticket.status)) {
    throw new Error("Sparepart hanya bisa diminta saat unit sedang didiagnosa/diperbaiki.");
  }

  const { error } = await supabase
    .from("service_tickets")
    .update({ part_notes: note.trim(), part_status: "requested" })
    .eq("id", ticketId);
  if (error) throw new Error(error.message);

  await supabase.from("service_ticket_logs").insert({
    ticket_id: ticketId,
    previous_status: ticket.status,
    new_status: ticket.status,
    changed_by: staff.id,
    notes: `Minta sparepart: ${note.trim()}`,
  });

  await supabase.from("notifications").insert({
    target_roles: ["admin", "owner"],
    type: "part_requested",
    title: "Sparepart diminta",
    body: `${ticket.ticket_number} — ${note.trim()}`,
    link: `/admin/tickets/${ticketId}`,
    ticket_id: ticketId,
  });

  revalidateTicketPaths(ticketId);
}

/** Admin/owner menandai sparepart sudah dipesan -> status jadi "Menunggu sparepart". */
export async function markPartOrdered(ticketId: string) {
  const staff = await requireFrontDesk();
  const supabase = await createClient();

  const { data: ticket, error: readErr } = await supabase
    .from("service_tickets")
    .select("id, status, part_status")
    .eq("id", ticketId)
    .single();
  if (readErr || !ticket) throw new Error("Tiket tidak ditemukan.");
  if (ticket.part_status !== "requested") {
    throw new Error("Belum ada permintaan sparepart yang menunggu diproses.");
  }

  const { error, data: updated } = await supabase
    .from("service_tickets")
    .update({ status: "WAITING_PART", part_status: "ordered" })
    .eq("id", ticketId)
    .eq("status", ticket.status)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Status tiket sudah berubah. Muat ulang halaman.");

  await supabase.from("service_ticket_logs").insert({
    ticket_id: ticketId,
    previous_status: ticket.status,
    new_status: "WAITING_PART",
    changed_by: staff.id,
    notes: "Sparepart sudah dipesan.",
  });

  revalidateTicketPaths(ticketId);
}

/**
 * Admin/owner menandai sparepart sudah tiba -> status jadi PART_ARRIVED
 * ("Part tiba"), notif teknisi. SENGAJA berhenti di sini, tidak langsung
 * PART_INSTALLING — supaya tidak ada teknisi lain yang salah kira unit
 * sudah mulai/selesai dipasang padahal partnya baru sampai. Teknisi sendiri
 * yang pindah ke PART_INSTALLING lewat updateTicketStatus begitu benar-benar
 * mulai memasang (lihat TICKET_STATUS_FLOW).
 */
export async function markPartArrived(ticketId: string) {
  const staff = await requireFrontDesk();
  const supabase = await createClient();

  const { data: ticket, error: readErr } = await supabase
    .from("service_tickets")
    .select("id, ticket_number, product_description, status, part_status")
    .eq("id", ticketId)
    .single();
  if (readErr || !ticket) throw new Error("Tiket tidak ditemukan.");
  if (ticket.status !== "WAITING_PART" || ticket.part_status !== "ordered") {
    throw new Error('Sparepart belum berstatus "sudah dipesan".');
  }

  const { error, data: updated } = await supabase
    .from("service_tickets")
    .update({ status: "PART_ARRIVED", part_status: "arrived" })
    .eq("id", ticketId)
    .eq("status", "WAITING_PART")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Status tiket sudah berubah. Muat ulang halaman.");

  await supabase.from("service_ticket_logs").insert({
    ticket_id: ticketId,
    previous_status: "WAITING_PART",
    new_status: "PART_ARRIVED",
    changed_by: staff.id,
    notes: "Sparepart sudah tiba.",
  });

  await supabase.from("notifications").insert({
    target_roles: ["technician", "owner"],
    type: "part_arrived",
    title: "Sparepart tiba",
    body: `${ticket.ticket_number} — ${ticket.product_description}. Siap dipasang.`,
    link: `/tech/workbench/${ticketId}`,
    ticket_id: ticketId,
  });

  revalidateTicketPaths(ticketId);
}
