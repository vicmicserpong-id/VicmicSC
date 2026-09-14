import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_FOLDERS = new Set(["units", "signatures"]);

/**
 * Proxy upload foto: browser staf -> route ini (same-origin, tanpa CORS) ->
 * vicmic-file-server di hosting Exabytes (server-ke-server; token rahasia
 * PHOTO_UPLOAD_SECRET tidak pernah sampai ke klien). Menggantikan Supabase
 * Storage yang kuotanya mepet — lihat lib/upload.ts.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi berakhir. Silakan masuk ulang." }, { status: 401 });
  }

  const uploadUrl = process.env.PHOTO_UPLOAD_URL;
  const secret = process.env.PHOTO_UPLOAD_SECRET;
  if (!uploadUrl || !secret) {
    return NextResponse.json(
      { error: "Upload foto belum dikonfigurasi di server (PHOTO_UPLOAD_URL/PHOTO_UPLOAD_SECRET)." },
      { status: 500 },
    );
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json({ error: "Body permintaan tidak valid." }, { status: 400 });
  }

  const file = incoming.get("file");
  const folder = incoming.get("folder");
  if (!(file instanceof File) || typeof folder !== "string" || !ALLOWED_FOLDERS.has(folder)) {
    return NextResponse.json({ error: "Berkas atau folder tidak valid." }, { status: 400 });
  }

  const forward = new FormData();
  forward.set("file", file, "photo.webp");
  forward.set("folder", folder);

  let upstream: Response;
  try {
    upstream = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      body: forward,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Tidak bisa menghubungi server foto: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  const data: { url?: string; error?: string } | null = await upstream.json().catch(() => null);
  if (!upstream.ok || !data?.url) {
    return NextResponse.json(
      { error: data?.error ?? `Server foto membalas status ${upstream.status}.` },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: data.url });
}
