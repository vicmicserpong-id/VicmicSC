import { createClient } from "@/lib/supabase/server";
import { todayWIB } from "@/lib/format";

import { QueueBoard } from "./queue-board";

export const metadata = { title: "Papan Antrean" };
export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("queues")
    .select("*")
    .eq("queue_date", todayWIB())
    .in("status", ["waiting", "serving"])
    .order("created_at", { ascending: true });

  return <QueueBoard initial={data ?? []} />;
}
