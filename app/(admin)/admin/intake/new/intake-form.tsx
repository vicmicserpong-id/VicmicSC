"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Minus, Plus, CheckCircle2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { PhotoUpload } from "@/components/shared/photo-upload";
import { SignaturePad } from "@/components/shared/signature-pad";
import { uploadImage, dataUrlToBlob } from "@/lib/upload";
import {
  WARRANTY_LABEL,
  PHYSICAL_CONDITION_TAGS,
  DEFAULT_ACCESSORIES,
  type WarrantyStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

import { createServiceTicket } from "./actions";

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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function IntakeForm({
  prefill,
}: {
  prefill: { queue_id: string; customer_name: string; customer_phone: string } | null;
}) {
  const router = useRouter();

  const [warranty, setWarranty] = useState<WarrantyStatus>("OOW");
  const [acc, setAcc] = useState({
    adaptor_ac: DEFAULT_ACCESSORIES.adaptor_ac,
    kabel_ac: DEFAULT_ACCESSORIES.kabel_ac,
    tas_dus: DEFAULT_ACCESSORIES.tas_dus,
    stylus: DEFAULT_ACCESSORIES.stylus,
    mouse: DEFAULT_ACCESSORIES.mouse,
    keyboard: DEFAULT_ACCESSORIES.keyboard,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [terms, setTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string; ticket_number: string } | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_name: prefill?.customer_name ?? "",
      customer_phone: prefill?.customer_phone ?? "",
      customer_phone_alt: "",
      customer_email: "",
      product_description: "",
      mtm_number: "",
      serial_number: "",
      complaint_description: "",
      physical_notes: "",
      acc_other: "",
    },
  });

  function toggleTag(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  function bump(key: "adaptor_ac" | "kabel_ac", delta: number) {
    setAcc((a) => ({ ...a, [key]: Math.max(0, Math.min(9, a[key] + delta)) }));
  }

  async function onSubmit(values: FormValues) {
    if (!terms) {
      toast.error("Pelanggan harus menyetujui syarat & ketentuan.");
      return;
    }
    setSubmitting(true);
    try {
      let signatureUrl: string | null = null;
      if (signature) {
        signatureUrl = await uploadImage(dataUrlToBlob(signature), "signatures");
      }

      const result = await createServiceTicket({
        queue_id: prefill?.queue_id ?? null,
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
        photos_url: photos,
        customer_signature_url: signatureUrl,
        terms_accepted: terms,
      });

      setDone(result);
      toast.success(`Tiket ${result.ticket_number} dibuat.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
        <CheckCircle2 className="size-10 text-emerald-600" />
        <p className="text-sm text-muted-foreground">Nomor Tiket Servis</p>
        <p className="text-3xl font-bold tracking-tight">{done.ticket_number}</p>
        <p className="text-sm">{getValues("customer_name")}</p>
        <p className="text-sm text-muted-foreground">{getValues("product_description")}</p>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => router.push("/admin/queue")}>Ke Papan Antrean</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Intake Unit Servis</h1>
        {prefill && (
          <span className="text-xs text-muted-foreground">Dari antrean · data terisi</span>
        )}
      </div>

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
            placeholder="Contoh: Lenovo ThinkPad X1 Carbon Gen 9, hitam"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Counter label="Adaptor / charger" value={acc.adaptor_ac} onDelta={(d) => bump("adaptor_ac", d)} />
          <Counter label="Kabel AC" value={acc.kabel_ac} onDelta={(d) => bump("kabel_ac", d)} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(
            [
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

      <Section title="Foto Unit">
        <PhotoUpload value={photos} onChange={setPhotos} disabled={submitting} />
      </Section>

      <Section title="Tanda Tangan Pelanggan">
        <SignaturePad onChange={setSignature} disabled={submitting} />
      </Section>

      <div className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={terms}
            onCheckedChange={(v) => setTerms(v === true)}
            className="mt-0.5"
          />
          <span>
            Pelanggan menyetujui syarat &amp; ketentuan servis Vicmic, termasuk biaya
            jasa dasar Rp 150.000 dan biaya cek/batal Rp 75.000 bila servis dibatalkan
            setelah diagnosa.
          </span>
        </label>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" /> Menyimpan…
            </>
          ) : (
            <>
              <Check /> Terima Unit &amp; Buat Tiket
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Counter({
  label,
  value,
  onDelta,
}: {
  label: string;
  value: number;
  onDelta: (delta: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Button type="button" size="icon-sm" variant="outline" onClick={() => onDelta(-1)}>
          <Minus className="size-3.5" />
        </Button>
        <span className="w-4 text-center text-sm tabular-nums">{value}</span>
        <Button type="button" size="icon-sm" variant="outline" onClick={() => onDelta(1)}>
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
