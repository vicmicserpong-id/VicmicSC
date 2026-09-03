"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Check,
  Pencil,
  Trash2,
  Package,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { TicketStatusBadge } from "@/components/shared/status-badge";
import { TicketProgress } from "@/components/shared/ticket-progress";
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
  TICKET_STATUS_FLOW_ADMIN,
  TICKET_STATUS_LABEL,
  WARRANTY_LABEL,
  ACCESSORY_LABEL,
  PART_STATUS_LABEL,
  PART_REQUEST_ELIGIBLE_STATUSES,
  type AccessoriesShape,
  type AppRole,
  type TicketStatus,
} from "@/lib/constants";
import { formatDateTimeWIB, waLink } from "@/lib/format";
import type { Database } from "@/lib/database.types";
import { updateTicketStatus } from "@/lib/actions/tickets";
import {
  requestSparepart,
  markPartOrdered,
  markPartArrived,
  escalateForPart,
} from "@/lib/actions/spareparts";
import { deleteTicket } from "@/app/(admin)/admin/tickets/[id]/data-actions";

type Ticket = Database["public"]["Tables"]["service_tickets"]["Row"];
type Log = Pick<
  Database["public"]["Tables"]["service_ticket_logs"]["Row"],
  "id" | "previous_status" | "new_status" | "notes" | "created_at" | "changed_by"
>;

type Profile = { id: string; full_name: string | null };

const ALL_STATUSES = Object.keys(TICKET_STATUS_LABEL) as TicketStatus[];
const HIDDEN_TARGETS: TicketStatus[] = ["CLOSED"]; // ditangani meja depan (mode teknisi)

function needs(current: TicketStatus, target: TicketStatus) {
  return {
    // Catatan diagnosa dicatat setiap kali meninggalkan status Diagnosa, apa pun tujuannya.
    diagnosisNotes: current === "DIAGNOSING",
    // Catatan hasil QC diisi admin saat MELULUSKAN unit (bukan saat teknisi bilang "selesai").
    qcNotes: current === "QC_TESTING" && target === "READY_FOR_PICKUP",
  };
}

/** Label tombol yang lebih enak dibaca untuk transisi tertentu. */
function transitionLabel(from: TicketStatus, to: TicketStatus): string {
  if (to === "QC_TESTING" && from === "PART_INSTALLING") return "Pemasangan Selesai → Uji QC";
  if (to === "QC_TESTING" && from === "IN_REPAIR") return "Perbaikan Selesai → Uji QC";
  return TICKET_STATUS_LABEL[to];
}

