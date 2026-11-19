# Nullsanz TikTok Studio — Inline Tri-Engine 4.0 / Ultra / Pro, SoundSafe & CoverSafe

Ekstensi browser (**Chrome / Edge / Brave / Android Quetta / Kiwi / Lemur**) untuk kalibrasi container MP4/MOV/MKV **100% lokal & offline** langsung di TikTok Studio (tanpa pindah tab), guna menjaga ketajaman video Ultra HD, 60–120 FPS, HDR/Dolby Vision, Cover/Thumbnail aman (**CoverSafe**), dan Anti-Mute Audio (**SoundSafe**) saat mengunggah ke TikTok Studio.

---

## ✨ Fitur Utama v4.1.0 Final

- **Inline All-in-One di TikTok Studio (Tanpa Pindah Tab):**
  1. Pilih langsung **`4.0 Direct`**, **`4.0 Ultra`**, **`4.0 Pro`**, **`3.0.5`**, **`3.0`**, atau **`2.1.5`** dari kartu upload TikTok Studio atau popup ekstensi.
  2. **Engine `4.0 Pro` kini jalan langsung inline di TikTok Studio** melalui iframe bridge `ffmpeg-bridge.html` + `ffmpeg-worker.js` offline!
  3. **Standalone Offline Studio (`patcher.html`):** Tetap tersedia lewat tombol **Studio Standalone** bagi yang ingin preview/download file hasil patch terlebih dahulu.
- **Engine `4.0 Direct` (`sl-sr` Dual-Audio / Dual-`stsd`):**
  - Zero re-encoding — bitstream video **8K 60fps / 4K 120fps / H.264 / HEVC / HDR10 / HLG / Dolby Vision** dipertahankan **100% byte-identical**.
  - Membangun **Dual Audio Track** (Track #1 Dual-`stsd` dengan silent tail AAC-LC + Track #2 kloning shared offset) tanpa menggeser offset video asli.
- **Engine `4.0 Ultra` (`NullsanzFastStart` — True FastStart Single-Audio):**
  - Reorganisasi atom ke layout **True FastStart** (`ftyp → moov → free → mdat → free` WebKit/iOS guard), rescale timescale `1000`, normalisasi `hdlr`, bersihkan `compressorname`/timestamp, serta overwrite **4 sample tail audio** secara in-place.
  - **Kompatibel universal** (mendukung audio mono, MOV QuickTime v1, iOS Safari, tanpa menambah dual-track) & video **100% byte-identical**.
  - Menjadi default otomatis di iOS dan target **Smart Fallback tahap-1** apabila input mono/MOV ditolak oleh `4.0 Direct`.
- **Engine `4.0 Pro` (FFmpeg WASM 100% Offline):**
  - Membawa bundel `@ffmpeg/core@0.12.10` (`ffmpeg-core.js` + `ffmpeg-core.wasm.gz`) **100% lokal di dalam ekstensi — tanpa CDN, tanpa `eval()`, tanpa koneksi internet**.
  - Ideal untuk akun yang kena pembatasan FPS atau file input non-standar (MOV/MKV/WebM/AVI/fragmented MP4/audio non-AAC).
  - Mempertahankan metadata **AMVE** (termasuk ekstraksi dari HEVC SEI), **HDR Color Matrix (BT.2020 HLG / PQ / BT.709)**, FastStart `moov`, serta Dual-Audio 3-track terverifikasi.
- **Smart 3-Stage Auto-Fallback:**
  - Ketika Engine `4.0 Direct` aktif, file tidak kompatibel otomatis turun bertahap: **`4.0 Direct` → `4.0 Ultra (FastStart)` → `4.0 Pro (FFmpeg Offline)`** (atau `3.0.5 Sentinel`).
- **CoverSafe & SoundSafe Protection (`page-hook.js` — `world: "MAIN"`):**
  - **CoverSafe Snapshot & Restore:** Melindungi seluruh field `cover / thumbnail / poster` pada payload publish agar thumbnail pilihan pengguna tidak pernah korup atau ter-reset.
  - **SoundSafe Anti-Mute + Sinkronisasi `has_original_audio`:** Normalisasi `vedit_common_info`, `psg_vsp_aud`, `music_info.music_id_string`, dan `has_original_audio` pintar (`0` jika musik library TikTok terpasang, `1` jika audio original) guna mencegah kontradiksi metadata / paksaan re-transcode server.
  - **Anti-Softban Protection:** Tidak memanipulasi `post_type = 3`, `enter_post_page_from = 1`, atau memalsukan `144 FPS` yang memicu shadow-flag / Cloud Canvas 30fps downgrade.
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
4. Klik icon **Nullsanz Studio v4.1 Final**:
   - **Cara Utama (Inline di TikTok Studio):** Aktifkan **Inline Auto-Patcher** & **SoundSafe & CoverSafe**, buka `https://www.tiktok.com/tiktokstudio/upload`, lalu pilih chip **`4.0 Direct`**, **`4.0 Ultra`**, atau **`4.0 Pro`** langsung di kartu upload TikTok Studio dan pilih/drop video!
   - **Cara Alternatif (Standalone Batch/Preview):** Klik **Buka Studio Standalone** dari popup atau kartu upload untuk patch & download file secara manual sebelum upload.

### 📱 Android (Quetta / Lemur / Kiwi Browser)
1. Install **Quetta Browser** (rekomendasi), **Lemur Browser**, atau **Kiwi Browser**.
2. Buka menu **Extensions** → aktifkan **Developer mode** → **Load / Import** folder/ZIP ekstensi ini.
3. Buka `https://www.tiktok.com/tiktokstudio/upload` dalam mode **Desktop Site** untuk Inline Auto-Patcher (`4.0 Direct` / `4.0 Ultra` / `4.0 Pro`), atau buka **Studio Standalone** dari popup ekstensi.

---

## 🔒 Privasi & Keamanan
Seluruh proses parsing MP4, penyusunan FastStart/Dual-Audio Track, maupun encoding FFmpeg WASM berjalan **100% lokal & offline di perangkat pengguna**. Tidak ada file video, kredensial, atau data pribadi yang dikirim ke server eksternal.

---

**Develop by nullsanz / null.cloud** • `v4.1.0 Final`
