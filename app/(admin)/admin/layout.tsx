import { StaffShell } from "@/components/shared/staff-shell";
import { getStaff } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getStaff();
  return (
    <StaffShell area="admin" name={staff.name} role={staff.role}>
      {children}
    </StaffShell>
  );
}
