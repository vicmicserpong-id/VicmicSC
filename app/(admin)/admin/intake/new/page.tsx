import { createClient } from "@/lib/supabase/server";

import { IntakeForm } from "./intake-form";

export const metadata = { title: "Servis Baru" };
export const dynamic = "force-dynamic";

export default async function IntakeNewPage({
  searchParams,
}: {
  searchParams: Promise<{ queue_id?: string }>;
}) {
  const { queue_id } = await searchParams;

  let prefill: {
    queue_id: string;
    customer_name: string;
    customer_phone: string;
  } | null = null;

  if (queue_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("queues")
      .select("id, customer_name, customer_phone, service_type")
      .eq("id", queue_id)
      .maybeSingle();
    if (data) {
      prefill = {
        queue_id: data.id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
      };
    }
  }

  return <IntakeForm prefill={prefill} />;
}
