-- ── Ringkasan antrean untuk halaman depan publik (anon) ─────────────
-- Hanya angka agregat + nomor antrean yang sedang dipanggil. TANPA data
-- pribadi (nama / nomor HP pelanggan). Dipakai strip status di portal.
create or replace function public.public_queue_summary()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with today as (
    select status, service_type, queue_number, daily_seq
    from public.queues
    where queue_date = (now() at time zone 'Asia/Jakarta')::date
  )
  select jsonb_build_object(
    'waiting_total', (select count(*) from today where status = 'waiting'),
    'serving_total', (select count(*) from today where status = 'serving'),
    'waiting_by_type', (
      select coalesce(jsonb_object_agg(service_type::text, c), '{}'::jsonb)
      from (
        select service_type, count(*) as c
        from today
        where status = 'waiting'
        group by service_type
      ) g
    ),
    'now_serving', (
      select coalesce(jsonb_agg(queue_number order by daily_seq), '[]'::jsonb)
      from today
      where status = 'serving'
    ),
    'as_of', now()
  );
$$;

revoke all on function public.public_queue_summary() from public;
grant execute on function public.public_queue_summary() to anon, authenticated;
