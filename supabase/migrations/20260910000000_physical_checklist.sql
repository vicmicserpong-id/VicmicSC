-- Checklist kondisi fisik terstruktur saat intake (menggantikan tag bebas
-- physical_condition_tags untuk tiket baru). Tiket lama tetap memakai kolom
-- lama; kolom baru default '{}'.
alter table public.service_tickets
  add column if not exists physical_checklist jsonb not null default '{}'::jsonb;
