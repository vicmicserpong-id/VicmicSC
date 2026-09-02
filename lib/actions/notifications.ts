"use server";

import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi berakhir. Silakan masuk ulang.");
  return { supabase, user };
}

/** Tandai satu notifikasi sudah dibaca oleh staf yang sedang login. */
export async function markNotificationRead(notificationId: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("notification_reads")
    .upsert({ notification_id: notificationId, user_id: user.id });
}

/** Tandai beberapa notifikasi sekaligus (mis. "Tandai semua dibaca"). */
export async function markNotificationsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  const { supabase, user } = await requireUser();
  await supabase
    .from("notification_reads")
    .upsert(notificationIds.map((id) => ({ notification_id: id, user_id: user.id })));
}
