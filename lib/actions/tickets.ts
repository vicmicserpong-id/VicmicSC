"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { sendEmail, readyEmailHtml } from "@/lib/email";
import { TICKET_STATUS_FLOW, type AppRole, type TicketStatus } from "@/lib/constants";
import { todayWIB } from "@/lib/format";
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
  revalidatePath("/admin/tickets");
  // PostgREST mengembalikan baris berisi null (bukan null) saat tak ada tiket.
  if (!data || !data.id) return null;
  return { id: data.id, ticket_number: data.ticket_number };
}

export type StatusChange = {
  ticketId: string;
  from: TicketStatus;
  to: TicketStatus;
  notes?: string;
  diagnosis_notes?: string;
  qc_notes?: string;
};

/**
 * Ubah status tiket + catat log (siapa yang mengubah selalu tercatat).
 * - Teknisi: hanya boleh mengikuti TICKET_STATUS_FLOW (alur maju/terdefinisi),
 *   tidak bisa memundurkan status semaunya, dan tidak bisa menarik tiket INTAKE
 *   di luar FIFO.
 * - Admin: HANYA boleh mengubah READY_FOR_PICKUP → CLOSED (menyerahkan unit ke
 *   pelanggan) — tidak boleh mengubah status bolak-balik di titik lain.
 * - Owner: bebas pindah ke status apa pun (koreksi), TAPI wajib mengisi catatan
 *   alasan perubahan.
 */
export async function updateTicketStatus(input: StatusChange) {
  const { supabase, user } = await requireUser();
  const role = await myRole(supabase, user.id);

  if (input.to === input.from) {
    throw new Error("Status tujuan sama dengan status saat ini.");
  }

  if (role === "owner") {
    if (!input.notes?.trim()) {
      throw new Error("Wajib isi catatan alasan perubahan status.");
    }
  } else if (role === "admin") {
    if (input.from !== "READY_FOR_PICKUP" || input.to !== "CLOSED") {
      throw new Error(
        'Admin hanya bisa mengubah status "Siap Diambil" menjadi "Selesai/Diambil". Untuk koreksi status lain, hubungi owner.',
      );
    }
  } else {
    if (input.from === "INTAKE") {
      throw new Error(
        'Tiket baru harus ditarik lewat tombol "Tarik Tiket Berikutnya" (FIFO), bukan diubah langsung.',
      );
    }
    const allowed = TICKET_STATUS_FLOW[input.from] ?? [];
    if (!allowed.includes(input.to)) {
      throw new Error(`Transisi ${input.from} → ${input.to} tidak diizinkan.`);
    }
  }

  const patch: TicketUpdate = { status: input.to };
  if (input.diagnosis_notes !== undefined)
    patch.diagnosis_notes = input.diagnosis_notes.trim() || null;
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
    notes: input.notes?.trim() || (input.to === "CLOSED" ? "Unit diserahkan ke pelanggan." : null),
  });

  // Tutup antrean pengambilan terkait bila ada (samakan dgn alur /admin/pickup).
  if (input.to === "CLOSED") {
    const { data: t } = await supabase
      .from("service_tickets")
      .select("ticket_number")
      .eq("id", input.ticketId)
      .single();
    if (t) {
      await supabase
        .from("queues")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("service_code", t.ticket_number)
        .eq("queue_date", todayWIB())
        .in("status", ["waiting", "serving"]);
    }
    revalidatePath("/admin/queue");
  }

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
  revalidatePath("/admin/tickets");
}
