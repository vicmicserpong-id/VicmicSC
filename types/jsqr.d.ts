/**
 * Native browser QR/barcode decoder (Chrome/Edge/Android; belum tersedia di
 * semua browser, mis. Safari lama) — dipakai kalau ada, dengan jsQR sebagai
 * fallback software. `jsqr` sudah membawa tipe TypeScript-nya sendiri
 * (`dist/index.d.ts`), jadi tidak perlu dideklarasikan ulang di sini.
 */
declare global {
  interface BarcodeDetectorOptions {
    formats?: string[];
  }

  interface DetectedBarcode {
    rawValue: string;
    format: string;
  }

  class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions);
    detect(image: CanvasImageSource): Promise<DetectedBarcode[]>;
  }

  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }
}

export {};
