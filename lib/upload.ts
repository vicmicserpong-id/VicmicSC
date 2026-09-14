import imageCompression from "browser-image-compression";

/**
 * Kompres gambar sebelum upload: WebP, sisi terpanjang maks 1280px,
 * target ~150-200 KB. Selalu dijalankan sebelum kirim ke server foto.
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

/**
 * Kompres lalu unggah lewat /api/upload-photo — diteruskan server-ke-server
 * ke vicmic-file-server di hosting Exabytes (bukan Supabase Storage lagi,
 * supaya kuota Supabase tidak dipakai foto). Mengembalikan URL publik.
 */
export async function uploadImage(file: File | Blob, folder: "units"): Promise<string> {
  const compressed = await compressImage(file);

  const body = new FormData();
  body.set("file", compressed, "photo.webp");
  body.set("folder", folder);

  const res = await fetch("/api/upload-photo", { method: "POST", body });
  const data: { url?: string; error?: string } | null = await res.json().catch(() => null);
  if (!res.ok || !data?.url) {
    throw new Error(data?.error ?? "Gagal mengunggah foto.");
  }
  return data.url;
}
