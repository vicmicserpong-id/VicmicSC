"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Label + spinner kecil selama link ini sedang dinavigasi (Next 15 useLinkStatus). */
function NavLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {pending && <Loader2 className="size-3 shrink-0 animate-spin opacity-70" />}
    </span>
  );
}

export function StaffNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav
      className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Menu"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors md:py-1.5",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <NavLabel label={item.label} />
          </Link>
        );
      })}
    </nav>
  );
}