export function TicketDetailView({
  ticket,
  logs,
  profiles,
  mode,
  role,
  assignedName,
  backHref,
  backLabel,
}: {
  ticket: Ticket;
  logs: Log[];
  profiles: Profile[];
  mode: "technician" | "admin";
  role: AppRole;
  assignedName: string | null;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const nameById = new Map(profiles.map((p) => [p.id, p.full_name ?? "Staf"]));
  const [target, setTarget] = useState<TicketStatus | null>(null);
  const [notes, setNotes] = useState("");
  const [diagnosisNotes, setDiagnosisNotes] = useState(ticket.diagnosis_notes ?? "");
  const [qcNotes, setQcNotes] = useState(ticket.qc_notes ?? "");
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [requestingPart, setRequestingPart] = useState(false);
  const [partRequestNote, setPartRequestNote] = useState("");
  const [partPending, startPartTransition] = useTransition();
  const [escalating, setEscalating] = useState(false);
  const [escalateNote, setEscalateNote] = useState("");

  const acc = ticket.accessories as unknown as AccessoriesShape;
  const visitedStatuses = new Set<TicketStatus>([
    ticket.status,
    ...logs.map((l) => l.new_status),
  ]);
  // Owner: bebas pindah ke status apa pun. Admin: Uji QC (Perbaikan/Pemasangan →
  // QC → Lulus/Tolak) + serah-terima unit. Teknisi: alur maju TICKET_STATUS_FLOW.
  const nextOptions =
    role === "owner"
      ? ALL_STATUSES.filter((s) => s !== ticket.status)
      : role === "admin"
        ? (TICKET_STATUS_FLOW_ADMIN[ticket.status] ?? [])
        : (TICKET_STATUS_FLOW[ticket.status] ?? []).filter((s) => !HIDDEN_TARGETS.includes(s));
  const notesRequired = role === "owner";
  const isQcReject = (t: TicketStatus) => ticket.status === "QC_TESTING" && t === "DIAGNOSING";

  function pick(t: TicketStatus) {
    setTarget(t);
    setNotes("");
  }

  const req = target ? needs(ticket.status, target) : null;

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
    if ((notesRequired || isQcReject(target)) && !notes.trim()) {
      toast.error(
        isQcReject(target)
          ? "Isi alasan penolakan saat Uji QC."
          : "Wajib isi catatan alasan perubahan status.",
      );
      return;
    }
    if (req.diagnosisNotes && !diagnosisNotes.trim()) {
      toast.error("Isi catatan diagnosa.");
      return;
    }

    startTransition(async () => {
      try {
        await updateTicketStatus({
          ticketId: ticket.id,
          from: ticket.status,
          to: target,
          notes,
          diagnosis_notes: req.diagnosisNotes ? diagnosisNotes : undefined,
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

  const isWorkbenchRole = role === "technician" || role === "owner";
  const isFrontDeskRole = role === "admin" || role === "owner";
  const canRequestPart =
    isWorkbenchRole && PART_REQUEST_ELIGIBLE_STATUSES.includes(ticket.status);
  const canMarkOrdered = isFrontDeskRole && ticket.part_status === "requested";
  const canMarkArrived =
    isFrontDeskRole && ticket.part_status === "ordered" && ticket.status === "WAITING_PART";
  const canEscalateForPart = isWorkbenchRole && ticket.status === "PART_INSTALLING";

  function submitPartRequest() {
    if (!partRequestNote.trim()) {
      toast.error("Sebutkan sparepart yang dibutuhkan.");
      return;
    }
    startPartTransition(async () => {
      try {
        await requestSparepart(ticket.id, partRequestNote);
        toast.success("Permintaan sparepart terkirim ke admin.");
        setRequestingPart(false);
        setPartRequestNote("");
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function submitMarkOrdered() {
    startPartTransition(async () => {
      try {
        await markPartOrdered(ticket.id);
        toast.success('Status → "Menunggu sparepart".');
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function submitMarkArrived() {
    startPartTransition(async () => {
      try {
        await markPartArrived(ticket.id);
        toast.success('Status → "Part tiba". Teknisi sudah dinotifikasi untuk lanjut memasang.');
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function submitEscalate() {
    if (!escalateNote.trim()) {
      toast.error("Isi alasan eskalasi.");
      return;
    }
    startPartTransition(async () => {
      try {
        await escalateForPart(ticket.id, escalateNote);
        toast.success('Tiket dikembalikan ke "Menunggu sparepart". Admin sudah dinotifikasi.');
        setEscalating(false);
        setEscalateNote("");
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

      <TicketProgress status={ticket.status} visited={visitedStatuses} />

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
          Ubah Status{" "}
          {role === "owner" && (
            <span className="font-normal text-muted-foreground">(bebas, owner)</span>
          )}
          {role === "admin" && (
            <span className="font-normal text-muted-foreground">(Uji QC &amp; serah-terima)</span>
          )}
        </h2>
        {nextOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {role === "admin"
              ? "Belum ada aksi meja depan di sini. Uji QC muncul setelah teknisi menandai pengerjaan selesai. Untuk koreksi status lain, hubungi owner."
              : ticket.status === "WAITING_PART"
                ? "Menunggu admin memesan/menerima sparepart — belum ada aksi untuk teknisi di sini."
                : ticket.status === "QC_TESTING"
                  ? "Menunggu Uji QC oleh admin."
                  : "Tidak ada transisi lanjutan dari status ini."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {nextOptions.map((t) => (
              <Button
                key={t}
                variant={target === t ? "default" : "outline"}
                size="sm"
                onClick={() => pick(t)}
                className={
                  isQcReject(t)
                    ? "border-destructive text-destructive hover:bg-destructive/10"
                    : undefined
                }
              >
                {isQcReject(t) ? "Tolak QC → Diagnosa" : transitionLabel(ticket.status, t)}
              </Button>
            ))}
          </div>
        )}

        {target && req && (
          <div className="mt-1 flex flex-col gap-3 border-t pt-3">
            {req.diagnosisNotes && (
              <Field>
                <FieldLabel htmlFor="dn">Catatan diagnosa (wajib)</FieldLabel>
                <Textarea
                  id="dn"
                  rows={2}
                  placeholder="Temuan diagnosa, penyebab kerusakan, rencana perbaikan…"
                  value={diagnosisNotes}
                  onChange={(e) => setDiagnosisNotes(e.target.value)}
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
                Catatan{" "}
                {isQcReject(target)
                  ? "(wajib — alasan penolakan QC)"
                  : notesRequired
                    ? "(wajib — alasan perubahan)"
                    : "(opsional)"}
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
                {isQcReject(target)
                  ? "Konfirmasi Tolak QC → Diagnosa"
                  : `Konfirmasi: ${transitionLabel(ticket.status, target)}`}
              </Button>
              <Button variant="ghost" onClick={() => setTarget(null)} disabled={pending}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {canEscalateForPart && (
          <div className="mt-1 flex flex-col gap-2 border-t pt-3">
            {!escalating ? (
              <Button
                variant="outline"
                size="sm"
                className="w-fit border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                onClick={() => {
                  setEscalating(true);
                  setEscalateNote("");
                }}
              >
                <AlertTriangle className="size-3.5" /> Eskalasi → Menunggu Sparepart
              </Button>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="esc">
                    Alasan eskalasi / sparepart tambahan (wajib)
                  </FieldLabel>
                  <Textarea
                    id="esc"
                    rows={2}
                    placeholder="Mis. ketemu kerusakan lain, part kurang / tidak cocok…"
                    value={escalateNote}
                    onChange={(e) => setEscalateNote(e.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitEscalate} disabled={partPending}>
                    {partPending ? <Loader2 className="animate-spin" /> : <AlertTriangle className="size-3.5" />}
                    Konfirmasi Eskalasi
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEscalating(false)}
                    disabled={partPending}
                  >
                    Batal
                  </Button>
                </div>
              </>
            )}
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

      {/* Sparepart */}
      {(canRequestPart || ticket.part_status !== "none") && (
        <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Package className="size-4" /> Sparepart
          </h2>

          {ticket.part_status !== "none" && (
            <div className="flex flex-col gap-1 text-sm">
              <p>
                Status: <strong>{PART_STATUS_LABEL[ticket.part_status]}</strong>
              </p>
              {ticket.part_notes && (
                <p className="text-muted-foreground">{ticket.part_notes}</p>
              )}
            </div>
          )}

          {canMarkOrdered && (
            <Button
              size="sm"
              className="w-fit"
              onClick={submitMarkOrdered}
              disabled={partPending}
            >
              {partPending ? <Loader2 className="animate-spin" /> : <Check />}
              Tandai Sudah Dipesan
            </Button>
          )}

          {canMarkArrived && (
            <Button
              size="sm"
              className="w-fit"
              onClick={submitMarkArrived}
              disabled={partPending}
            >
              {partPending ? <Loader2 className="animate-spin" /> : <Check />}
              Tandai Sparepart Tiba
            </Button>
          )}

          {canRequestPart && !requestingPart && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                setRequestingPart(true);
                setPartRequestNote(ticket.part_notes ?? "");
              }}
            >
              <Package className="size-3.5" />
              {ticket.part_status === "none" ? "Request Sparepart" : "Ajukan Ulang / Perbarui"}
            </Button>
          )}

          {canRequestPart && requestingPart && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <Field>
                <FieldLabel htmlFor="prn">Sparepart yang dibutuhkan</FieldLabel>
                <Textarea
                  id="prn"
                  rows={2}
                  placeholder="Nama part, spesifikasi, catatan lain…"
                  value={partRequestNote}
                  onChange={(e) => setPartRequestNote(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <Button size="sm" onClick={submitPartRequest} disabled={partPending}>
                  {partPending ? <Loader2 className="animate-spin" /> : <Check />}
                  Kirim ke Admin
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRequestingPart(false)}
                  disabled={partPending}
                >
                  Batal
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

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
        {ticket.diagnosis_notes && (
          <div>
            <p className="font-semibold">Catatan diagnosa</p>
            <p className="text-muted-foreground">{ticket.diagnosis_notes}</p>
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
                  {log.previous_status && log.previous_status !== log.new_status
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
