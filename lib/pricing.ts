import { BASE_SERVICE_FEE, CANCEL_FEE } from "@/lib/constants";

export type PricingInput = {
  /** Servis dibatalkan pelanggan / unit tak bisa diperbaiki. */
  cancelled: boolean;
  /** Unit sudah melewati tahap diagnosa (menentukan biaya cek saat batal). */
  diagnosed: boolean;
  /** Ada pergantian sparepart atau paket servis tambahan yang disetujui. */
  hasPartsOrPackage: boolean;
  /** Total biaya part / paket yang disetujui pelanggan. */
  partsTotal: number;
};

export type PricingLine = { label: string; amount: number };

/**
 * Aturan biaya toko (PRD §2C):
 *  - Batal setelah dicek → Rp 75.000 (biaya cek saja). Batal sebelum dicek → Rp 0.
 *  - Ada part / paket     → biaya jasa dasar DITIADAKAN; pelanggan bayar total part saja.
 *  - Tanpa part           → biaya jasa dasar Rp 150.000.
 */
export function computeFinalCost(input: PricingInput): number {
  if (input.cancelled) return input.diagnosed ? CANCEL_FEE : 0;
  if (input.hasPartsOrPackage) return Math.max(0, Math.round(input.partsTotal));
  return BASE_SERVICE_FEE;
}

export function pricingBreakdown(input: PricingInput): {
  lines: PricingLine[];
  total: number;
} {
  const total = computeFinalCost(input);

  if (input.cancelled) {
    return {
      lines: [
        {
          label: input.diagnosed ? "Biaya cek / batal servis" : "Tidak ada biaya",
          amount: total,
        },
      ],
      total,
    };
  }

  if (input.hasPartsOrPackage) {
    return {
      lines: [
        { label: "Biaya part / paket servis", amount: total },
        { label: "Biaya jasa dasar (ditiadakan)", amount: 0 },
      ],
      total,
    };
  }

  return {
    lines: [{ label: "Biaya jasa dasar", amount: total }],
    total,
  };
}
