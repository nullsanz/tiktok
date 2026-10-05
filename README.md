# ⚡ Nullsanz TikTok Studio v3.0.0
> **Local Video Calibration, Multi-Engine Ultra HD & Lossless Anti-Compress for TikTok Studio**  
> *Developed by [nullsanz](https://github.com/nullsanz) & [null.cloud](https://null.cloud)*

---

## 🌟 Fitur Utama v3.0.0

- **🚀 Multi-Engine System (2.1.5, 2.3 & 3.0):**
  - **Engine 2.1.5:** Standard Local Container Calibration.
  - **Engine 2.3:** High-Precision Container & Layout Verification.
  - **Engine 3.0:** Native **Dolby Vision** (`dvh1`, `dvhe`) & HEVC (`hvc1`, `hev1`) Verification!
- **📺 Resolusi Resmi Hingga 8K 60FPS & 4K 120FPS:**
  - Hingga 4K (4096×2160) @ 120 FPS.
  - Di atas 4K hingga 8K (8192×4320) @ 60 FPS (Ultra Smooth)!
- **🛡️ 6-Pass Safe & Strict Byte-for-Byte Verification:**
  - Perhitungan offset box moov menggunakan algoritma 6 putaran (*6-Pass Safe*).
  - Pengecekan byte demi byte payload media (`mdat`) terhadap file sumber asli memastikan bitstream video tidak korup.
  - *Output Size Guard* otomatis mencegah file mengecil/rusak saat di-patch.
- **🎯 Cloud Canvas Bypass & Anti-Shadowflag Akun Besar:**
  - Menghapus manipulasi `post_type = 3` yang memicu deteksi shadow-flag TikTok.
  - Menginjeksi preferensi HD resmi: `allow_upload_hd: 1`, `is_high_quality: true`, `psg_vsp_aud: true`, `hd_post_enable: 1`.
  - Membuka otomatis Creator Studio AB flags untuk upload 60fps & HD.
- **✨ 100% Bersih (Zero Watermark):**
  - Seluruh injeksi watermark otomatis, auto-tag `@mention`, dan prefix teks bawaan telah dibersihkan total. Caption postingan Anda tetap 100% murni sesuai yang Anda ketik.
- **🔓 Password Gate Dihilangkan (Full Unlimited):**
  - Akses terbuka secara default tanpa batasan password atau ukuran file.
- **🎵 Sound Safe Anti-Mute:** Original Audio dan musik TikTok tetap terjaga utuh dengan parameter audio `has_original_audio: 1` dan `psg_vsp_aud: true`.
- **🔒 Privasi 100% Lokal:** Pemrosesan dijalankan langsung di browser lokal Anda tanpa upload ke server luar.

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
