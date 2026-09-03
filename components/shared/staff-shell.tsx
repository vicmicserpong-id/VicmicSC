import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";

import { StaffNav } from "@/components/shared/staff-nav";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ChangePassword } from "@/components/shared/change-password";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, type AppRole } from "@/lib/constants";
import type { NotificationItem } from "@/lib/notifications";

const NAV: Record<"admin" | "tech", { href: string; label: string; ownerOnly?: boolean }[]> = {
  admin: [
    { href: "/admin/queue", label: "Antrean" },
    { href: "/admin/tickets", label: "Daftar Servis" },
    { href: "/admin/intake/new", label: "Servis Baru" },
    { href: "/admin/pickup", label: "Pengambilan" },
    { href: "/admin/reports", label: "Laporan" },
    { href: "/admin/customers", label: "Pelanggan" },
    { href: "/admin/staff", label: "Staf", ownerOnly: true },
  ],
  tech: [{ href: "/tech/workbench", label: "Workbench" }],
};

export function StaffShell({
  area,
  name,
  role,
  notifications,
  notificationReadIds,
  children,
}: {
  area: "admin" | "tech";
  name: string;
  role: AppRole;
  notifications: NotificationItem[];
  notificationReadIds: string[];
  children: React.ReactNode;
}) {
  const items = NAV[area].filter((i) => !i.ownerOnly || role === "owner");

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background">
        {/* Baris 1: identitas + aksi akun */}
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link href={items[0].href} className="flex shrink-0 items-center gap-2">
            <Image src="/logo-mark.png" alt="Vicmic" width={26} height={26} priority />
            <span className="text-sm font-semibold tracking-tight">Vicmic</span>
          </Link>

          {/* Nav inline hanya di layar lebar */}
          <div className="ml-2 hidden min-w-0 flex-1 md:block">
            <StaffNav items={items} />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <NotificationBell
              role={role}
              initialItems={notifications}
              initialReadIds={notificationReadIds}
            />
            <div className="hidden max-w-[16ch] text-right leading-tight sm:block">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
            </div>
            <ChangePassword />
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm" aria-label="Keluar">
                <LogOut className="size-4 sm:size-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Baris 2: nav gulir penuh-lebar, hanya di layar kecil */}
        <div className="border-t bg-background md:hidden">
          <div className="mx-auto w-full max-w-5xl px-2 py-1">
            <StaffNav items={items} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-5 sm:px-4 sm:py-6">{children}</main>
    </div>
  );
}
