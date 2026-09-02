-- ── Notifikasi staf (lonceng) ─────────────────────────────────────────
-- Satu baris = satu event, ditargetkan ke sekumpulan role (mis. teknisi+owner).
-- Status "sudah dibaca" per staf disimpan terpisah (notification_reads) supaya
-- tiap orang punya status baca sendiri-sendiri.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  target_roles app_role[] not null,
  type text not null,
  title text not null,
  body text,
  link text,
  ticket_id uuid references public.service_tickets(id) on delete cascade,
  queue_id uuid references public.queues(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index idx_notifications_created on public.notifications (created_at desc);
create index idx_notifications_target_roles on public.notifications using gin (target_roles);

create table public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

create policy "Staff read notifications" on public.notifications
  for select to authenticated using (true);
create policy "Users manage own reads" on public.notification_reads
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.notifications;

-- ── Trigger: unit baru diterima -> notifikasi teknisi + owner ────────
create or replace function public.notify_new_ticket()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications (target_roles, type, title, body, link, ticket_id)
  values (
    array['technician','owner']::app_role[],
    'new_ticket',
    'Unit baru diterima',
    new.ticket_number || ' — ' || new.product_description,
    '/tech/workbench',
    new.id
  );
  return new;
end; $$;

create trigger trg_notify_new_ticket
  after insert on public.service_tickets
  for each row execute function public.notify_new_ticket();

-- ── Trigger: unit siap diambil -> notifikasi admin + owner ───────────
create or replace function public.notify_ticket_ready()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'READY_FOR_PICKUP' and old.status is distinct from new.status then
    insert into public.notifications (target_roles, type, title, body, link, ticket_id)
    values (
      array['admin','owner']::app_role[],
      'ready_pickup',
      'Unit siap diambil',
      new.ticket_number || ' — ' || new.customer_name,
      '/admin/pickup',
      new.id
    );
  end if;
  return new;
end; $$;

create trigger trg_notify_ticket_ready
  after update on public.service_tickets
  for each row execute function public.notify_ticket_ready();

-- ── Trigger: antrean baru -> notifikasi admin + owner ─────────────────
create or replace function public.notify_new_queue()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications (target_roles, type, title, body, link, queue_id)
  values (
    array['admin','owner']::app_role[],
    'new_queue',
    'Antrean baru',
    new.queue_number || ' — ' || new.customer_name,
    '/admin/queue',
    new.id
  );
  return new;
end; $$;

create trigger trg_notify_new_queue
  after insert on public.queues
  for each row execute function public.notify_new_queue();
