# Pantau Dompetku v3

Keuangan pribadi & keluarga. **Backend**: Google Apps Script (API JSON). **Frontend**: HTML/CSS/JS statis tanpa build (GitHub + Vercel).

- 🔐 **Login Google** (Google Identity Services) — tanpa kata sandi sendiri.
- 🗄️ **Penyimpanan terpisah per ruang**: tiap ruang = 1 Spreadsheet sendiri; isinya hanya `ID` + payload **terenkripsi AES-256-CTR + HMAC-SHA256**, kunci data unik per ruang.
- 👨‍👩‍👧 **Ruang Keluarga**: undang akun Google lain; peran *Pemilik / Anggota / Hanya lihat*; setiap transaksi mencatat siapa pembuatnya; ringkasan gabungan per anggota.
- 🖨️ **Cetak laporan bulanan** (A4, per siklus gajian) → Print atau *Simpan sebagai PDF*.
- Dompet tak terbatas + warna kustom, tema, siklus gajian, grafik, target tabungan, input cepat AI (fitur v2 tetap ada).

```
appscript/   Code(router) Config Util Master Auth Spaces Store Crypto Wallets Transactions Goals Settings Ai Migrate + appsscript.json
frontend/    index.html · vercel.json · css/(base layout components print) · js/(app api store cycle theme ui charts components utils config) · js/views/(login dashboard transactions reports family wallets goals settings print)
tests/       crypto-test.js · backend-test.js · e2e-ui.js · gas-mock.js     (node tests/…)
```

## 1. Google OAuth Client ID
1. [Google Cloud Console](https://console.cloud.google.com) → buat/ pilih project → **APIs & Services → OAuth consent screen**: User type *External*, isi nama app & email. Scope cukup bawaan (email, profile, openid). Agar **semua orang** bisa login, ubah status ke **In production** (jika masih *Testing*, hanya maksimal 100 test user).
2. **Credentials → Create Credentials → OAuth client ID → Web application**.
   **Authorized JavaScript origins**: `https://NAMA-ANDA.vercel.app` (+ `http://localhost:8080` untuk uji lokal). Salin **Client ID**.

## 2. Backend (Apps Script)
1. Buat Google Sheet baru (atau pakai yang lama) → **Extensions → Apps Script**. Hapus `Index.html` lama.
2. Buat file untuk **tiap** `.gs` di folder `appscript/` (nama sama) dan tempel isinya. Di **Project Settings** centang *Show "appsscript.json"* dan samakan isinya dengan `appscript/appsscript.json`.
3. **Project Settings → Script Properties**:
   | Key | Isi |
   |---|---|
   | `GOOGLE_CLIENT_ID` | Client ID dari langkah 1 (**wajib**) |
   | `GEMINI_API_KEY` | opsional (AI sungguhan) · `GEMINI_MODEL` opsional |
   | `ALLOWED_EMAILS` | opsional, batasi pengguna: `a@gmail.com, @kantor.com` (kosong = siapa saja) |
4. Jalankan fungsi **`setup`** (izinkan akses Sheets & Drive). Ini membuat sheet master dan **`MASTER_KEY`**.
5. ⚠️ **CADANGKAN `MASTER_KEY`** (Script Properties → salin ke password manager). **Tanpa kunci ini seluruh data tidak bisa dibuka lagi**, dan menghapusnya = kehilangan semua data.
6. **Deploy → New deployment → Web app** · Execute as **Me** · Access **Anyone** → salin URL `/exec`.
   Setiap mengubah kode: *Manage deployments → ✏️ → New version → Deploy*.

## 3. Frontend (GitHub + Vercel)
1. Isi `frontend/js/config.js`: `API_URL` (URL `/exec`) dan `GOOGLE_CLIENT_ID`. Keduanya publik, aman di GitHub.
2. Push ke GitHub → Vercel **Add New Project** → **Root Directory: `frontend`** → Framework **Other** → Deploy.
3. Tambahkan domain Vercel ke *Authorized JavaScript origins* (langkah 1).

## Memindahkan data v2 (teks biasa) ke versi terenkripsi
1. Login sekali ke aplikasi dengan akun Google tujuan.
2. Di editor Apps Script jalankan `migrateLegacy('email@gmail.com')` (sheet lama `Wallets/Transactions/Savings_Goals/Settings` di spreadsheet master dibaca).
3. Setelah yakin berhasil, **hapus sheet lama** — isinya masih teks biasa.

## Model keamanan (baca ini)
| | |
|---|---|
| **Terenkripsi** | dompet, transaksi, target, kategori, pengaturan (AES-256-CTR + HMAC-SHA256, nonce acak per baris, deteksi manipulasi) |
| **Tidak terenkripsi** | email, nama, foto profil, relasi keanggotaan & undangan (dibutuhkan untuk login dan fitur keluarga) |
| **Kunci** | kunci data per ruang dibungkus `MASTER_KEY` di Script Properties. **Bukan enkripsi ujung-ke-ujung**: pemilik script/server secara teknis bisa membuka data. Melindungi dari: akses langsung ke file Sheet/Drive, backup bocor, salah bagi file. Jika ingin *zero-knowledge* (pemilik pun tidak bisa baca), perlu desain E2EE berbasis passphrase — konsekuensinya AI server-side dan pemulihan akun tidak bisa dipakai. |
| **Sesi** | token acak 30 hari, hanya hash-nya yang disimpan; verifikasi ID token Google (audience, penerbit, email terverifikasi) |
| **Akses** | setiap request dicek keanggotaan & peran di server; viewer tidak bisa menulis; hanya pemilik yang mengundang/menghapus |
| **AI** | bila `GEMINI_API_KEY` diisi: hanya ringkasan agregat / satu kalimat transaksi dikirim ke Google; dibatasi 12 permintaan/jam/akun |

**Jika dipakai publik, Anda menjadi pengelola data keuangan orang lain**: siapkan kebijakan privasi, jaga akun Google pemilik script (aktifkan 2FA), dan sediakan jalur penghapusan (tersedia: *Pengaturan → Hapus akun & data*).

## Batasan Apps Script
Eksekusi bersamaan maks ±30, UrlFetch ±20.000/hari (akun Gmail biasa), tulisan diserialkan oleh satu lock, semua data ruang didekripsi per permintaan. Nyaman untuk puluhan–ratusan pengguna dengan ribuan transaksi; untuk skala lebih besar pertimbangkan akun Workspace atau backend database. Undangan keluarga **tidak dikirim lewat email** (mencegah penyalahgunaan): beri tahu orangnya, ia masuk dengan akun Google yang sama lalu menerima undangan di menu Keluarga.

## Pengujian
```
node tests/crypto-test.js          # AES/SHA/HMAC dicocokkan dengan OpenSSL
node tests/backend-test.js         # alur backend + isolasi + peran + enkripsi (layanan Google ditiru)
PLAYWRIGHT_PATH=… node tests/e2e-ui.js   # UI sungguhan ↔ backend sungguhan, 3 pengguna, cetak PDF
```
