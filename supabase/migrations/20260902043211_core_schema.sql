-- Operasikan DB dalam zona WIB (mempermudah query ad-hoc & CURRENT_DATE)
alter database postgres set timezone to 'Asia/Jakarta';

-- ── Enums ─────────────────────────────────────────────────────────────
create type service_type_enum as enum ('service_baru', 'pengambilan_unit', 'lain_lain');
create type queue_status_enum as enum ('waiting', 'serving', 'completed', 'canceled');
create type warranty_status_enum as enum ('INW', 'OOW', 'CID', 'DOA');
create type service_ticket_status as enum (
  'INTAKE','DIAGNOSING','WAITING_APPROVAL','WAITING_PART','PART_INSTALLING',
  'IN_REPAIR','QC_TESTING','READY_FOR_PICKUP','CLOSED','CANCELLED'
);

-- ── Counter harian atomik (nomor antrean & nomor tiket) ──────────────
create table public.daily_counters (
  scope text not null,
  day   date not null,
  value integer not null default 0,
  primary key (scope, day)
);
alter table public.daily_counters enable row level security;
-- tanpa policy: hanya diakses lewat fungsi SECURITY DEFINER

create or replace function public.next_counter(p_scope text)
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.daily_counters (scope, day, value)
  values (p_scope, (now() at time zone 'Asia/Jakarta')::date, 1)
  on conflict (scope, day) do update set value = daily_counters.value + 1
  returning value;
$$;

-- ── queues ──────────────────────────────────────────────────────────
create table public.queues (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  queue_number varchar(10) not null,
  daily_seq integer not null,
  service_type service_type_enum not null,
  service_code varchar(50),
  customer_name varchar(100) not null,
  customer_phone varchar(25) not null,
  status queue_status_enum not null default 'waiting',
  served_by uuid references auth.users(id),
  served_at timestamptz,
  completed_at timestamptz,
  queue_date date not null default (now() at time zone 'Asia/Jakarta')::date,
  unique (queue_date, service_type, daily_seq)
);
create index idx_queues_active on public.queues (queue_date, status);
create index idx_queues_type_seq on public.queues (queue_date, service_type, daily_seq);

-- ── service_tickets ─────────────────────────────────────────────────
create table public.service_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number varchar(30) unique not null,
  queue_id uuid references public.queues(id),
  customer_name varchar(100) not null,
  customer_phone varchar(25) not null,
  customer_phone_alt varchar(25),
  customer_email varchar(100),
  product_description varchar(150) not null,
  mtm_number varchar(100),
  serial_number varchar(100),
  warranty_status warranty_status_enum not null default 'OOW',
  accessories jsonb not null default '{
    "adaptor_ac": 0, "kabel_ac": 0, "tas_dus": false, "stylus": false,
    "mouse": false, "keyboard": false, "other": ""
  }'::jsonb,
  complaint_description text not null,
  physical_condition_tags text[],
  physical_notes text,
  photos_url text[],
  base_service_fee numeric(12,2) not null default 150000,
  cancel_fee numeric(12,2) not null default 75000,
  estimated_cost numeric(12,2) not null default 0,
  final_cost numeric(12,2) not null default 0,
  status service_ticket_status not null default 'INTAKE',
  assigned_technician uuid references auth.users(id),
  intake_by uuid not null references auth.users(id),
  part_notes text,
  qc_notes text,
  customer_signature_url text,
  terms_accepted boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tickets_status_created on public.service_tickets (status, created_at);
create index idx_tickets_technician on public.service_tickets (assigned_technician);
create index idx_tickets_number on public.service_tickets (ticket_number);

-- ── service_ticket_logs ─────────────────────────────────────────────
create table public.service_ticket_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.service_tickets(id) on delete cascade,
  previous_status service_ticket_status,
  new_status service_ticket_status not null,
  changed_by uuid not null references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_logs_ticket on public.service_ticket_logs (ticket_id, created_at);

-- ── updated_at otomatis ─────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end; $$;
create trigger trg_touch_service_tickets
  before update on public.service_tickets
  for each row execute function public.touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.queues enable row level security;
alter table public.service_tickets enable row level security;
alter table public.service_ticket_logs enable row level security;

create policy "Public insert queue" on public.queues
  for insert to anon, authenticated with check (true);
create policy "Public view today queue" on public.queues
  for select to anon, authenticated using (queue_date = (now() at time zone 'Asia/Jakarta')::date);
create policy "Staff manage queues" on public.queues
  for all to authenticated using (true) with check (true);

create policy "Staff manage tickets" on public.service_tickets
  for all to authenticated using (true) with check (true);
create policy "Staff manage logs" on public.service_ticket_logs
  for all to authenticated using (true) with check (true);

-- ── Realtime ────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.queues;
alter publication supabase_realtime add table public.service_tickets;
