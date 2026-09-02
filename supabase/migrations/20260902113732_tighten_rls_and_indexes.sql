-- 1) Hindari re-evaluasi auth.uid() per baris (initplan)
drop policy "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 2) Hilangkan tumpang tindih policy di queues untuk role authenticated.
--    Policy publik cukup untuk anon; staf (authenticated) sudah dicakup "Staff manage queues".
drop policy "Public insert queue" on public.queues;
drop policy "Public view today queue" on public.queues;
create policy "Public insert queue" on public.queues
  for insert to anon with check (true);
create policy "Public view today queue" on public.queues
  for select to anon
  using (queue_date = (now() at time zone 'Asia/Jakarta')::date);

-- 3) Index penutup untuk foreign key
create index idx_queues_served_by     on public.queues (served_by);
create index idx_logs_changed_by      on public.service_ticket_logs (changed_by);
create index idx_tickets_intake_by    on public.service_tickets (intake_by);
create index idx_tickets_queue_id     on public.service_tickets (queue_id);
