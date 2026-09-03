-- Status baru "PART_ARRIVED" (Part tiba) — dipisah dari PART_INSTALLING.
-- Sebelumnya admin menandai sparepart tiba langsung melompat ke
-- PART_INSTALLING ("Pemasangan sparepart"), padahal belum tentu ada
-- teknisi yang sedang memasangnya saat itu juga — bisa bikin teknisi lain
-- salah kira unit sudah ditangani. Sekarang: admin menandai tiba ->
-- PART_ARRIVED, lalu TEKNISI sendiri yang pindah ke PART_INSTALLING saat
-- benar-benar mulai memasang (lihat TICKET_STATUS_FLOW di lib/constants.ts).
alter type public.service_ticket_status add value if not exists 'PART_ARRIVED' after 'WAITING_PART';
