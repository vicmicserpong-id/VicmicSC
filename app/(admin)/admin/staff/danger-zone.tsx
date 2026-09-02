"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { resetTodayData, resetAllData } from "./actions";

function DangerAction({
  icon: Icon,
  title,
  description,
  buttonLabel,
  confirmPhrase,
  disabled,
  run,
  successMessage,
}: {
  icon: React.ElementType;
  title: string;
  description: React.ReactNode;
  buttonLabel: string;
  confirmPhrase: string;
  disabled: boolean;
  run: () => Promise<{ queues: number; tickets: number }>;
  successMessage: (r: { queues: number; tickets: number }) => string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setConfirmText("");
  }

  function execute() {
    startTransition(async () => {
      try {
        const r = await run();
        toast.success(successMessage(r));
        close();
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-destructive/20 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-destructive" />
        <h3 className="text-sm font-semibold text-destructive">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>

      {!open ? (
        <Button
          variant="outline"
          className="w-fit border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          <Trash2 className="size-3.5" />
          {disabled ? "Tidak ada data" : buttonLabel}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-background p-4">
          <p className="text-sm">
            Ketik{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">{confirmPhrase}</code>{" "}
            untuk konfirmasi:
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmPhrase}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={confirmText !== confirmPhrase || pending}
              onClick={execute}
            >
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Ya, Hapus Sekarang
            </Button>
            <Button variant="ghost" onClick={close} disabled={pending}>
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DangerZone({
  todayQueues,
  todayTickets,
  totalQueues,
  totalTickets,
}: {
  todayQueues: number;
  todayTickets: number;
  totalQueues: number;
  totalTickets: number;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" />
        <h2 className="text-sm font-semibold text-destructive">Zona Berbahaya</h2>
      </div>

      <DangerAction
        icon={Trash2}
        title="Reset Data Hari Ini"
        description={
          <>
            Hapus semua antrean &amp; tiket servis yang dibuat <strong>hari ini</strong>{" "}
            ({todayQueues} antrean, {todayTickets} tiket). Riwayat hari-hari
            sebelumnya tidak tersentuh, akun staf tidak terpengaruh.
          </>
        }
        buttonLabel="Reset Data Hari Ini"
        confirmPhrase="HAPUS HARI INI"
        disabled={todayQueues === 0 && todayTickets === 0}
        run={resetTodayData}
        successMessage={(r) => `Terhapus: ${r.queues} antrean, ${r.tickets} tiket (hari ini).`}
      />

      <DangerAction
        icon={ShieldAlert}
        title="Hapus SEMUA Data"
        description={
          <>
            Hapus <strong>seluruh</strong> riwayat antrean &amp; tiket servis dari
            semua tanggal ({totalQueues} antrean, {totalTickets} tiket sepanjang
            waktu) — bukan cuma hari ini. Akun staf tetap aman. Cocok untuk bersih-bersih
            sebelum go-live, <strong>bukan</strong> untuk operasional harian.
            Tindakan ini permanen dan tidak bisa dibatalkan.
          </>
        }
        buttonLabel="Hapus Semua Data"
        confirmPhrase="HAPUS SEMUA DATA"
        disabled={totalQueues === 0 && totalTickets === 0}
        run={resetAllData}
        successMessage={(r) => `Terhapus total: ${r.queues} antrean, ${r.tickets} tiket.`}
      />
    </section>
  );
}
