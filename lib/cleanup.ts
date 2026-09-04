import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/constants";

/** Foto unit pada tiket yang sudah tuntas (Selesai/Dibatalkan) dihapus setelah sekian hari. */
export const PHOTO_RETENTION_DAYS = 14;

/** Ambil path relatif-ke-bucket dari URL publik Supabase Storage. */
function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  try {
    return decodeURIComponent(url.slice(i + marker.length));
  } catch {
    return url.slice(i + marker.length);
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
 * kuota Supabase Storage (paket gratis) tidak penuh. Best-effort: satu
 * tiket gagal tidak menghentikan yang lain.
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

    const paths = photos
      .map(storagePathFromPublicUrl)
      .filter((p): p is string => !!p);

    if (paths.length > 0) {
      const { error: rmErr } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
      if (rmErr) {
        errors.push(`${t.ticket_number}: ${rmErr.message}`);
        continue;
      }
      filesDeleted += paths.length;
    }

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
