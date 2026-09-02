import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";

const ADMIN_ROLES = new Set(["admin", "owner"]);
const TECH_ROLES = new Set(["technician", "owner"]);

/**
 * Menyegarkan session Supabase pada setiap request + proteksi route staf.
 * - /admin/*  -> butuh role admin/owner
 * - /tech/*   -> butuh role technician/owner
 * - /login    -> redirect ke dashboard sesuai role bila sudah login
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // PENTING: jangan menaruh logika di antara createServerClient dan getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const inAdmin = path.startsWith("/admin");
  const inTech = path.startsWith("/tech");
  const inStaffArea = inAdmin || inTech;

  if (inStaffArea && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (inStaffArea || path === "/login")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = profile?.role ?? "admin";
    const home = TECH_ROLES.has(role) && !ADMIN_ROLES.has(role) ? "/tech/workbench" : "/admin/queue";

    if (path === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = home;
      return NextResponse.redirect(url);
    }
    if (inAdmin && !ADMIN_ROLES.has(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/tech/workbench";
      return NextResponse.redirect(url);
    }
    if (inTech && !TECH_ROLES.has(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/queue";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
