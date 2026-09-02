import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/constants";

export type Staff = {
  id: string;
  email: string | null;
  name: string;
  role: AppRole;
};

/**
 * Ambil staf yang sedang login untuk Server Component / layout.
 * Redirect ke /login bila belum login. Gerbang role tetap di middleware.
 */
export async function getStaff(): Promise<Staff> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    name: profile?.full_name ?? user.email ?? "Staf",
    role: (profile?.role ?? "admin") as AppRole,
  };
}

/** Seperti getStaff() tapi melempar bila bukan owner. Untuk aksi manajemen staf. */
export async function requireOwner(): Promise<Staff> {
  const staff = await getStaff();
  if (staff.role !== "owner") {
    throw new Error("Hanya owner yang boleh melakukan aksi ini.");
  }
  return staff;
}

/** Seperti getStaff() tapi melempar bila teknisi. Untuk koreksi data tiket (admin/owner). */
export async function requireFrontDesk(): Promise<Staff> {
  const staff = await getStaff();
  if (staff.role === "technician") {
    throw new Error("Hanya admin atau owner yang boleh melakukan aksi ini.");
  }
  return staff;
}

/** Seperti getStaff() tapi melempar bila admin (meja depan). Untuk aksi kerja teknisi (teknisi/owner). */
export async function requireWorkbench(): Promise<Staff> {
  const staff = await getStaff();
  if (staff.role === "admin") {
    throw new Error("Hanya teknisi atau owner yang boleh melakukan aksi ini.");
  }
  return staff;
}
