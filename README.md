# ⚡ Nullsanz TikTok Studio v3.0.5
> **Local Video Calibration, Multi-Engine Ultra HD & Lossless Anti-Compress for TikTok Studio**  
> *Developed by [nullsanz](https://github.com/nullsanz) & [null.cloud](https://null.cloud)*

---

## 🌟 Fitur Utama v3.0.5

- **🚀 Multi-Engine System (2.1.5, 3.0 & 3.0.5):**
  - **Engine 2.1.5:** Standard Local Container Calibration (Universal Legacy).
  - **Engine 3.0:** Native **Dolby Vision** (`dvh1`, `dvhe`) & HEVC (`hvc1`, `hev1`) Verification!
  - **Engine 3.0.5 (NEW):** Versi terbaru dengan **Anti-Softban Protection** & Fast 4-Pass Remuxer!
- **🛡️ Anti-Softban AB Hook (Zero 0-Views Penalty):**
  - Mengeliminasi override agresif pada AB Test endpoints TikTok yang sebelumnya dapat memicu shadow-flag/bot detection.
  - Mempertahankan bypass Cloud Canvas secara native dan aman (`cloud_edit_is_use_video_canvas: false`, `psg_vsp_aud: true`).
- **⚡ Fast 4-Pass Container Remuxer:**
  - Optimasi perhitungan offset moov menjadi 4 iterasi cepat.
  - Menghilangkan beban pemindaian byte-by-byte pada video besar sehingga browser tidak pernah freeze saat memproses file ratusan MB.
- **📺 Resolusi Resmi Hingga 8K 60FPS & 4K 120FPS:**
  - Hingga 4K (4096×2160) @ 120 FPS.
  - Di atas 4K hingga 8K (8192×4320) @ 60 FPS (Ultra Smooth)!
- **✨ 100% Bersih (Zero Watermark):**
  - Seluruh injeksi watermark otomatis, auto-tag `@mention`, dan prefix teks bawaan telah dibersihkan total. Caption postingan Anda tetap 100% murni sesuai yang Anda ketik.
- **🔓 Password Gate Dihilangkan (Full Unlimited):**
  - Akses terbuka secara default tanpa batasan password atau ukuran file.
- **🎵 Sound Safe Anti-Mute:** Original Audio dan musik TikTok tetap terjaga utuh dengan parameter audio `has_original_audio: 1` dan `psg_vsp_aud: true`.
- **🔒 Privasi 100% Lokal:** Pemrosesan dijalankan langsung di browser lokal Anda tanpa upload ke server luar.

---

## 📱 Panduan Mutlak Upload di Android (Anti-Kompres & Bebas Eror)

> ⚠️ **ATURAN MUTLAK:** JANGAN upload lewat aplikasi TikTok HP biasa karena server TikTok otomatis mengompres paksa video jadi 720p 30 FPS dan memburamkan visual.

1. **Gunakan Browser yang Mendukung Ekstensi Chrome:**
   - Unduh **Quetta Browser**, **Lemur Browser**, atau **Kiwi Browser** dari Google Play Store.
2. **Download File Ekstensi Ini:**
   - Klik tombol hijau **Code** di atas, lalu pilih **Download ZIP** (atau klik [Direct Download ZIP](https://github.com/nullsanz/tiktok/archive/refs/heads/main.zip)).
   - Ekstrak file ZIP tersebut di memori internal HP Anda.
3. **Pasang Ekstensi di Browser:**
   - Buka menu ekstensi di browser (atau ketik `chrome://extensions` di address bar).
   - Aktifkan toggle **Developer Mode** (Mode Pengembang).
   - Klik tombol **Load unpacked** / **from (.zip/.crx/.user.js)**, lalu pilih folder hasil ekstrak tadi.
4. **Buka TikTok Studio dalam Mode Desktop:**
   - Aktifkan centang **Situs Desktop / Desktop Site** pada pengaturan browser Anda.
   - Buka link resmi [TikTok Studio Upload](https://www.tiktok.com/tiktokstudio/upload).
   - Login ke akun TikTok Anda.
   - Dropzone kustom **Nullsanz Studio** akan muncul otomatis. Unggah video Anda di sana dan video akan diproses tanpa kompresi server!

---

## 💻 Panduan Instalasi di PC / Laptop (Chrome, Edge, Brave)

1. Unduh atau clone repository ini:
   ```bash
   git clone https://github.com/nullsanz/tiktok.git
   ```
   *Atau klik tombol **Code** > **Download ZIP** dan ekstrak foldernya.*
2. Buka browser Chromium favorit Anda:
   - **Google Chrome:** Buka `chrome://extensions`
   - **Microsoft Edge:** Buka `edge://extensions`
   - **Brave Browser:** Buka `brave://extensions`
3. Aktifkan toggle **Developer Mode** (Mode Pengembang).
4. Klik tombol **Load unpacked** (Muat yang belum dibongkar).
5. Pilih folder repository ini.
6. Buka [TikTok Studio Upload](https://www.tiktok.com/tiktokstudio/upload) dan unggah video Anda seperti biasa. Pill dan banner **Nullsanz TikTok Studio** akan aktif otomatis di layar upload!

---

## 🛠️ File Arsitektur

- `manifest.json` — Konfigurasi ekstensi Chrome Manifest V3 (v3.0.0).
- `page-hook.js` — Script MAIN world yang mencegat `JSON.stringify`, `fetch`, dan `XMLHttpRequest` untuk menonaktifkan canvas recompression TikTok & membersihkan watermark.
- `content.js` — Content script UI yang memasang HUD status, upload dropzone, progress bar, selector engine, dan komunikasi patcher.
- `processor.js` & `processor.html` — Background worker sandbox untuk kalibrasi FastStart MP4 container.
- `nullsanz-engine.js` — Multi-Engine verification module (Dolby Vision, HEVC, and multi-profile layout checks).
- `nullsanz-mp4-core.js` — Engine biner pembedah atom dan box MP4 (ftyp, moov, mdat) secara lokal dengan 6-Pass Safe.
- `popup.html` & `popup.js` — Dashboard interaktif bilingual (ID/EN) untuk kontrol fitur dan tema.
- `icons/` & assets — Icon dan branding resmi Nullsanz.

---

## 📜 Lisensi
MIT License © 2026 Nullsanz.
