-- ── Catatan diagnosa + alur permintaan sparepart teknisi <-> admin ────
create type public.part_request_status as enum ('none', 'requested', 'ordered', 'arrived');

alter table public.service_tickets
  add column diagnosis_notes text,
  add column part_status public.part_request_status not null default 'none';

-- Teknisi tidak lagi mengubah status ke WAITING_PART / PART_INSTALLING sendiri —
-- itu jadi wewenang admin (lewat markPartOrdered/markPartArrived di
-- lib/actions/spareparts.ts) setelah teknisi mengajukan permintaan sparepart.
-- (Tidak ada perubahan skema untuk ini — TICKET_STATUS_FLOW yang dipersempit
-- ada di lib/constants.ts, ditegakkan lib/actions/tickets.ts.)

-- Notifications sejauh ini cuma diisi lewat trigger (SECURITY DEFINER, bypass RLS).
-- Alur sparepart butuh Server Action meng-insert notifikasi langsung sebagai staf
-- yang login, jadi perlu policy insert (konsisten dgn tabel lain yg "terbuka utk
-- staf, ditegakkan di level aplikasi").
create policy "Staff create notifications" on public.notifications
  for insert to authenticated with check (true);
