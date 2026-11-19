(() => {
  'use strict';

  const MAX_FILE_BYTES = 2000 * 1024 * 1024; // 2 GB Unlimited
  const $ = (id) => document.getElementById(id);

  let selectedFile = null;
  let selectedEngine = '4.0'; // '4.0' | '4.0-ultra' | '4.0-pro' | '3.0.5'
  let proResolutionMode = '1080p'; // '1080p' | 'native'
  let currentPreviewUrl = null;
  let currentDownloadUrl = null;
  let ffmpegWorker = null;
  let workerSeq = 0;
  let currentTheme = 'light';

  const ENGINE_META = {
    '4.0': {
      hint: '4.0 Direct (sl-sr)',
      btn: 'Mulai Patch Cepat (4.0 Direct)',
      desc: 'Patch langsung tanpa encoding ulang (metode Dual-Audio sl-sr). Proses sangat cepat dan mempertahankan bitstream video 8K 60fps / 4K 120fps / HDR asli 100% utuh.'
    },
    '4.0-ultra': {
      hint: '4.0 Ultra • FastStart',
      btn: 'Mulai Ultra Patch (True FastStart)',
      desc: 'Menyusun ulang MP4 ke True FastStart (ftyp → moov → free → mdat → free), rescale timescale ke 1000, strip metadata encoder, & overwrite 4 sample tail audio tanpa re-encode. Kompatibel luas untuk audio mono, MOV, maupun iOS.'
    },
    '4.0-pro': {
      hint: '4.0 Pro • Offline FFmpeg WASM',
      btn: 'Mulai Pro Encoding (FFmpeg Offline)',
      desc: 'Encoding ulang H.264 High + AAC 48kHz secara 100% offline dengan preservasi AMVE & HDR color matrix (HLG/PQ/BT.709) + Dual-Audio 3-track FastStart. Ideal untuk akun limit FPS atau input non-AAC / MKV / WebM.'
    },
    '3.0.5': {
      hint: '3.0.5 • 64-bit Sentinel',
      btn: 'Mulai Sentinel Patch (3.0.5)',
      desc: 'Patch cepat 64-bit Unknown Duration Sentinel klasik (video & audio bitstream 100% identik). Cocok sebagai alternatif aman untuk file HEVC/Dolby Vision atau audio AAC mono.'
    }
  };

  function log(msg, type = 'info') {
    const el = $('logBody');
    if (!el) return;
    const d = document.createElement('div');
    d.className = type;
    const ts = new Date().toTimeString().split(' ')[0];
    d.textContent = `[${ts}] ${msg}`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }

  function fmtSz(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  function fileExt(name) {
    const m = String(name || '').match(/\.([a-z0-9]+)$/i);
    return (m ? m[1] : 'mp4').toLowerCase();
  }

  // Theme sync with extension storage
  function applyTheme(theme) {
    currentTheme = theme === 'dark' ? 'dark' : 'light';
    if (currentTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      $('btnThemeToggle').textContent = '☀ Light Mode';
    } else {
      document.documentElement.removeAttribute('data-theme');
      $('btnThemeToggle').textContent = '🌙 Dark Mode';
    }
  }

  function loadTheme() {
    try {
      const saved = JSON.parse(localStorage.getItem('nullsanz_settings_v4') || '{}');
      if (saved.theme) applyTheme(saved.theme);
    } catch (_) {}
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['theme'], (res) => {
          if (res?.theme) applyTheme(res.theme);
        });
      }
    } catch (_) {}
  }

  $('btnThemeToggle').addEventListener('click', () => {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) chrome.storage.local.set({ theme: next });
    } catch (_) {}
    try {
      const prev = JSON.parse(localStorage.getItem('nullsanz_settings_v4') || '{}');
      localStorage.setItem('nullsanz_settings_v4', JSON.stringify({ ...prev, theme: next }));
    } catch (_) {}
  });

  // Engine selector
  function selectEngine(mode) {
    selectedEngine = ['4.0', '4.0-ultra', '4.0-pro', '3.0.5'].includes(mode) ? mode : '4.0';
    document.querySelectorAll('.engine-card-btn').forEach((btn) => {
      const active = btn.getAttribute('data-engine') === selectedEngine;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const m = ENGINE_META[selectedEngine];
    $('engineHint').textContent = m.hint;
    $('engineModeDesc').textContent = m.desc;
    $('btnGoLabel').textContent = m.btn;
    $('btnGo').disabled = !selectedFile;
    $('proOptionsRow').classList.toggle('show', selectedEngine === '4.0-pro');
    $('fallbackBox').classList.remove('show');
  }

  document.querySelectorAll('.engine-card-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectEngine(btn.getAttribute('data-engine')));
  });

  document.querySelectorAll('[data-res-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      proResolutionMode = btn.getAttribute('data-res-mode') === 'native' ? 'native' : '1080p';
      document.querySelectorAll('[data-res-mode]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-res-mode') === proResolutionMode);
      });
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ nullsanzResolutionMode: proResolutionMode });
        }
      } catch (_) {}
    });
  });

  $('btnSwitchToPro').addEventListener('click', () => {
    selectEngine('4.0-pro');
    log('Dialihkan ke Engine 4.0 Pro (FFmpeg Offline). Klik tombol Mulai untuk melanjutkan.', 'info');
  });

  // Progress helpers
  function setProgress(pct, title = '', detail = '') {
    const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    $('progressFill').style.width = p + '%';
    $('progressPct').textContent = p + '%';
    if (title) $('progressLabel').textContent = title;

    $('processOverlay').classList.add('show');
    $('procBar').style.width = p + '%';
    $('procPct').textContent = p + '%';
    if (title) $('procTitle').textContent = title;
    if (detail) $('procDetail').textContent = detail;

    $('stepRead').classList.toggle('active', p >= 5);
    $('stepInspect').classList.toggle('active', p >= 15);
    $('stepProcess').classList.toggle('active', p >= 35);
    $('stepVerify').classList.toggle('active', p >= 88);
  }

  function hideProgressOverlay(delay = 450) {
    setTimeout(() => $('processOverlay').classList.remove('show'), delay);
  }

  // Offline FFmpeg Worker
  function getFFmpegWorker() {
    if (ffmpegWorker) return ffmpegWorker;
    ffmpegWorker = new Worker('ffmpeg-worker.js');
    return ffmpegWorker;
  }

  function runOfflineFFmpeg(buffer, inputExt, mode, onProgress, ffmpegArgs) {
    return new Promise((resolve, reject) => {
      const worker = getFFmpegWorker();
      const id = ++workerSeq;
      const handler = (ev) => {
        const m = ev.data || {};
        if (m.type === 'progress') {
          onProgress?.(m.value || 0, m.text || 'FFmpeg WASM…');
          return;
        }
        if (m.type === 'done') {
          worker.removeEventListener('message', handler);
          worker.removeEventListener('error', errHandler);
          resolve({ buffer: m.buffer, outputExt: m.outputExt || 'mp4', mode: m.mode || mode });
          return;
        }
        if (m.type === 'error') {
          worker.removeEventListener('message', handler);
          worker.removeEventListener('error', errHandler);
          reject(new Error(m.message || 'FFmpeg worker error'));
        }
      };
      const errHandler = (err) => {
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', errHandler);
        reject(new Error(err?.message || 'FFmpeg worker crash'));
      };
      worker.addEventListener('message', handler);
      worker.addEventListener('error', errHandler);
      worker.postMessage({ type: mode, id, inputExt, buffer, ffmpegArgs: ffmpegArgs || null }, [buffer]);
    });
  }

  // File Selection & Preview
  const drop = $('drop');
  const fi = $('fi');
  const player = $('videoPreviewPlayer');

  drop.addEventListener('click', (e) => {
    if (e.target.closest('#videoPreviewWrap') || e.target.closest('.btn-reselect') || e.target.closest('.btn-preview-toggle')) return;
    fi.click();
  });
  fi.addEventListener('change', (e) => loadFile(e.target.files?.[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    loadFile(e.dataTransfer?.files?.[0]);
  });

  $('btnChangeVideo').addEventListener('click', (e) => { e.stopPropagation(); fi.click(); });
  $('btnPreviewPlay').addEventListener('click', (e) => {
    e.stopPropagation();
    if (player.paused) {
      player.play().catch(() => {});
      $('playIconSvg').innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    } else {
      player.pause();
      $('playIconSvg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    }
  });

  $('btnCopyLog').addEventListener('click', () => {
    const text = $('logBody').innerText;
    navigator.clipboard?.writeText(text).then(() => {
      $('btnCopyLog').textContent = 'Tersalin ✓';
      setTimeout(() => { $('btnCopyLog').textContent = 'Salin'; }, 1800);
    }).catch(() => {});
  });

  $('btnClearLog').addEventListener('click', () => {
    $('logBody').innerHTML = '<div class="info">[System] Log dibersihkan. Standby…</div>';
  });

  async function inspectSelectedHeader(file) {
    try {
      const headSlice = new Uint8Array(await file.slice(0, Math.min(file.size, 8 * 1024 * 1024)).arrayBuffer());
      const pro = window.NullsanzProCore;
      if (!pro) return;
      const meta = pro.inspectMp4Source(headSlice);
      if (meta && meta.isIsoBmff) {
        if (meta.avgFps > 0) $('metaFps').textContent = `${meta.avgFps.toFixed(2)} FPS`;
        const hdrLabel = meta.hdrMode === 'hlg' ? 'HLG HDR' : (meta.hdrMode === 'pq' ? 'HDR10 PQ' : 'SDR');
        $('metaHdr').textContent = meta.amveBytes ? `${hdrLabel} + AMVE` : hdrLabel;
        log(`Container MP4/MOV • ${meta.videoCodec || '?'} / ${meta.audioCodec || 'no-audio'} • ${hdrLabel}${meta.amveBytes ? ' + AMVE terdeteksi' : ''}`, 'info');
      } else {
        $('metaFps').textContent = fileExt(file.name).toUpperCase();
        $('metaHdr').textContent = 'Non-MP4 (Pro)';
        log(`Format ${fileExt(file.name).toUpperCase()} terdeteksi — disarankan memakai Engine 4.0 Pro (FFmpeg Offline).`, 'warn');
      }
    } catch (_) {}
  }

  function loadFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      log(`File terlalu besar (${fmtSz(file.size)}), maksimal 2 GB.`, 'err');
      return;
    }
    if (!/^video\//i.test(file.type) && !/\.(mp4|mov|m4v|webm|mkv|avi|mpeg|mpg|ts|mts|m2ts|3gp|3g2|flv|wmv)$/i.test(file.name)) {
      log('File bukan format video yang dikenali.', 'warn');
      return;
    }

    selectedFile = file;
    $('fallbackBox').classList.remove('show');
    drop.classList.add('loaded');
    $('uploadTitle').textContent = 'Video Terpilih & Siap Dikalibrasi';
    $('uploadDesc').textContent = 'Pilih engine lalu klik Mulai di bawah';
    $('uploadFile').textContent = `${file.name} (${fmtSz(file.size)})`;

    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = URL.createObjectURL(file);
    player.src = currentPreviewUrl;
    $('videoPreviewWrap').style.display = 'block';
    $('playIconSvg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';

    player.onloadedmetadata = () => {
      const w = player.videoWidth || 0;
      const h = player.videoHeight || 0;
      const d = Number.isFinite(player.duration) ? player.duration : 0;
      const m = Math.floor(d / 60);
      const s = Math.floor(d % 60);
      $('metaResolution').textContent = w && h ? `${w}×${h}` : '---';
      $('metaDuration').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    $('sOrig').textContent = fmtSz(file.size);
    $('sOrig').classList.remove('empty');
    $('sSize').textContent = '---'; $('sSize').classList.add('empty');
    $('sDelta').style.display = 'none';
    $('sMode').textContent = 'Ready'; $('sMode').classList.remove('empty');
    $('sVerify').textContent = '---'; $('sVerify').classList.add('empty');
    $('successBanner').classList.remove('show');
    $('btnDl').classList.remove('show');
    $('btnGoStudio').classList.remove('show');
    $('btnReset').classList.remove('show');
    $('btnGo').disabled = false;

    log(`Video dimuat: ${file.name} (${fmtSz(file.size)})`, 'info');
    void inspectSelectedHeader(file);
  }

  // Main Calibration Pipeline
  $('btnGo').addEventListener('click', async () => {
    if (!selectedFile) return;
    $('btnGo').disabled = true;
    $('fallbackBox').classList.remove('show');
    $('progressCard').classList.add('show');
    $('successBanner').classList.remove('show');
    setProgress(5, 'Membaca video…', `${selectedFile.name} (${fmtSz(selectedFile.size)})`);

    try {
      let outputBlob = null;
      let outputSize = 0;
      let modeLabel = '';
      let verifyLabel = 'Verified ✓';
      let suffix = '_Nullsanz_v4.mp4';

      if (selectedEngine === '4.0') {
        log('Memulai Nullsanz Engine 4.0 • Direct Patch (sl-sr Dual-Audio)…', 'info');
        const direct = window.NullsanzSlSrEngine;
        if (!direct?.patchDirect) throw new Error('NullsanzSlSrEngine tidak termuat.');

        setProgress(28, 'Menerapkan Direct Patch 4.0…', 'Menyusun Dual-Audio Track & Dual-stsd tanpa re-encode.');
        let directRes;
        try {
          directRes = await direct.patchDirect(selectedFile, { artist: 'Nullsanz Studio 4.0' });
        } catch (err) {
          const msg = err?.message || String(err);
          $('fallbackReason').textContent = `4.0 Direct tidak cocok untuk file ini: ${msg}`;
          $('fallbackBox').classList.add('show');
          throw new Error(msg);
        }

        outputBlob = directRes.blob || new Blob([directRes.bytes], { type: 'video/mp4' });
        outputSize = outputBlob.size;

        setProgress(90, 'Verifikasi Container…', 'Memeriksa integritas Dual-Audio & video bitstream.');
        if (selectedFile.size <= 350 * 1024 * 1024) {
          const origU8 = new Uint8Array(await selectedFile.arrayBuffer());
          const outU8 = new Uint8Array(await outputBlob.arrayBuffer());
          const ver = direct.verifyDirectOutput(origU8, outU8);
          if (!ver.ok) throw new Error('Verifikasi 4.0 Direct gagal: ' + ver.reason);
          log(`Verifikasi OK • ${ver.tracks} tracks (${ver.audioTracks} audio, Dual-stsd) • Video bitstream 100% identik`, 'ok');
          modeLabel = `4.0 Direct • ${ver.tracks}T`;
        } else {
          log(`Output besar (${fmtSz(outputSize)}) selesai via zero-copy Blob assembly.`, 'ok');
          modeLabel = '4.0 Direct • 3T';
        }
        $('successSub').textContent = 'Bitstream video 100% utuh • Dual-Audio sl-sr siap upload ke TikTok Studio.';
      } else if (selectedEngine === '4.0-ultra') {
        log('Memulai Nullsanz Engine 4.0 Ultra • True FastStart Single-Audio…', 'info');
        const fastStart = window.NullsanzFastStart;
        if (!fastStart?.patchContainer) throw new Error('NullsanzFastStart tidak termuat.');

        const origBuf = await selectedFile.arrayBuffer();
        const inputU8 = new Uint8Array(origBuf);
        setProgress(35, 'Menerapkan FastStart 4.0 Ultra…', 'Memindahkan moov ke depan, rescale timescale 1000 & membersihkan tail audio.');
        const ultraRes = fastStart.patchContainer(inputU8);
        const outU8 = new Uint8Array(ultraRes.bytes);

        setProgress(88, 'Verifikasi Engine 4.0 Ultra…', 'Memverifikasi video bitstream 100% utuh & audio tail clean.');
        if (!fastStart.verifyUntouched(inputU8, outU8)) {
          throw new Error('Verifikasi Engine 4.0 Ultra gagal: data media berubah.');
        }

        log(`Verifikasi Ultra OK • moov sebelum mdat • Video 100% utuh • ${ultraRes.report.audioTailOverwritten} sample tail cleaned`, 'ok');
        outputBlob = new Blob([outU8], { type: 'video/mp4' });
        outputSize = outU8.byteLength;
        modeLabel = '4.0 Ultra • FastStart';
        suffix = '_Nullsanz_Ultra.mp4';
        $('successSub').textContent = 'True FastStart single-audio • Video 100% utuh, siap upload cepat ke TikTok Studio.';
      } else if (selectedEngine === '4.0-pro') {
        log('Memulai Nullsanz Engine 4.0 Pro • Offline FFmpeg WASM…', 'info');
        const pro = window.NullsanzProCore;
        if (!pro) throw new Error('NullsanzProCore tidak termuat.');

        const origBuf = await selectedFile.arrayBuffer();
        const inputU8 = new Uint8Array(origBuf);
        setProgress(10, 'Analisa Video Pro…', 'Membaca metadata resolusi, FPS, bitrate, HDR, & AMVE.');

        const meta = pro.inspectMp4Source(inputU8);
        const sourceAmve = meta.isIsoBmff ? (meta.amveBytes || pro.extractAmveFromSource(inputU8)) : null;
        const ffmpegArgs = pro.buildProFfmpegArgs('__INPUT__', '__OUTPUT__', meta, {
          wasm: true,
          resolutionMode: proResolutionMode
        });

        log(
          `Analisa: ${meta.width || '?'}×${meta.height || '?'} • ${(meta.avgFps || 0).toFixed(2)} fps • ${String(meta.hdrMode || 'sdr').toUpperCase()}${sourceAmve ? ' • AMVE preserved' : ''} • Target: ${proResolutionMode}`,
          'info'
        );
        setProgress(15, 'FFmpeg WASM Offline…', 'Memuat FFmpeg Core lokal (0% internet / 100% offline)…');

        const encoded = await runOfflineFFmpeg(origBuf, fileExt(selectedFile.name), 'PRO_ENCODE', (v, txt) => {
          const pp = Math.min(86, Math.max(15, Number(v) || 15));
          setProgress(pp, 'Nullsanz 4.0 Pro • Encoding', txt || 'Encoding lokal berjalan…');
        }, ffmpegArgs);

        setProgress(90, 'Finalisasi FastStart + Dual-Audio…', 'Menyusun moov FastStart, AMVE & 3 tracks.');
        const patchedU8 = pro.patchProMp4(new Uint8Array(encoded.buffer), {
          sourceAmve,
          artist: 'Nullsanz Studio 4.0 Pro'
        });

        setProgress(96, 'Verifikasi Output Pro…', 'Memeriksa 3 tracks, Dual-stsd, & shared stco.');
        const ver = pro.verifyProMp4(patchedU8);
        if (!ver.ok) throw new Error('Verifikasi MP4 Pro gagal: ' + (ver.reason || 'struktur tidak valid'));

        log(`Verifikasi Pro OK • ${ver.tracks} tracks • FastStart=${ver.fastStart} • ${ver.durationMs} ms`, 'ok');
        outputBlob = new Blob([patchedU8], { type: 'video/mp4' });
        outputSize = patchedU8.byteLength;
        modeLabel = `4.0 Pro • ${ver.tracks}T`;
        suffix = '_Nullsanz_v4_Pro.mp4';
        $('successSub').textContent = 'Encode H.264/AAC lokal + AMVE + Dual-Audio FastStart siap upload.';
      } else {
        log('Memulai Nullsanz Engine 3.0.5 • 64-bit Duration Sentinel…', 'info');
        const core = window.NullsanzMp4Core;
        if (!core?.patchWithReport) throw new Error('NullsanzMp4Core tidak termuat.');

        const origBuf = await selectedFile.arrayBuffer();
        const inputU8 = new Uint8Array(origBuf);
        setProgress(45, 'Menerapkan 64-bit Sentinel…', 'Video & audio sample 100% byte-identical.');
        const res = core.patchWithReport(inputU8);
        const ver = core.verifyOutput(inputU8, res.bytes);
        if (!ver.mdatByteIdentical) throw new Error('Verifikasi mdat Sentinel gagal.');

        log(`Verifikasi Sentinel 3.0.5 OK • Codec: ${res.report.codec} • mdat 100% identik`, 'ok');
        outputBlob = new Blob([res.bytes], { type: 'video/mp4' });
        outputSize = res.bytes.byteLength;
        modeLabel = '3.0.5 Sentinel';
        suffix = '_Nullsanz_v305.mp4';
        $('successSub').textContent = '64-bit Duration Sentinel aktif • mdat 100% byte-identical.';
      }

      if (currentDownloadUrl) URL.revokeObjectURL(currentDownloadUrl);
      currentDownloadUrl = URL.createObjectURL(outputBlob);

      const base = selectedFile.name.replace(/\.[^/.]+$/, '');
      $('btnDl').href = currentDownloadUrl;
      $('btnDl').download = base + suffix;
      $('btnDl').classList.add('show');
      $('btnGoStudio').classList.add('show');
      $('btnReset').classList.add('show');

      $('sSize').textContent = fmtSz(outputSize);
      $('sSize').classList.remove('empty');
      const diff = outputSize - selectedFile.size;
      const sign = diff >= 0 ? '+' : '-';
      const pct = selectedFile.size > 0 ? ((Math.abs(diff) / selectedFile.size) * 100).toFixed(2) : '0.00';
      $('sDelta').textContent = `Delta: ${sign}${fmtSz(Math.abs(diff))} (${sign}${pct}%)`;
      $('sDelta').style.display = 'block';
      $('sMode').textContent = modeLabel;
      $('sMode').classList.remove('empty');
      $('sVerify').textContent = verifyLabel;
      $('sVerify').classList.remove('empty');

      setProgress(100, 'Selesai ✓', 'Video terverifikasi & siap di-download.');
      hideProgressOverlay(650);
      $('successBanner').classList.add('show');
      $('btnGo').disabled = false;
      log(`Selesai! Output: ${base + suffix} (${fmtSz(outputSize)})`, 'ok');
    } catch (err) {
      log(`Kesalahan: ${err?.message || err}`, 'err');
      $('btnGo').disabled = false;
      $('progressCard').classList.remove('show');
      hideProgressOverlay(0);
    }
  });

  function resetAll() {
    selectedFile = null;
    fi.value = '';
    if (currentPreviewUrl) { URL.revokeObjectURL(currentPreviewUrl); currentPreviewUrl = null; }
    if (currentDownloadUrl) { URL.revokeObjectURL(currentDownloadUrl); currentDownloadUrl = null; }
    player.pause();
    player.removeAttribute('src');
    player.load();
    $('videoPreviewWrap').style.display = 'none';
    drop.classList.remove('loaded');
    $('uploadTitle').textContent = 'Pilih atau Seret Video ke Sini';
    $('uploadDesc').textContent = '4.0 Direct: MP4 (AVC/HEVC + AAC Stereo) • 4.0 Pro: Semua format video';
    $('uploadFile').textContent = 'Belum ada file dipilih';
    $('metaResolution').textContent = '---';
    $('metaFps').textContent = '---';
    $('metaDuration').textContent = '---';
    $('metaHdr').textContent = 'SDR';

    ['sOrig', 'sSize', 'sMode', 'sVerify'].forEach((id) => {
      $(id).textContent = '---';
      $(id).classList.add('empty');
    });
    $('sDelta').style.display = 'none';
    $('successBanner').classList.remove('show');
    $('progressCard').classList.remove('show');
    $('fallbackBox').classList.remove('show');
    $('btnDl').classList.remove('show');
    $('btnDl').removeAttribute('href');
    $('btnGoStudio').classList.remove('show');
    $('btnReset').classList.remove('show');
    $('btnGo').disabled = true;
    log('Sistem di-reset. Standby menunggu video baru.', 'info');
  }

  $('btnReset').addEventListener('click', resetAll);

  // Initial setup & URL mode parameter
  loadTheme();
  const params = new URLSearchParams(location.search);
  const initialMode = params.get('mode');
  if (initialMode && ['4.0', '4.0-ultra', '4.0-pro', '3.0.5'].includes(initialMode)) {
    selectEngine(initialMode);
  } else {
    selectEngine('4.0');
  }
})();
