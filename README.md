# 🎬 Nullsanz TikTok Studio (Ultra HD / Anti-Compress Uploader)
> **Chrome Extension Manifest V3 — Ultra HD / 4K / 60 FPS Local Video Upload Workflow without Quality Loss or Caption Watermarks**

---

## 🌟 Fitur Utama
1. **Anti-Compression TikTok Engine:**
   - Secara cerdas memotong downscale & kompresi server TikTok dengan memodifikasi payload post (`cloud_edit_is_use_video_canvas = false`, sanitasi `vedit_segment_info`, `tiktok_snap_shot_lite_params`, dan menjaga `has_original_audio = 1`).
   - Kualitas video tetap tajam, bitrate tinggi, dan warna HDR / Ultra HD tidak pudar saat diunggah lewat browser.
2. **Zero Forced Caption Watermark (100% Bersih):**
   - **TIDAK ADA** watermark otomatis atau paksaan tag akun di caption.
   - Caption, hashtag, dan deskripsi video yang Anda ketik 100% asli tanpa tambahan teks asing.
3. **Local MP4 & FFmpeg WASM Container Patcher:**
   - Memperbaiki atom MP4/HEVC (`moov`, `trak`, `mdat`) langsung di memori browser lokal (on-device processing) sehingga TikTok menerima file tanpa error container.
4. **Clean Studio UI:**
   - Tampilan ekstensi modern bernuansa gelap khas Nullsanz Studio.

---

## 🚀 Cara Pemasangan di Google Chrome / Edge / Brave

1. Buka browser dan kunjungi halaman ekstensi:
   ```text
   chrome://extensions/
   ```
2. Aktifkan **Developer mode** (Mode pengembang) di pojok kanan atas.
3. Klik tombol **Load unpacked** (Muat yang belum dibongkar).
4. Pilih folder repositori ini (`tiktok`).
5. Ekstensi **Nullsanz TikTok Studio v2.1.0** akan langsung aktif!

---

## 📹 Cara Menggunakan

1. Buka [TikTok Creator Studio Upload](https://www.tiktok.com/tiktokstudio/upload).
2. Pastikan ekstensi berstatus **ACTIVE** pada icon ekstensi di toolbar browser.
3. Drag & drop atau pilih video hasil export HD/HDR Anda (misal hasil transcode 4000 Nits Brutal Silau dari Bot Loker Bray / Kompressor).
4. Tulis caption, tagar, dan atur thumbnail sesuai keinginan.
5. Klik **Post / Unggah** — video akan terunggah dalam resolusi penuh tanpa kompresi buram!

---

## 🛡️ Lisensi & Hak Cipta
* Disesuaikan dan dikembangkan untuk ekosistem **Nullsanz**.
