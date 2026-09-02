"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { sinceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/constants";
import type { NotificationItem } from "@/lib/notifications";
import { markNotificationRead, markNotificationsRead } from "@/lib/actions/notifications";

export function NotificationBell({
  role,
  initialItems,
  initialReadIds,
}: {
  role: AppRole;
  initialItems: NotificationItem[];
  initialReadIds: string[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [readIds, setReadIds] = useState<Set<string>>(new Set(initialReadIds));
  const [open, setOpen] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  useEffect(() => {
    const channel = supabase
      .channel("staff-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as NotificationItem & { target_roles: AppRole[] };
          if (!row.target_roles?.includes(role)) return;
          setItems((prev) => [row, ...prev].slice(0, 30));
          toast.info(row.title, { description: row.body ?? undefined });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, role]);

  const unreadCount = items.filter((i) => !readIds.has(i.id)).length;

  function openItem(item: NotificationItem) {
    if (!readIds.has(item.id)) {
      setReadIds((prev) => new Set(prev).add(item.id));
      markNotificationRead(item.id).catch(() => {});
    }
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  function markAllRead() {
    const unread = items.filter((i) => !readIds.has(i.id)).map((i) => i.id);
    if (unread.length === 0) return;
    setReadIds((prev) => new Set([...prev, ...unread]));
    markNotificationsRead(unread).catch(() => {});
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-8 place-items-center rounded-lg hover:bg-muted/50"
        aria-label="Notifikasi"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-destructive px-0.5 text-[10px] font-medium leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 flex max-h-96 w-80 flex-col overflow-hidden rounded-xl bg-popover ring-1 ring-foreground/10 shadow-lg">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Notifikasi</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Tandai semua dibaca
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  Belum ada notifikasi.
                </p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted/40",
                      !readIds.has(item.id) && "bg-muted/30",
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      {!readIds.has(item.id) && (
                        <span className="size-1.5 shrink-0 rounded-full bg-[#0f172a]" />
                      )}
                      {item.title}
                    </span>
                    {item.body && (
                      <span className="text-xs text-muted-foreground">{item.body}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {sinceShort(item.created_at)} lalu
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
