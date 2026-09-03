"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/shared/password-input";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("Email atau password salah.");
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") ? next : "/admin/queue");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <Image src="/logo-mark.png" alt="Vicmic" width={48} height={48} className="mb-3" priority />
        <h1 className="text-lg font-semibold">Masuk Staf</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vicmic Service System</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
      >
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Memproses…
            </>
          ) : (
            "Masuk"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/" className="underline underline-offset-4">
          Kembali ke halaman pelanggan
        </Link>
      </p>
    </div>
  );
}
