import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/constants";

/** Foto unit pada tiket yang sudah tuntas (Selesai/Dibatalkan) dihapus setelah sekian hari. */
export const PHOTO_RETENTION_DAYS = 14;

/** Ambil path relatif-ke-bucket dari URL publik Supabase Storage, atau null. */
function supabaseStoragePath(url: string): string | null {
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  try {
    return decodeURIComponent(url.slice(i + marker.length));
  } catch {
    return url.slice(i + marker.length);
  }
}

/** Ambil path relatif (mis. "units/2026/09/xxxx.webp") dari URL vicmic-file-server, atau null. */
function fileServerPath(url: string): string | null {
  const uploadUrl = process.env.PHOTO_UPLOAD_URL;
  if (!uploadUrl) return null;
  try {
    const fileHost = new URL(uploadUrl).host;
    const u = new URL(url);
    if (u.host !== fileHost) return null;
    const marker = "/uploads/";
    const i = u.pathname.indexOf(marker);
    if (i === -1) return null;
    return decodeURIComponent(u.pathname.slice(i + marker.length));
  } catch {
    return null;
  }
}

/** Minta vicmic-file-server menghapus satu file. Lempar error kalau gagal. */
async function deleteFromFileServer(path: string): Promise<void> {
  const deleteUrl = process.env.PHOTO_DELETE_URL;
  const secret = process.env.PHOTO_UPLOAD_SECRET;
  if (!deleteUrl || !secret) {
    throw new Error("PHOTO_DELETE_URL / PHOTO_UPLOAD_SECRET belum diset.");
  }
  const res = await fetch(deleteUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
      // Hosting Exabytes memblokir request tanpa User-Agent yang wajar (dianggap bot).
      "User-Agent": "Mozilla/5.0 (compatible; VicmicServiceApp/1.0; +https://service.vicmic.id)",
    },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const data: { error?: string } | null = await res.json().catch(() => null);
    throw new Error(data?.error ?? `vicmic-file-server membalas status ${res.status}.`);
  }
}

export type PhotoCleanupResult = {
  ticketsCleaned: number;
  filesDeleted: number;
  errors: string[];
};

/**
 * Hapus foto unit (Storage + kolom photos_url) untuk tiket CLOSED/CANCELLED
 * yang sudah tidak berubah lebih dari PHOTO_RETENTION_DAYS hari — supaya
 * kuota penyimpanan tidak penuh. Menangani DUA sumber foto sekaligus:
 * foto lama di Supabase Storage (peninggalan sebelum migrasi) dan foto baru
 * di vicmic-file-server (hosting Exabytes). Best-effort: satu tiket/foto
 * gagal tidak menghentikan yang lain.
 */
export async function cleanupOldTicketPhotos(): Promise<PhotoCleanupResult> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - PHOTO_RETENTION_DAYS * 86_400_000).toISOString();

  const { data: tickets, error } = await supabase
    .from("service_tickets")
    .select("id, ticket_number, photos_url")
    .in("status", ["CLOSED", "CANCELLED"])
    .lt("updated_at", cutoff)
    .not("photos_url", "is", null)
    .limit(200);

  if (error) {
    return { ticketsCleaned: 0, filesDeleted: 0, errors: [error.message] };
  }

  let ticketsCleaned = 0;
  let filesDeleted = 0;
  const errors: string[] = [];

  for (const t of tickets ?? []) {
    const photos = t.photos_url ?? [];
    if (photos.length === 0) continue;

    const supabasePaths: string[] = [];
    const fileServerPaths: string[] = [];
    for (const url of photos) {
      const sp = supabaseStoragePath(url);
      if (sp) {
        supabasePaths.push(sp);
        continue;
      }
      const fp = fileServerPath(url);
      if (fp) fileServerPaths.push(fp);
    }

    let ok = true;

    if (supabasePaths.length > 0) {
      const { error: rmErr } = await supabase.storage.from(STORAGE_BUCKET).remove(supabasePaths);
      if (rmErr) {
        errors.push(`${t.ticket_number} (Supabase): ${rmErr.message}`);
        ok = false;
      } else {
        filesDeleted += supabasePaths.length;
      }
    }

    for (const path of fileServerPaths) {
      try {
        await deleteFromFileServer(path);
        filesDeleted += 1;
      } catch (e) {
        errors.push(`${t.ticket_number} (Exabytes): ${(e as Error).message}`);
        ok = false;
      }
    }

    if (!ok) continue;

    const { error: updErr } = await supabase
      .from("service_tickets")
      .update({ photos_url: [] })
      .eq("id", t.id);
    if (updErr) {
      errors.push(`${t.ticket_number} (update kolom): ${updErr.message}`);
      continue;
    }
    ticketsCleaned += 1;
  }

  return { ticketsCleaned, filesDeleted, errors };
}
