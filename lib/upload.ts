import imageCompression from "browser-image-compression";

import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKET } from "@/lib/constants";

/**
 * Kompres gambar sebelum upload: WebP, sisi terpanjang maks 1280px,
 * target ~150-200 KB. Selalu dijalankan sebelum kirim ke Supabase Storage.
 */
export async function compressImage(file: File | Blob): Promise<File> {
  const input =
    file instanceof File ? file : new File([file], "image", { type: file.type || "image/png" });
  return imageCompression(input, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 1280,
    fileType: "image/webp",
    initialQuality: 0.8,
    useWebWorker: true,
  });
}

/** Kompres lalu upload ke bucket `vicmic-photos`. Mengembalikan URL publik. */
export async function uploadImage(
  file: File | Blob,
  folder: "units" | "signatures",
): Promise<string> {
  const compressed = await compressImage(file);
  const supabase = createClient();
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, compressed, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** dataURL (dari signature canvas) -> Blob */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
