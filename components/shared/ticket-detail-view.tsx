"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageCircle, Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { TicketStatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  TICKET_STATUS_FLOW,
  TICKET_STATUS_LABEL,
  WARRANTY_LABEL,
  ACCESSORY_LABEL,
  type AccessoriesShape,
  type TicketStatus,
} from "@/lib/constants";
import { formatDateTimeWIB, waLink } from "@/lib/format";
import type { Database } from "@/lib/database.types";
import { updateTicketStatus } from "@/lib/actions/tickets";
import { deleteTicket } from "@/app/(admin)/admin/tickets/[id]/data-actions";

type Ticket = Database["public"]["Tables"]["service_tickets"]["Row"];
type Log = Pick<
  Database["public"]["Tables"]["service_ticket_logs"]["Row"],
  "id" | "previous_status" | "new_status" | "notes" | "created_at" | "changed_by"
>;

type Profile = { id: string; full_name: string | null };

const ALL_STATUSES = Object.keys(TICKET_STATUS_LABEL) as TicketStatus[];
const HIDDEN_TARGETS: TicketStatus[] = ["CLOSED"]; // ditangani meja depan (mode teknisi)

function needs(target: TicketStatus) {
  return {
    partNotes: target === "WAITING_PART" || target === "PART_INSTALLING",
    qcNotes: target === "QC_TESTING" || target === "READY_FOR_PICKUP",
  };
}

