"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Wrench, PackageCheck, MessagesSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPE_LABEL, type ServiceType } from "@/lib/constants";
import { cn } from "@/lib/utils";

const CATEGORIES: {
  value: ServiceType;
  title: string;
  desc: string;
  icon: React.ElementType;
}[] = [
  {
    value: "service_baru",
    title: "Servis Baru",
    desc: "Titip unit untuk diperiksa / diperbaiki",
    icon: Wrench,
  },
  {
    value: "pengambilan_unit",
    title: "Pengambilan Unit",
    desc: "Ambil unit yang sudah selesai servis",
    icon: PackageCheck,
  },
  {
    value: "lain_lain",
    title: "Konsultasi / Pembelian / Lain-lain",
    desc: "Tanya-tanya, beli aksesori, dll",
    icon: MessagesSquare,
  },
];

const schema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 huruf")
    .max(100, "Nama terlalu panjang"),
  customer_phone: z
    .string()
    .trim()
    .min(8, "Nomor WhatsApp tidak valid")
    .max(25, "Nomor terlalu panjang")
    .regex(/^[0-9+\-\s()]+$/, "Format nomor tidak valid"),
  service_code: z.string().trim().max(50, "Terlalu panjang").optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewQueuePage() {
  const router = useRouter();
  const [category, setCategory] = useState<ServiceType | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customer_name: "", customer_phone: "", service_code: "" },
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: FormValues) {
    if (!category) {
      toast.error("Pilih kategori antrean dulu");
      return;
    }
    if (category === "pengambilan_unit" && !values.service_code?.trim()) {
      setError("service_code", { message: "Nomor tiket/nota servis wajib diisi" });
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_queue_ticket", {
      p_service_type: category,
      p_customer_name: values.customer_name,
      p_customer_phone: values.customer_phone,
      p_service_code:
        category === "pengambilan_unit"
          ? values.service_code?.trim() || undefined
          : undefined,
    });

    if (error || !data) {
      toast.error(error?.message ?? "Gagal membuat antrean. Coba lagi.");
      return;
    }

    try {
      localStorage.setItem("vicmic:lastQueueId", data.id);
    } catch {
      /* localStorage tidak tersedia — abaikan */
    }
    router.replace(`/queue/${data.id}`);
  }

  return (
    <PageShell back={{ href: "/" }}>
      <h1 className="text-lg font-semibold">Ambil Nomor Antrean</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pilih jenis keperluan Anda hari ini.
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                active
                  ? "border-[#0f172a] bg-[#0f172a]/5 ring-1 ring-[#0f172a]"
                  : "border-border bg-card hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-lg",
                  active ? "bg-[#0f172a] text-white" : "bg-muted text-foreground",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium leading-tight">{c.title}</span>
                <span className="text-xs text-muted-foreground">{c.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {category ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-6 flex flex-col gap-4"
          noValidate
        >
          <Field data-invalid={!!errors.customer_name}>
            <FieldLabel htmlFor="customer_name">Nama</FieldLabel>
            <Input
              id="customer_name"
              autoComplete="name"
              placeholder="Nama Anda"
              aria-invalid={!!errors.customer_name}
              {...register("customer_name")}
            />
            <FieldError>{errors.customer_name?.message}</FieldError>
          </Field>

          <Field data-invalid={!!errors.customer_phone}>
            <FieldLabel htmlFor="customer_phone">No. WhatsApp</FieldLabel>
            <Input
              id="customer_phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08xxxxxxxxxx"
              aria-invalid={!!errors.customer_phone}
              {...register("customer_phone")}
            />
            <FieldDescription>Untuk notifikasi status servis.</FieldDescription>
            <FieldError>{errors.customer_phone?.message}</FieldError>
          </Field>

          {category === "pengambilan_unit" ? (
            <Field data-invalid={!!errors.service_code}>
              <FieldLabel htmlFor="service_code">No. Tiket / Nota Servis</FieldLabel>
              <Input
                id="service_code"
                placeholder="Contoh: 20260902-0001"
                autoCapitalize="characters"
                aria-invalid={!!errors.service_code}
                {...register("service_code")}
              />
              <FieldDescription>
                Tertera di nota servis / struk penerimaan unit.
              </FieldDescription>
              <FieldError>{errors.service_code?.message}</FieldError>
            </Field>
          ) : null}

          <Button type="submit" size="lg" className="mt-2" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" /> Memproses…
              </>
            ) : (
              `Ambil Nomor (${SERVICE_TYPE_LABEL[category]})`
            )}
          </Button>
        </form>
      ) : null}
    </PageShell>
  );
}
