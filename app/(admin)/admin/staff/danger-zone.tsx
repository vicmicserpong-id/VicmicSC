"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { resetTodayData } from "./actions";

const CONFIRM_TEXT = "HAPUS HARI INI";

export function DangerZone({
  queues,
  tickets,
}: {
  queues: number;
  tickets: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  const isEmpty = queues === 0 && tickets === 0;

  function close() {
    setOpen(false);
    setConfirmText("");
  }

  function reset() {
    startTransition(async () => {
      try {
        const r = await resetTodayData();
        toast.success(`Terhapus: ${r.queues} antrean, ${r.tickets} tiket (hari ini).`);
        close();
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" />
        <h2 className="text-sm font-semibold text-destructive">Zona Berbahaya</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Hapus semua antrean &amp; tiket servis yang dibuat <strong>hari ini</strong> (
        {queues} antrean, {tickets} tiket). Riwayat hari-hari sebelumnya tidak
        tersentuh, akun staf tidak terpengaruh. Berguna untuk membersihkan data
        uji coba. Tindakan ini <strong>tidak bisa dibatalkan</strong>.
      </p>

      {!open ? (
        <Button
          variant="outline"
          className="w-fit border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => setOpen(true)}
          disabled={isEmpty}
        >
          <Trash2 className="size-3.5" />
          {isEmpty ? "Tidak ada data hari ini" : "Reset Data Hari Ini"}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-background p-4">
          <p className="text-sm">
            Ketik{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">{CONFIRM_TEXT}</code>{" "}
            untuk konfirmasi:
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_TEXT}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={confirmText !== CONFIRM_TEXT || pending}
              onClick={reset}
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
    </section>
  );
}
