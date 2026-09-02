import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Semua path kecuali:
     * - _next/static, _next/image
     * - file statis umum (svg/png/jpg/…), favicon, ikon PWA, manifest, service worker
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|workbox-|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
