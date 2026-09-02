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
| Email | Resend (notifikasi, rekap harian & bulanan dgn lampiran CSV) |
| Hosting & Cron | Vercel |
| Brand | Logo Vicmic Serpong (`public/logo-mark.png` — dipakai di UI & ikon PWA/favicon; `public/logo.png` — lockup lengkap dgn wordmark) |

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
| `RECAP_EMAIL_RECIPIENT` | – | tujuan email rekap harian & bulanan (boleh Gmail biasa) |
| `CRON_SECRET` | – | token acak untuk mengamankan `/api/cron/daily-report` & `/api/cron/monthly-report` |

## Database

Skema + RPC + RLS ada di [`supabase/migrations/`](supabase/migrations/). Terapkan lewat
Supabase SQL Editor (urut nama file) atau `supabase db push`.

- Tabel: `queues`, `service_tickets`, `service_ticket_logs`, `profiles`, `daily_counters`,
  `notifications`, `notification_reads`
- View: `service_ticket_last_change` (baris log terakhir per tiket — dipakai untuk kolom
  "diubah oleh" di Workbench & Daftar Servis tanpa fetch semua log), `customer_directory`
  (satu baris per nomor WhatsApp, diringkas dari riwayat `service_tickets` — "bank data"
  pelanggan, lihat bagian Pelanggan di bawah)
- RPC: `create_queue_ticket`, `next_ticket_number`, `pull_next_ticket` (FIFO, `FOR UPDATE SKIP LOCKED`), `public_track_ticket`
- Timezone DB di-set `Asia/Jakarta`; `queue_date` default eksplisit WIB
- Nomor antrean anti-race via `daily_counters` (reset harian, format `A-01`/`B-01`/`C-01`)
- Nomor tiket servis via sequence global `ticket_seq` (**tidak** reset harian) — format
  `YYYYMMDD-XXXX`, mis. `20260902-0001`. Angka tetap lanjut walau tanggal berganti, supaya
  tidak ada nomor yang ambigu antar hari.

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
4. Cron terdaftar otomatis dari [`vercel.json`](vercel.json). Vercel menyuntik header
   `Authorization: Bearer $CRON_SECRET` sendiri:
   - `/api/cron/daily-report` — `0 15 * * *` UTC = **22:00 WIB**, tiap hari.
   - `/api/cron/monthly-report` — `0 1 1 * *` UTC = **08:00 WIB tgl 1**, kirim rekap bulan
     yang baru tutup (unit selesai/diambil + lampiran CSV).

## Peta route

```
/                         Portal QR pelanggan
/queue/new                Ambil nomor antrean (kategori A/B/C)
/queue/[id]               Tiket antrean digital (nomor + antrean di depan, realtime)
/tracking                 Cek status servis (nomor tiket)
/login                    Masuk staf
/admin/queue              Papan panggil meja depan (realtime)
/admin/tickets            Daftar Servis — papan status Kanban semua tiket (realtime,
                          pencarian, "diubah oleh", ekspor CSV)
/admin/intake/new         Servis Baru — form penerimaan unit (foto)
/admin/pickup             Validasi & penyerahan unit
/admin/tickets/[id]       Detail tiket — ubah status (lihat "Alur status servis" di
                          bawah untuk batasan per role), edit data / hapus tiket
/admin/tickets/[id]/edit  Koreksi data tiket (salah input saat Servis Baru) — admin/owner
/admin/tickets/[id]/print Cetak label QR (thermal 58mm) — admin/owner
/admin/reports            Laporan — dashboard analitik + ekspor/kirim rekap bulanan — admin/owner
/admin/customers          Pelanggan — bank data pelanggan + ekspor CSV — admin/owner
/admin/staff              Kelola staf (owner) + reset data uji coba
/tech/workbench           Dashboard teknisi + Tarik Tiket FIFO (tiket yg sudah ditarik saja
                          yang terlihat — tiket baru sengaja disembunyikan, lihat di bawah)
/tech/workbench/[id]      Detail tiket — teknisi mengikuti alur status (tak bisa mundur)
/t/[ticket_number]        Shortlink hasil scan QR label — redirect ke halaman detail yang
                          benar sesuai role yang scan (teknisi/admin/owner)
/api/cron/daily-report    Rekap harian (cron)
/api/cron/monthly-report  Rekap bulanan + lampiran CSV unit selesai (cron)
```

