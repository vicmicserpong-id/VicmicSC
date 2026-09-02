create type app_role as enum ('admin', 'technician', 'owner');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar(100),
  role app_role not null default 'admin',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Read all profiles" on public.profiles
  for select to authenticated using (true);
create policy "Update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-buat profil saat user baru dibuat di Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::app_role, 'admin')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill user yang sudah ada (kalau ada)
insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data->>'full_name', email) from auth.users
on conflict (id) do nothing;

-- Helper: role user saat ini (dipakai di app untuk routing admin vs teknisi)
create or replace function public.current_role_name()
returns app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;
grant execute on function public.current_role_name() to authenticated;
