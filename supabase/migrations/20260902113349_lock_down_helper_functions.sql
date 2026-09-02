-- Helper/trigger internal: tidak boleh dipanggil langsung via RPC.
-- Fungsi SECURITY DEFINER pemanggil (mis. create_queue_ticket) tetap bisa memakainya secara internal.
revoke all on function public.next_counter(text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

comment on table public.daily_counters is
  'Counter atomik per hari (nomor antrean & nomor tiket). RLS on tanpa policy = akses langsung ditolak; hanya lewat fungsi SECURITY DEFINER.';
