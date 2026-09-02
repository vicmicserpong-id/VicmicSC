import { StaffShell } from "@/components/shared/staff-shell";
import { getStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getInitialNotifications } from "@/lib/notifications";

export default async function TechLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getStaff();
  const supabase = await createClient();
  const { items, readIds } = await getInitialNotifications(supabase, staff.role, staff.id);
  return (
    <StaffShell
      area="tech"
      name={staff.name}
      role={staff.role}
      notifications={items}
      notificationReadIds={readIds}
    >
      {children}
    </StaffShell>
  );
}
