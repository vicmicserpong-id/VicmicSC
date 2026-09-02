"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Search, Loader2, PackageCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { TicketStatusBadge } from "@/components/shared/status-badge";
import { createClient } from "@/lib/supabase/client";
import { TICKET_STATUS_LABEL } from "@/lib/constants";
import type { Database } from "@/lib/database.types";

import { closeTicket } from "./actions";

type Ticket = Database["public"]["Tables"]["service_tickets"]["Row"];

export function PickupPanel({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settled, setSettled] = useState(false);
  const [pending, startTransition] = useTransition();

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const q = code.trim().toUpperCase();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setSettled(false);
    const supabase = createClient();
    const { data } = await supabase
      .from("service_tickets")
      .select("*")
      .eq("ticket_number", q)
      .maybeSingle();
    setTicket(data ?? null);
    setLoading(false);
  }

  const canSettle = ticket?.status === "READY_FOR_PICKUP";

  function settle() {
    if (!ticket) return;
    startTransition(async () => {
      try {
        await closeTicket(ticket.id);
        setSettled(true);
        toast.success("Unit diserahkan.");
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-lg font-semibold">Pengambilan Unit</h1>

      <form onSubmit={search} className="flex items-end gap-2">
        <Field className="flex-1">
          <FieldLabel htmlFor="code">No. Tiket Servis</FieldLabel>
          <Input
            id="code"
            placeholder="20260902-0001"
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Search />}
          Cari
        </Button>
      </form>

      {searched && !loading && !ticket && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
          <AlertTriangle className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Tiket tidak ditemukan.</p>
        </div>
      )}

      {ticket && settled && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <p className="font-medium">Unit {ticket.ticket_number} diserahkan</p>
        </div>
      )}

      {ticket && !settled && (
        <div className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{ticket.ticket_number}</p>
              <p className="font-semibold">{ticket.customer_name}</p>
              <p className="text-sm text-muted-foreground">{ticket.product_description}</p>
            </div>
            <TicketStatusBadge status={ticket.status} />
          </div>

          {ticket.photos_url && ticket.photos_url.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {ticket.photos_url.map((url, i) => (
                <div
                  key={url}
                  className="relative size-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-foreground/10"
                >
                  <Image src={url} alt={`Foto ${i + 1}`} fill sizes="64px" className="object-cover" />
                </div>
              ))}
            </div>
          )}

          {!canSettle && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
              <AlertTriangle className="size-4 shrink-0" />
              Unit belum siap diambil — status saat ini:{" "}
              <strong>{TICKET_STATUS_LABEL[ticket.status]}</strong>.
            </div>
          )}

          <Button size="lg" onClick={settle} disabled={!canSettle || pending}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" /> Memproses…
              </>
            ) : (
              <>
                <PackageCheck /> Serahkan Unit
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
