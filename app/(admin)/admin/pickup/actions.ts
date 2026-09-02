"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { todayWIB } from "@/lib/format";

export async function closeTicket(ticketId: string, finalCost: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi berakhir. Silakan masuk ulang.");

  const { data: current, error: readErr } = await supabase
    .from("service_tickets")
    .select("id, ticket_number, status")
    .eq("id", ticketId)
    .single();
  if (readErr || !current) throw new Error("Tiket tidak ditemukan.");
  if (current.status !== "READY_FOR_PICKUP") {
    throw new Error("Unit belum berstatus siap diambil.");
  }

  const { error } = await supabase
    .from("service_tickets")
    .update({ status: "CLOSED", final_cost: Math.max(0, Math.round(finalCost)) })
    .eq("id", ticketId);
  if (error) throw new Error(error.message);

  await supabase.from("service_ticket_logs").insert({
    ticket_id: ticketId,
    previous_status: "READY_FOR_PICKUP",
    new_status: "CLOSED",
    changed_by: user.id,
    notes: `Unit diserahkan ke pelanggan. Pelunasan Rp ${Math.round(finalCost).toLocaleString("id-ID")}`,
  });

  // Tutup antrean pengambilan terkait bila ada
  await supabase
    .from("queues")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("service_code", current.ticket_number)
    .eq("queue_date", todayWIB())
    .in("status", ["waiting", "serving"]);

  revalidatePath("/admin/queue");
}