export function TicketDetailView({
  ticket,
  logs,
  profiles,
  mode,
  assignedName,
  backHref,
  backLabel,
}: {
  ticket: Ticket;
  logs: Log[];
  profiles: Profile[];
  mode: "technician" | "admin";
  assignedName: string | null;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const nameById = new Map(profiles.map((p) => [p.id, p.full_name ?? "Staf"]));
  const [target, setTarget] = useState<TicketStatus | null>(null);
  const [notes, setNotes] = useState("");
  const [partNotes, setPartNotes] = useState(ticket.part_notes ?? "");
  const [qcNotes, setQcNotes] = useState(ticket.qc_notes ?? "");
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  const acc = ticket.accessories as unknown as AccessoriesShape;
  const nextOptions =
    mode === "admin"
      ? ALL_STATUSES.filter((s) => s !== ticket.status)
      : (TICKET_STATUS_FLOW[ticket.status] ?? []).filter((s) => !HIDDEN_TARGETS.includes(s));

  function pick(t: TicketStatus) {
    setTarget(t);
    setNotes("");
  }

  const req = target ? needs(target) : null;

  function confirmDelete() {
    startDelete(async () => {
      try {
        await deleteTicket(ticket.id);
        toast.success(`Tiket ${ticket.ticket_number} dihapus.`);
        router.push("/admin/tickets");
      } catch (e) {
        toast.error((e as Error).message);
        setDeleteOpen(false);
      }
    });
  }

  function submit() {
    if (!target || !req) return;
    if (mode === "admin" && !notes.trim()) {
      toast.error("Wajib isi catatan alasan perubahan status.");
      return;
    }
    if (target === "WAITING_PART" && !partNotes.trim()) {
      toast.error("Isi catatan sparepart.");
      return;
    }

    startTransition(async () => {
      try {
        await updateTicketStatus({
          ticketId: ticket.id,
          from: ticket.status,
          to: target,
          notes,
          part_notes: req.partNotes ? partNotes : undefined,
          qc_notes: req.qcNotes ? qcNotes : undefined,
        });
        toast.success(`Status → ${TICKET_STATUS_LABEL[target]}`);
        setTarget(null);
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link
        href={backHref}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{ticket.ticket_number}</h1>
          <p className="text-sm">{ticket.product_description}</p>
          <p className="text-sm text-muted-foreground">
            {ticket.customer_name} ·{" "}
            <a
              href={waLink(ticket.customer_phone, "")}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {ticket.customer_phone}
            </a>
          </p>
          {assignedName && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ditugaskan ke <span className="font-medium">{assignedName}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <TicketStatusBadge status={ticket.status} />
          {mode === "admin" && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" render={<Link href={`/admin/tickets/${ticket.id}/edit`} />}>
                <Pencil className="size-3.5" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" /> Hapus
              </Button>
            </div>
          )}
        </div>
      </div>

      {mode === "admin" && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hapus tiket {ticket.ticket_number}?</DialogTitle>
              <DialogDescription>
                Seluruh data unit, foto, dan riwayat status tiket ini akan terhapus permanen.
                Tindakan ini tidak bisa dibatalkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Batal
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 className="size-3.5" />}
                Ya, Hapus
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Ubah status */}
      <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-sm font-semibold">
          Ubah Status {mode === "admin" && <span className="font-normal text-muted-foreground">(bebas, admin)</span>}
        </h2>
        {nextOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada transisi lanjutan dari status ini.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {nextOptions.map((t) => (
              <Button
                key={t}
                variant={target === t ? "default" : "outline"}
                size="sm"
                onClick={() => pick(t)}
              >
                {TICKET_STATUS_LABEL[t]}
              </Button>
            ))}
          </div>
        )}

        {target && req && (
          <div className="mt-1 flex flex-col gap-3 border-t pt-3">
            {req.partNotes && (
              <Field>
                <FieldLabel htmlFor="pn">Catatan sparepart</FieldLabel>
                <Textarea
                  id="pn"
                  rows={2}
                  placeholder="Nama part, estimasi kedatangan, supplier…"
                  value={partNotes}
                  onChange={(e) => setPartNotes(e.target.value)}
                />
              </Field>
            )}
            {req.qcNotes && (
              <Field>
                <FieldLabel htmlFor="qc">Catatan QC</FieldLabel>
                <Textarea
                  id="qc"
                  rows={2}
                  placeholder="Keyboard OK, suhu normal, charging OK, port IO OK…"
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="nt">
                Catatan {mode === "admin" ? "(wajib — alasan perubahan)" : "(opsional)"}
              </FieldLabel>
              <Textarea
                id="nt"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={submit} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Check />}
                Konfirmasi → {TICKET_STATUS_LABEL[target]}
              </Button>
              <Button variant="ghost" onClick={() => setTarget(null)} disabled={pending}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {ticket.status === "READY_FOR_PICKUP" && (
          <a
            href={waLink(
              ticket.customer_phone,
              `Halo ${ticket.customer_name}, unit servis Anda (${ticket.ticket_number} - ${ticket.product_description}) sudah SELESAI dan siap diambil di Vicmic Service. Terima kasih.`,
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <MessageCircle className="size-4" /> Kabari pelanggan via WhatsApp
          </a>
        )}
      </section>

      {/* Detail unit */}
      <section className="grid gap-4 rounded-xl bg-card p-5 text-sm ring-1 ring-foreground/10 sm:grid-cols-2">
        <Info label="Garansi" value={WARRANTY_LABEL[ticket.warranty_status]} />
        <Info label="MTM / Model" value={ticket.mtm_number || "-"} />
        <Info label="Serial Number" value={ticket.serial_number || "-"} />
        <Info label="Email" value={ticket.customer_email || "-"} />
        <Info label="Diterima" value={formatDateTimeWIB(ticket.created_at)} />
        <Info label="Diperbarui" value={formatDateTimeWIB(ticket.updated_at)} />
      </section>

      {ticket.photos_url && ticket.photos_url.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="text-sm font-semibold">Foto Unit</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ticket.photos_url.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10"
              >
                <Image src={url} alt={`Foto ${i + 1}`} fill sizes="120px" className="object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl bg-card p-5 text-sm ring-1 ring-foreground/10">
        <div>
          <p className="font-semibold">Keluhan</p>
          <p className="text-muted-foreground">{ticket.complaint_description}</p>
        </div>
        {ticket.physical_condition_tags && ticket.physical_condition_tags.length > 0 && (
          <div>
            <p className="font-semibold">Kondisi fisik saat diterima</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ticket.physical_condition_tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
        {ticket.physical_notes && (
          <div>
            <p className="font-semibold">Catatan kondisi</p>
            <p className="text-muted-foreground">{ticket.physical_notes}</p>
          </div>
        )}
        <div>
          <p className="font-semibold">Kelengkapan</p>
          <p className="text-muted-foreground">{accessoriesSummary(acc)}</p>
        </div>
        {ticket.part_notes && (
          <div>
            <p className="font-semibold">Catatan sparepart</p>
            <p className="text-muted-foreground">{ticket.part_notes}</p>
          </div>
        )}
        {ticket.qc_notes && (
          <div>
            <p className="font-semibold">Catatan QC</p>
            <p className="text-muted-foreground">{ticket.qc_notes}</p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-sm font-semibold">Riwayat</h2>
        <ol className="flex flex-col gap-3">
          {logs.map((log) => (
            <li key={log.id} className="flex gap-3 text-sm">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-muted-foreground" />
              <div>
                <p>
                  {log.previous_status
                    ? `${TICKET_STATUS_LABEL[log.previous_status]} → `
                    : ""}
                  <strong>{TICKET_STATUS_LABEL[log.new_status]}</strong>
                </p>
                {log.notes && <p className="text-muted-foreground">{log.notes}</p>}
                <p className="text-xs text-muted-foreground">
                  oleh <span className="font-medium">{nameById.get(log.changed_by) ?? "Staf"}</span>{" "}
                  · {formatDateTimeWIB(log.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function accessoriesSummary(acc: AccessoriesShape): string {
  const parts: string[] = [];
  if (acc.adaptor_ac) parts.push(ACCESSORY_LABEL.adaptor_ac);
  if (acc.kabel_ac) parts.push(ACCESSORY_LABEL.kabel_ac);
  if (acc.tas_dus) parts.push(ACCESSORY_LABEL.tas_dus);
  if (acc.stylus) parts.push(ACCESSORY_LABEL.stylus);
  if (acc.mouse) parts.push(ACCESSORY_LABEL.mouse);
  if (acc.keyboard) parts.push(ACCESSORY_LABEL.keyboard);
  if (acc.other) parts.push(acc.other);
  return parts.length ? parts.join(", ") : "Tidak ada";
}
