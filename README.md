# LensaKeuangan

**LensaKeuangan** adalah aplikasi pelacak keuangan pribadi responsif untuk mencatat pemasukan dan pengeluaran melalui pemindaian foto struk. Aplikasi dibangun dengan React, Express, tRPC, Drizzle ORM, dan MySQL/TiDB. Semua mutasi data mengharuskan pengguna yang terautentikasi, dan setiap query fitur selalu dibatasi dengan `userId` dari sesi saat ini.

## Sistem Visual Obsidian Canvas

Antarmuka memakai gaya **AI-native monokrom** bernama Obsidian Canvas: ruang hitam berlapis, grid data halus, panel gelap, dan aksen putih untuk menegaskan proses pemindaian serta insight keuangan. Tipografi menggunakan **Unbounded** untuk judul dan **Space Grotesk** untuk isi, dengan **DM Mono** untuk data teknis.

| Token | Hex | Peran |
|---|---:|---|
| Ink | `#050505` | Latar utama hitam. |
| Deep | `#0C0C0C` | Kedalaman navigasi dan permukaan kedua. |
| Panel | `#121212` | Kartu, form, dan kontainer data. |
| Stroke | `#303030` | Batas panel dan input. |
| White | `#F5F5F5` | Teks utama dan aksi primer. |
| Soft White | `#D8D8D8` | Penekanan sekunder dan ikon. |
| Muted | `#A7A7A7` | Teks penjelas dan metadata. |

Audit lokal melalui `node scripts/contrast-check.mjs` memverifikasi pasangan teks utama, teks sekunder, dan putih lembut terhadap permukaan Ink serta Panel. Semua pasangan yang diuji melewati ambang 4.5:1 untuk teks ukuran normal.

## Alur Scan dan Review

Pengguna dapat mengambil foto melalui `getUserMedia` atau memilih beberapa foto dari galeri. Setiap gambar yang diterima divalidasi sebagai JPG, PNG, atau WebP dengan batas **6 MB per foto** dan maksimum lima foto per upload. File diunggah ke penyimpanan S3 menggunakan helper server-side. Database hanya menyimpan `storageKey`, nama file, MIME type, status, dan metadata; byte gambar tidak pernah disimpan dalam tabel database.

Setelah upload, server memproses setiap struk memakai model multimodal **`gemini-3-flash-preview`**. Model dipanggil hanya dari server dan diwajibkan menghasilkan JSON yang mengikuti schema ketat. Payload kemudian divalidasi lagi dengan Zod sebelum menjadi hasil review. Hasil ambigu harus memakai `null`, sehingga pengguna dapat memperbaikinya pada layar review sebelum transaksi disetujui.

| Status receipt | Makna | Transisi berikutnya |
|---|---|---|
| `uploaded` | Foto tersimpan di object storage. | `processing` |
| `processing` | Model AI sedang mengekstrak data. | `needs_review` atau `failed` |
| `needs_review` | Hasil siap diperiksa dan diedit pengguna. | `approved` atau `failed` |
| `approved` | Transaksi dan item tersimpan sebagai catatan final. | Terminal |
| `failed` | Upload tersedia, tetapi ekstraksi atau review gagal. | `processing` melalui retry |

## Struktur Data

| Tabel | Kegunaan |
|---|---|
| `categories` | Kategori bawaan Indonesia dan kategori personal yang dimiliki user. |
| `receipts` | Metadata gambar struk dan `storageKey` S3. |
| `extraction_runs` | Audit pemrosesan AI, confidence, status, dan payload hasil tervalidasi. |
| `transactions` | Catatan keuangan yang disetujui pengguna. |
| `transaction_items` | Rincian item dari transaksi. |

Kategori bawaan pengeluaran meliputi **Makanan**, **Transport**, **Belanja**, **Tagihan**, **Hiburan**, **Kesehatan**, **Pendidikan**, dan **Lainnya**. Pengguna dapat membuat, mengubah, dan menghapus kategori personal; kategori bawaan dikunci untuk mempertahankan penamaan standar.

## Validasi Lokal

Jalankan perintah berikut dari root proyek:

```bash
pnpm check
pnpm test
```

Test mencakup aturan transisi status receipt, validasi schema ekstraksi, kategori bawaan Indonesia, logout, dan verifikasi bahwa router meneruskan user ID sesi ke query kategori, transaksi, serta review.

## Deploy ke Vercel

Proyek ini menyiapkan Vercel Function pada `api/index.ts`, static output Vite pada `dist/public`, serta SPA rewrite yang **tidak** menimpa request `/api/*`. Struktur ini mengikuti pola Express export dan static asset Vercel. [1] [2]

| Vercel setting | Nilai |
|---|---|
| Framework preset | Vite |
| Build command | `pnpm vercel:build` |
| Output directory | `dist/public` |
| API entrypoint | `api/index.ts` |
| Health check | `/api/health` |

Tambahkan variabel berikut pada **Project Settings → Environment Variables** di Vercel. Nilai sensitif tidak boleh dimasukkan ke GitHub atau diekspos dengan prefix `VITE_`.

| Kelompok | Variabel |
|---|---|
| Database dan session | `DATABASE_URL`, `JWT_SECRET` |
| Manus OAuth yang dipakai aplikasi | `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID` |
| Ekstraksi AI server-side | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` |
| Object storage portable | `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (bila diperlukan), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |

> Foto struk tetap berada di object storage. Database hanya menyimpan `storageKey`; aplikasi mengeluarkan signed URL pendek melalui endpoint terlindungi `/api/storage/*`, sehingga gambar tidak dijadikan aset publik maupun byte database.

Setelah repository terhubung ke Vercel, jalankan deployment dari dashboard Vercel dan atur OAuth redirect URL ke `https://<domain-anda>/api/oauth/callback`. Untuk preview deployment, gunakan environment variables Preview yang setara tetapi terpisah dari Production.

Template aman untuk nama variable, scope, dan contoh nilai non-secret tersedia di [`docs/vercel-env-example.md`](docs/vercel-env-example.md). Template tersebut sengaja tidak berupa `.env` agar tidak mudah terisi atau terdorong ke Git.

### Batasan serverless yang perlu diperhatikan

> Vercel menjalankan Express sebagai satu Function; static assets harus disajikan dari output/public directory, bukan bergantung pada `express.static()`. [1]

Proses ekstraksi receipt berjalan dalam request `process` atau `retry`, bukan worker yang hidup permanen. Karena function dapat berhenti ketika tidak ada traffic dan memiliki batas waktu eksekusi, jangan menambahkan antrian in-memory, polling, atau background process tanpa layanan eksternal. Gunakan MySQL/TiDB untuk data relasional dan S3-compatible storage untuk gambar; filesystem function tidak dipakai sebagai penyimpanan permanen. Signed URL receipt dibatasi lima menit dan diverifikasi terhadap `userId` sebelum redirect.

Model AI, database, OAuth, dan object storage semuanya memerlukan environment variable production yang valid. Tanpa `S3_*`, aplikasi tetap dapat dibangun tetapi upload receipt pada deployment Vercel sengaja akan gagal dengan pesan konfigurasi yang jelas, bukan menyimpan gambar ke filesystem atau database.

## GitHub

Repository dibuat privat agar kode dan konfigurasi aplikasi tidak terbuka. File `.env*`, folder `.vercel/`, dependency, log, serta build output tetap diabaikan oleh Git.

## Referensi

[1]: https://vercel.com/docs/frameworks/backend/express "Express on Vercel"
[2]: https://vercel.com/docs/frameworks/frontend/vite "Vite on Vercel"
