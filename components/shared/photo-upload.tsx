"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { uploadImage } from "@/lib/upload";
import { cn } from "@/lib/utils";

/**
 * Ambil / pilih beberapa foto unit. Tiap foto dikompres (WebP, maks 1280px,
 * ~150-200 KB) lalu diunggah ke Supabase Storage. `value` berisi URL publik.
 */
export function PhotoUpload({
  value,
  onChange,
  max = 8,
  disabled,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = max - value.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (picked.length < files.length) {
      toast.warning(`Maksimal ${max} foto.`);
    }

    setBusy((n) => n + picked.length);
    const uploaded: string[] = [];
    for (const file of picked) {
      try {
        uploaded.push(await uploadImage(file, "units"));
      } catch (e) {
        toast.error(`Gagal mengunggah ${file.name}: ${(e as Error).message}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (uploaded.length) onChange([...value, ...uploaded]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((url, i) => (
          <div
            key={url}
            className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10"
          >
            <Image
              src={url}
              alt={`Foto unit ${i + 1}`}
              fill
              sizes="120px"
              className="object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Hapus foto"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}

        {busy > 0 &&
          Array.from({ length: busy }).map((_, i) => (
            <div
              key={`busy-${i}`}
              className="grid aspect-square place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-foreground/10"
            >
              <Loader2 className="size-5 animate-spin" />
            </div>
          ))}

        {!disabled && value.length + busy < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "grid aspect-square place-items-center rounded-lg border border-dashed border-input text-muted-foreground transition-colors hover:bg-muted/50",
            )}
          >
            <Camera className="size-6" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <p className="text-xs text-muted-foreground">
        {value.length}/{max} foto · dikompres otomatis sebelum diunggah
      </p>
    </div>
  );
}
