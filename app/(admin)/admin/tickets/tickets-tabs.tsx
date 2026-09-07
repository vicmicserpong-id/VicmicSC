"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/tickets", label: "Aktif" },
  { href: "/admin/tickets/riwayat", label: "Riwayat" },
];

export function TicketsTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex w-fit rounded-lg bg-muted p-[3px] text-sm">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-foreground/60 hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
