-- Nomor tiket kini YYYYMMDD-XXXX dengan sequence GLOBAL (tidak reset tiap hari),
-- untuk menghindari kesalahan pencarian antar tanggal. Prefix "VMC-" dihapus.
create sequence if not exists public.ticket_seq start with 1 increment by 1;

create or replace function public.next_ticket_number()
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  select to_char((now() at time zone 'Asia/Jakarta'), 'YYYYMMDD') || '-' ||
         lpad(nextval('public.ticket_seq')::text, 4, '0');
$$;

grant execute on function public.next_ticket_number() to authenticated;
grant usage on sequence public.ticket_seq to authenticated;
