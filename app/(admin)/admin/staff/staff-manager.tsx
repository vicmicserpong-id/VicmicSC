"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, KeyRound, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { APP_ROLES, ROLE_LABEL, type AppRole } from "@/lib/constants";
import { formatDateWIB } from "@/lib/format";

import { createStaff, setStaffRole, resetStaffPassword } from "./actions";

export type StaffRow = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  created_at: string;
};

export function StaffManager({
  meId,
  initial,
}: {
  meId: string;
  initial: StaffRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(id: string | null, fn: () => Promise<void>, okMsg?: string) {
    setBusyId(id ?? "__form__");
    startTransition(async () => {
      try {
        await fn();
        if (okMsg) toast.success(okMsg);
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Kelola Staf</h1>
          <p className="text-sm text-muted-foreground">{initial.length} akun</p>
        </div>
        <Button onClick={() => setAdding((v) => !v)} variant={adding ? "outline" : "default"}>
          {adding ? <X /> : <UserPlus />}
          {adding ? "Tutup" : "Tambah Staf"}
        </Button>
      </div>

      {adding && (
        <AddStaffForm
          busy={busyId === "__form__"}
          onSubmit={(v) =>
            run(
              null,
              async () => {
                await createStaff(v);
                setAdding(false);
              },
              `Akun ${v.email} dibuat.`,
            )
          }
        />
      )}

      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Nama</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Dibuat</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {initial.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium">
                  {s.full_name}
                  {s.id === meId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(Anda)</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{s.email}</td>
                <td className="px-4 py-2.5">
                  <select
                    value={s.role}
                    disabled={busyId === s.id}
                    onChange={(e) =>
                      run(
                        s.id,
                        () => setStaffRole(s.id, e.target.value as AppRole),
                        "Role diperbarui.",
                      )
                    }
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  >
                    {APP_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {s.created_at ? formatDateWIB(s.created_at) : "-"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === s.id}
                    onClick={() => {
                      const pw = window.prompt(
                        `Password baru untuk ${s.email} (min. 8 karakter):`,
                      );
                      if (!pw) return;
                      run(s.id, () => resetStaffPassword(s.id, pw), "Password direset.");
                    }}
                  >
                    {busyId === s.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="size-3.5" />
                    )}
                    Reset PW
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Menghapus akun permanen dilakukan lewat Supabase Dashboard (unit servis
        menyimpan referensi ke akun teknisi/admin).
      </p>
    </div>
  );
}

function AddStaffForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (v: {
    email: string;
    password: string;
    full_name: string;
    role: AppRole;
  }) => void;
}) {
  const [email, setEmail] = useState("");
  const [full_name, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("admin");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ email, password, full_name, role });
      }}
      className="grid gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:grid-cols-2"
    >
      <Field>
        <FieldLabel htmlFor="s_name">Nama</FieldLabel>
        <Input id="s_name" required value={full_name} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="s_email">Email</FieldLabel>
        <Input
          id="s_email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="s_pw">Password awal (min. 8)</FieldLabel>
        <Input
          id="s_pw"
          type="text"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="s_role">Role</FieldLabel>
        <select
          id="s_role"
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {APP_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Buat Akun
        </Button>
      </div>
    </form>
  );
}
