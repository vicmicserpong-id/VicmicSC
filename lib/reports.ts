import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  TICKET_STATUS_LABEL,
  WARRANTY_LABEL,
  type TicketStatus,
  type WarrantyStatus,
} from "@/lib/constants";
import { formatDateTimeWIB, monthBoundsWIB, monthLabelWIB, shiftMonth } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

// ── CSV ────────────────────────────────────────────────────────────
function csvEscape(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  // BOM supaya Excel membaca karakter non-ASCII (mis. "é", "ñ") dengan benar.
  return "﻿" + lines.join("\r\n");
}

type ExportTicketRow = {
  ticket_number: string;
  status: TicketStatus;
  customer_name: string;
  customer_phone: string;
  product_description: string;
  warranty_status: WarrantyStatus;
  assigned_technician: string | null;
  created_at: string;
  updated_at: string;
};

const EXPORT_SELECT =
  "ticket_number, status, customer_name, customer_phone, product_description, warranty_status, assigned_technician, created_at, updated_at";

function ticketsToCsv(rows: ExportTicketRow[], nameById: Map<string, string>): string {
  const headers = [
    "No. Tiket",
    "Status",
    "Nama Pelanggan",
    "No. WhatsApp",
    "Unit",
    "Garansi",
    "Teknisi",
    "Tanggal Masuk",
    "Terakhir Diperbarui",
  ];
  const body = rows.map((r) => [
    r.ticket_number,
    TICKET_STATUS_LABEL[r.status],
    r.customer_name,
    r.customer_phone,
    r.product_description,
    WARRANTY_LABEL[r.warranty_status],
    r.assigned_technician ? (nameById.get(r.assigned_technician) ?? "-") : "-",
    formatDateTimeWIB(r.created_at),
    formatDateTimeWIB(r.updated_at),
  ]);
  return toCsv(headers, body);
}

async function fetchProfilesMap(supabase: Client): Promise<Map<string, string>> {
  const { data } = await supabase.from("profiles").select("id, full_name");
  return new Map((data ?? []).map((p) => [p.id, p.full_name ?? "-"]));
}

/** CSV seluruh tiket servis (semua status, semua tanggal). */
export async function exportAllTicketsCsv(supabase: Client): Promise<string> {
  const [{ data: tickets }, nameById] = await Promise.all([
    supabase
      .from("service_tickets")
      .select(EXPORT_SELECT)
      .order("created_at", { ascending: false }),
    fetchProfilesMap(supabase),
  ]);
  return ticketsToCsv((tickets ?? []) as ExportTicketRow[], nameById);
}

/** CSV tiket berstatus CLOSED ("sudah diambil") yang diperbarui dalam bulan `yearMonth` (YYYY-MM). */
export async function exportMonthlyClosedCsv(
  supabase: Client,
  yearMonth: string,
): Promise<{ csv: string; count: number }> {
  const { start, end } = monthBoundsWIB(yearMonth);
  const [{ data: tickets }, nameById] = await Promise.all([
    supabase
      .from("service_tickets")
      .select(EXPORT_SELECT)
      .eq("status", "CLOSED")
      .gte("updated_at", start)
      .lt("updated_at", end)
      .order("updated_at", { ascending: true }),
    fetchProfilesMap(supabase),
  ]);
  const rows = (tickets ?? []) as ExportTicketRow[];
  return { csv: ticketsToCsv(rows, nameById), count: rows.length };
}

// ── Dashboard analitik ────────────────────────────────────────────
export type MonthlyReportData = {
  yearMonth: string;
  monthLabel: string;
  newCount: number;
  closedCount: number;
  cancelledCount: number;
  activeNow: number;
  avgTurnaroundDays: number | null;
  warrantyBreakdown: { status: WarrantyStatus; label: string; count: number }[];
  statusDistribution: { status: TicketStatus; label: string; count: number }[];
  perTechnicianClosed: { name: string; count: number }[];
  trend: { yearMonth: string; monthLabel: string; newCount: number; closedCount: number }[];
};

