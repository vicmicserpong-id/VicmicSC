import Link from "next/link";

import { cn } from "@/lib/utils";

/** Wadah mobile-first di tengah layar untuk halaman pelanggan. */
export function PageShell({
  children,
  className,
  back,
}: {
  children: React.ReactNode;
  className?: string;
  back?: { href: string; label?: string };
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-10 pt-4">
      <header className="mb-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-[#0f172a] text-sm font-bold text-white">
            V
          </span>
          <span className="text-sm font-semibold tracking-tight">Vicmic Service</span>
        </Link>
        {back ? (
          <Link
            href={back.href}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {back.label ?? "Kembali"}
          </Link>
        ) : null}
      </header>
      <main className={cn("flex flex-1 flex-col", className)}>{children}</main>
    </div>
  );
}
