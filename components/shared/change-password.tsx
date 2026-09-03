"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/shared/password-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

/** Tombol + dialog "ubah kata sandi sendiri" untuk staf yang sedang login. */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  function reset() {
    setPw("");
    setConfirm("");
  }

  function submit() {
    if (pw.length < 8) {
      toast.error("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (pw !== confirm) {
      toast.error("Konfirmasi kata sandi tidak sama.");
      return;
    }
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        toast.error(error.message || "Gagal mengubah kata sandi.");
        return;
      }
      toast.success("Kata sandi berhasil diubah.");
      setOpen(false);
      reset();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Ubah kata sandi"
        aria-label="Ubah kata sandi"
        onClick={() => setOpen(true)}
      >
        <KeyRound className="size-3.5" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Kata Sandi</DialogTitle>
            <DialogDescription>
              Berlaku untuk akun yang sedang login. Kamu tetap masuk setelah menggantinya.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="new-pw">Kata sandi baru</FieldLabel>
              <PasswordInput
                id="new-pw"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-pw">Ulangi kata sandi baru</FieldLabel>
              <PasswordInput
                id="confirm-pw"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Batal
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound className="size-3.5" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
