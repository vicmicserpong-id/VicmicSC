import { Check, X } from "lucide-react";

import { TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Tahapan inti — selalu tampil, apa pun jalur yang diambil tiket.
const CORE_STEPS: TicketStatus[] = [
  "INTAKE",
  "DIAGNOSING",
  "IN_REPAIR",
  "QC_TESTING",
  "READY_FOR_PICKUP",
  "CLOSED",
];

/**
 * Timeline ringkas "sudah sampai mana" di halaman detail tiket. Cuma
 * menampilkan tahap opsional (Menunggu persetujuan, jalur sparepart) kalau
 * memang pernah/sedang dilalui tiket ini — supaya tiket servis biasa yang
 * tidak pakai jalur itu tidak dipenuhi titik-titik yang tidak relevan.
 */
export function TicketProgress({
  status,
  visited,
}: {
  status: TicketStatus;
  visited: Set<TicketStatus>;
}) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-900">
        <X className="size-4 shrink-0" />
        Servis ini dibatalkan.
      </div>
    );
  }

  const steps: TicketStatus[] = ["INTAKE", "DIAGNOSING"];
  if (visited.has("WAITING_APPROVAL")) steps.push("WAITING_APPROVAL");
  steps.push("IN_REPAIR");
  if (visited.has("WAITING_PART") || visited.has("PART_ARRIVED") || visited.has("PART_INSTALLING")) {
    steps.push("WAITING_PART", "PART_ARRIVED", "PART_INSTALLING");
  }
  steps.push("QC_TESTING", "READY_FOR_PICKUP", "CLOSED");

  const currentIdx = steps.indexOf(status);

  return (
    <div className="flex items-start overflow-x-auto rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      {steps.map((s, i) => {
        const state = currentIdx < 0 ? "upcoming" : i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming";
        const isCore = CORE_STEPS.includes(s);
        return (
          <div key={s} className={cn("flex items-start", i < steps.length - 1 && "flex-1")}>
            <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  state === "done" && "bg-emerald-500 text-white",
                  state === "current" && "bg-blue-500 text-white ring-4 ring-blue-500/20",
                  state === "upcoming" && "bg-muted text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  state === "current" ? "font-semibold text-foreground" : "text-muted-foreground",
                  !isCore && "italic",
                )}
              >
                {TICKET_STATUS_LABEL[s]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "mt-3 h-0.5 flex-1 rounded-full",
                  state === "done" ? "bg-emerald-500" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
