"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Keyboard, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type ScanStatus = "starting" | "scanning" | "found" | "denied" | "unsupported" | "error";

/** Ambil kode tiket dari hasil scan — bisa berupa URL lengkap (dari label
 *  cetak, mis. `https://vicmic-sc.vercel.app/t/VM-000123`) atau nomor tiket
 *  yang diketik manual. */
function extractTicketPath(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const match = text.match(/\/t\/([^/?#\s]+)/);
  if (match) return `/t/${match[1]}`;
  // Bukan tautan label kita — anggap teksnya sendiri adalah nomor tiket.
  if (/^[A-Za-z0-9-]{3,}$/.test(text)) return `/t/${encodeURIComponent(text)}`;
  return null;
}

/**
 * Scan QR code label unit langsung dari kamera perangkat. Pakai
 * `BarcodeDetector` bawaan browser kalau tersedia (Chrome/Edge/Android —
 * lebih cepat & hemat baterai), jatuh ke `jsQR` (decode manual per-frame di
 * canvas) kalau tidak — mis. Safari/iOS lama. Selalu ada input manual sebagai
 * cadangan kalau kamera tidak bisa diakses atau QR-nya sulit terbaca.
 */
export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const handledRef = useRef(false);

  const [status, setStatus] = useState<ScanStatus>("starting");
  const [manualValue, setManualValue] = useState("");

  const goToTicket = useCallback(
    (path: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setStatus("found");
      router.push(path);
    },
    [router],
  );

  const handleDecoded = useCallback(
    (raw: string) => {
      const path = extractTicketPath(raw);
      if (!path) {
        toast.warning("QR terbaca tapi bukan label tiket Vicmic.", { description: raw.slice(0, 80) });
        return;
      }
      goToTicket(path);
    },
    [goToTicket],
  );

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");

        if (typeof window !== "undefined" && window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const tickNative = async () => {
            if (cancelled || handledRef.current || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) {
                handleDecoded(codes[0].rawValue);
                return;
              }
            } catch {
              // frame belum siap / device tidak siap — coba lagi frame berikutnya
            }
            rafRef.current = requestAnimationFrame(tickNative);
          };
          rafRef.current = requestAnimationFrame(tickNative);
        } else {
          const { default: jsQR } = await import("jsqr");
          const tickFallback = () => {
            if (cancelled || handledRef.current) return;
            const v = videoRef.current;
            const canvas = canvasRef.current;
            if (v && canvas && v.readyState === v.HAVE_ENOUGH_DATA) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(frame.data, frame.width, frame.height, {
                  inversionAttempts: "dontInvert",
                });
                if (code?.data) {
                  handleDecoded(code.data);
                  return;
                }
              }
            }
            rafRef.current = requestAnimationFrame(tickFallback);
          };
          rafRef.current = requestAnimationFrame(tickFallback);
        }
      } catch (e) {
        if (cancelled) return;
        const name = (e as Error)?.name;
        setStatus(name === "NotAllowedError" || name === "PermissionDeniedError" ? "denied" : "error");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [handleDecoded]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const path = extractTicketPath(manualValue);
    if (!path) {
      toast.error("Format tidak dikenali. Masukkan nomor tiket atau tautan dari label.");
      return;
    }
    goToTicket(path);
  }

  const cameraActive = status === "scanning" || status === "found";

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <Card size="sm">
        <CardContent className="flex flex-col items-center gap-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className={cameraActive ? "size-full object-cover" : "hidden"}
            />
            <canvas ref={canvasRef} className="hidden" />

            {cameraActive && (
              <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/80" />
            )}

            {!cameraActive && (
              <div className="grid size-full place-items-center text-white/70">
                {status === "starting" && <Loader2 className="size-8 animate-spin" />}
                {status === "denied" && (
                  <div className="flex flex-col items-center gap-2 px-4 text-center text-sm">
                    <Camera className="size-8" />
                    <p>Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser.</p>
                  </div>
                )}
                {status === "unsupported" && (
                  <div className="flex flex-col items-center gap-2 px-4 text-center text-sm">
                    <Camera className="size-8" />
                    <p>Browser ini tidak mendukung akses kamera. Gunakan input manual di bawah.</p>
                  </div>
                )}
                {status === "error" && (
                  <div className="flex flex-col items-center gap-2 px-4 text-center text-sm">
                    <Camera className="size-8" />
                    <p>Kamera tidak bisa diakses. Coba lagi atau gunakan input manual.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {status === "scanning" && (
              <>
                <ScanLine className="size-3.5" /> Arahkan kamera ke QR code di label unit
              </>
            )}
            {status === "found" && (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Tiket ditemukan, membuka…
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent>
          <form onSubmit={submitManual} className="flex flex-col gap-2">
            <Field>
              <FieldLabel htmlFor="manual-ticket" className="flex items-center gap-1.5 text-xs">
                <Keyboard className="size-3.5" /> Atau masukkan manual
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="manual-ticket"
                  placeholder="Nomor tiket atau tautan label"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                />
                <Button type="submit" variant="outline">
                  Buka
                </Button>
              </div>
            </Field>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
