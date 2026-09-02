import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";

import { StaffNav } from "@/components/shared/staff-nav";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, type AppRole } from "@/lib/constants";

const NAV: Record<"admin" | "tech", { href: string; label: string; ownerOnly?: boolean }[]> = {
  admin: [
    { href: "/admin/queue", label: "Antrean" },
    { href: "/admin/tickets", label: "Daftar Servis" },
    { href: "/admin/intake/new", label: "Servis Baru" },
    { href: "/admin/pickup", label: "Pengambilan" },
    { href: "/admin/reports", label: "Laporan" },
    { href: "/admin/staff", label: "Staf", ownerOnly: true },
  ],
  tech: [{ href: "/tech/workbench", label: "Workbench" }],
};

export function StaffShell({
  area,
  name,
  role,
  children,
}: {
  area: "admin" | "tech";
  name: string;
  role: AppRole;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
          <Link href={NAV[area][0].href} className="flex items-center gap-2">
            <Image src="/logo-mark.png" alt="Vicmic" width={28} height={28} priority />
            <span className="text-sm font-semibold tracking-tight">Vicmic</span>
          </Link>

          <StaffNav
            items={NAV[area].filter((i) => !i.ownerOnly || role === "owner")}
          />

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
            </div>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="size-3.5" /> Keluar
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
