"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_ROLES, type AppRole } from "@/lib/constants";

export async function createStaff(input: {
  email: string;
  password: string;
  full_name: string;
  role: AppRole;
}) {
  await requireOwner();

  const email = input.email.trim().toLowerCase();
  const name = input.full_name.trim();
  if (!email || !name) throw new Error("Email dan nama wajib diisi.");
  if (input.password.length < 8) throw new Error("Password minimal 8 karakter.");
  if (!APP_ROLES.includes(input.role)) throw new Error("Role tidak valid.");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: name, role: input.role },
  });
  if (error) throw new Error(error.message);

  // Trigger handle_new_user membuat profil dari metadata; pastikan role & nama benar.
  if (data.user) {
    await admin
      .from("profiles")
      .update({ full_name: name, role: input.role })
      .eq("id", data.user.id);
  }

  revalidatePath("/admin/staff");
}

export async function setStaffRole(userId: string, role: AppRole) {
  const me = await requireOwner();
  if (!APP_ROLES.includes(role)) throw new Error("Role tidak valid.");
  if (userId === me.id && role !== "owner") {
    throw new Error("Anda tidak bisa menurunkan role diri sendiri.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/staff");
}

export async function resetStaffPassword(userId: string, password: string) {
  await requireOwner();
  if (password.length < 8) throw new Error("Password minimal 8 karakter.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
}
