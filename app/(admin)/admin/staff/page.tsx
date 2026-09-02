import { redirect } from "next/navigation";

import { getStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/constants";

import { StaffManager, type StaffRow } from "./staff-manager";

export const metadata = { title: "Kelola Staf" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const me = await getStaff();
  if (me.role !== "owner") redirect("/admin/queue");

  const admin = createAdminClient();
  const [{ data: list }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin.from("profiles").select("id, full_name, role, created_at"),
  ]);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const staff: StaffRow[] = (list?.users ?? [])
    .map((u) => {
      const p = byId.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "-",
        full_name: p?.full_name ?? u.email ?? "-",
        role: (p?.role ?? "admin") as AppRole,
        created_at: p?.created_at ?? u.created_at ?? "",
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return <StaffManager meId={me.id} initial={staff} />;
}
