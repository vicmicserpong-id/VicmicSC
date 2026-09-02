-- ── Buat tiket antrean secara atomik (dipanggil pelanggan anon) ──────
create or replace function public.create_queue_ticket(
  p_service_type service_type_enum,
  p_customer_name text,
  p_customer_phone text,
  p_service_code text default null
) returns public.queues
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_seq integer;
  v_row public.queues;
begin
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Nama pelanggan wajib diisi';
  end if;
  if p_customer_phone is null or length(trim(p_customer_phone)) = 0 then
    raise exception 'Nomor WhatsApp wajib diisi';
  end if;
  if p_service_type = 'pengambilan_unit'
     and (p_service_code is null or length(trim(p_service_code)) = 0) then
    raise exception 'Nomor tiket/nota servis wajib untuk pengambilan unit';
  end if;

  v_prefix := case p_service_type
    when 'service_baru' then 'A'
    when 'pengambilan_unit' then 'B'
    else 'C' end;

  v_seq := public.next_counter('queue:' || p_service_type::text);

  insert into public.queues
    (queue_number, daily_seq, service_type, service_code, customer_name, customer_phone)
  values
    (v_prefix || '-' || lpad(v_seq::text, 2, '0'), v_seq, p_service_type,
     nullif(trim(coalesce(p_service_code, '')), ''), trim(p_customer_name), trim(p_customer_phone))
  returning * into v_row;

  return v_row;
end; $$;

revoke all on function public.create_queue_ticket(service_type_enum, text, text, text) from public;
grant execute on function public.create_queue_ticket(service_type_enum, text, text, text) to anon, authenticated;

-- ── Nomor tiket servis: VMC-YYYYMMDD-### ────────────────────────────
create or replace function public.next_ticket_number()
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  select 'VMC-' || to_char((now() at time zone 'Asia/Jakarta'), 'YYYYMMDD') || '-' ||
         lpad(public.next_counter('ticket')::text, 3, '0');
$$;
grant execute on function public.next_ticket_number() to authenticated;

-- ── Tarik tiket FIFO: kunci tiket INTAKE tertua ke teknisi ──────────
create or replace function public.pull_next_ticket(p_technician uuid)
returns public.service_tickets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.service_tickets;
begin
  if p_technician is null then
    raise exception 'Teknisi tidak valid';
  end if;

  select * into v_row
  from public.service_tickets
  where status = 'INTAKE'
  order by created_at asc
  limit 1
  for update skip locked;

  if not found then
    return null;
  end if;

  update public.service_tickets
  set status = 'DIAGNOSING', assigned_technician = p_technician, updated_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into public.service_ticket_logs
    (ticket_id, previous_status, new_status, changed_by, notes)
  values
    (v_row.id, 'INTAKE', 'DIAGNOSING', p_technician, 'Ditarik via FIFO');

  return v_row;
end; $$;

revoke all on function public.pull_next_ticket(uuid) from public;
grant execute on function public.pull_next_ticket(uuid) to authenticated;

-- ── Tracking mandiri pelanggan (anon) — hanya status, tanpa data pribadi ──
create or replace function public.public_track_ticket(p_ticket_number text)
returns table (
  ticket_number varchar(30),
  product_description varchar(150),
  status service_ticket_status,
  estimated_cost numeric(12,2),
  final_cost numeric(12,2),
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select ticket_number, product_description, status, estimated_cost, final_cost, created_at, updated_at
  from public.service_tickets
  where ticket_number = upper(trim(p_ticket_number))
  limit 1;
$$;
revoke all on function public.public_track_ticket(text) from public;
grant execute on function public.public_track_ticket(text) to anon, authenticated;
