-- Satu baris per nomor WhatsApp unik — "bank data" pelanggan, diringkas dari
-- riwayat service_tickets. View biasa (bukan tabel baru), jadi selalu sinkron
-- otomatis tanpa duplikasi data.
create or replace view public.customer_directory as
select
  customer_phone as phone,
  (array_agg(customer_name order by created_at desc))[1] as name,
  (array_agg(customer_email order by created_at desc)
    filter (where customer_email is not null and customer_email <> ''))[1] as email,
  count(*) as total_tickets,
  min(created_at) as first_visit,
  max(created_at) as last_visit,
  (array_agg(product_description order by created_at desc))[1] as last_product,
  (array_agg(status order by created_at desc))[1] as last_status
from public.service_tickets
group by customer_phone;

grant select on public.customer_directory to authenticated;