## Alur status servis

`INTAKE → DIAGNOSING → {WAITING_APPROVAL | IN_REPAIR} → [WAITING_PART → PART_INSTALLING] →
QC_TESTING → READY_FOR_PICKUP → CLOSED` (atau `CANCELLED` dari beberapa titik). Transisi yang
diizinkan didefinisikan di `lib/constants.ts` → `TICKET_STATUS_FLOW`.

Server action tunggal `lib/actions/tickets.ts` → `updateTicketStatus()` menegakkan ini
berdasarkan role pemanggil — **tiga tingkat**, makin ke atas makin longgar:
- **Teknisi**: hanya boleh mengikuti `TICKET_STATUS_FLOW` — alur MAJU murni, tanpa jalur
  mundur/lateral sama sekali (mis. `QC_TESTING` tidak bisa balik ke `IN_REPAIR`), dan **tidak**
  termasuk `WAITING_PART`/`PART_INSTALLING` (lihat alur sparepart di bawah — itu wewenang
  admin). Semua teknisi bisa melihat & mengubah **semua** tiket yang sudah ditarik (bukan cuma
  yang mereka tarik sendiri), supaya unit tidak macet kalau teknisi yang menarik sedang libur.
  Tiket **baru** (`INTAKE`, belum ditarik siapa pun) sengaja **tidak muncul** di daftar
  Workbench — supaya teknisi tidak bisa pilih-pilih dan urutan antrean tetap terjaga.
  Satu-satunya jalan masuk adalah tombol "Tarik Tiket Berikutnya (FIFO)", yang mengunci
  tiket `INTAKE` tertua (RPC `pull_next_ticket`, `FOR UPDATE SKIP LOCKED`) dan langsung
  menandainya `DIAGNOSING` untuk teknisi tersebut. Server action `updateTicketStatus`
  menolak setiap upaya teknisi mengubah status langsung dari `INTAKE` (harus lewat FIFO).
  Meninggalkan status `DIAGNOSING` (ke tujuan mana pun) mewajibkan **catatan diagnosa**
  (`diagnosis_notes`).
- **Admin**: **hanya** boleh mengubah `READY_FOR_PICKUP` → `CLOSED` (menyerahkan unit ke
  pelanggan) lewat panel status umum — tidak bisa mengubah status bolak-balik di titik lain
  sama sekali. Ini otomatis menutup antrean pengambilan terkait juga (sama seperti lewat
  `/admin/pickup`). Admin/owner ADA dua transisi tambahan di luar panel ini, khusus lewat
  alur sparepart (lihat di bawah).
- **Owner**: bebas pindah ke status apa pun lewat panel status umum (mis. mengoreksi
  kesalahan atau membalik status), TAPI wajib mengisi catatan alasan perubahan. Ini
  satu-satunya jalan resmi untuk koreksi status di luar alur normal.

Setiap perubahan status selalu tercatat di `service_ticket_logs` (siapa, dari status apa,
ke status apa, catatan, waktu) dan ditampilkan di riwayat tiket ("Riwayat") — tidak bisa
dipalsukan/dihapus dari UI. Baris terakhirnya juga ditampilkan sebagai "diubah oleh {nama}"
di daftar Workbench & Daftar Servis (lewat view `service_ticket_last_change`), supaya
langsung kelihatan siapa yang terakhir menyentuh status suatu tiket tanpa buka detail.

