# LaundryKu

Aplikasi manajemen laundry berbasis HTML, CSS, JavaScript, dan Supabase. Autentikasi memakai Supabase Auth dan transaksi disimpan di PostgreSQL Supabase dengan Row Level Security; aplikasi tidak memakai demo data atau `localStorage`.

## Menjalankan lokal

```bash
python -m http.server 8000
```

Buka `http://localhost:8000`. Jalankan `supabase-schema.sql` di SQL Editor sebelum membuat akun. Jika project sudah pernah memakai schema lama, jalankan juga `supabase-migration-username.sql`. Login dapat menggunakan username atau email. Tidak diperlukan Vite, Node.js, atau proses build.

## Struktur

- `index.html` — dashboard dan autentikasi Supabase
- `data-laundry.html` — daftar transaksi dengan filter/pencarian
- `laporan.html` — ringkasan laporan dan ekspor CSV
- `script.js` — Supabase Auth, query transaksi, dan interaksi
- `supabase-config.js` — konfigurasi koneksi Supabase browser
- `supabase-schema.sql` — tabel, trigger profile, dan Row Level Security
- `supabase-migration-username.sql` — migrasi username untuk database lama
