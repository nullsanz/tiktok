(() => {
  'use strict';

  const SUPPORTED_ENGINES = ['4.0', '3.0.5', '3.0', '2.1.5'];
  const ENGINE_HINTS = {
    id: {
      '4.0': '4.0 Direct (sl-sr)',
      '3.0.5': '3.0.5 Sentinel',
      '3.0': '3.0 HEVC/DV',
      '2.1.5': '2.1.5 Classic'
    },
    en: {
      '4.0': '4.0 Direct (sl-sr)',
      '3.0.5': '3.0.5 Sentinel',
      '3.0': '3.0 HEVC/DV',
      '2.1.5': '2.1.5 Classic'
    }
  };

  const I18N = {
    id: {
      engineReady: 'Patcher 4.0 & Pro Core Ready',
      appName: 'Nullsanz Studio',
      appSub: 'Dual Engine 4.0 Direct + FFmpeg WASM Offline',
      devSub: 'Develop by nullsanz / null.cloud',
      btnOpenPatcher: 'Buka Studio Patcher (4.0 & Pro)',
      btnOpenTikTok: 'Buka TikTok Studio ↗',
      enginePicker: 'Inline Auto-Patch Engine',
      uploaderLabel: 'Inline Auto-Patcher',
      uploaderOn: 'AKTIF DI TIKTOK STUDIO',
      uploaderOff: 'NONAKTIF (UPLOAD MANUAL)',
      soundSafeLabel: 'SoundSafe & CoverSafe',
      soundSafeOn: 'AKTIF (ANTI-MUTE + COVER)',
      soundSafeOff: 'NONAKTIF',
      cleanStatus: 'Zero Watermark • Anti-Softban',
      accordionFeatures: 'Fitur Utama v4.0 Pro',
      accordionGuide: 'Panduan Penggunaan',
      chipFeatures: '18 FITUR',
      chipGuide: '5 TAHAP',
      footerSub: 'Nullsanz TikTok Studio • v4.0.0 Pro',
      features: [
        'Engine 4.0 Direct (sl-sr) Dual-Audio tanpa re-encode',
        'Engine 4.0 Pro FFmpeg WASM 100% Offline (Zero CDN)',
        'Hybrid Workflow: Inline Auto-Patcher + Standalone Studio',
        'CoverSafe Snapshot & Restore (Thumbnail Anti-Korup)',
        'SoundSafe Anti-Mute & Music Info Preservation',
        'Anti-Softban Protection (Tanpa paksa post_type/144fps)',
        'AMVE Metadata & HDR Color Matrix (HLG / PQ / BT.709)',
        'Dual-Audio Track (Track 1 Dual-stsd + Track 2 Original)',
        'Hingga 8K 60 FPS • 4K 120 FPS (Bitstream Utuh)',
        'Smart Auto-Fallback (4.0 Direct → 3.0.5 Sentinel)',
        'Dukungan H.264, H.265 / HEVC & Dolby Vision',
        'Support MP4, MOV, MKV, WebM (via 4.0 Pro)',
        'Zero Watermark & Zero Third-Party Mention',
        'Zero Password Gate (Full Unlimited hingga 2 GB)',
        'FastStart moov Optimizer (4.0 Pro)',
        '100% Proses Lokal di Perangkat (Privasi Penuh)',
        'Dukungan Desktop & Android (Quetta / Kiwi / Lemur)',
        'Tema Light / Dark & Bahasa Indonesia / Inggris'
      ],
      steps: [
        {
          num: 1,
          title: 'Ekspor Video Master',
          desc: 'Ekspor video dalam 1080p, 4K, atau 8K • 60 FPS dengan audio AAC-LC stereo dari CapCut, Premiere, Alight Motion, atau DaVinci.'
        },
        {
          num: 2,
          title: 'Pilih Jalur Cepat (Inline) atau Studio Pro',
          desc: 'Untuk upload 1-klik: langsung buka TikTok Studio dengan Inline Auto-Patcher Engine 4.0 aktif. Untuk akun limit FPS / file non-AAC: buka Studio Patcher → pilih 4.0 Pro (FFmpeg).'
        },
        {
          num: 3,
          title: 'Kalibrasi 100% Lokal & Offline',
          desc: 'Engine 4.0 Direct mem-patch container secara instan tanpa menyentuh bitstream video. Engine 4.0 Pro melakukan encode H.264/AAC lokal + AMVE + Dual Audio Track.'
        },
        {
          num: 4,
          title: 'Aktifkan SoundSafe & CoverSafe',
          desc: 'Pastikan toggle SoundSafe & CoverSafe AKTIF agar cover/thumbnail pilihanmu aman 100% dan audio/musik tidak terkena mute saat publish.'
        },
        {
          num: 5,
          title: 'Publish Bersih Tanpa Watermark',
          desc: 'Atur caption & cover seperti biasa di TikTok Studio lalu publish. Nol watermark paksaan, nol limit password, anti-softban.'
        }
      ]
    },
    en: {
      engineReady: 'Patcher 4.0 & Pro Core Ready',
      appName: 'Nullsanz Studio',
      appSub: 'Dual Engine 4.0 Direct + Offline FFmpeg WASM',
      devSub: 'Develop by nullsanz / null.cloud',
      btnOpenPatcher: 'Open Patcher Studio (4.0 & Pro)',
      btnOpenTikTok: 'Open TikTok Studio ↗',
      enginePicker: 'Inline Auto-Patch Engine',
      uploaderLabel: 'Inline Auto-Patcher',
      uploaderOn: 'ACTIVE ON TIKTOK STUDIO',
      uploaderOff: 'DISABLED (MANUAL UPLOAD)',
      soundSafeLabel: 'SoundSafe & CoverSafe',
      soundSafeOn: 'ACTIVE (ANTI-MUTE + COVER)',
      soundSafeOff: 'DISABLED',
      cleanStatus: 'Zero Watermark • Anti-Softban',
      accordionFeatures: 'Key Features v4.0 Pro',
      accordionGuide: 'Step-by-Step Guide',
      chipFeatures: '18 FEATURES',
      chipGuide: '5 STEPS',
      footerSub: 'Nullsanz TikTok Studio • v4.0.0 Pro',
      features: [
        'Engine 4.0 Direct (sl-sr) Dual-Audio Zero Re-encode',
        'Engine 4.0 Pro Offline FFmpeg WASM (Zero CDN)',
        'Hybrid Workflow: Inline Auto-Patcher + Standalone Studio',
        'CoverSafe Snapshot & Restore (Thumbnail Protection)',
        'SoundSafe Anti-Mute & Music Info Preservation',
        'Anti-Softban Protection (No forced post_type/144fps)',
        'AMVE Metadata & HDR Color Matrix (HLG / PQ / BT.709)',
        'Dual-Audio Track (Track 1 Dual-stsd + Track 2 Original)',
        'Up to 8K 60 FPS • 4K 120 FPS (Bitstream Untouched)',
        'Smart Auto-Fallback (4.0 Direct → 3.0.5 Sentinel)',
        'H.264, H.265 / HEVC & Dolby Vision Support',
        'MP4, MOV, MKV, WebM Support (via 4.0 Pro)',
        'Zero Watermark & Zero Third-Party Mentions',
        'Zero Password Gate (Full Unlimited up to 2 GB)',
        'FastStart moov Optimizer (4.0 Pro)',
        '100% Local Processing (Complete Privacy)',
        'Desktop & Android Support (Quetta / Kiwi / Lemur)',
        'Light / Dark Mode & Bilingual ID / EN'
      ],
      steps: [
        {
          num: 1,
          title: 'Export Master Video',
          desc: 'Export your video in 1080p, 4K, or 8K • 60 FPS with stereo AAC-LC audio from CapCut, Premiere, Alight Motion, or DaVinci.'
        },
        {
          num: 2,
          title: 'Choose Inline Fast-Path or Pro Studio',
          desc: 'For 1-click upload: open TikTok Studio with Inline Auto-Patcher Engine 4.0 ON. For FPS-limited accounts or non-AAC files: open Patcher Studio → choose 4.0 Pro (FFmpeg).'
        },
        {
          num: 3,
          title: '100% Local & Offline Calibration',
          desc: 'Engine 4.0 Direct patches the container instantly without touching video bitstream. Engine 4.0 Pro encodes locally with H.264/AAC + AMVE + Dual Audio Track.'
        },
        {
          num: 4,
          title: 'Keep SoundSafe & CoverSafe Active',
          desc: 'Keep SoundSafe & CoverSafe ON so your custom cover/thumbnail stays intact and audio/music stays protected from muting.'
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
