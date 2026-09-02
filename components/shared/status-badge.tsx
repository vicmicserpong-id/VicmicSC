import { Badge } from "@/components/ui/badge";
import {
  QUEUE_STATUS_LABEL,
  TICKET_STATUS_LABEL,
  type QueueStatus,
  type TicketStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const TICKET_TONE: Record<TicketStatus, string> = {
  INTAKE: "bg-slate-100 text-slate-700",
  DIAGNOSING: "bg-blue-100 text-blue-700",
  WAITING_APPROVAL: "bg-amber-100 text-amber-800",
  WAITING_PART: "bg-amber-100 text-amber-800",
  PART_INSTALLING: "bg-indigo-100 text-indigo-700",
  IN_REPAIR: "bg-blue-100 text-blue-700",
  QC_TESTING: "bg-violet-100 text-violet-700",
  READY_FOR_PICKUP: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

const QUEUE_TONE: Record<QueueStatus, string> = {
  waiting: "bg-amber-100 text-amber-800",
  serving: "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-100 text-slate-600",
  canceled: "bg-rose-100 text-rose-700",
};

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn(TICKET_TONE[status], className)}>
      {TICKET_STATUS_LABEL[status]}
    </Badge>
  );
}

export function QueueStatusBadge({
  status,
  className,
}: {
  status: QueueStatus;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn(QUEUE_TONE[status], className)}>
      {QUEUE_STATUS_LABEL[status]}
    </Badge>
  );
}
