# LensaKeuangan

**LensaKeuangan** adalah aplikasi pelacak keuangan pribadi responsif untuk mencatat pemasukan dan pengeluaran melalui pemindaian foto struk. Aplikasi dibangun dengan React, Express, tRPC, Drizzle ORM, dan MySQL/TiDB. Semua mutasi data mengharuskan pengguna yang terautentikasi, dan setiap query fitur selalu dibatasi dengan `userId` dari sesi saat ini.

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
