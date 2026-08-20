# Template Environment Vercel

> Salin **nama** variabel berikut ke **Vercel → Project Settings → Environment Variables**. Jangan commit nilai asli, dan jangan memberi prefix `VITE_` pada secret server-side.

| Variabel | Berlaku untuk | Nilai contoh aman | Catatan |
|---|---|---|---|
| `VITE_APP_ID` | Client | `app-id-dari-oauth` | ID aplikasi OAuth yang boleh dibaca browser. |
| `VITE_OAUTH_PORTAL_URL` | Client | `https://api.manus.im` | Base URL portal OAuth. |
| `DATABASE_URL` | Server | `mysql://...` | URL database MySQL/TiDB yang dapat diakses dari Vercel. |
| `JWT_SECRET` | Server | `ganti-dengan-random-secret` | Generate secret panjang dan unik untuk production. |
| `OAUTH_SERVER_URL` | Server | `https://api.manus.im` | URL server OAuth. |
| `OWNER_OPEN_ID` | Server | `owner-open-id` | ID pemilik aplikasi. |
| `BUILT_IN_FORGE_API_URL` | Server | `https://...` | Endpoint server-side untuk ekstraksi AI bila masih memakai Forge. |
| `BUILT_IN_FORGE_API_KEY` | Server | `ganti-dengan-secret` | Jangan pernah diberi prefix `VITE_`. |
| `STORAGE_DRIVER` | Server | `s3` | Wajib `s3` untuk storage portable di Vercel. |
| `S3_BUCKET` | Server | `receipt-bucket` | Bucket image receipt. |
| `S3_REGION` | Server | `ap-southeast-1` atau `auto` | Region provider object storage. |
| `S3_ENDPOINT` | Server | `https://<endpoint>` | Kosongkan hanya untuk AWS S3 standar. |
| `S3_ACCESS_KEY_ID` | Server | `ganti-dengan-secret` | Access key dengan akses minimum bucket/prefix. |
| `S3_SECRET_ACCESS_KEY` | Server | `ganti-dengan-secret` | Secret key penyimpanan object. |

Gunakan nilai berbeda untuk **Preview** dan **Production** jika database, bucket, atau OAuth redirect URL berbeda. Setelah menyimpan environment variable, jalankan redeploy di Vercel agar build dan function memakai nilai terbaru.
