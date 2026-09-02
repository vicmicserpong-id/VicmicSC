"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { TICKET_STATUS_FLOW, type TicketStatus } from "@/lib/constants";
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
  // PostgREST mengembalikan baris berisi null (bukan null) saat tak ada tiket.
  if (!data || !data.id) return null;
  return { id: data.id, ticket_number: data.ticket_number };
}

export type StatusChange = {
  ticketId: string;
  from: TicketStatus;
  to: TicketStatus;
  notes?: string;
  estimated_cost?: number;
  final_cost?: number;
  part_notes?: string;
  qc_notes?: string;
};

/** Ubah status tiket + catat log. Memvalidasi transisi & mengunci status asal. */
export async function updateTicketStatus(input: StatusChange) {
  const { supabase, user } = await requireUser();

  const allowed = TICKET_STATUS_FLOW[input.from] ?? [];
  if (!allowed.includes(input.to)) {
    throw new Error(`Transisi ${input.from} → ${input.to} tidak diizinkan.`);
  }

  const patch: TicketUpdate = { status: input.to };
  if (typeof input.estimated_cost === "number")
    patch.estimated_cost = Math.max(0, Math.round(input.estimated_cost));
  if (typeof input.final_cost === "number")
    patch.final_cost = Math.max(0, Math.round(input.final_cost));
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

  revalidatePath(`/tech/workbench/${input.ticketId}`);
  revalidatePath("/tech/workbench");
}
