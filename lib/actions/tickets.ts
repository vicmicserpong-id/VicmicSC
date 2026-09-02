"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { sendEmail, readyEmailHtml } from "@/lib/email";
import { TICKET_STATUS_FLOW, type AppRole, type TicketStatus } from "@/lib/constants";
import type { Database } from "@/lib/database.types";

type TicketUpdate = Database["public"]["Tables"]["service_tickets"]["Update"];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi berakhir. Silakan masuk ulang.");
  return { supabase, user };
}

async function myRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<AppRole> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return (data?.role ?? "admin") as AppRole;
}

/** Tarik tiket INTAKE tertua ke teknisi (FIFO, atomik lewat RPC). */
export async function pullNextTicket(): Promise<
  { id: string; ticket_number: string } | null
> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.rpc("pull_next_ticket", {
    p_technician: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/tech/workbench");
  revalidatePath("/admin/board");
  // PostgREST mengembalikan baris berisi null (bukan null) saat tak ada tiket.
  if (!data || !data.id) return null;
  return { id: data.id, ticket_number: data.ticket_number };
}

export type StatusChange = {
  ticketId: string;
  from: TicketStatus;
  to: TicketStatus;
  notes?: string;
  part_notes?: string;
  qc_notes?: string;
};

/**
 * Ubah status tiket + catat log (siapa yang mengubah selalu tercatat).
 * - Teknisi: hanya boleh mengikuti TICKET_STATUS_FLOW (alur maju/terdefinisi),
 *   tidak bisa memundurkan status semaunya.
 * - Admin / owner: bebas pindah ke status apa pun (koreksi), TAPI wajib
 *   mengisi catatan alasan perubahan.
 */
export async function updateTicketStatus(input: StatusChange) {
  const { supabase, user } = await requireUser();
  const role = await myRole(supabase, user.id);
  const isFreeform = role === "admin" || role === "owner";

  if (input.to === input.from) {
    throw new Error("Status tujuan sama dengan status saat ini.");
  }

  if (isFreeform) {
    if (!input.notes?.trim()) {
      throw new Error("Wajib isi catatan alasan perubahan status.");
    }
  } else {
    const allowed = TICKET_STATUS_FLOW[input.from] ?? [];
    if (!allowed.includes(input.to)) {
      throw new Error(`Transisi ${input.from} → ${input.to} tidak diizinkan.`);
    }
  }

  const patch: TicketUpdate = { status: input.to };
  if (input.part_notes !== undefined) patch.part_notes = input.part_notes.trim() || null;
  if (input.qc_notes !== undefined) patch.qc_notes = input.qc_notes.trim() || null;

  const { data: updated, error } = await supabase
    .from("service_tickets")
    .update(patch)
    .eq("id", input.ticketId)
    .eq("status", input.from)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Status tiket sudah berubah. Muat ulang halaman.");

  await supabase.from("service_ticket_logs").insert({
    ticket_id: input.ticketId,
    previous_status: input.from,
    new_status: input.to,
    changed_by: user.id,
    notes: input.notes?.trim() || null,
  });

  // Notifikasi "siap diambil" ke pelanggan (best-effort — tidak menggagalkan aksi).
  if (input.to === "READY_FOR_PICKUP") {
    const { data: t } = await supabase
      .from("service_tickets")
      .select("ticket_number, customer_name, customer_email, product_description")
      .eq("id", input.ticketId)
      .single();
    if (t?.customer_email) {
      try {
        await sendEmail({
          to: t.customer_email,
          subject: `Unit ${t.ticket_number} siap diambil — Vicmic Service`,
          html: readyEmailHtml(t),
        });
      } catch (e) {
        console.error("[notify ready] gagal kirim email:", e);
      }
    }
  }

  revalidatePath(`/tech/workbench/${input.ticketId}`);
  revalidatePath(`/admin/tickets/${input.ticketId}`);
  revalidatePath("/tech/workbench");
  revalidatePath("/admin/board");
}
