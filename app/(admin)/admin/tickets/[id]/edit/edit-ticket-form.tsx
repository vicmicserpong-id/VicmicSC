"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import {
  WARRANTY_LABEL,
  PHYSICAL_CONDITION_TAGS,
  type AccessoriesShape,
  type WarrantyStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

import { updateTicketData } from "../data-actions";

type Ticket = Database["public"]["Tables"]["service_tickets"]["Row"];

const schema = z.object({
  customer_name: z.string().trim().min(2, "Nama minimal 2 huruf").max(100),
  customer_phone: z.string().trim().min(8, "Nomor tidak valid").max(25),
  customer_phone_alt: z.string().trim().max(25).optional(),
  customer_email: z
    .string()
    .trim()
    .max(100)
    .email("Email tidak valid")
    .optional()
    .or(z.literal("")),
  product_description: z.string().trim().min(3, "Wajib diisi").max(150),
  mtm_number: z.string().trim().max(100).optional(),
  serial_number: z.string().trim().max(100).optional(),
  complaint_description: z.string().trim().min(5, "Jelaskan keluhan pelanggan").max(2000),
  physical_notes: z.string().trim().max(2000).optional(),
  acc_other: z.string().trim().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

const WARRANTIES = Object.keys(WARRANTY_LABEL) as WarrantyStatus[];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function EditTicketForm({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  const initialAcc = ticket.accessories as unknown as AccessoriesShape;

  const [warranty, setWarranty] = useState<WarrantyStatus>(ticket.warranty_status);
  const [acc, setAcc] = useState({
    adaptor_ac: initialAcc.adaptor_ac,
    kabel_ac: initialAcc.kabel_ac,
    tas_dus: initialAcc.tas_dus,
    stylus: initialAcc.stylus,
    mouse: initialAcc.mouse,
    keyboard: initialAcc.keyboard,
  });
  const [tags, setTags] = useState<string[]>(ticket.physical_condition_tags ?? []);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_name: ticket.customer_name,
      customer_phone: ticket.customer_phone,
      customer_phone_alt: ticket.customer_phone_alt ?? "",
      customer_email: ticket.customer_email ?? "",
      product_description: ticket.product_description,
      mtm_number: ticket.mtm_number ?? "",
      serial_number: ticket.serial_number ?? "",
      complaint_description: ticket.complaint_description,
      physical_notes: ticket.physical_notes ?? "",
      acc_other: initialAcc.other ?? "",
    },
  });

  function toggleTag(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await updateTicketData(ticket.id, {
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        customer_phone_alt: values.customer_phone_alt?.trim() || null,
        customer_email: values.customer_email?.trim() || null,
        product_description: values.product_description,
        mtm_number: values.mtm_number?.trim() || null,
        serial_number: values.serial_number?.trim() || null,
        warranty_status: warranty,
        accessories: { ...acc, other: values.acc_other?.trim() ?? "" },
        complaint_description: values.complaint_description,
        physical_condition_tags: tags,
        physical_notes: values.physical_notes?.trim() || null,
      });
      toast.success("Data tiket diperbarui.");
      router.push(`/admin/tickets/${ticket.id}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto flex max-w-2xl flex-col gap-5" noValidate>
      <Link
        href={`/admin/tickets/${ticket.id}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {ticket.ticket_number}
      </Link>

      <h1 className="text-lg font-semibold">Edit Data Tiket — {ticket.ticket_number}</h1>

      <Section title="Data Pelanggan">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.customer_name}>
            <FieldLabel htmlFor="customer_name">Nama</FieldLabel>
            <Input id="customer_name" aria-invalid={!!errors.customer_name} {...register("customer_name")} />
            <FieldError>{errors.customer_name?.message}</FieldError>
          </Field>
          <Field data-invalid={!!errors.customer_phone}>
            <FieldLabel htmlFor="customer_phone">No. WhatsApp</FieldLabel>
            <Input id="customer_phone" inputMode="tel" aria-invalid={!!errors.customer_phone} {...register("customer_phone")} />
            <FieldError>{errors.customer_phone?.message}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="customer_phone_alt">No. Telepon Alternatif</FieldLabel>
            <Input id="customer_phone_alt" inputMode="tel" {...register("customer_phone_alt")} />
          </Field>
          <Field data-invalid={!!errors.customer_email}>
            <FieldLabel htmlFor="customer_email">Email</FieldLabel>
            <Input id="customer_email" type="email" aria-invalid={!!errors.customer_email} {...register("customer_email")} />
            <FieldError>{errors.customer_email?.message}</FieldError>
          </Field>
        </div>
      </Section>

      <Section title="Data Unit">
        <Field data-invalid={!!errors.product_description}>
          <FieldLabel htmlFor="product_description">Deskripsi Produk</FieldLabel>
          <Input
            id="product_description"
            aria-invalid={!!errors.product_description}
            {...register("product_description")}
          />
          <FieldError>{errors.product_description?.message}</FieldError>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="mtm_number">MTM / Model</FieldLabel>
            <Input id="mtm_number" {...register("mtm_number")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="serial_number">Serial Number</FieldLabel>
            <Input id="serial_number" {...register("serial_number")} />
          </Field>
        </div>
        <Field>
          <FieldLabel>Status Garansi</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {WARRANTIES.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWarranty(w)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  warranty === w
                    ? "border-[#0f172a] bg-[#0f172a] text-white"
                    : "border-input hover:bg-muted/50",
                )}
              >
                {w}
              </button>
            ))}
          </div>
          <FieldDescription>{WARRANTY_LABEL[warranty]}</FieldDescription>
        </Field>
      </Section>

      <Section title="Kelengkapan">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(
            [
              ["adaptor_ac", "Adaptor / charger"],
              ["kabel_ac", "Kabel AC"],
              ["tas_dus", "Tas / dus"],
              ["stylus", "Stylus / pen"],
              ["mouse", "Mouse"],
              ["keyboard", "Keyboard eksternal"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={acc[key]}
                onCheckedChange={(v) => setAcc((a) => ({ ...a, [key]: v === true }))}
              />
              {label}
            </label>
          ))}
        </div>
        <Field>
          <FieldLabel htmlFor="acc_other">Kelengkapan lain</FieldLabel>
          <Input id="acc_other" placeholder="mis. tas eksternal, kartu garansi" {...register("acc_other")} />
        </Field>
      </Section>

      <Section title="Keluhan & Kondisi Fisik">
        <Field data-invalid={!!errors.complaint_description}>
          <FieldLabel htmlFor="complaint_description">Keluhan Pelanggan</FieldLabel>
          <Textarea
            id="complaint_description"
            rows={3}
            aria-invalid={!!errors.complaint_description}
            {...register("complaint_description")}
          />
          <FieldError>{errors.complaint_description?.message}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Kondisi Fisik Saat Diterima</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {PHYSICAL_CONDITION_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  tags.includes(tag)
                    ? "border-amber-500 bg-amber-100 text-amber-900"
                    : "border-input hover:bg-muted/50",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="physical_notes">Catatan Kondisi Tambahan</FieldLabel>
          <Textarea id="physical_notes" rows={2} {...register("physical_notes")} />
        </Field>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" /> Menyimpan…
            </>
          ) : (
            <>
              <Check /> Simpan Perubahan
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={submitting}
          onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