Admin/owner juga bisa **mengoreksi data tiket** (nama, kontak, deskripsi unit, kelengkapan,
keluhan, kondisi fisik) lewat `/admin/tickets/[id]/edit`, atau **menghapus tiket** sepenuhnya
(mis. salah input/tiket ganda) lewat tombol Hapus di halaman detail — keduanya ditolak untuk
role teknisi (`lib/auth.ts` → `requireFrontDesk()`).

Aplikasi ini murni untuk **alur kerja (workflow)** — pelacakan biaya/pembayaran per unit
tidak lagi ditampilkan di intake, workbench, maupun pengambilan.

## Alur permintaan sparepart

Server actions di `lib/actions/spareparts.ts` (gerbang `lib/auth.ts` →
`requireWorkbench()`/`requireFrontDesk()`), melacak status di kolom baru
`service_tickets.part_status` (`none → requested → ordered → arrived`):

1. **Teknisi/owner** mengklik "Request Sparepart" di halaman detail tiket (muncul saat status
   `DIAGNOSING`/`WAITING_APPROVAL`/`IN_REPAIR`/`PART_INSTALLING`) → `requestSparepart()`.
   Ini **tidak mengubah status tiket** — hanya menyimpan kebutuhan part (`part_notes`) +
   notifikasi ke admin/owner ("Sparepart diminta").
2. **Admin/owner** menekan "Tandai Sudah Dipesan" setelah memesan part →
   `markPartOrdered()` → status tiket jadi `WAITING_PART`.
3. Begitu part tiba, **admin/owner** menekan "Tandai Sparepart Tiba" → `markPartArrived()` →
   status tiket jadi `PART_INSTALLING`, teknisi dinotifikasi ("Sparepart tiba").
4. **Teknisi** melanjutkan dari `PART_INSTALLING` seperti biasa (→ `QC_TESTING` → ...).

## QR code & cetak label thermal

Tiap tiket punya satu QR (halaman "Cetak Label" di detail tiket, admin/owner) yang berisi
tautan `/t/{nomor_tiket}` — di-scan siapa pun (teknisi atau admin/owner) langsung diarahkan ke
halaman detail tiket yang sesuai perannya, tanpa perlu cari manual di daftar. Berguna ditempel
di unit fisiknya supaya gampang dicek ulang statusnya.

Halaman cetak (`app/(admin)/admin/tickets/[id]/print/`) diset untuk label thermal continuous
**58mm** (`@page { size: 58mm auto }`) — asumsi printer POS/label kecil yang umum dipakai toko
di Indonesia. Kalau printer Kakak beda ukuran (mis. 80mm) atau berupa printer label khusus
(Bluetooth, app sendiri seperti Niimbot/Phomemo — bukan printer biasa lewat driver OS), kabari
saya modelnya supaya disesuaikan.

## Laporan & ekspor (`/admin/reports`, admin/owner)

Logika angkanya ada di `lib/reports.ts` (dipakai bareng oleh Server Action & cron, supaya
sekali hitung dua kali pakai):

- **Dashboard analitik**, per bulan (bisa navigasi bulan sebelumnya/berikutnya): unit masuk,
  unit selesai (diambil), dibatalkan, sedang berjalan (snapshot sekarang), rata-rata waktu
  pengerjaan, unit masuk per status garansi (INW/OOW/CID/DOA), sebaran status tiket aktif
  saat ini, unit selesai per teknisi, dan tren 6 bulan terakhir (masuk vs. selesai).
- **Ekspor CSV** (buka langsung di Excel — ada BOM UTF-8):
  - Tombol "Ekspor CSV" di Daftar Servis (`/admin/tickets`) — seluruh tiket, semua status/tanggal.
  - Tombol "Ekspor CSV (selesai bulan ini)" di halaman Laporan — hanya tiket `CLOSED` pada
    bulan yang sedang dilihat.
- **Kirim rekap ke email owner**:
  - Tombol "Kirim ke Email Sekarang" di halaman Laporan — kirim rekap + lampiran CSV bulan
    yang sedang dilihat, kapan saja, ke `RECAP_EMAIL_RECIPIENT`.
  - Cron bulanan `/api/cron/monthly-report` (`0 1 1 * *` UTC = 08:00 WIB tgl 1) — otomatis
    kirim rekap bulan yang baru tutup, tanpa perlu diminta.

