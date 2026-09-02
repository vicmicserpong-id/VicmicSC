-- Batasi bucket: maksimum 2 MB, hanya gambar
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/webp','image/jpeg','image/png']
where id = 'vicmic-photos';

-- Bucket sudah public -> objek bisa dibaca via URL publik tanpa policy.
-- Policy di bawah untuk operasi lewat Storage API oleh staf (list/upload/replace/hapus).
create policy "staff read vicmic-photos" on storage.objects
  for select to authenticated using (bucket_id = 'vicmic-photos');
create policy "staff upload vicmic-photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'vicmic-photos');
create policy "staff update vicmic-photos" on storage.objects
  for update to authenticated using (bucket_id = 'vicmic-photos') with check (bucket_id = 'vicmic-photos');
create policy "staff delete vicmic-photos" on storage.objects
  for delete to authenticated using (bucket_id = 'vicmic-photos');
