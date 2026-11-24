# Pantau Dompetku v2

Aplikasi pencatat keuangan pribadi. **Backend**: Google Apps Script + Google Sheet. **Frontend**: HTML/CSS/JS statis (tanpa build) untuk GitHub + Vercel.

```
pantau-dompetku/
├── appscript/              ← disalin ke Apps Script (backend / API JSON)
│   ├── Code.gs             router doGet/doPost + auth token
│   ├── Config.gs           nama sheet, header kolom, kategori bawaan
│   ├── Db.gs               akses Sheet, migrasi kolom, util tanggal/angka
│   ├── Wallets.gs · Transactions.gs · Goals.gs · Settings.gs
│   └── Ai.gs               Gemini (opsional) + parser/analisis berbasis aturan
└── frontend/               ← di-upload ke GitHub, di-deploy Vercel
    ├── index.html · vercel.json
    ├── css/  base · layout · components
    └── js/   app · api · store · cycle · theme · ui · charts · components · utils · config
        └── views/  dashboard · transactions · reports · wallets · goals · settings · connect
```

## 1. Deploy backend (Apps Script)

1. Buka Google Sheet lama Anda → **Extensions → Apps Script**.
2. Hapus `Index.html` lama. Ganti `Code.gs` dan buat file baru (**+ → Script**) untuk tiap file di folder `appscript/` (nama sama, tanpa `.gs`), tempel isinya.
3. **Project Settings → Script Properties**, tambahkan:
   | Key | Isi |
   |---|---|
   | `API_TOKEN` | kata sandi acak panjang (**sangat disarankan**) |
   | `GEMINI_API_KEY` | opsional, untuk AI sungguhan |
   | `GEMINI_MODEL` | opsional, bawaan `gemini-2.5-flash` |
4. Pilih fungsi `setup` → **Run** (izinkan akses). Sheet & kolom baru dibuat otomatis; **data lama tetap aman**.
5. **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → salin URL berakhiran `/exec`.
6. Setiap mengubah kode backend: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (URL tidak berubah).

> Tanpa `API_TOKEN`, siapa pun yang tahu URL bisa membaca/mengubah data Anda. Frontend bersifat publik, jadi token dimasukkan lewat layar "Hubungkan" (disimpan di browser, bukan di GitHub).

## 2. Deploy frontend (GitHub + Vercel)

1. Push folder ini ke GitHub.
2. Vercel → **Add New Project** → pilih repo → **Root Directory: `frontend`** → Framework Preset: **Other** → Deploy (tanpa build command).
3. Buka situs Vercel → isi **URL Web App** dan **Token** di layar Hubungkan. Ulangi sekali di tiap perangkat.

Uji lokal: `cd frontend && python3 -m http.server 8080`.

## Fitur
- **Sidebar** (desktop) / **drawer + bottom-nav + tombol + tengah** (mobile), semua halaman responsif.
- **Dompet tanpa batas**: tambah/edit/hapus, warna (palet + kustom), ikon, tipe, saldo awal, pratinjau langsung. Ganti nama otomatis memperbarui transaksi.
- **Tema**: terang/gelap/otomatis + warna aplikasi bebas (per perangkat).
- **Siklus gajian**: atur tanggal 1–28 (Pengaturan atau halaman Laporan). Dipakai di Dashboard, Transaksi, dan Laporan; navigasi siklus sebelumnya/berikutnya.
- **Laporan**: grafik 3/6/12 siklus (klik batang untuk detail), tabel ringkasan, kategori, harian, per dompet, 5 pengeluaran terbesar.
- **Transaksi**: tambah/edit/hapus, transfer antar dompet, filter + pencarian, ekspor CSV.
- **Target tabungan**: progres, setoran per siklus yang dibutuhkan, "Tambah Dana" otomatis mencatat transaksi.
- **Kategori** dapat dikelola; **AI**: input kalimat ("makan siang 25rb pakai cash") dan analisis siklus.

## Perubahan penting dari versi lama
- `google.script.run` diganti `fetch` ke Web App (wajib agar frontend bisa di Vercel).
- API key Gemini pindah ke Script Properties (tidak lagi di kode).
- Kolom baru otomatis ditambahkan: `Transactions.GoalID`, `Wallets.Ikon`. Menghapus transaksi tabungan kini mengurangi target.
- Input teks yang diawali `= + - @` diamankan agar tidak dibaca sebagai rumus Sheets.
