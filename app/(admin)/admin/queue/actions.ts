"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi berakhir. Silakan masuk ulang.");
  return { supabase, user };
}

/** Panggil pelanggan: waiting -> serving. */
export async function callQueue(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("queues")
    .update({
      status: "serving",
      served_by: user.id,
      served_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "waiting");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/queue");
}

/** Kembalikan ke antrean: serving -> waiting. */
export async function recallQueue(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("queues")
    .update({ status: "waiting", served_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/queue");
}

/** Tandai selesai (dipakai untuk kategori konsultasi / lain-lain). */
export async function completeQueue(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("queues")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/queue");
}

export async function cancelQueue(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("queues")
    .update({ status: "canceled", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/queue");
}
