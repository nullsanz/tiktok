(() => {
  'use strict';

  // Comprehensive Bilingual Dictionary
  const I18N = {
    id: {
      appName: 'Nullsanz Studio',
      appSub: 'Ultra HD Multi-Engine & Anti-Kompres',
      devSub: 'Develop by nullsanz / null.cloud',
      engineReady: 'Nullsanz Multi-Engine Core Ready',
      hudCalibration: '8K 60FPS • 4K 120FPS',
      hudSound: 'SOUND SAFE',
      hudProcess: '100% LOKAL',
      uploaderLabel: 'Auto-Patcher Uploader',
      uploaderOn: 'AKTIF',
      uploaderOff: 'NONAKTIF',
      watermarkLabel: 'Caption Watermark',
      watermarkOn: 'NYALA',
      watermarkOff: 'NONAKTIF (BERSIH)',
      publicVersionLabel: 'Engine Mode',
      publicVersionOn: 'MULTI-ENGINE 2.1.5 / 2.3 / 3.0',
      publicVersionOff: 'FULL UNLIMITED',
      supportTitle: '',
      supportBadge: '',
      supportText: '',
      btnOpenStudio: 'Buka TikTok Studio',
      accordionFeatures: 'Fitur Utama',
      accordionGuide: 'Panduan Langkah demi Langkah',
      chipFeatures: '16 FITUR',
      chipGuide: '5 TAHAP',
      footerSub: 'Nullsanz TikTok Studio • v3.0.0',
      features: [
        'Kualitas Unggah TikTok yang Ditingkatkan',
        'Hingga 8K 60 FPS • 4K 120 FPS (Ultra Smooth)',
        'Dukungan H.264 & H.265 / HEVC',
        'Mendukung Semua Format Video (MP4 / MOV)',
        'Dukungan Original Sound (Bypass Anti-Mute)',
        'Kompatibilitas TikTok Story & Feed',
        'Sound & Music Tagging Aman',
        '@Mention yang Bisa Diklik',
        'Dukungan Edit Cover Presisi',
        'Pemrosesan Video Otomatis',
        'Pemrosesan Lokal di Perangkat (Privasi 100%)',
        'Proses Upload Simpel & Cepat',
        'Penghapus Repost Metadata',
        'Toggle Watermark & Metadata',
        'Dukungan Mobile & Desktop Browser',
        'Bahasa Inggris & Indonesia'
      ],
      steps: [
        {
          num: 1,
          title: 'Ekspor Video Master',
          desc: 'Ekspor editan kamu dalam 1080p, 4K, atau 8K • 60 FPS dari video editor favoritmu (CapCut, Premiere, Alight Motion, dll).'
        },
        {
          num: 2,
          title: 'Tingkatkan Kualitas (Enhance)',
          desc: 'Gunakan video enhancer pilihanmu. Rekomendasi Wink: Ultra HD, atau AI Repair → Basic → Ultra HD → 1080p.'
        },
        {
          num: 3,
          title: 'Kompres & Kalibrasi FastStart',
          desc: 'Gunakan Panda Video Compressor atau EDGE Video Calibration Studio untuk optimasi container MP4 non-fragmented.'
        },
        {
          num: 4,
          title: 'Mode Kompresi & Ekstensi',
          desc: 'Pilih Large File mode. Pastikan toggle Auto-Patcher pada ekstensi ini berstatus AKTIF.'
        },
        {
          num: 5,
          title: 'Unggah ke TikTok Studio',
          desc: 'Buka TikTok Studio lalu unggah. Ekstensi Nullsanz otomatis mengkalibrasi file secara lokal sebelum video diunggah.'
        }
      ]
    },
    en: {
      appName: 'Nullsanz Studio',
      appSub: 'Ultra HD Multi-Engine & Anti-Compress',
      devSub: 'Develop by nullsanz / null.cloud',
      engineReady: 'Nullsanz Multi-Engine Core Ready',
      hudCalibration: '8K 60FPS • 4K 120FPS',
      hudSound: 'SOUND SAFE',
      hudProcess: '100% LOCAL',
      uploaderLabel: 'Auto-Patcher Uploader',
      uploaderOn: 'ACTIVE',
      uploaderOff: 'DISABLED',
      watermarkLabel: 'Caption Watermark',
      watermarkOn: 'ON',
      watermarkOff: 'OFF (CLEAN)',
      publicVersionLabel: 'Engine Mode',
      publicVersionOn: 'MULTI-ENGINE 2.1.5 / 2.3 / 3.0',
      publicVersionOff: 'FULL UNLIMITED',
      supportTitle: '',
      supportBadge: '',
      supportText: '',
      btnOpenStudio: 'Open TikTok Studio',
      accordionFeatures: 'Key Features',
      accordionGuide: 'Step-by-Step Guide',
      chipFeatures: '16 FEATURES',
      chipGuide: '5 STEPS',
      footerSub: 'Nullsanz TikTok Studio • v3.0.0',
      features: [
        'Enhanced TikTok Upload Quality',
        'Up to 8K 60 FPS • 4K 120 FPS (Ultra Smooth)',
        'H.264 & H.265 / HEVC Support',
        'Supports All Video Formats (MP4 / MOV)',
        'Original Sound Support (Anti-Mute Bypass)',
        'TikTok Story & Feed Compatibility',
        'Safe Sound & Music Tagging',
        'Clickable @Mention Support',
        'Precision Cover Editing Support',
        'Automatic Video Processing',
        'Local Device Processing (100% Private)',
        'Simple & Fast Upload Workflow',
        'Metadata Repost Cleaner',
        'Toggle Watermark & Metadata',
        'Mobile & Desktop Browser Support',
        'English & Indonesian Language'
      ],
      steps: [
        {
          num: 1,
          title: 'Export Master Video',
          desc: 'Export your edit in 1080p, 4K, or 8K • 60 FPS from your favorite video editor (CapCut, Premiere, Alight Motion, etc).'
        },
        {
          num: 2,
          title: 'Enhance Quality',
          desc: 'Use your preferred video enhancer. Recommended for Wink: Ultra HD, or AI Repair → Basic → Ultra HD → 1080p.'
        },
        {
          num: 3,
          title: 'Compress & FastStart Calibration',
          desc: 'Use Panda Video Compressor or EDGE Video Calibration Studio to optimize non-fragmented MP4 containers.'
        },
        {
          num: 4,
          title: 'Compression Mode & Extension',
          desc: 'Select Large File mode. Make sure the Auto-Patcher toggle in this extension is set to ACTIVE.'
        },
        {
          num: 5,
          title: 'Upload to TikTok Studio',
          desc: 'Open TikTok Studio and upload. The Nullsanz extension automatically calibrates the file locally before upload.'
        }
      ]
    }
  };

  // State
  let currentLang = 'id';
  let uploaderActive = true;
  let watermarkActive = false;
  let publicVersionActive = true;
  let currentTheme = 'light';

  // Elements
  const txtEngineStatus = document.getElementById('txtEngineStatus');
  const txtAppName = document.getElementById('txtAppName');
  const txtAppSub = document.getElementById('txtAppSub');
  const txtDevSub = document.getElementById('txtDevSub');
  const btnLangEn = document.getElementById('btnLangEn');
  const btnLangId = document.getElementById('btnLangId');
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeIcon = document.getElementById('themeIcon');

  const cardUploader = document.getElementById('cardUploader');
  const lblUploader = document.getElementById('lblUploader');
  const valUploader = document.getElementById('valUploader');
  const txtUploaderStatus = document.getElementById('txtUploaderStatus');
  const chkUploader = document.getElementById('chkUploader');

  const cardWatermark = document.getElementById('cardWatermark');
  const lblWatermark = document.getElementById('lblWatermark');
  const valWatermark = document.getElementById('valWatermark');
  const txtWatermarkStatus = document.getElementById('txtWatermarkStatus');
  const chkWatermark = document.getElementById('chkWatermark');

  const cardPublicVersion = document.getElementById('cardPublicVersion');
  const lblPublicVersion = document.getElementById('lblPublicVersion');
  const valPublicVersion = document.getElementById('valPublicVersion');
  const txtPublicVersionStatus = document.getElementById('txtPublicVersionStatus');
  const chkPublicVersion = document.getElementById('chkPublicVersion');

  const txtSupportTitle = document.getElementById('txtSupportTitle');
  const txtSupportText = document.getElementById('txtSupportText');

  const btnOpenStudio = document.getElementById('btnOpenStudio');
  const txtBtnOpenStudio = document.getElementById('txtBtnOpenStudio');

  const accFeatures = document.getElementById('accFeatures');
  const btnAccFeatures = document.getElementById('btnAccFeatures');
  const txtAccFeaturesTitle = document.getElementById('txtAccFeaturesTitle');
  const featureListContainer = document.getElementById('featureListContainer');

  const accGuide = document.getElementById('accGuide');
  const btnAccGuide = document.getElementById('btnAccGuide');
  const txtAccGuideTitle = document.getElementById('txtAccGuideTitle');
  const stepListContainer = document.getElementById('stepListContainer');

  const txtFooterSub = document.getElementById('txtFooterSub');

  // Sparkle Icon SVG
  const sparkleSvg = `
    <div class="feature-sparkle-wrap">
      <svg viewBox="0 0 24 24">
        <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
      </svg>
    </div>
  `;

  // Sun & Moon Icons for Theme Switch
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
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  `;

  // Save Settings
  function saveState() {
    const data = {
      nullsanzLang: currentLang,
      nullsanzUploader: uploaderActive,
      nullsanzWatermark: watermarkActive,
      nullsanzPublicVersion: publicVersionActive,
      nullsanzTheme: currentTheme
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          uploaderActive,
          watermarkActive,
          publicVersion: publicVersionActive,
          lang: currentLang,
          theme: currentTheme
        });
      }
    } catch (_) {}

    try {
      localStorage.setItem('nullsanz_settings', JSON.stringify(data));
    } catch (_) {}
  }

  // Load Settings
  function loadState() {
    try {
      const saved = localStorage.getItem('nullsanz_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nullsanzLang) currentLang = parsed.nullsanzLang;
        if (parsed.nullsanzUploader !== undefined) uploaderActive = !!parsed.nullsanzUploader;
        if (parsed.nullsanzWatermark !== undefined) watermarkActive = !!parsed.nullsanzWatermark;
        if (parsed.nullsanzPublicVersion !== undefined) publicVersionActive = !!parsed.nullsanzPublicVersion;
        if (parsed.nullsanzTheme) currentTheme = parsed.nullsanzTheme;
      }
    } catch (_) {}

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['uploaderActive', 'watermarkActive', 'publicVersion', 'lang', 'theme'], (res) => {
          if (!res) return;
          if (res.uploaderActive !== undefined) uploaderActive = !!res.uploaderActive;
          if (res.watermarkActive !== undefined) watermarkActive = !!res.watermarkActive;
          if (res.publicVersion !== undefined) publicVersionActive = !!res.publicVersion;
          if (res.lang) currentLang = res.lang;
          if (res.theme) currentTheme = res.theme;
          applyAll();
        });
      }
    } catch (_) {}

    applyAll();
  }

  // Render Features & Steps
  function renderDynamicContent() {
    const t = I18N[currentLang] || I18N.id;

    // Features
    featureListContainer.innerHTML = t.features.map(f => `
      <div class="feature-item">
        ${sparkleSvg}
        <span>${f}</span>
      </div>
    `).join('');

    // Timeline Steps
    stepListContainer.innerHTML = t.steps.map(s => `
      <div class="timeline-item">
        <div class="timeline-node">${s.num}</div>
        <div class="timeline-title">${s.title}</div>
        <div class="timeline-desc">${s.desc}</div>
      </div>
    `).join('');
  }

  // Apply UI texts & state
  function applyAll() {
    const t = I18N[currentLang] || I18N.id;

    // Theme
    if (currentTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeIcon.innerHTML = sunSvg;
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeIcon.innerHTML = moonSvg;
    }

    // Texts
    txtEngineStatus.textContent = t.engineReady;
    txtAppName.textContent = t.appName;
    txtAppSub.textContent = t.appSub;
    txtDevSub.textContent = t.devSub;

    lblUploader.textContent = t.uploaderLabel;
    txtUploaderStatus.textContent = uploaderActive ? t.uploaderOn : t.uploaderOff;
    valUploader.className = `toggle-substatus ${uploaderActive ? 'on' : 'off'}`;
    chkUploader.checked = uploaderActive;
    if (uploaderActive) {
      cardUploader.classList.add('active-card');
    } else {
      cardUploader.classList.remove('active-card');
    }

    lblWatermark.textContent = t.watermarkLabel;
    txtWatermarkStatus.textContent = watermarkActive ? t.watermarkOn : t.watermarkOff;
    valWatermark.className = `toggle-substatus ${watermarkActive ? 'on' : 'off'}`;
    chkWatermark.checked = watermarkActive;
    if (watermarkActive) {
      cardWatermark.classList.add('active-card');
    } else {
      cardWatermark.classList.remove('active-card');
    }

    lblPublicVersion.textContent = t.publicVersionLabel;
    txtPublicVersionStatus.textContent = publicVersionActive ? t.publicVersionOn : t.publicVersionOff;
    valPublicVersion.className = `toggle-substatus ${publicVersionActive ? 'on' : 'off'}`;
    chkPublicVersion.checked = publicVersionActive;
    if (publicVersionActive) cardPublicVersion.classList.add('active-card');
    else cardPublicVersion.classList.remove('active-card');

    txtSupportTitle.textContent = t.supportTitle;
    txtSupportText.textContent = t.supportText;

    txtBtnOpenStudio.textContent = t.btnOpenStudio;
    txtAccFeaturesTitle.textContent = t.accordionFeatures;
    txtAccGuideTitle.textContent = t.accordionGuide;
    txtFooterSub.textContent = t.footerSub;

    // Lang Buttons
    if (currentLang === 'en') {
      btnLangEn.classList.add('active');
      btnLangId.classList.remove('active');
    } else {
      btnLangId.classList.add('active');
      btnLangEn.classList.remove('active');
    }

    // Dynamic Lists
    renderDynamicContent();
  }

  // Language Click Handlers
  btnLangEn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentLang = 'en';
    saveState();
    applyAll();
  });

  btnLangId.addEventListener('click', (e) => {
    e.stopPropagation();
    currentLang = 'id';
    saveState();
    applyAll();
  });

  // Theme Toggle Click Handler
  btnThemeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    saveState();
    applyAll();
  });

  // Toggles Click Handlers
  chkUploader.addEventListener('change', (e) => {
    uploaderActive = e.target.checked;
    saveState();
    applyAll();
  });

  cardUploader.addEventListener('click', (e) => {
    if (e.target.closest('.switch')) return;
    chkUploader.checked = !chkUploader.checked;
    uploaderActive = chkUploader.checked;
    saveState();
    applyAll();
  });

  chkWatermark.addEventListener('change', (e) => {
    watermarkActive = e.target.checked;
    saveState();
    applyAll();
  });

  cardWatermark.addEventListener('click', (e) => {
    if (e.target.closest('.switch')) return;
    chkWatermark.checked = !chkWatermark.checked;
    watermarkActive = chkWatermark.checked;
    saveState();
    applyAll();
  });

  chkPublicVersion.addEventListener('change', (e) => {
    publicVersionActive = e.target.checked;
    saveState();
    applyAll();
  });

  cardPublicVersion.addEventListener('click', (e) => {
    if (e.target.closest('.switch')) return;
    chkPublicVersion.checked = !chkPublicVersion.checked;
    publicVersionActive = chkPublicVersion.checked;
    saveState();
    applyAll();
  });

  // Accordion 1 Handler (Fitur Utama)
  btnAccFeatures.addEventListener('click', () => {
    const isOpen = accFeatures.classList.contains('open');
    if (isOpen) {
      accFeatures.classList.remove('open');
    } else {
      accFeatures.classList.add('open');
    }
  });

  // Accordion 2 Handler (Panduan Langkah demi Langkah)
  btnAccGuide.addEventListener('click', () => {
    const isOpen = accGuide.classList.contains('open');
    if (isOpen) {
      accGuide.classList.remove('open');
    } else {
      accGuide.classList.add('open');
    }
  });

  // Open TikTok Studio CTA Button
  btnOpenStudio.addEventListener('click', () => {
    const targetUrl = 'https://www.tiktok.com/tiktokstudio/upload';
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: targetUrl });
      } else {
        window.open(targetUrl, '_blank');
      }
    } catch (_) {
      window.open(targetUrl, '_blank');
    }
  });

  // Initial load
  loadState();

})();
