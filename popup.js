(() => {
  'use strict';

  const SUPPORTED_ENGINES = ['4.0', '4.0-ultra', '4.0-pro', '3.0.5', '3.0', '2.1.5'];
  const ENGINE_HINTS = {
    id: {
      '4.0': '4.0 Direct (sl-sr)',
      '4.0-ultra': '4.0 Ultra (FastStart)',
      '4.0-pro': '4.0 Pro (FFmpeg)',
      '3.0.5': '3.0.5 Sentinel',
      '3.0': '3.0 HEVC/DV',
      '2.1.5': '2.1.5 Classic'
    },
    en: {
      '4.0': '4.0 Direct (sl-sr)',
      '4.0-ultra': '4.0 Ultra (FastStart)',
      '4.0-pro': '4.0 Pro (FFmpeg)',
      '3.0.5': '3.0.5 Sentinel',
      '3.0': '3.0 HEVC/DV',
      '2.1.5': '2.1.5 Classic'
    }
  };

  const I18N = {
    id: {
      engineReady: 'Inline Tri-Engine 4.0 / Ultra / Pro Ready',
      appName: 'Nullsanz Studio',
      appSub: 'Inline 4.0 Direct • 4.0 Ultra FastStart • 4.0 Pro FFmpeg',
      devSub: 'Develop by nullsanz / null.cloud',
      btnOpenPatcher: 'Buka Studio Standalone (Batch / Offline)',
      btnOpenTikTok: 'Buka TikTok Studio ↗',
      enginePicker: 'Inline Auto-Patch Engine',
      uploaderLabel: 'Inline Auto-Patcher',
      uploaderOn: 'AKTIF DI TIKTOK STUDIO',
      uploaderOff: 'NONAKTIF (UPLOAD MANUAL)',
      soundSafeLabel: 'SoundSafe & CoverSafe',
      soundSafeOn: 'AKTIF (ANTI-MUTE + COVER)',
      soundSafeOff: 'NONAKTIF',
      cleanStatus: 'Zero Watermark • Anti-Softban',
      accordionFeatures: 'Fitur Utama v4.1 Final',
      accordionGuide: 'Panduan Penggunaan',
      chipFeatures: '19 FITUR',
      chipGuide: '5 TAHAP',
      footerSub: 'Nullsanz TikTok Studio • v4.1.0 Final',
      features: [
        'Engine 4.0 Direct (sl-sr) Dual-Audio tanpa re-encode',
        'Engine 4.0 Ultra FastStart (Single-Audio Universal & Cepat Review)',
        'Engine 4.0 Pro FFmpeg WASM Inline langsung di TikTok Studio (Zero CDN)',
        'Smart 3-Stage Auto-Fallback (4.0 Direct → 4.0 Ultra → 4.0 Pro)',
        'CoverSafe Snapshot & Restore (Thumbnail Anti-Korup)',
        'SoundSafe Anti-Mute & Sinkronisasi has_original_audio Pintar',
        'Anti-Softban Protection (Tanpa paksa post_type/144fps)',
        'AMVE Metadata & HDR Color Matrix (HLG / PQ / BT.709)',
        'Hingga 8K 60 FPS • 4K 120 FPS (Bitstream Utuh di 4.0/Ultra)',
        'Kompatibel Penuh Audio Mono, MOV QuickTime v1 & iOS Safari',
        'Dukungan H.264, H.265 / HEVC & Dolby Vision',
        'Support MP4, MOV, MKV, WebM langsung via 4.0 Pro Inline',
        'Hybrid Workflow: Langsung di TikTok Studio + Studio Standalone',
        'Zero Watermark & Zero Third-Party Mention',
        'Zero Password Gate (Full Unlimited hingga 2 GB)',
        'True FastStart moov Optimizer + Trailing WebKit Guard',
        '100% Proses Lokal di Perangkat (Privasi Penuh)',
        'Dukungan Desktop & Android (Quetta / Kiwi / Lemur)',
        'Tema Light / Dark & Bahasa Indonesia / Inggris'
      ],
      steps: [
        {
          num: 1,
          title: 'Ekspor Video Master',
          desc: 'Ekspor video dalam 1080p, 4K, atau 8K • 60 FPS dari CapCut, Premiere, Alight Motion, atau DaVinci (audio stereo, mono, maupun MOV didukung).'
        },
        {
          num: 2,
          title: 'Pilih Engine Langsung di TikTok Studio',
          desc: 'Semua engine kini jalan langsung di TikTok Studio tanpa pindah tab: 4.0 Direct (sl-sr), 4.0 Ultra (FastStart ringan & anti-stuck review), atau 4.0 Pro (FFmpeg WASM inline).'
        },
        {
          num: 3,
          title: 'Smart Auto-Fallback Otomatis',
          desc: 'Jika memilih 4.0 Direct pada file mono/MOV, sistem otomatis beralih ke 4.0 Ultra (tanpa re-encode), lalu 4.0 Pro bila kontainer terfragmentasi.'
        },
        {
          num: 4,
          title: 'Aktifkan SoundSafe & CoverSafe',
          desc: 'Pastikan toggle SoundSafe & CoverSafe AKTIF agar cover/thumbnail pilihanmu aman 100% dan has_original_audio akurat sesuai musik yang terpasang.'
        },
        {
          num: 5,
          title: 'Publish Bersih Tanpa Watermark',
          desc: 'Atur caption & cover seperti biasa di TikTok Studio lalu publish. Nol watermark paksaan, nol limit password, anti-softban.'
        }
      ]
    },
    en: {
      engineReady: 'Inline Tri-Engine 4.0 / Ultra / Pro Ready',
      appName: 'Nullsanz Studio',
      appSub: 'Inline 4.0 Direct • 4.0 Ultra FastStart • 4.0 Pro FFmpeg',
      devSub: 'Develop by nullsanz / null.cloud',
      btnOpenPatcher: 'Open Standalone Studio (Batch / Offline)',
      btnOpenTikTok: 'Open TikTok Studio ↗',
      enginePicker: 'Inline Auto-Patch Engine',
      uploaderLabel: 'Inline Auto-Patcher',
      uploaderOn: 'ACTIVE ON TIKTOK STUDIO',
      uploaderOff: 'DISABLED (MANUAL UPLOAD)',
      soundSafeLabel: 'SoundSafe & CoverSafe',
      soundSafeOn: 'ACTIVE (ANTI-MUTE + COVER)',
      soundSafeOff: 'DISABLED',
      cleanStatus: 'Zero Watermark • Anti-Softban',
      accordionFeatures: 'Key Features v4.1 Final',
      accordionGuide: 'Step-by-Step Guide',
      chipFeatures: '19 FEATURES',
      chipGuide: '5 STEPS',
      footerSub: 'Nullsanz TikTok Studio • v4.1.0 Final',
      features: [
        'Engine 4.0 Direct (sl-sr) Dual-Audio Zero Re-encode',
        'Engine 4.0 Ultra FastStart (Single-Audio Universal & Fast Review)',
        'Engine 4.0 Pro FFmpeg WASM Inline inside TikTok Studio (Zero CDN)',
        'Smart 3-Stage Auto-Fallback (4.0 Direct → 4.0 Ultra → 4.0 Pro)',
        'CoverSafe Snapshot & Restore (Thumbnail Protection)',
        'SoundSafe Anti-Mute & Smart has_original_audio Sync',
        'Anti-Softban Protection (No forced post_type/144fps)',
        'AMVE Metadata & HDR Color Matrix (HLG / PQ / BT.709)',
        'Up to 8K 60 FPS • 4K 120 FPS (Bitstream Untouched in 4.0/Ultra)',
        'Full Mono Audio, QuickTime v1 MOV & iOS WebKit Compatibility',
        'H.264, H.265 / HEVC & Dolby Vision Support',
        'MP4, MOV, MKV, WebM Support directly via 4.0 Pro Inline',
        'Hybrid Workflow: Inline TikTok Studio + Standalone Studio',
        'Zero Watermark & Zero Third-Party Mentions',
        'Zero Password Gate (Full Unlimited up to 2 GB)',
        'True FastStart moov Optimizer + Trailing WebKit Guard',
        '100% Local Processing (Complete Privacy)',
        'Desktop & Android Support (Quetta / Kiwi / Lemur)',
        'Light / Dark Mode & Bilingual ID / EN'
      ],
      steps: [
        {
          num: 1,
          title: 'Export Master Video',
          desc: 'Export your video in 1080p, 4K, or 8K • 60 FPS from CapCut, Premiere, Alight Motion, or DaVinci (stereo, mono, or MOV all supported).'
        },
        {
          num: 2,
          title: 'Pick Engine Directly in TikTok Studio',
          desc: 'Every engine now runs inline in TikTok Studio without switching tabs: 4.0 Direct (sl-sr), 4.0 Ultra (lightweight FastStart), or 4.0 Pro (FFmpeg WASM inline).'
        },
        {
          num: 3,
          title: 'Automatic Smart 3-Stage Fallback',
          desc: 'If 4.0 Direct hits mono/MOV inputs, it automatically steps down to lossless 4.0 Ultra first, then 4.0 Pro if needed.'
        },
        {
          num: 4,
          title: 'Keep SoundSafe & CoverSafe Active',
          desc: 'Keep SoundSafe & CoverSafe ON so custom covers stay intact and has_original_audio matches whether TikTok library audio is attached.'
        },
        {
          num: 5,
          title: 'Publish Clean with Zero Watermark',
          desc: 'Set your caption & cover normally in TikTok Studio and publish. Zero forced watermarks, zero password gates, anti-softban safe.'
        }
      ]
    }
  };

  let currentLang = 'id';
  let currentTheme = 'light';
  let uploaderActive = true;
  let soundSafeActive = true;
  let selectedEngine = '4.0';

  const $ = (id) => document.getElementById(id);

  const sparkleSvg = `
    <div class="feature-sparkle-wrap">
      <svg viewBox="0 0 24 24"><path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/></svg>
    </div>`;

  const moonSvg = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  const sunSvg = `
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;

  function saveState() {
    const localPayload = {
      lang: currentLang,
      theme: currentTheme,
      uploaderActive,
      soundSafeActive,
      nullsanzEngine: selectedEngine
    };
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set(localPayload);
      }
    } catch (_) {}
    try {
      localStorage.setItem('nullsanz_settings_v4', JSON.stringify(localPayload));
    } catch (_) {}
  }

  function loadState() {
    try {
      const saved = localStorage.getItem('nullsanz_settings_v4');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.lang) currentLang = p.lang;
        if (p.theme) currentTheme = p.theme;
        if (p.uploaderActive !== undefined) uploaderActive = !!p.uploaderActive;
        if (p.soundSafeActive !== undefined) soundSafeActive = !!p.soundSafeActive;
        if (p.nullsanzEngine && SUPPORTED_ENGINES.includes(p.nullsanzEngine)) selectedEngine = p.nullsanzEngine;
      }
    } catch (_) {}

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['lang', 'theme', 'uploaderActive', 'soundSafeActive', 'nullsanzEngine'], (res) => {
          if (!res) return;
          if (res.lang) currentLang = res.lang;
          if (res.theme) currentTheme = res.theme;
          if (res.uploaderActive !== undefined) uploaderActive = !!res.uploaderActive;
          if (res.soundSafeActive !== undefined) soundSafeActive = !!res.soundSafeActive;
          if (res.nullsanzEngine && SUPPORTED_ENGINES.includes(res.nullsanzEngine)) selectedEngine = res.nullsanzEngine;
          applyAll();
        });
      }
    } catch (_) {}

    applyAll();
  }

  function applyAll() {
    const t = I18N[currentLang] || I18N.id;

    if (currentTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      $('themeIcon').innerHTML = sunSvg;
    } else {
      document.documentElement.removeAttribute('data-theme');
      $('themeIcon').innerHTML = moonSvg;
    }

    $('txtEngineStatus').textContent = t.engineReady;
    $('txtAppName').textContent = t.appName;
    $('txtAppSub').textContent = t.appSub;
    $('txtDevSub').textContent = t.devSub;
    $('txtBtnOpenPatcher').textContent = t.btnOpenPatcher;
    $('txtBtnOpenTikTok').textContent = t.btnOpenTikTok;
    $('lblEnginePicker').textContent = t.enginePicker;
    $('txtEngineActiveHint').textContent = (ENGINE_HINTS[currentLang] || ENGINE_HINTS.id)[selectedEngine] || selectedEngine;

    document.querySelectorAll('.engine-seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-engine') === selectedEngine);
    });

    $('lblUploader').textContent = t.uploaderLabel;
    $('txtUploaderStatus').textContent = uploaderActive ? t.uploaderOn : t.uploaderOff;
    $('valUploader').className = `toggle-substatus ${uploaderActive ? 'on' : 'off'}`;
    $('chkUploader').checked = uploaderActive;
    $('cardUploader').classList.toggle('active-card', uploaderActive);

    $('lblSoundSafe').textContent = t.soundSafeLabel;
    $('txtSoundSafeStatus').textContent = soundSafeActive ? t.soundSafeOn : t.soundSafeOff;
    $('valSoundSafe').className = `toggle-substatus ${soundSafeActive ? 'on' : 'off'}`;
    $('chkSoundSafe').checked = soundSafeActive;
    $('cardSoundSafe').classList.toggle('active-card', soundSafeActive);

    $('txtCleanStatus').textContent = t.cleanStatus;
    $('chipFeatures').textContent = t.chipFeatures;
    $('txtAccFeaturesTitle').textContent = t.accordionFeatures;
    $('chipGuide').textContent = t.chipGuide;
    $('txtAccGuideTitle').textContent = t.accordionGuide;
    $('txtFooterSub').textContent = t.footerSub;

    $('btnLangEn').classList.toggle('active', currentLang === 'en');
    $('btnLangId').classList.toggle('active', currentLang !== 'en');

    $('featureListContainer').innerHTML = t.features.map((f) => `
      <div class="feature-item">${sparkleSvg}<span>${f}</span></div>
    `).join('');

    $('stepListContainer').innerHTML = t.steps.map((s) => `
      <div class="timeline-item">
        <div class="timeline-node">${s.num}</div>
        <div class="timeline-title">${s.title}</div>
        <div class="timeline-desc">${s.desc}</div>
      </div>
    `).join('');
  }

  $('btnLangEn').addEventListener('click', () => { currentLang = 'en'; saveState(); applyAll(); });
  $('btnLangId').addEventListener('click', () => { currentLang = 'id'; saveState(); applyAll(); });
  $('btnThemeToggle').addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    saveState();
    applyAll();
  });

  document.querySelectorAll('.engine-seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const eng = btn.getAttribute('data-engine');
      if (SUPPORTED_ENGINES.includes(eng)) {
        selectedEngine = eng;
        saveState();
        applyAll();
      }
    });
  });

  $('chkUploader').addEventListener('change', (e) => { uploaderActive = e.target.checked; saveState(); applyAll(); });
  $('cardUploader').addEventListener('click', (e) => {
    if (e.target.closest('.switch')) return;
    uploaderActive = !uploaderActive;
    saveState();
    applyAll();
  });

  $('chkSoundSafe').addEventListener('change', (e) => { soundSafeActive = e.target.checked; saveState(); applyAll(); });
  $('cardSoundSafe').addEventListener('click', (e) => {
    if (e.target.closest('.switch')) return;
    soundSafeActive = !soundSafeActive;
    saveState();
    applyAll();
  });

  $('btnAccFeatures').addEventListener('click', () => $('accFeatures').classList.toggle('open'));
  $('btnAccGuide').addEventListener('click', () => $('accGuide').classList.toggle('open'));

  function openTab(url) {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url });
        return;
      }
    } catch (_) {}
    window.open(url, '_blank', 'noopener');
  }

  $('btnOpenPatcher').addEventListener('click', () => {
    const url = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
      ? chrome.runtime.getURL('patcher.html')
      : 'patcher.html';
    openTab(url);
  });

  $('btnOpenTikTok').addEventListener('click', () => {
    openTab('https://www.tiktok.com/tiktokstudio/upload');
  });

  loadState();
})();
