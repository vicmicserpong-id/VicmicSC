"use client";

import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Papan tanda tangan pelanggan. `onChange` menerima dataURL PNG saat selesai
 * membubuhkan coretan, atau null saat dibersihkan.
 */
export function SignaturePad({
  onChange,
  disabled,
}: {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<SignatureCanvas>(null);
  const [width, setWidth] = useState(0);
  const height = 176;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function clear() {
    padRef.current?.clear();
    onChange(null);
  }

  function handleEnd() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      onChange(null);
      return;
    }
    onChange(pad.toDataURL("image/png"));
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wrapRef}
        className="overflow-hidden rounded-lg border border-input bg-white"
        style={{ height }}
      >
        {width > 0 && (
          <SignatureCanvas
            ref={padRef}
            penColor="#0f172a"
            canvasProps={{ width, height, className: "touch-none" }}
            onEnd={handleEnd}
            clearOnResize={false}
          />
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Bubuhkan tanda tangan di area putih.
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clear}
          disabled={disabled}
        >
          <Eraser className="size-3.5" /> Hapus
        </Button>
      </div>
    </div>
  );
}
