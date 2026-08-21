# Lanjutkan Pengembangan di IDE Antigravity

Repository ini dapat langsung dibuka dari GitHub di IDE Antigravity. Stack aplikasinya terdiri dari **React 19 + Vite** di `client/`, **Express + tRPC** di `server/`, serta **MySQL/TiDB + Drizzle ORM** untuk data relasional.

## Menjalankan lokal

1. Clone repository dan buka folder root proyek di Antigravity.
2. Jalankan `pnpm install`.
3. Buat file `.env.local` secara lokal saja, lalu isi `DATABASE_URL`, `JWT_SECRET`, konfigurasi OAuth, AI, dan storage berdasarkan tabel di [`vercel-env-example.md`](vercel-env-example.md). Jangan commit file tersebut.
4. Jalankan `pnpm db:push` untuk membuat atau menerapkan migrasi Drizzle ke database MySQL/TiDB Anda.
5. Jalankan `pnpm dev`, kemudian buka URL yang ditampilkan server.

## Data dan migrasi

Skema database berada pada `drizzle/schema.ts`, sedangkan migrasi disimpan pada `drizzle/migrations/`. Saat mengubah tabel, lakukan urutan berikut:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
pnpm check
pnpm test
```

Data baru harus selalu memakai `userId` dari sesi terautentikasi. Jangan menyimpan byte gambar di MySQL/TiDB; tabel `receipts` hanya menyimpan metadata dan `storageKey`.

## Receipt, storage, dan AI

Untuk development lokal atau deployment non-Manus, gunakan object storage S3-compatible melalui `STORAGE_DRIVER=s3` dan variabel `S3_*`. Upload disimpan di bucket, sedangkan endpoint `/api/storage/*` memverifikasi pemilik receipt sebelum mengarahkan ke signed URL singkat.

Ekstraksi struk tetap harus dipanggil dari server melalui model `gemini-3-flash-preview`. Jangan memindahkan `BUILT_IN_FORGE_API_KEY` atau key provider AI ke kode React atau variable berprefix `VITE_`.

## Area pengembangan utama

| Kebutuhan | Lokasi utama |
|---|---|
| Halaman dan tampilan | `client/src/pages/`, `client/src/components/`, `client/src/index.css` |
| Kontrak API tRPC | `server/routers.ts` |
| Query terisolasi per pengguna | `server/db.ts` |
| Skema dan migrasi | `drizzle/schema.ts`, `drizzle/migrations/` |
| Upload dan S3 | `server/receiptUpload.ts`, `server/storage.ts` |
| AI receipt extraction | `server/receiptExtraction.ts` |
| Test | `server/*.test.ts` |

Sebelum push, jalankan `pnpm check`, `pnpm test`, dan `pnpm build`. Untuk Vercel, gunakan `VERCEL=1 pnpm vercel:build`.
