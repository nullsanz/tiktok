# Nullsanz TikTok Studio — Patcher 4.0 Pro, SoundSafe & CoverSafe

Ekstensi browser (**Chrome / Edge / Brave / Android Quetta / Kiwi / Lemur**) untuk kalibrasi container MP4/MOV **100% lokal & offline** guna menjaga ketajaman video Ultra HD, 60–120 FPS, HDR/Dolby Vision, Cover/Thumbnail aman (**CoverSafe**), dan Anti-Mute Audio (**SoundSafe**) saat mengunggah ke TikTok Studio.

---

## ✨ Fitur Utama v4.0.0 Pro

- **Hybrid Workflow (2 Jalur Unggah):**
  1. **Inline Auto-Patcher langsung di TikTok Studio:** Pilih atau drag & drop video langsung di halaman upload TikTok Studio, pilih engine (`4.0 Direct` / `3.0.5` / `3.0` / `2.1.5`) langsung dari kartu upload — otomatis dikalibrasi 1-klik sebelum masuk ke TikTok.
  2. **Standalone Offline Patcher Studio (`patcher.html`):** Buka dari popup ekstensi untuk mengakses **Engine `4.0 Direct (sl-sr)`**, **Engine `4.0 Pro` (FFmpeg WASM 100% Offline)**, dan **Engine `3.0.5 Sentinel`** lengkap dengan live video preview, deteksi HDR/AMVE, telemetri ukuran & delta, serta terminal log.
- **Engine `4.0 Direct` (`sl-sr` Dual-Audio / Dual-`stsd`):**
  - Zero re-encoding — bitstream video **8K 60fps / 4K 120fps / H.264 / HEVC / HDR10 / HLG / Dolby Vision** dipertahankan **100% byte-identical**.
  - Membangun **Dual Audio Track** (Track #1 Dual-`stsd` dengan silent tail AAC-LC + Track #2 kloning shared offset) tanpa menggeser offset video asli.
  - Dilengkapi **Smart Auto-Fallback** di mode inline (otomatis turun aman ke Engine `3.0.5 Sentinel` jika input non-AAC stereo / mono).
- **Engine `4.0 Pro` (FFmpeg WASM 100% Offline):**
  - Membawa bundel `@ffmpeg/core@0.12.10` (`ffmpeg-core.js` + `ffmpeg-core.wasm.gz`) **100% lokal di dalam ekstensi — tanpa CDN, tanpa `eval()`, tanpa koneksi internet**.
  - Ideal untuk akun yang kena pembatasan FPS atau file input non-standar (MOV/MKV/WebM/audio non-AAC).
  - Mempertahankan metadata **AMVE** (termasuk ekstraksi dari HEVC SEI), **HDR Color Matrix (BT.2020 HLG / PQ / BT.709)**, FastStart `moov`, serta Dual-Audio 3-track terverifikasi.
  - Pilihan target resolusi **1080p Fast (WASM)** atau **Native Resolution (Keep Source)**.
- **CoverSafe & SoundSafe Protection (`page-hook.js` v4.0 — `world: "MAIN"`):**
  - **CoverSafe Snapshot & Restore:** Melindungi seluruh field `cover / thumbnail / poster` pada payload publish agar thumbnail pilihan pengguna tidak pernah korup atau ter-reset.
  - **SoundSafe Anti-Mute:** Normalisasi `vedit_common_info`, `psg_vsp_aud`, `has_original_audio`, dan `music_info.music_id_string` (toggleable dari Popup).
  - **Anti-Softban Protection:** Tidak memanipulasi `post_type = 3`, `enter_post_page_from = 1`, atau memalsukan `144 FPS` yang memicu shadow-flag / Cloud Canvas 30fps downgrade pada akun besar.
- **100% Clean & Full Unlimited:**
  - **Zero Watermark & Zero Third-Party Mention** (caption & metadata `udta` bersih).
  - **Zero Password Gate** (langsung aktif tanpa kunci, limit hingga **2 GB**).
  - Tema **Light / Dark** & Bilingual **ID / EN**.

---

## 📱 Cara Install & Pakai

### 💻 Desktop (Chrome / Edge / Brave)
1. Download / clone repo ini, lalu ekstrak jika berbentuk ZIP.
2. Buka `chrome://extensions/` → aktifkan **Developer mode (Mode pengembang)**.
3. Klik **Load unpacked (Muat yang belum dibuka)** → pilih folder `/tiktok`.
4. Klik icon **Nullsanz Studio v4.0 Pro**:
   - **Cara Cepat (1-Klik Inline):** Pastikan **Inline Auto-Patcher** & **SoundSafe & CoverSafe** aktif, pilih engine `4.0`, lalu klik **Buka TikTok Studio ↗** dan langsung pilih/drop video.
   - **Cara Pro (Offline FFmpeg Studio):** Klik **Buka Studio Patcher (4.0 & Pro)**, pilih video, pilih `4.0 Direct` atau `4.0 Pro`, download hasil kalibrasi, lalu upload ke TikTok Studio.

### 📱 Android (Quetta / Lemur / Kiwi Browser)
1. Install **Quetta Browser** (rekomendasi), **Lemur Browser**, atau **Kiwi Browser**.
2. Buka menu **Extensions** → aktifkan **Developer mode** → **Load / Import** folder/ZIP ekstensi ini.
3. Buka `https://www.tiktok.com/tiktokstudio/upload` dalam mode **Desktop Site** untuk Inline Auto-Patcher, atau buka **Studio Patcher (4.0 & Pro)** dari popup ekstensi.

---

## 🔒 Privasi & Keamanan
Seluruh proses parsing MP4, penyusunan Dual-Audio Track, maupun encoding FFmpeg WASM berjalan **100% lokal & offline di perangkat pengguna**. Tidak ada file video, kredensial, atau data pribadi yang dikirim ke server eksternal.

---

**Develop by nullsanz / null.cloud** • `v4.0.0 Pro`
