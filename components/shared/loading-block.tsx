import { Loader2 } from "lucide-react";

/**
 * Indikator "sedang memuat" generik — dipakai di setiap loading.tsx supaya
 * pindah halaman tidak terasa "diam saja" sebelum kontennya siap.
 */
export function LoadingBlock({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      {label}
    </div>
  );
}
