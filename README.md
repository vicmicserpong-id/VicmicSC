# Vicmic Service SuperApp

Sistem terintegrasi **antrean meja depan**, **penerimaan unit servis (Work Order)**,
**alur kerja teknisi FIFO**, upload foto ke **Supabase Storage**, dan **rekap email
harian otomatis**. PWA — bisa di-install di HP pelanggan maupun tablet staf.

## Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| UI | Tailwind CSS v4 + shadcn/ui (Base UI) |
| PWA | `@ducanh2912/next-pwa` |
| Database / Auth / Realtime | Supabase (PostgreSQL) |
| Object storage | **Supabase Storage** (bucket `vicmic-photos`) — *bukan Cloudflare R2* |
| Kompresi gambar | `browser-image-compression` (WebP, ≤1280px, ~150–200 KB) |
| Tanda tangan | `react-signature-canvas` |
| Email | Resend |
| Hosting & Cron | Vercel |

## Setup lokal

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya (lihat di bawah)
npm run dev
```

### Environment variables

| Var | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon key (JWT) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | secret — server only (cron) |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | ✅ | `vicmic-photos` |
| `NEXT_PUBLIC_APP_URL` | – | URL publik (metadata/OG). Kosong = auto pakai URL Vercel |
| `RESEND_API_KEY` | – | tanpa ini, email dilewati (app tetap jalan) |
| `RESEND_FROM` | – | `Vicmic Service <noreply@domain>` (domain harus terverifikasi di Resend) |
| `RECAP_EMAIL_RECIPIENT` | – | tujuan email rekap harian (boleh Gmail biasa) |
| `CRON_SECRET` | – | token acak untuk mengamankan `/api/cron/daily-report` |

## Database

Skema + RPC + RLS ada di [`supabase/migrations/`](supabase/migrations/). Terapkan lewat
Supabase SQL Editor (urut nama file) atau `supabase db push`.

- Tabel: `queues`, `service_tickets`, `service_ticket_logs`, `profiles`, `daily_counters`
- RPC: `create_queue_ticket`, `next_ticket_number`, `pull_next_ticket` (FIFO, `FOR UPDATE SKIP LOCKED`), `public_track_ticket`
- Timezone DB di-set `Asia/Jakarta`; `queue_date` default eksplisit WIB
- Nomor antrean & tiket anti-race via `daily_counters` (`INSERT … ON CONFLICT … RETURNING`)

**Buat user staf:** Supabase → Authentication → Users → Add user (Auto Confirm).
Trigger otomatis membuat baris `profiles` (`role = 'admin'`). Ubah role bila perlu:

```sql
update public.profiles set role = 'technician' where id = '<uuid>';
-- role: 'admin' (meja depan) | 'technician' (workbench) | 'owner' (keduanya)
```

## Deploy (Vercel)

1. Import repo di [vercel.com/new](https://vercel.com/new) → framework Next.js (auto).
2. Isi semua environment variables (lihat tabel di atas).
3. Deploy. Tiap `git push` ke `main` = auto-deploy.
4. Cron `/api/cron/daily-report` terdaftar otomatis dari [`vercel.json`](vercel.json)
   (jadwal `0 15 * * *` UTC = **22:00 WIB**). Vercel menyuntik header
   `Authorization: Bearer $CRON_SECRET` sendiri.

## Peta route

```
/                         Portal QR pelanggan
/queue/new                Ambil nomor antrean (kategori A/B/C)
/queue/[id]               Tiket antrean digital (nomor + antrean di depan, realtime)
/tracking                 Cek status servis (nomor tiket)
/login                    Masuk staf
/admin/queue              Papan panggil meja depan (realtime)
/admin/intake/new         Form intake unit (foto, tanda tangan)
/admin/pickup             Validasi & penyerahan unit
/tech/workbench           Dashboard teknisi + Tarik Tiket FIFO
/tech/workbench/[id]      Detail tiket + ubah status + riwayat
/api/cron/daily-report    Rekap harian (cron)
```

## Alur status servis

`INTAKE → DIAGNOSING → {WAITING_APPROVAL | WAITING_PART → PART_INSTALLING | IN_REPAIR}
→ QC_TESTING → READY_FOR_PICKUP → CLOSED` (atau `CANCELLED` dari beberapa titik).
Transisi yang diizinkan didefinisikan di `lib/constants.ts` → `TICKET_STATUS_FLOW`.

## Aturan biaya (`lib/pricing.ts`)

- Biaya jasa dasar **Rp 150.000** — otomatis **ditiadakan** bila ada part/paket yang disetujui (pelanggan hanya bayar part).
- Biaya cek / batal **Rp 75.000** — bila servis dibatalkan setelah diagnosa.

## Catatan penyimpangan dari PRD

- **Object storage**: Supabase Storage, bukan Cloudflare R2 (R2 minta kartu kredit).
- **Upload**: langsung dari browser ke Storage (RLS staf) + kompres wajib di klien — bukan lewat `/api/upload`.
- **Next.js 15** (bukan 14); **shadcn v4 / Base UI** (bukan Radix).
- **Cron 22:00 WIB** = `0 15 * * *` UTC (PRD tulis `0 22` yang sebenarnya 05:00 WIB).
- API route `/api/queue/next` & `/api/ticket/pull-fifo` tidak dibuat — diganti panggilan RPC + Server Actions.
