import Link from "next/link";
import { ClipboardList, Search, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Vicmic Service — Antrean & Servis Laptop",
};

export default function PortalPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-3 grid size-14 place-items-center rounded-2xl bg-[#0f172a] text-2xl font-bold text-white">
          V
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Vicmic Service</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selamat datang. Silakan pilih layanan di bawah.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/queue/new"
          className="group flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#0f172a] text-white">
            <ClipboardList className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="font-medium">Ambil Nomor Antrean</span>
            <span className="text-sm text-muted-foreground">
              Servis baru, pengambilan unit, atau konsultasi
            </span>
          </span>
          <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href="/tracking"
          className="group flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
            <Search className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="font-medium">Cek Status Servis</span>
            <span className="text-sm text-muted-foreground">
              Lacak unit Anda dengan nomor tiket
            </span>
          </span>
          <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Staf toko?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
