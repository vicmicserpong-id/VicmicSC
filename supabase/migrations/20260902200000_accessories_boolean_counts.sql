-- Adaptor/charger & kabel AC berubah dari counter (angka) jadi checkbox (boolean),
-- menyamakan pola dengan kelengkapan lain.
alter table public.service_tickets
  alter column accessories set default '{
    "adaptor_ac": false, "kabel_ac": false, "tas_dus": false, "stylus": false,
    "mouse": false, "keyboard": false, "other": ""
  }'::jsonb;

update public.service_tickets
set accessories = jsonb_set(
  jsonb_set(
    accessories,
    '{adaptor_ac}',
    to_jsonb(coalesce((accessories->>'adaptor_ac')::numeric, 0) > 0)
  ),
  '{kabel_ac}',
  to_jsonb(coalesce((accessories->>'kabel_ac')::numeric, 0) > 0)
)
where jsonb_typeof(accessories->'adaptor_ac') = 'number'
   or jsonb_typeof(accessories->'kabel_ac') = 'number';
