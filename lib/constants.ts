import type { Database } from "@/lib/database.types";

export type ServiceType = Database["public"]["Enums"]["service_type_enum"];
export type QueueStatus = Database["public"]["Enums"]["queue_status_enum"];
export type WarrantyStatus = Database["public"]["Enums"]["warranty_status_enum"];
export type TicketStatus = Database["public"]["Enums"]["service_ticket_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];

// ── Peran staf ──────────────────────────────────────────────────────
export const APP_ROLES: AppRole[] = ["admin", "technician", "owner"];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin Meja Depan",
  technician: "Teknisi",
  owner: "Owner",
};

// ── Antrean ──────────────────────────────────────────────────────────
export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  service_baru: "Servis Baru",
  pengambilan_unit: "Pengambilan Unit",
  lain_lain: "Konsultasi / Pembelian / Lain-lain",
};

export const SERVICE_TYPE_PREFIX: Record<ServiceType, string> = {
  service_baru: "A",
  pengambilan_unit: "B",
  lain_lain: "C",
};

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  waiting: "Menunggu",
  serving: "Sedang dilayani",
  completed: "Selesai",
  canceled: "Batal",
};

// ── Status servis ────────────────────────────────────────────────────
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  INTAKE: "Diterima",
  DIAGNOSING: "Diagnosa",
  WAITING_APPROVAL: "Menunggu persetujuan",
  WAITING_PART: "Menunggu sparepart",
  PART_ARRIVED: "Part tiba",
  PART_INSTALLING: "Pemasangan sparepart",
  IN_REPAIR: "Sedang diperbaiki",
  QC_TESTING: "Uji QC",
  READY_FOR_PICKUP: "Siap diambil",
  CLOSED: "Selesai / diserahkan",
  CANCELLED: "Dibatalkan",
};

/**
 * Transisi status yang diizinkan untuk TEKNISI — murni MAJU, tidak ada
 * jalur mundur/lateral. Koreksi/pembalikan status hanya lewat override OWNER
 * (lihat lib/actions/tickets.ts -> updateTicketStatus).
 *
 * Alur teknisi BERAKHIR di IN_REPAIR / PART_INSTALLING — Uji QC (QC_TESTING)
 * dijalankan ADMIN, bukan teknisi (lihat TICKET_STATUS_FLOW_ADMIN). Jadi dari
 * PART_INSTALLING & IN_REPAIR teknisi cuma bisa membatalkan; admin yang
 * memindahkan ke QC_TESTING.
 *
 * WAITING_PART bukan wewenang teknisi (kosong di bawah) — teknisi cuma bisa
 * MENGAJUKAN permintaan sparepart (requestSparepart), lalu admin yang
 * memesan & menandai tiba. Begitu tiba (PART_ARRIVED), giliran teknisi lagi
 * yang pindah ke PART_INSTALLING begitu benar-benar mulai memasang — supaya
 * tidak ada teknisi lain yang salah kira unit sudah ditangani padahal cuma
 * partnya yang baru sampai. Dari PART_INSTALLING teknisi juga bisa eskalasi
 * balik ke WAITING_PART (escalateForPart) — di luar peta ini.
 */
export const TICKET_STATUS_FLOW: Record<TicketStatus, TicketStatus[]> = {
  INTAKE: ["DIAGNOSING", "CANCELLED"],
  DIAGNOSING: ["WAITING_APPROVAL", "IN_REPAIR", "CANCELLED"],
  WAITING_APPROVAL: ["IN_REPAIR", "CANCELLED"],
  WAITING_PART: [],
  PART_ARRIVED: ["PART_INSTALLING", "CANCELLED"],
  PART_INSTALLING: ["CANCELLED"],
  IN_REPAIR: ["CANCELLED"],
  QC_TESTING: [],
  READY_FOR_PICKUP: [],
  CLOSED: [],
  CANCELLED: [],
};

/**
 * Transisi yang boleh dilakukan ADMIN (meja depan). Admin menjalankan Uji QC:
 * dari IN_REPAIR / PART_INSTALLING -> QC_TESTING, lalu LULUS (READY_FOR_PICKUP)
 * atau TOLAK -> kembali ke DIAGNOSING (mulai dari awal, alasan wajib). Plus
 * serah-terima unit READY_FOR_PICKUP -> CLOSED.
 */
export const TICKET_STATUS_FLOW_ADMIN: Partial<Record<TicketStatus, TicketStatus[]>> = {
  IN_REPAIR: ["QC_TESTING"],
  PART_INSTALLING: ["QC_TESTING"],
  QC_TESTING: ["READY_FOR_PICKUP", "DIAGNOSING"],
  READY_FOR_PICKUP: ["CLOSED"],
};

// ── Alur permintaan sparepart ──────────────────────────────────────
export type PartRequestStatus = Database["public"]["Enums"]["part_request_status"];

export const PART_STATUS_LABEL: Record<PartRequestStatus, string> = {
  none: "Tidak ada permintaan",
  requested: "Diminta teknisi",
  ordered: "Sudah dipesan",
  arrived: "Sudah tiba",
};

/** Status tiket di mana teknisi masih boleh mengajukan permintaan sparepart. */
export const PART_REQUEST_ELIGIBLE_STATUSES: TicketStatus[] = [
  "DIAGNOSING",
  "WAITING_APPROVAL",
  "IN_REPAIR",
  "PART_INSTALLING",
];

/** Status yang dihitung "selesai hari ini" untuk rekap harian. */
export const DONE_STATUSES: TicketStatus[] = ["READY_FOR_PICKUP", "CLOSED"];

// ── Garansi ─────────────────────────────────────────────────────────
export const WARRANTY_LABEL: Record<WarrantyStatus, string> = {
  INW: "In Warranty (INW)",
  OOW: "Out of Warranty (OOW)",
  CID: "Customer Induced Damage (CID)",
  DOA: "Dead on Arrival (DOA)",
};

// ── Intake ──────────────────────────────────────────────────────────
export const PHYSICAL_CONDITION_TAGS = [
  "Baret halus",
  "Baret dalam",
  "Penyok / dent",
  "Engsel longgar",
  "Bezel / frame retak",
  "LCD bergaris",
  "LCD blank / redup",
  "Keyboard rusak",
  "Trackpad bermasalah",
  "Port longgar",
  "Baterai kembung",
  "Segel rusak",
  "Ada bekas bongkar",
  "Kotor / berdebu",
  "Karet kaki hilang",
] as const;

export type AccessoriesShape = {
  adaptor_ac: boolean;
  kabel_ac: boolean;
  tas_dus: boolean;
  stylus: boolean;
  mouse: boolean;
  keyboard: boolean;
  other: string;
};

export const DEFAULT_ACCESSORIES: AccessoriesShape = {
  adaptor_ac: false,
  kabel_ac: false,
  tas_dus: false,
  stylus: false,
  mouse: false,
  keyboard: false,
  other: "",
};

export const ACCESSORY_LABEL: Record<keyof AccessoriesShape, string> = {
  adaptor_ac: "Adaptor / charger",
  kabel_ac: "Kabel AC",
  tas_dus: "Tas / dus",
  stylus: "Stylus / pen",
  mouse: "Mouse",
  keyboard: "Keyboard eksternal",
  other: "Lainnya",
};

// ── Storage ─────────────────────────────────────────────────────────
export const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "vicmic-photos";