## Notifikasi (lonceng di header)

Ikon lonceng ada di header semua area staf (`components/shared/notification-bell.tsx`),
realtime lewat Supabase Realtime + badge jumlah belum dibaca. Event dibuat otomatis lewat
**trigger database** (`supabase/migrations/20260903000000_notifications.sql`), bukan kode
aplikasi — jadi selalu konsisten apa pun jalur yang memicunya:

| Event | Target | Sumber |
|---|---|---|
| Unit baru diterima | Teknisi + owner | Trigger DB `trg_notify_new_ticket` (insert `service_tickets`) |
| Unit siap diambil | Admin + owner | Trigger DB `trg_notify_ticket_ready` (update status → `READY_FOR_PICKUP`) |
| Antrean baru masuk | Admin + owner | Trigger DB `trg_notify_new_queue` (insert `queues`) |
| Sparepart diminta | Admin + owner | Server action `requestSparepart()` |
| Sparepart tiba | Teknisi + owner | Server action `markPartArrived()` |

Dua yang terakhir dibuat dari Server Action (bukan trigger), karena bagian dari alur
sparepart di bawah — insert-nya lewat policy `"Staff create notifications"` (insert,
`to authenticated with check (true)` — konsisten dengan model RLS "terbuka utk staf,
ditegakkan di level aplikasi" yang dipakai di semua tabel lain).

Status "sudah dibaca" per staf disimpan di `notification_reads` (satu baris per
notifikasi × user), jadi tiap orang punya status baca sendiri-sendiri meski memakai
device/tablet yang sama secara bergantian.

## Pelanggan / bank data (`/admin/customers`, admin/owner)

View `customer_directory` meringkas seluruh riwayat `service_tickets` jadi satu baris per
nomor WhatsApp (nama, email, total servis, kunjungan pertama/terakhir, produk & status
terakhir) — tanpa tabel/data baru, selalu sinkron otomatis. Halaman Pelanggan menampilkan
ini sebagai daftar yang bisa dicari & diekspor CSV (`exportCustomersCsvAction`), supaya bisa
dipakai owner untuk **remarketing/promo** (mis. broadcast WhatsApp) di luar aplikasi.

Sengaja **tidak** dibuatkan fitur kirim pesan massal otomatis dari dalam aplikasi — broadcast
promo menyentuh isu consent/anti-spam WhatsApp yang sebaiknya pemilik kendalikan sendiri lewat
tool broadcast resmi (mis. WhatsApp Business), bukan dikirim otomatis oleh sistem.

## Catatan penyimpangan dari PRD

- **Object storage**: Supabase Storage, bukan Cloudflare R2 (R2 minta kartu kredit).
- **Upload**: langsung dari browser ke Storage (RLS staf) + kompres wajib di klien — bukan lewat `/api/upload`.
- **Tanda tangan pelanggan**: dihapus dari alur Servis Baru — kolom `customer_signature_url` masih ada di skema untuk kompatibilitas, tapi tidak diisi lagi.
- **Next.js 15** (bukan 14); **shadcn v4 / Base UI** (bukan Radix).
- **Cron 22:00 WIB** = `0 15 * * *` UTC (PRD tulis `0 22` yang sebenarnya 05:00 WIB).
- API route `/api/queue/next` & `/api/ticket/pull-fifo` tidak dibuat — diganti panggilan RPC + Server Actions.
- **Biaya jasa dasar / biaya batal** di PRD §2C **tidak lagi ditegakkan di UI** — atas
  permintaan pemilik, aplikasi difokuskan murni untuk pelacakan alur kerja servis, bukan
  pembayaran. Kolom biaya masih ada di skema (`base_service_fee`, `cancel_fee`,
  `estimated_cost`, `final_cost`) untuk kompatibilitas masa depan, tapi tidak diisi lagi.
