import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/constants";
import type { Database } from "@/lib/database.types";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
};

/** Notifikasi untuk role tertentu (30 terbaru) + id yang sudah dibaca oleh user ini. */
export async function getInitialNotifications(
  supabase: SupabaseClient<Database>,
  role: AppRole,
  userId: string,
): Promise<{ items: NotificationItem[]; readIds: string[] }> {
  const { data: notifs } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, created_at")
    .contains("target_roles", [role])
    .order("created_at", { ascending: false })
    .limit(30);

  const items = notifs ?? [];
  if (items.length === 0) return { items: [], readIds: [] };

  const { data: reads } = await supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", userId)
    .in(
      "notification_id",
      items.map((n) => n.id),
    );

  return { items, readIds: (reads ?? []).map((r) => r.notification_id) };
}
