import type { Database } from "@/lib/database.types";

export type ServiceType = Database["public"]["Enums"]["service_type_enum"];
export type QueueStatus = Database["public"]["Enums"]["queue_status_enum"];
export type WarrantyStatus = Database["public"]["Enums"]["warranty_status_enum"];
export type TicketStatus = Database["public"]["Enums"]["service_ticket_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];

// ── Biaya toko (PRD §2C) ──────────────────────────────────────────────
export const BASE_SERVICE_FEE = 150_000;
export const CANCEL_FEE = 75_000;

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
  WAITING_APPROVAL: "Menunggu persetujuan biaya",
  WAITING_PART: "Menunggu sparepart",
  PART_INSTALLING: "Pemasangan sparepart",
  IN_REPAIR: "Sedang diperbaiki",
  QC_TESTING: "Uji QC",
  READY_FOR_PICKUP: "Siap diambil",
  CLOSED: "Selesai / diserahkan",
  CANCELLED: "Dibatalkan",
};

/** Transisi status yang diizinkan dari status saat ini (dropdown teknisi). */
export const TICKET_STATUS_FLOW: Record<TicketStatus, TicketStatus[]> = {
  INTAKE: ["DIAGNOSING", "CANCELLED"],
  DIAGNOSING: ["WAITING_APPROVAL", "WAITING_PART", "IN_REPAIR", "CANCELLED"],
  WAITING_APPROVAL: ["IN_REPAIR", "WAITING_PART", "CANCELLED"],
  WAITING_PART: ["PART_INSTALLING", "CANCELLED"],
  PART_INSTALLING: ["IN_REPAIR", "QC_TESTING", "CANCELLED"],
  IN_REPAIR: ["QC_TESTING", "WAITING_PART", "CANCELLED"],
  QC_TESTING: ["READY_FOR_PICKUP", "IN_REPAIR"],
  READY_FOR_PICKUP: ["CLOSED", "IN_REPAIR"],
  CLOSED: [],
  CANCELLED: [],
};

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
  adaptor_ac: number;
  kabel_ac: number;
  tas_dus: boolean;
  stylus: boolean;
  mouse: boolean;
  keyboard: boolean;
  other: string;
};

export const DEFAULT_ACCESSORIES: AccessoriesShape = {
  adaptor_ac: 0,
  kabel_ac: 0,
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
