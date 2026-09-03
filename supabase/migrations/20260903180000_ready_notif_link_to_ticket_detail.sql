-- Notifikasi "Unit siap diambil" untuk admin: arahkan ke detail servis,
-- bukan ke halaman pengambilan.
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
      '/admin/tickets/' || new.id,
      new.id
    );
  end if;
  return new;
end; $$;

-- Perbaiki notifikasi lama yang masih menunjuk ke /admin/pickup.
update public.notifications
set link = '/admin/tickets/' || ticket_id
where type = 'ready_pickup'
  and link = '/admin/pickup'
  and ticket_id is not null;