const WARRANTY_ORDER: WarrantyStatus[] = ["INW", "OOW", "CID", "DOA"];
const STATUS_ORDER: TicketStatus[] = [
  "INTAKE",
  "DIAGNOSING",
  "WAITING_APPROVAL",
  "WAITING_PART",
  "PART_INSTALLING",
  "IN_REPAIR",
  "QC_TESTING",
  "READY_FOR_PICKUP",
];

/** Kumpulkan seluruh angka untuk dashboard analitik admin/owner, untuk bulan `yearMonth`. */
export async function buildMonthlyReport(supabase: Client, yearMonth: string): Promise<MonthlyReportData> {
  const { start, end } = monthBoundsWIB(yearMonth);

  const [
    { count: newCount },
    { data: closedRows },
    { count: cancelledCount },
    { count: activeNow },
    { data: warrantyRows },
    { data: activeStatusRows },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("service_tickets")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("service_tickets")
      .select("created_at, updated_at, assigned_technician")
      .eq("status", "CLOSED")
      .gte("updated_at", start)
      .lt("updated_at", end),
    supabase
      .from("service_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "CANCELLED")
      .gte("updated_at", start)
      .lt("updated_at", end),
    supabase
      .from("service_tickets")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(CLOSED,CANCELLED)"),
    supabase
      .from("service_tickets")
      .select("warranty_status")
      .gte("created_at", start)
      .lt("created_at", end),
    supabase.from("service_tickets").select("status").not("status", "in", "(CLOSED,CANCELLED)"),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "-"]));

  const closed = closedRows ?? [];
  const durations = closed
    .map((t) => (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 86_400_000)
    .filter((d) => Number.isFinite(d) && d >= 0);
  const avgTurnaroundDays =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const perTechMap = new Map<string, number>();
  closed.forEach((t) => {
    if (t.assigned_technician) {
      perTechMap.set(t.assigned_technician, (perTechMap.get(t.assigned_technician) ?? 0) + 1);
    }
  });
  const perTechnicianClosed = [...perTechMap.entries()]
    .map(([id, count]) => ({ name: nameById.get(id) ?? "-", count }))
    .sort((a, b) => b.count - a.count);

  const warrantyCount = new Map<WarrantyStatus, number>();
  (warrantyRows ?? []).forEach((r) => {
    warrantyCount.set(r.warranty_status, (warrantyCount.get(r.warranty_status) ?? 0) + 1);
  });
  const warrantyBreakdown = WARRANTY_ORDER.map((status) => ({
    status,
    label: WARRANTY_LABEL[status],
    count: warrantyCount.get(status) ?? 0,
  }));

  const statusCount = new Map<TicketStatus, number>();
  (activeStatusRows ?? []).forEach((r) => {
    statusCount.set(r.status, (statusCount.get(r.status) ?? 0) + 1);
  });
  const statusDistribution = STATUS_ORDER.map((status) => ({
    status,
    label: TICKET_STATUS_LABEL[status],
    count: statusCount.get(status) ?? 0,
  })).filter((s) => s.count > 0);

  // Tren 6 bulan terakhir (termasuk bulan `yearMonth`).
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(yearMonth, i - 5));
  const trend = await Promise.all(
    months.map(async (ym) => {
      const b = monthBoundsWIB(ym);
      const [{ count: nc }, { count: cc }] = await Promise.all([
        supabase
          .from("service_tickets")
          .select("id", { count: "exact", head: true })
          .gte("created_at", b.start)
          .lt("created_at", b.end),
        supabase
          .from("service_tickets")
          .select("id", { count: "exact", head: true })
          .eq("status", "CLOSED")
          .gte("updated_at", b.start)
          .lt("updated_at", b.end),
      ]);
      return { yearMonth: ym, monthLabel: monthLabelWIB(ym), newCount: nc ?? 0, closedCount: cc ?? 0 };
    }),
  );

  return {
    yearMonth,
    monthLabel: monthLabelWIB(yearMonth),
    newCount: newCount ?? 0,
    closedCount: closed.length,
    cancelledCount: cancelledCount ?? 0,
    activeNow: activeNow ?? 0,
    avgTurnaroundDays,
    warrantyBreakdown,
    statusDistribution,
    perTechnicianClosed,
    trend,
  };
}
