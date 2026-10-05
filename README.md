# ⚡ Nullsanz TikTok Studio v2.1.5
> **Local Video Calibration, Lossless Anti-Compress Engine & Sound Safe for TikTok Studio**  
> *Developed by [nullsanz](https://github.com/nullsanz) & [null.cloud](https://null.cloud)*

---

## 🌟 Fitur Utama

- **🚀 Lossless Anti-Compress Engine:** Mencegat request publish TikTok Studio (`studio.tiktok.com`) secara real-time dan menonaktifkan *Cloud Canvas Video Editor* TikTok (`cloud_edit_is_use_video_canvas: false`, `psg_vsp_aud: true`, `video_quality_score: 1.0`). Video 1080p, 4K, 60fps, 120fps tidak akan dikompres ulang oleh server TikTok.
- **✨ 100% Bersih (Zero Watermark):** Seluruh injeksi watermark otomatis, auto-tag `@mention`, dan prefix teks bawaan telah dibersihkan total. Caption postingan Anda tetap 100% murni sesuai yang Anda ketik.
- **🔓 Password Gate Permanen Dihilangkan:** Tidak ada lagi popup atau modal login *Access Control*. Ekstensi langsung terbuka dalam status **Full Unlimited (Tier 3 VIP Master)** tanpa batasan ukuran file atau batas resolusi.
- **🎵 Sound Safe Anti-Mute:** Original Audio dan musik TikTok tetap terjaga utuh dengan parameter audio `has_original_audio: 1` dan `psg_vsp_aud: true`.
- **🔒 Privasi 100% Lokal:** Pemrosesan FastStart container MP4/MOV dijalankan langsung di memori browser lokal perangkat Anda tanpa pengiriman data ke server luar.

---

## 📦 Panduan Instalasi (Chrome & Microsoft Edge)

1. Unduh atau clone repository ini:
   ```bash
   git clone https://github.com/nullsanz/tiktok.git
   ```
2. Buka browser Chromium favorit Anda:
   - **Google Chrome:** Buka `chrome://extensions`
   - **Microsoft Edge:** Buka `edge://extensions`
3. Aktifkan **Developer Mode** (Mode Pengembang) di bagian kanan atas atau kiri bawah.
4. Klik tombol **Load unpacked** (Muat yang belum dibongkar).
5. Pilih folder repository ini (`tiktok`).
6. Buka [TikTok Studio](https://studio.tiktok.com) dan unggah video Anda seperti biasa. Pill dan banner **Nullsanz TikTok Studio** akan aktif otomatis di layar upload!

---

## 🛠️ File Arsitektur

- `manifest.json` — Konfigurasi ekstensi Chrome Manifest V3.
- `page-hook.js` — Script MAIN world yang mencegat `JSON.stringify`, `fetch`, dan `XMLHttpRequest` untuk menonaktifkan canvas recompression TikTok & membersihkan watermark.
- `content.js` — Content script UI yang memasang HUD status, upload dropzone, progress bar, dan komunikasi patcher.
- `processor.js` & `processor.html` — Background worker sandbox untuk kalibrasi FastStart MP4 container.
- `adjn-mp4-core.js` — Engine biner pembedah atom dan box MP4 (ftyp, moov, mdat) secara lokal.
- `popup.html` & `popup.js` — Dashboard interaktif bilingual (ID/EN) untuk kontrol fitur dan tema.
- `icons/` & assets — Icon dan branding resmi Nullsanz.

---

## 📜 Lisensi
MIT License © 2026 Nullsanz.
