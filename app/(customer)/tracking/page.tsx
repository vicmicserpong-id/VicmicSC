"use client";

import { useState } from "react";
import { Loader2, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/shared/page-shell";
import { TicketStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { type TicketStatus } from "@/lib/constants";
import { formatRupiah, formatDateTimeWIB } from "@/lib/format";

type TrackResult = {
  ticket_number: string;
  product_description: string;
  status: TicketStatus;
  estimated_cost: number;
  final_cost: number;
  created_at: string;
  updated_at: string;
};

export default function TrackingPage() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [searched, setSearched] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;

    setLoading(true);
    setSearched(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("public_track_ticket", {
      p_ticket_number: q,
    });
    setLoading(false);

    if (error) {
      toast.error("Gagal memeriksa. Coba lagi.");
      return;
    }
    setResult((data?.[0] as TrackResult) ?? null);
  }

  return (
    <PageShell back={{ href: "/" }}>
      <h1 className="text-lg font-semibold">Cek Status Servis</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Masukkan nomor tiket dari nota servis Anda.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="ticket">Nomor Tiket</FieldLabel>
          <Input
            id="ticket"
            placeholder="VMC-20260902-001"
            autoCapitalize="characters"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" disabled={loading || !value.trim()}>
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Memeriksa…
            </>
          ) : (
            <>
              <Search /> Cek Status
            </>
          )}
        </Button>
      </form>

      {searched && !loading && !result ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl bg-card p-6 text-center ring-1 ring-foreground/10">
          <XCircle className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nomor tiket tidak ditemukan. Periksa kembali penulisannya.
          </p>
        </div>
      ) : null}

      {result ? (
        <div className="mt-6 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Nomor Tiket</p>
              <p className="font-semibold">{result.ticket_number}</p>
            </div>
            <TicketStatusBadge status={result.status} />
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Unit</dt>
              <dd className="text-right font-medium">{result.product_description}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Estimasi biaya</dt>
              <dd className="font-medium">
                {result.estimated_cost > 0 ? formatRupiah(result.estimated_cost) : "-"}
              </dd>
            </div>
            {result.final_cost > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Total biaya</dt>
                <dd className="font-semibold">{formatRupiah(result.final_cost)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Diperbarui</dt>
              <dd className="font-medium">{formatDateTimeWIB(result.updated_at)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </PageShell>
  );
}
