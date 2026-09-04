-- Nomor Work Order / RMA vendor (mis. Lenovo) — dicatat saat intake,
-- dipakai staf untuk mencari tiket selain no. tiket internal / SN.
alter table public.service_tickets
  add column wo_rma_number varchar(100);
