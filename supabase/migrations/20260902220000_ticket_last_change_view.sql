-- Baris terakhir per tiket dari service_ticket_logs — dipakai untuk menampilkan
-- "diubah oleh siapa" di daftar Workbench & Daftar Servis tanpa fetch semua log.
create or replace view public.service_ticket_last_change as
select distinct on (ticket_id)
  ticket_id,
  changed_by,
  new_status,
  created_at as changed_at
from public.service_ticket_logs
order by ticket_id, created_at desc;

grant select on public.service_ticket_last_change to authenticated;
