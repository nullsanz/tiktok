(() => {
  'use strict';
  if (window.__NULLSANZ_METHOD_V40__) return;
  window.__NULLSANZ_METHOD_V40__ = true;

  const SUPPORTED_ENGINES = ['4.0', '4.0-ultra', '4.0-pro', '3.0.5', '3.0', '2.1.5'];
  const ENGINE_LABELS = {
    '4.0': '4.0 Direct (sl-sr)',
    '4.0-ultra': '4.0 Ultra (FastStart)',
    '4.0-pro': '4.0 Pro (FFmpeg)',
    '3.0.5': '3.0.5 Sentinel',
    '3.0': '3.0 HEVC/DV',
    '2.1.5': '2.1.5 Classic'
  };
  const MAX_FILE_BYTES = 2000 * 1024 * 1024; // 2 GB Unlimited Local

  const isIOS = () => {
    const ua = String(navigator?.userAgent || '');
    return /iP(hone|ad|od)/.test(ua) ||
           (navigator?.platform === 'MacIntel' && (navigator?.maxTouchPoints || 0) > 1);
  };

  let processorReady = false;
  let pageHookReady = false;
  let frame = null;
  let pill = null;
  let toast = null;
  let overlay = null;
  let overlayTitle = null;
  let overlayDetail = null;
  let overlayBar = null;
  let busy = false;
  let pending = null;
  let requestSeq = 0;
  let toastTimer = null;
  let publishSeen = 0;

  // Synced user settings
  let uploaderEnabled = true;
  let soundSafeEnabled = true;
  let selectedEngine = isIOS() ? '4.0-ultra' : '4.0';
  let resolutionMode = '1080p';

  const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|mkv|avi|mpg|mpeg|ts|mts|m2ts|3gp|3g2|wmv|flv)$/i;
  const isVideoFile = (f) => !!f && (String(f.type || '').toLowerCase().startsWith('video/') || VIDEO_EXT_RE.test(f.name || ''));
  const fmtBytes = (n) => n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`;

  const isTikTokStudioPage = () => {
    const host = String(location.hostname || '').toLowerCase();
    const path = String(location.pathname || '').toLowerCase();
    return host.includes('studio.tiktok.com') ||
           path.includes('/tiktokstudio') ||
           path.includes('/creator') ||
           path.includes('/upload');
  };

  function openPatcherStudio(mode = '') {
    try {
      chrome.runtime.sendMessage({ type: 'OPEN_PATCHER', mode }, (resp) => {
        if (chrome.runtime.lastError || !resp?.ok) {
          const query = mode ? `?mode=${encodeURIComponent(mode)}` : '';
          window.open(chrome.runtime.getURL(`patcher.html${query}`), '_blank', 'noopener');
        }
      });
    } catch (_) {
      try {
        const query = mode ? `?mode=${encodeURIComponent(mode)}` : '';
        window.open(chrome.runtime.getURL(`patcher.html${query}`), '_blank', 'noopener');
      } catch (__) {}
    }
  }

  // Fallback page-hook injection for mobile browsers without MV3 world:"MAIN"
  function injectHookScriptFallback() {
    try {
      if (document.documentElement && !document.documentElement.dataset.nullsanzHookInjected) {
        document.documentElement.dataset.nullsanzHookInjected = '1';
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('page-hook.js');
        script.onload = () => script.remove();
        script.onerror = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
      }
    } catch (_) {}
  }
  injectHookScriptFallback();
  if (!document.documentElement?.dataset?.nullsanzHookInjected) {
    document.addEventListener('DOMContentLoaded', injectHookScriptFallback, { once: true });
  }

  function syncSettingsToPage() {
    try {
      if (document.documentElement) {
        document.documentElement.dataset.nullsanzSoundSafe = soundSafeEnabled ? '1' : '0';
        document.documentElement.dataset.nullsanzUploader = uploaderEnabled ? '1' : '0';
        document.documentElement.dataset.nullsanzEngine = selectedEngine;
      }
      window.postMessage({
        source: 'NULLSANZ_METHOD',
        type: 'NULLSANZ_SETTINGS',
        settings: {
          soundSafeEnabled: !!soundSafeEnabled,
          uploaderEnabled: !!uploaderEnabled,
          engine: selectedEngine
        }
      }, '*');
    } catch (_) {}
  }

  function refreshPillUI() {
    if (!pill) return;
    if (!uploaderEnabled) {
      const shieldTxt = soundSafeEnabled ? 'SoundSafe & CoverSafe tetap AKTIF' : 'Auto-Patch & SoundSafe Nonaktif';
      pill.innerHTML = `
        <span class="nullsanz-line1">
          <span class="nullsanz-dot" style="background:#9e9483;box-shadow:none;animation:none"></span>
          <span style="color:#d6d0c4">Nullsanz Studio v4.0 (Inline Off)</span>
        </span>
        <span class="nullsanz-spec" style="color:#a49a89">${shieldTxt}</span>
      `;
      pill.title = 'Nullsanz Studio v4.1 • Klik icon ekstensi untuk mengubah mode';
      return;
    }

    const engLabel = ENGINE_LABELS[selectedEngine] || selectedEngine;
    const shieldBadge = soundSafeEnabled ? 'SoundSafe + CoverSafe' : 'Shield Off';
    pill.innerHTML = `
      <span class="nullsanz-line1">
        <span class="nullsanz-dot"></span>
        <span>Nullsanz Studio v4.1 • Engine ${engLabel}</span>
      </span>
      <span class="nullsanz-spec">8K60/4K120 • ${shieldBadge} • Zero Watermark</span>
    `;
    pill.title = `Nullsanz TikTok Studio v4.1 Final | Engine ${engLabel} | ${shieldBadge} | Full Unlimited`;
  }

  function refreshZoneEngineUI() {
    const card = document.querySelector('#nullsanzZoneCard');
    if (!card) return;
    const tag = card.querySelector('.nullsanz-card-tag');
    if (tag) {
      const engLabel = ENGINE_LABELS[selectedEngine] || selectedEngine;
      tag.textContent = `✦ ENGINE ${engLabel.toUpperCase()} • SOUNDSAFE & COVERSAFE ✦`;
    }
    card.querySelectorAll('[data-nullsanz-engine]').forEach((btn) => {
      const active = btn.getAttribute('data-nullsanz-engine') === selectedEngine;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setEngine(nextEngine, notify = false) {
    if (!SUPPORTED_ENGINES.includes(nextEngine)) return;
    selectedEngine = nextEngine;
    try {
      chrome.storage?.local?.set({ nullsanzEngine: selectedEngine });
    } catch (_) {}
    syncSettingsToPage();
    refreshPillUI();
    refreshZoneEngineUI();
    if (notify) {
      showToast(`✓ Engine Nullsanz ${ENGINE_LABELS[selectedEngine]} aktif.`, 'ok');
    }
  }

  // Load & watch chrome.storage.local
  try {
    chrome.storage?.local?.get(['uploaderActive', 'soundSafeActive', 'nullsanzEngine', 'nullsanzResolutionMode'], (res) => {
      if (res) {
        if (res.uploaderActive !== undefined) uploaderEnabled = !!res.uploaderActive;
        if (res.soundSafeActive !== undefined) soundSafeEnabled = !!res.soundSafeActive;
        if (res.nullsanzEngine && SUPPORTED_ENGINES.includes(res.nullsanzEngine)) {
          selectedEngine = res.nullsanzEngine;
        }
        if (res.nullsanzResolutionMode === 'native' || res.nullsanzResolutionMode === '1080p') {
          resolutionMode = res.nullsanzResolutionMode;
        }
      }
      syncSettingsToPage();
      refreshPillUI();
      refreshZoneEngineUI();
    });

    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.uploaderActive !== undefined) uploaderEnabled = !!changes.uploaderActive.newValue;
      if (changes.soundSafeActive !== undefined) soundSafeEnabled = !!changes.soundSafeActive.newValue;
      if (changes.nullsanzEngine?.newValue && SUPPORTED_ENGINES.includes(changes.nullsanzEngine.newValue)) {
        selectedEngine = changes.nullsanzEngine.newValue;
      }
      if (changes.nullsanzResolutionMode?.newValue) {
        resolutionMode = changes.nullsanzResolutionMode.newValue === 'native' ? 'native' : '1080p';
      }
      syncSettingsToPage();
      refreshPillUI();
      refreshZoneEngineUI();
    });
  } catch (_) {}

  function findTikTokVideoInput() {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    const inp = inputs.find((i) => {
      const accept = String(i.accept || '').toLowerCase();
      return accept.includes('video') || accept.includes('.mp4');
    }) || inputs[0] || null;
    if (inp && getComputedStyle(inp).display === 'none') {
      try {
        inp.style.display = 'block';
        inp.style.opacity = '0.0001';
        inp.style.position = 'absolute';
        inp.style.pointerEvents = 'none';
        inp.style.width = '1px';
        inp.style.height = '1px';
      } catch (_) {}
    }
    return inp;
  }

  function findActiveFileInput() {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    return inputs.find((e) => !e.disabled && (String(e.accept || '').toLowerCase().includes('video') || String(e.accept || '').toLowerCase().includes('.mp4'))) ||
           inputs.find((e) => !e.disabled) ||
           null;
  }

  // Intercept file picker CHANGE
  document.addEventListener('change', (event) => {
    if (!uploaderEnabled) return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file' || !input.files?.length) return;

    if (input.dataset.nullsanzReady) {
      delete input.dataset.nullsanzReady;
      return;
    }
    if (input.dataset.nullsanzProcessing) return;

    const files = Array.from(input.files || []);
    if (!files.some(isVideoFile)) return;

    event.stopImmediatePropagation();
    event.stopPropagation();

    if (busy) return;
    void processSelection(input, files[0]);
  }, true);

  // Intercept drag and DROP
  document.addEventListener('drop', (event) => {
    if (!uploaderEnabled) return;
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.some(isVideoFile)) return;

    if (busy) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const input = findActiveFileInput() || findTikTokVideoInput();
    if (!input) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void processSelection(input, files[0]);
  }, true);

  function ensureDom() {
    if (!document.documentElement) return setTimeout(ensureDom, 5);
    if (!isTikTokStudioPage()) return;
    if (frame) return;

    const style = document.createElement('style');
    style.textContent = `
      #nullsanz-method-pill {
        position: fixed;
        left: 50%;
        top: 16px;
        transform: translateX(-50%);
        z-index: 2147483646;
        min-width: 310px;
        border: 1px solid rgba(95, 174, 111, 0.42);
        background: rgba(22, 24, 29, 0.84);
        color: #fff;
        border-radius: 20px;
        padding: 9px 18px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 12px 36px rgba(0,0,0,0.24), 0 0 14px rgba(95, 174, 111, 0.22);
        cursor: pointer;
        backdrop-filter: blur(16px) saturate(140%);
        -webkit-backdrop-filter: blur(16px) saturate(140%);
        text-align: center;
        transition: all 0.25s ease;
      }
      @media (max-width: 700px) {
        #nullsanz-method-pill {
          top: 10px;
          padding: 7px 12px;
          min-width: min(290px, calc(100vw - 20px));
          max-width: calc(100vw - 20px);
        }
        #nullsanz-toast {
          top: 72px;
        }
      }
      #nullsanz-method-pill:hover {
        transform: translateX(-50%) translateY(-2px);
        box-shadow: 0 16px 42px rgba(0,0,0,0.3), 0 0 20px rgba(95, 174, 111, 0.35);
      }
      #nullsanz-method-pill .nullsanz-line1 {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font: 700 12px/1.2 -apple-system, sans-serif;
        color: #fff;
      }
      #nullsanz-method-pill .nullsanz-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #54be68;
        box-shadow: 0 0 8px #54be68;
        animation: nullsanzPulse 2s infinite;
      }
      #nullsanz-method-pill .nullsanz-spec {
        display: block;
        margin-top: 4px;
        font: 600 10px/1.25 -apple-system, sans-serif;
        color: #a8d5b2;
        letter-spacing: 0.3px;
      }
      @keyframes nullsanzPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.25); opacity: 0.65; }
      }
      #nullsanz-toast {
        position: fixed;
        z-index: 2147483647;
        top: 86px;
        left: 50%;
        transform: translateX(-50%);
        max-width: min(440px, calc(100vw - 24px));
        display: none;
        background: #181d19;
        color: #e5f7ea;
        border: 1px solid #54be68;
        border-radius: 12px;
        padding: 10px 16px;
        font: 600 12px/1.45 -apple-system, sans-serif;
        box-shadow: 0 14px 34px rgba(0,0,0,0.3);
        word-break: break-word;
        text-align: center;
      }
      #nullsanz-toast.show { display: block; }
      #nullsanz-toast.err { background: #241416; border-color: #e05d5d; color: #fce8e8; }

      /* Upload Zone Custom Decoration */
      .nullsanz-upload-zone {
        position: relative !important;
        overflow: hidden !important;
        border: 2px solid #e4dccd !important;
        background: #f7f2e8 !important;
        width: 100% !important;
        min-height: 410px !important;
        box-sizing: border-box !important;
        border-radius: 18px !important;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.55), 0 12px 36px rgba(60,52,40,0.06) !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      .nullsanz-upload-zone > *:not(.nullsanz-zone-overlay):not(input[type="file"]) {
        clip-path: inset(100%) !important;
        overflow: hidden !important;
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      .nullsanz-upload-zone.nullsanz-drag-over {
        border-color: #48a459 !important;
        box-shadow: 0 0 0 3px rgba(72,164,89,.18), inset 0 0 0 1px rgba(255,255,255,.65) !important;
        transform: scale(1.005);
      }
      .nullsanz-zone-overlay {
        position: absolute;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 410px;
        z-index: 10;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        overflow: hidden;
        border-radius: inherit;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .nullsanz-zone-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, #fdfaf3, #f3ebdc);
        pointer-events: none;
      }
      .nullsanz-bracket {
        position: absolute;
        width: 22px;
        height: 22px;
        border-color: #b2a58f;
        border-style: solid;
        z-index: 12;
        pointer-events: none;
      }
      .nullsanz-bracket-tl { top: 14px; left: 14px; border-width: 2.5px 0 0 2.5px; border-top-left-radius: 6px; }
      .nullsanz-bracket-tr { top: 14px; right: 14px; border-width: 2.5px 2.5px 0 0; border-top-right-radius: 6px; }
      .nullsanz-bracket-bl { bottom: 14px; left: 14px; border-width: 0 0 2.5px 2.5px; border-bottom-left-radius: 6px; }
      .nullsanz-bracket-br { bottom: 14px; right: 14px; border-width: 0 2.5px 2.5px 0; border-bottom-right-radius: 6px; }

      .nullsanz-zone-card {
        position: relative;
        z-index: 14;
        width: min(468px, calc(100% - 32px));
        background: rgba(253, 250, 243, 0.97);
        backdrop-filter: blur(18px) saturate(140%);
        -webkit-backdrop-filter: blur(18px) saturate(140%);
        border: 1px solid #ddd3c1;
        border-radius: 20px;
        padding: 20px 22px 18px;
        text-align: center;
        box-shadow: 0 20px 50px rgba(72,63,49,.12), 0 0 25px rgba(150,137,113,.08);
        transition: all 0.25s ease;
      }
      .nullsanz-zone-card:hover {
        border-color: #78b486;
        transform: translateY(-2px);
      }
      .nullsanz-card-logo-img {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: block;
        margin: 0 auto 8px;
        object-fit: cover;
        box-shadow: 0 6px 18px rgba(62,55,44,.12);
      }
      .nullsanz-card-title {
        font: 800 17px/1.25 -apple-system, BlinkMacSystemFont, sans-serif;
        letter-spacing: -0.2px;
        color: #29261f;
        margin-bottom: 4px;
      }
      .nullsanz-card-tag {
        display: inline-block;
        font: 700 9.5px/1 -apple-system, sans-serif;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        background: #e1f1e4;
        border: 1px solid #a8d5b2;
        color: #266033;
        padding: 4px 10px;
        border-radius: 20px;
        margin-bottom: 10px;
      }
      .nullsanz-card-prompt {
        font: 500 12px/1.4 -apple-system, sans-serif;
        color: #756e62;
        margin-bottom: 12px;
      }
      .nullsanz-engine-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .nullsanz-eng-chip {
        border: 1px solid #d8cdbb;
        background: #f5efe3;
        color: #5f574b;
        border-radius: 9px;
        padding: 6px 10px;
        font: 700 10.5px/1 -apple-system, sans-serif;
        cursor: pointer;
        transition: all 0.18s ease;
      }
      .nullsanz-eng-chip:hover {
        border-color: #78b486;
        color: #2d6b3a;
      }
      .nullsanz-eng-chip.active {
        background: #dcecdf;
        border-color: #48a459;
        color: #23592e;
        box-shadow: 0 2px 8px rgba(72,164,89,0.2);
      }
      .nullsanz-card-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .nullsanz-card-btn {
        border: none;
        background: linear-gradient(135deg, #48a459 0%, #2d6b3a 100%);
        color: #ffffff;
        font: 700 12.5px/1 -apple-system, sans-serif;
        padding: 10px 18px;
        border-radius: 12px;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(72,164,89,.28);
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 7px;
      }
      .nullsanz-card-btn:hover {
        filter: brightness(1.06);
        transform: scale(1.02);
      }
      .nullsanz-pro-btn {
        border: 1px solid #cfc4b0;
        background: #fffdf8;
        color: #302d27;
        font: 700 11.5px/1 -apple-system, sans-serif;
        padding: 10px 14px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .nullsanz-pro-btn:hover {
        border-color: #48a459;
        color: #2d6b3a;
        background: #f3faf4;
      }
      .nullsanz-card-specs {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 12px;
        font: 600 10px/1 -apple-system, sans-serif;
        color: #8d8577;
      }
      .nullsanz-card-specs span:not(:last-child)::after {
        content: "•";
        margin-left: 8px;
        opacity: 0.6;
      }

      /* Processing Ring */
      .nullsanz-ring-container {
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 10px 0;
      }
      .nullsanz-zone-card.is-processing .nullsanz-idle-content { display: none; }
      .nullsanz-zone-card.is-processing .nullsanz-ring-container { display: flex; }
      .nullsanz-ring-wrap {
        position: relative;
        width: 86px;
        height: 86px;
        margin: 0 auto 14px;
      }
      .nullsanz-ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
      .nullsanz-ring-circle-bg { fill: none; stroke: rgba(41, 38, 31, 0.12); stroke-width: 6; }
      .nullsanz-ring-circle-bar {
        fill: none;
        stroke: #48a459;
        stroke-width: 6;
        stroke-linecap: round;
        stroke-dasharray: 264;
        stroke-dashoffset: 264;
        transition: stroke-dashoffset 0.2s ease;
      }
      .nullsanz-ring-percentage {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font: 800 19px/1 -apple-system, sans-serif;
        color: #29261f;
      }
      .nullsanz-ring-title {
        font: 800 14px/1.3 -apple-system, sans-serif;
        color: #29261f;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .nullsanz-ring-detail {
        font: 500 11.5px/1.4 -apple-system, sans-serif;
        color: #756e62;
      }

      /* Fallback Modal Overlay */
      #nullsanz-process-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483645;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(14, 17, 22, 0.76);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font-family: -apple-system, sans-serif;
      }
      #nullsanz-process-overlay.show { display: flex; }
      #nullsanz-process-card {
        width: min(500px, calc(100vw - 36px));
        padding: 30px 32px 26px;
        border-radius: 22px;
        background: rgba(22, 25, 31, 0.96);
        border: 1px solid rgba(84, 190, 104, 0.4);
        box-shadow: 0 28px 80px rgba(0,0,0,0.5), 0 0 25px rgba(84, 190, 104, 0.2);
        color: #fff;
        text-align: center;
      }
      #nullsanz-process-logo {
        font: 800 20px/1 -apple-system, sans-serif;
        color: #54be68;
        margin-bottom: 14px;
      }
      #nullsanz-process-title {
        font: 700 15px/1.25 -apple-system, sans-serif;
        color: #ffffff;
        margin-bottom: 6px;
      }
      #nullsanz-process-detail {
        min-height: 18px;
        font: 500 12px/1.4 -apple-system, sans-serif;
        color: #a49e92;
        margin-bottom: 18px;
      }
      #nullsanz-process-track {
        height: 8px;
        border-radius: 999px;
        background: #2a3039;
        overflow: hidden;
      }
      #nullsanz-process-bar {
        height: 100%;
        width: 0;
        background: #54be68;
        border-radius: 999px;
        transition: width .22s ease;
      }
      #nullsanz-process-note {
        margin-top: 14px;
        font: 600 11px/1.4 -apple-system, sans-serif;
        color: #797368;
      }
    `;
    document.documentElement.appendChild(style);

    pill = document.createElement('button');
    pill.id = 'nullsanz-method-pill';
    pill.type = 'button';
    pill.addEventListener('click', () => {
      if (busy) return;
      if (!uploaderEnabled) {
        showToast('Inline Auto-Patcher sedang Nonaktif. Aktifkan di popup ekstensi atau pakai Studio 4.0 Pro.', 'err');
        return;
      }
      const input = findTikTokVideoInput();
      if (!input) return showToast('Input upload TikTok belum muncul. Buka TikTok Studio > Upload.', 'err');
      input.click();
    });
    document.documentElement.appendChild(pill);
    refreshPillUI();

    toast = document.createElement('div');
    toast.id = 'nullsanz-toast';
    document.documentElement.appendChild(toast);

    overlay = document.createElement('div');
    overlay.id = 'nullsanz-process-overlay';
    overlay.innerHTML = `
      <div id="nullsanz-process-card">
        <img src="${chrome.runtime.getURL('icon128.png')}" alt="Nullsanz Logo" style="width:54px;height:54px;border-radius:14px;margin:0 auto 12px;display:block;box-shadow:0 6px 18px rgba(0,0,0,0.18);">
        <div id="nullsanz-process-logo">Nullsanz TikTok Studio v4.1</div>
        <div id="nullsanz-process-title">Membaca video…</div>
        <div id="nullsanz-process-detail">TikTok ditahan sampai proses kalibrasi selesai.</div>
        <div id="nullsanz-process-track"><div id="nullsanz-process-bar"></div></div>
        <div id="nullsanz-process-note">Nullsanz Ultra HD Studio • 100% Lokal &amp; Zero Watermark</div>
      </div>`;
    document.documentElement.appendChild(overlay);
    overlayTitle = overlay.querySelector('#nullsanz-process-title');
    overlayDetail = overlay.querySelector('#nullsanz-process-detail');
    overlayBar = overlay.querySelector('#nullsanz-process-bar');

    try {
      frame = document.createElement('iframe');
      frame.src = chrome.runtime.getURL('processor.html');
      frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none';
      frame.setAttribute('aria-hidden', 'true');
      document.documentElement.appendChild(frame);
    } catch (_) {}

    syncSettingsToPage();
    decorateUploadZone();
    setInterval(decorateUploadZone, 750);
  }

  function hasDashedBorder(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el.classList.contains('nullsanz-upload-zone') || el.dataset.nullsanzDropzone === '1') return true;
    try {
      const s = window.getComputedStyle(el);
      return (
        (s.borderStyle && s.borderStyle.includes('dashed')) ||
        s.borderTopStyle === 'dashed' ||
        s.borderRightStyle === 'dashed' ||
        s.borderBottomStyle === 'dashed' ||
        s.borderLeftStyle === 'dashed'
      );
    } catch (_) {
      return false;
    }
  }

  function findOuterUploadDropZone(startEl) {
    if (!startEl) return null;
    const existing = document.querySelector('[data-nullsanz-dropzone="1"]');
    if (existing && document.body.contains(existing)) return existing;

    let curr = startEl;
    let dashedAncestor = null;
    let uploadAncestor = null;

    for (let i = 0; i < 14 && curr && curr !== document.body && curr !== document.documentElement; i++, curr = curr.parentElement) {
      if (hasDashedBorder(curr)) {
        dashedAncestor = curr;
        break;
      }
      const r = curr.getBoundingClientRect();
      const cls = String(curr.className || '').toLowerCase();
      const id = String(curr.id || '').toLowerCase();
      const isUploadish = /drop|upload|stage|container|zone|card/.test(cls + ' ' + id);

      if (r.width >= 280 && r.height >= 160 && r.height < 900) {
        const hasHeaderOrTabs = !!curr.querySelector('header, nav, [role="tablist"], [class*="header"], [class*="sidebar"], [class*="tab"]');
        if (!hasHeaderOrTabs && (isUploadish || !uploadAncestor)) {
          uploadAncestor = curr;
        }
      }
    }
    const target = dashedAncestor || uploadAncestor || null;
    if (target) target.dataset.nullsanzDropzone = '1';
    return target;
  }

  function dismissUploadOverlay() {
    window.__nullsanzUploadActive = true;
    const ov = document.querySelector('.nullsanz-zone-overlay');
    const zone = document.querySelector('.nullsanz-upload-zone');
    if (ov) {
      ov.style.transition = 'opacity 0.35s ease';
      ov.style.opacity = '0';
      setTimeout(() => {
        try { ov.remove(); } catch (_) {}
        if (zone) zone.classList.remove('nullsanz-upload-zone');
      }, 350);
    } else if (zone) {
      zone.classList.remove('nullsanz-upload-zone');
    }
  }

  function decorateUploadZone() {
    if (!isTikTokStudioPage()) return;
    if (!uploaderEnabled) {
      const ov = document.querySelector('.nullsanz-zone-overlay');
      const zone = document.querySelector('.nullsanz-upload-zone');
      if (ov) ov.remove();
      if (zone) zone.classList.remove('nullsanz-upload-zone');
      return;
    }

    if (document.querySelector('input[placeholder*="caption" i], textarea, [class*="caption" i], [class*="publish" i], [class*="post-btn" i]')) {
      const ov = document.querySelector('.nullsanz-zone-overlay');
      if (ov) ov.remove();
      return;
    }

    if (window.__nullsanzUploadActive && !findTikTokVideoInput()) return;
    window.__nullsanzUploadActive = false;

    const existingOverlay = document.querySelector('.nullsanz-zone-overlay');
    if (existingOverlay && document.body.contains(existingOverlay)) return;

    const input = findTikTokVideoInput();
    const btn = Array.from(document.querySelectorAll('button')).find((el) =>
      /pilih video|select video|choose video|unggah video|upload video/i.test((el.textContent || '').trim())
    );

    const startEl = (btn ? btn.parentElement : null) || (input ? input.parentElement : null);
    if (!startEl) return;

    const zone = findOuterUploadDropZone(startEl) || startEl;
    if (!zone) return;

    zone.dataset.nullsanzDropzone = '1';
    if (getComputedStyle(zone).position === 'static') {
      zone.style.position = 'relative';
    }
    zone.classList.add('nullsanz-upload-zone');

    const overlayEl = document.createElement('div');
    overlayEl.className = 'nullsanz-zone-overlay';
    overlayEl.innerHTML = `
      <div class="nullsanz-zone-gradient"></div>
      <div class="nullsanz-bracket nullsanz-bracket-tl"></div>
      <div class="nullsanz-bracket nullsanz-bracket-tr"></div>
      <div class="nullsanz-bracket nullsanz-bracket-bl"></div>
      <div class="nullsanz-bracket nullsanz-bracket-br"></div>

      <div class="nullsanz-zone-card" id="nullsanzZoneCard">
        <div class="nullsanz-idle-content">
          <img src="${chrome.runtime.getURL('icon48.png')}" class="nullsanz-card-logo-img" alt="Nullsanz Logo">
          <div class="nullsanz-card-title">Nullsanz TikTok Studio v4.1 Final</div>
          <div class="nullsanz-card-tag">✦ ENGINE 4.0 DIRECT (SL-SR) • SOUNDSAFE &amp; COVERSAFE ✦</div>
          <div class="nullsanz-card-prompt" id="nullsanzCardPrompt">Tarik &amp; letakkan video di sini atau pilih engine di bawah untuk kalibrasi langsung di TikTok Studio</div>

          <div class="nullsanz-engine-bar" role="group" aria-label="Pilih Nullsanz Engine">
            <button type="button" class="nullsanz-eng-chip ${selectedEngine === '4.0' ? 'active' : ''}" data-nullsanz-engine="4.0" aria-pressed="${selectedEngine === '4.0'}">4.0 Direct</button>
            <button type="button" class="nullsanz-eng-chip ${selectedEngine === '4.0-ultra' ? 'active' : ''}" data-nullsanz-engine="4.0-ultra" aria-pressed="${selectedEngine === '4.0-ultra'}">4.0 Ultra</button>
            <button type="button" class="nullsanz-eng-chip ${selectedEngine === '4.0-pro' ? 'active' : ''}" data-nullsanz-engine="4.0-pro" aria-pressed="${selectedEngine === '4.0-pro'}">4.0 Pro</button>
            <button type="button" class="nullsanz-eng-chip ${selectedEngine === '3.0.5' ? 'active' : ''}" data-nullsanz-engine="3.0.5" aria-pressed="${selectedEngine === '3.0.5'}">3.0.5</button>
            <button type="button" class="nullsanz-eng-chip ${selectedEngine === '3.0' ? 'active' : ''}" data-nullsanz-engine="3.0" aria-pressed="${selectedEngine === '3.0'}">3.0</button>
            <button type="button" class="nullsanz-eng-chip ${selectedEngine === '2.1.5' ? 'active' : ''}" data-nullsanz-engine="2.1.5" aria-pressed="${selectedEngine === '2.1.5'}">2.1.5</button>
          </div>

          <div class="nullsanz-card-actions">
            <button type="button" class="nullsanz-card-btn" id="nullsanzPickVideoBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>Pilih Video (Auto-Patch)</span>
            </button>
            <button type="button" class="nullsanz-pro-btn" id="nullsanzOpenProStudioBtn" title="Buka Studio Standalone untuk download/preview offline">
              <span>⚡ Studio Standalone</span>
            </button>
          </div>

          <div class="nullsanz-card-specs">
            <span>8K 60FPS / 4K 120FPS</span>
            <span>Dual-Audio 4.0</span>
            <span>Zero Watermark</span>
          </div>
        </div>

        <div class="nullsanz-ring-container">
          <div class="nullsanz-ring-wrap">
            <svg class="nullsanz-ring-svg" viewBox="0 0 100 100">
              <circle class="nullsanz-ring-circle-bg" cx="50" cy="50" r="42"></circle>
              <circle class="nullsanz-ring-circle-bar" id="nullsanzRingBar" cx="50" cy="50" r="42"></circle>
            </svg>
            <div class="nullsanz-ring-percentage" id="nullsanzRingPct">0%</div>
          </div>
          <div class="nullsanz-ring-title" id="nullsanzRingTitle">MEMBACA VIDEO…</div>
          <div class="nullsanz-ring-detail" id="nullsanzRingDetail">TikTok ditahan sampai kalibrasi selesai.</div>
        </div>
      </div>
    `;

    // Engine chip clicks (stop propagation so file picker doesn't open)
    overlayEl.querySelectorAll('[data-nullsanz-engine]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (busy) return;
        setEngine(chip.getAttribute('data-nullsanz-engine'), true);
      });
    });

    // Open Pro Studio button
    const proBtn = overlayEl.querySelector('#nullsanzOpenProStudioBtn');
    if (proBtn) {
      proBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPatcherStudio('4.0-pro');
      });
    }

    // Click handler to open file picker
    overlayEl.addEventListener('click', (e) => {
      if (busy) return;
      if (e.target.closest('[data-nullsanz-engine]') || e.target.closest('#nullsanzOpenProStudioBtn')) return;
      const inp = findTikTokVideoInput();
      if (inp) inp.click();
    });

    overlayEl.addEventListener('dragenter', () => {
      zone.classList.add('nullsanz-drag-over');
      const prompt = overlayEl.querySelector('#nullsanzCardPrompt');
      if (prompt) prompt.textContent = 'Lepaskan video untuk mulai kalibrasi otomatis!';
    });
    overlayEl.addEventListener('dragleave', (e) => {
      if (!overlayEl.contains(e.relatedTarget)) {
        zone.classList.remove('nullsanz-drag-over');
        const prompt = overlayEl.querySelector('#nullsanzCardPrompt');
        if (prompt) prompt.textContent = 'Tarik & letakkan video di sini atau pilih engine di bawah untuk kalibrasi otomatis';
      }
    });
    overlayEl.addEventListener('drop', () => {
      zone.classList.remove('nullsanz-drag-over');
    });

    zone.appendChild(overlayEl);
    refreshZoneEngineUI();
  }

  function showToast(message, mode = '') {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `show ${mode}`.trim();
    toastTimer = setTimeout(() => {
      toast.className = '';
    }, 4800);
  }

  function setStage(title, pct, detail = '') {
    const p = Math.max(0, Math.min(100, pct));
    const card = document.getElementById('nullsanzZoneCard');
    const ringBar = document.getElementById('nullsanzRingBar');
    const ringPct = document.getElementById('nullsanzRingPct');
    const ringTitle = document.getElementById('nullsanzRingTitle');
    const ringDetail = document.getElementById('nullsanzRingDetail');

    if (card) card.classList.add('is-processing');
    if (ringPct) ringPct.textContent = `${Math.round(p)}%`;
    if (ringTitle) ringTitle.textContent = title.toUpperCase();
    if (ringDetail) ringDetail.textContent = detail;
    if (ringBar) {
      const circum = 2 * Math.PI * 42;
      ringBar.style.strokeDashoffset = String(circum - (p / 100) * circum);
    }

    if (overlay) overlay.classList.add('show');
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayDetail) overlayDetail.textContent = detail;
    if (overlayBar) overlayBar.style.width = p + '%';
  }

  function hideStage(delay = 600) {
    setTimeout(() => {
      const card = document.getElementById('nullsanzZoneCard');
      if (card) card.classList.remove('is-processing');
      if (overlay) overlay.classList.remove('show');
      if (overlayBar) overlayBar.style.width = '0%';
    }, delay);
  }

  function setBusy(val) {
    busy = !!val;
    if (pill) pill.style.opacity = busy ? '0.6' : '1';
  }

  async function waitProcessor(timeout = 12000) {
    const start = Date.now();
    while (!processorReady) {
      if (Date.now() - start > timeout) throw new Error('Processor belum siap. Muat ulang TikTok lalu coba lagi.');
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  async function processSelection(input, file) {
    if (busy || !file || !isVideoFile(file)) return;
    if (file.size > MAX_FILE_BYTES) {
      return showToast(`Video ${fmtBytes(file.size)} melewati limit 2 GB untuk Nullsanz Studio.`, 'err');
    }

    setBusy(true);
    input.dataset.nullsanzProcessing = '1';
    setStage('Membaca video…', 10, `${file.name} • ${fmtBytes(file.size)}`);

    try {
      const buffer = await file.arrayBuffer();

      // Fast-path: Inline processor
      if (globalThis.NullsanzVideoProcessor?.processVideoDirect) {
        const requestId = `nullsanz-${Date.now()}-${++requestSeq}`;
        const result = await globalThis.NullsanzVideoProcessor.processVideoDirect({
          requestId,
          buffer,
          fileName: file.name || 'video.mp4',
          fileType: file.type || '',
          fileSize: file.size || buffer.byteLength,
          engine: selectedEngine,
          resolutionMode
        }, (label, progress, detail) => {
          setStage(label, progress, detail);
        });

        const safeOriginalName = (file.name || 'video.mp4').replace(/[\\/:*?"<>|]+/g, '_');
        const base = safeOriginalName.replace(/\.[^.]+$/, '');
        const suffix = result.mode === 'nullsanz-direct-4.0-slsr'
          ? '_Nullsanz_v4'
          : (result.mode === 'nullsanz-ultra-4.0-faststart'
            ? '_Nullsanz_Ultra'
            : (result.mode === 'nullsanz-pro-4.0-wasm' ? '_Nullsanz_Pro' : '_NullsanzStudio'));
        const finalName = result.passthrough
          ? (result.outputName || safeOriginalName)
          : `${base}${suffix}.mp4`;
        const finalType = result.passthrough
          ? (result.outputMime || file.type || 'application/octet-stream')
          : (result.outputMime || 'video/mp4');
        const outputBuf = (result.output instanceof Uint8Array)
          ? result.output.buffer.slice(result.output.byteOffset, result.output.byteOffset + result.output.byteLength)
          : result.output;

        let targetInput = input.isConnected !== false ? input : findActiveFileInput();
        if (!targetInput) throw new Error('Elemen upload TikTok tidak ditemukan.');

        let patched;
        if (result.passthrough && isIOS()) {
          patched = file;
          try { Object.defineProperty(patched, 'name', { value: finalName, writable: false }); } catch (_) {}
        } else {
          const blobParts = result.passthrough ? [file] : [outputBuf];
          patched = new File(blobParts, finalName, {
            type: finalType,
            lastModified: file.lastModified || Date.now()
          });
        }
        delete targetInput.dataset.nullsanzProcessing;
        if (targetInput !== input) delete input.dataset.nullsanzProcessing;

        const engineUsed = result.report?.engine || result.mode || 'Nullsanz v4.0';
        setStage('Siap upload', 100, `${engineUsed} • ${fmtBytes(result.inputBytes || file.size)} → ${fmtBytes(outputBuf.byteLength)}`);

        replayToTikTok(targetInput, patched, file);
        if (result.warning) {
          showToast(`✓ Kalibrasi selesai (${result.warning}). SoundSafe & CoverSafe aktif.`, 'ok');
        } else {
          showToast(`✓ Nullsanz v4.0: ${engineUsed} selesai! SoundSafe & CoverSafe aktif.`, 'ok');
        }

        hideStage(700);
        setTimeout(dismissUploadOverlay, 800);
        return;
      }

      // Fallback iframe processor
      await waitProcessor();
      const requestId = `nullsanz-${Date.now()}-${++requestSeq}`;
      pending = { requestId, input, originalFile: file };
      frame.contentWindow.postMessage({
        source: 'NULLSANZ_CONTENT',
        type: 'PROCESS',
        requestId,
        buffer,
        fileName: file.name || 'video.mp4',
        fileType: file.type || '',
        fileSize: file.size || buffer.byteLength,
        engine: selectedEngine,
        resolutionMode
      }, '*', [buffer]);
    } catch (e) {
      delete input.dataset.nullsanzProcessing;
      pending = null;
      setBusy(false);
      hideStage(0);
      showToast(`Nullsanz Studio gagal: ${e?.message || e}`, 'err');
    } finally {
      if (!pending) setBusy(false);
    }
  }

  function replayToTikTok(inputEl, file, originalFile) {
    if (originalFile && file.name) {
      window.postMessage({
        source: 'NULLSANZ_CONTENT',
        type: 'STORE_ORIGINAL_FILE',
        patchedName: file.name,
        originalFile
      }, '*');
    }

    let a = inputEl;
    const assign = () => {
      if (a?.isConnected === false) a = findActiveFileInput();
      if (!a) return false;

      try {
        const tracker = a._valueTracker;
        if (tracker) tracker.setValue('');
      } catch (_) {}

      const dt = new DataTransfer();
      dt.items.add(file);
      try {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
        if (typeof nativeSetter === 'function') nativeSetter.call(a, dt.files);
        else a.files = dt.files;
      } catch (e) {
        console.warn('[Nullsanz v4.0] DataTransfer assign error:', e);
        try { a.files = dt.files; } catch (_) {}
      }

      a.dataset.nullsanzReady = '1';
      a.dispatchEvent(new Event('input', { bubbles: true, composed: true, cancelable: true }));
      a.dispatchEvent(new Event('change', { bubbles: true, composed: true, cancelable: true }));
      return true;
    };

    if (!assign() || !isIOS()) return;

    let attempts = 0;
    const retry = () => {
      if (attempts >= 4 || a?.isConnected === false) return;
      attempts += 1;
      assign();
      setTimeout(retry, 500);
    };
    setTimeout(retry, 500);
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data) return;

    if (data.source === 'NULLSANZ_PAGE_HOOK') {
      if (data.type === 'HOOK_READY') {
        pageHookReady = true;
        syncSettingsToPage();
      } else if (data.type === 'PUBLISH_NORMALIZED') {
        publishSeen++;
        showToast('✓ Nullsanz v4.0: SoundSafe & CoverSafe diterapkan (Zero Watermark).', 'ok');
      }
      return;
    }

    if (data.source !== 'NULLSANZ_PROCESSOR') return;
    if (data.type === 'READY') { processorReady = true; return; }
    if (!pending || (data.requestId && data.requestId !== pending.requestId)) return;

    if (data.type === 'STAGE') {
      setStage(data.label || 'Memproses…', data.progress || 0, data.detail || 'TikTok ditahan sampai proses selesai.');
      return;
    }
    if (data.type === 'ERROR') {
      const input = pending.input;
      if (input) delete input.dataset.nullsanzProcessing;
      pending = null;
      setBusy(false);
      hideStage(0);
      showToast(`Proses kalibrasi gagal: ${data.message || 'unknown'}`, 'err');
      return;
    }
    if (data.type === 'DONE') {
      const { input, originalFile } = pending;
      try {
        const safeOriginalName = (originalFile.name || 'video.mp4').replace(/[\\/:*?"<>|]+/g, '_');
        const base = safeOriginalName.replace(/\.[^.]+$/, '');
        const suffix = data.mode === 'nullsanz-direct-4.0-slsr'
          ? '_Nullsanz_v4'
          : (data.mode === 'nullsanz-ultra-4.0-faststart'
            ? '_Nullsanz_Ultra'
            : (data.mode === 'nullsanz-pro-4.0-wasm' ? '_Nullsanz_Pro' : '_NullsanzStudio'));
        const finalName = data.passthrough ? (data.outputName || safeOriginalName) : `${base}${suffix}.mp4`;
        const finalType = data.passthrough ? (data.outputMime || originalFile.type || 'application/octet-stream') : (data.outputMime || 'video/mp4');
        const patched = new File([data.buffer], finalName, { type: finalType, lastModified: originalFile.lastModified || Date.now() });
        const strictLargerCheck = data.mode === 'nullsanz-direct-4.0-slsr' || data.mode === 'nullsanz-core-resolution-codec-safe';
        if (!data.passthrough && ((strictLargerCheck && patched.size < originalFile.size) || patched.size < 1024)) {
          throw new Error(`SIZE GUARD: output ${fmtBytes(patched.size)} tidak valid (source ${fmtBytes(originalFile.size)}).`);
        }
        setStage('Siap upload', 100, `${data.mode || 'processed'} • ${fmtBytes(data.inputBytes)} → ${fmtBytes(data.outputBytes)}`);
        let targetInput = input.isConnected !== false ? input : findActiveFileInput();
        if (targetInput) {
          delete targetInput.dataset.nullsanzProcessing;
          if (targetInput !== input) delete input.dataset.nullsanzProcessing;
          replayToTikTok(targetInput, patched, originalFile);
        }
        showToast('✓ Nullsanz v4.0: Kalibrasi selesai! SoundSafe & CoverSafe aktif.', 'ok');
      } catch (e) {
        if (input) delete input.dataset.nullsanzProcessing;
        showToast(`Gagal meneruskan file hasil proses: ${e?.message || e}`, 'err');
      } finally {
        pending = null;
        setBusy(false);
        hideStage(700);
        setTimeout(dismissUploadOverlay, 800);
      }
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (isTikTokStudioPage()) ensureDom();
    });
  } else {
    if (isTikTokStudioPage()) ensureDom();
  }
})();
