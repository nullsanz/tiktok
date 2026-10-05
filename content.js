(() => {
  'use strict';
  if (window.__Nullsanz_METHOD_V20__) return;
  window.__Nullsanz_METHOD_V20__ = true;

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
  let uploaderEnabled = true;
  let watermarkEnabled = false;
  let publicVersionEnabled = true;

  // ================= ACCESS CONTROL =================
  const ACCESS_USERS = {
    'TIKTOKNullsanz': { name: 'Nullsanz Studio', tier: 3, limit: 2000 * 1024 * 1024 }
  };
  const MAX_FILE_BYTES = 2000 * 1024 * 1024;
  let selectedEngine = '3.0';

  let accessUnlocked = true;
  let activeAccess = {
    name: 'Nullsanz Studio',
    tier: 3,
    limit: Infinity,
    key: 'UNLIMITED',
    public: true,
    maxLongSide: 8192,
    maxShortSide: 4320,
    maxFps: 120
  };

  let accessModal = null;
  let accessInput = null;
  let accessError = null;

  const accessLimitLabel = n => Number.isFinite(n) ? fmtBytes(n) : 'Unlimited';

  const maskKey = key => key ? '••••••' + key.slice(-4) : '—';

  function getAccessUser(key) {
    return ACCESS_USERS[String(key || '').trim()];
  }

  function updateAccessPill() {
    if (!pill) return;
    if (!uploaderEnabled) return;
    if (!accessUnlocked || !activeAccess) {
      pill.innerHTML = `
        <span class="nullsanz-line1">
          <span class="nullsanz-dot nullsanz-locked-dot"></span>
          <span>Nullsanz TikTok Studio v3.0 • READY</span>
        </span>
        <span class="nullsanz-spec">Masukkan password untuk mengaktifkan Auto-Patch</span>
      `;
      pill.title = 'Nullsanz Studio • Ready';
      return;
    }
    pill.innerHTML = `
      <span class="nullsanz-line1">
        <span class="nullsanz-dot"></span>
        <span>Nullsanz Studio v3.0 • Engine ${selectedEngine}</span>
      </span>
      <span class="nullsanz-spec">Auto-Patch ACTIVE • ${accessLimitLabel(activeAccess.limit)} • Key ${maskKey(activeAccess.key)}</span>
    `;
    pill.title = `Nullsanz Studio v3.0 • Engine ${selectedEngine} • Full Unlimited`;
  }

  function showAccessModal() {
    if (!accessModal) return;
    accessModal.classList.add('show');
    setTimeout(() => accessInput?.focus(), 80);
  }

  function hideAccessModal() {
    if (accessModal) accessModal.classList.remove('show');
  }

  function showAccessError(message) {
    if (!accessError) return;
    accessError.textContent = message;
    accessError.classList.add('show');
    if (accessInput) {
      accessInput.classList.remove('shake');
      void accessInput.offsetWidth;
      accessInput.classList.add('shake');
    }
  }

  function unlockAccess() {
    const key = String(accessInput?.value || '').trim();
    const user = getAccessUser(key);
    if (!user) return showAccessError('Password salah atau tidak terdaftar.');

    activeAccess = { ...user, key };
    accessUnlocked = true;
    if (accessInput) accessInput.value = '';
    if (accessError) accessError.classList.remove('show');
    hideAccessModal();
    updateAccessPill();
    updateUploadZoneAccess();
    showToast(`✓ Akses aktif • ${user.name} • ${user.tier === 3 ? 'Unlimited' : accessLimitLabel(user.limit)}`);
  }

  function restoreAccessSession() {
    accessUnlocked = true;
    activeAccess = {
      name: 'Nullsanz Studio',
      tier: 3,
      limit: Infinity,
      key: 'UNLIMITED',
      public: true,
      maxLongSide: 8192,
      maxShortSide: 4320,
      maxFps: 120
    };
    return true;
  }

  function lockAccess() {
    accessUnlocked = false;
    activeAccess = null;
    updateAccessPill();
    updateUploadZoneAccess();
    showAccessModal();
  }

  function requireAccess() {
    return true;
  }


  function refreshPillUI() {
    if (!pill) return;
    if (!uploaderEnabled) {
      pill.innerHTML = `
        <span class="nullsanz-line1">
          <span class="nullsanz-dot" style="background:#9e9483;box-shadow:none"></span>
          <span style="color:#6b6252">Nullsanz Studio (Nonaktif)</span>
        </span>
        <span class="nullsanz-spec" style="color:#9e9483">Patcher dimatikan lewat popup ekstensi</span>
      `;
      pill.title = 'Nullsanz Studio Nonaktif • Buka icon ekstensi untuk mengaktifkan';
    } else {
      pill.innerHTML = `
        <span class="nullsanz-line1">
          <span class="nullsanz-dot"></span>
          <span>Nullsanz TikTok Studio v3.0 Active</span>
        </span>
        <span class="nullsanz-spec">Auto-Patch 4K 120FPS • Sound Safe (Anti-Kompres)</span>
      `;
      pill.title = 'Nullsanz TikTok Studio v3.0 | Auto-Patch & Sound Safe Active';
    }
  }

  let pageHookInjectedOk = false;
  function injectHookScript() {
    try {
      if (document.documentElement && !document.documentElement.dataset.adjnHookInjected) {
        document.documentElement.dataset.adjnHookInjected = '1';
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('page-hook.js');
        script.onload = () => { script.remove(); pageHookInjectedOk = true; };
        script.onerror = () => {
          script.remove();
          console.warn('[Nullsanz] page-hook.js injection failed (likely iOS/Orion). Sound Safe via page hook unavailable.');
        };
        (document.head || document.documentElement).appendChild(script);
      }
    } catch (_) {
      console.warn('[Nullsanz] injectHookScript error:', _);
    }
  }
  injectHookScript();
  if (!document.documentElement?.dataset?.adjnHookInjected) {
    document.addEventListener('DOMContentLoaded', injectHookScript, { once: true });
  }

  function syncDataset() {
    try {
      if (document.documentElement) {
        document.documentElement.dataset.adjnWatermark = watermarkEnabled ? '1' : '0';
        document.documentElement.dataset.adjnUploader = uploaderEnabled ? '1' : '0';
      }
      window.postMessage({
        source: 'Nullsanz_METHOD',
        type: 'Nullsanz_SETTINGS',
        settings: {
          watermarkEnabled: !!watermarkEnabled,
          uploaderEnabled: !!uploaderEnabled
        }
      }, '*');
    } catch (_) {}
  }

  try {
    chrome.storage?.local?.get(['uploaderActive', 'watermarkActive'], res => {
      if (res && res.uploaderActive !== undefined) uploaderEnabled = !!res.uploaderActive;
      if (res && res.watermarkActive !== undefined) watermarkEnabled = !!res.watermarkActive;
      syncDataset();
      refreshPillUI();
      updateUploadZoneAccess();
    });
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.uploaderActive !== undefined) {
        uploaderEnabled = !!changes.uploaderActive.newValue;
        syncDataset();
        refreshPillUI();
        updateUploadZoneAccess();
      }
      if (changes.watermarkActive !== undefined) {
        watermarkEnabled = !!changes.watermarkActive.newValue;
        syncDataset();
      }
    });
  } catch (_) {}

  const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|mkv|avi|mpg|mpeg|ts|mts|m2ts|3gp|3g2|wmv|flv)$/i;
  const isVideoFile = f => !!f && (String(f.type || '').toLowerCase().startsWith('video/') || VIDEO_EXT_RE.test(f.name || ''));
  const isSupportedContainer = f => isVideoFile(f);
  const fmtBytes = n => n >= 1024**3 ? `${(n/1024**3).toFixed(2)} GB` : n >= 1024**2 ? `${(n/1024**2).toFixed(1)} MB` : `${(n/1024).toFixed(1)} KB`;

  const isTikTokStudioPage = () => {
    const host = String(location.hostname || '').toLowerCase();
    const path = String(location.pathname || '').toLowerCase();
    return host.includes('studio.tiktok.com') ||
           path.includes('/tiktokstudio') ||
           path.includes('/creator') ||
           path.includes('/upload');
  };

  function findTikTokVideoInput() {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    const inp = inputs.find(i => {
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

  const isIOS = () => {
    const ua = String(navigator?.userAgent || '');
    return /iP(hone|ad|od)/.test(ua) ||
           (navigator?.platform === 'MacIntel' && (navigator?.maxTouchPoints || 0) > 1) ||
           Boolean(window.__NULLSANZ_ORION_COMPAT__);
  };

  function findActiveFileInput() {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    return inputs.find(e => !e.disabled && (String(e.accept || '').toLowerCase().includes('video') || String(e.accept || '').toLowerCase().includes('.mp4'))) ||
           inputs.find(e => !e.disabled) ||
           null;
  }

  // Intercept file picker CHANGE
  // Use document.addEventListener (not window) — matches proven Transcode Vague pattern for iOS WebKit
  document.addEventListener('change', event => {
    if (!uploaderEnabled) return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file' || !input.files?.length) return;

    // Synthetic event replayed to TikTok: let it pass through to TikTok's native listeners!
    if (input.dataset.nullsanzReady) {
      delete input.dataset.nullsanzReady;
      return;
    }

    // Already processing
    if (input.dataset.nullsanzProcessing) return;

    const files = Array.from(input.files || []);
    if (!files.some(isVideoFile)) return;

    // ====== iOS / Orion / Mobile WebKit: Intercept and patch ======
    // Previously we bypassed this, but the user requested the UI and patch to be active on iOS.
    // The React freeze issue was resolved by using clip-path instead of display:none.


    // ====== Desktop (Chrome/Edge/etc): full interception + processing ======
    // Stop propagation so TikTok does not get the raw unpatched file yet.
    event.stopImmediatePropagation();
    event.stopPropagation();

    if (!requireAccess()) return;
    if (busy) return;

    void processSelection(input, files[0]);
  }, true);

  // Intercept drag and DROP (desktop/iOS)
  document.addEventListener('drop', event => {
    if (!uploaderEnabled) return;
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.some(isVideoFile)) return;

    if (!requireAccess()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
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
        top: 18px;
        transform: translateX(-50%);
        z-index: 2147483646;
        min-width: 310px;
        border: 1px solid rgba(95, 174, 111, 0.35);
        background: rgba(22, 24, 29, 0.78);
        color: #fff;
        border-radius: 20px;
        padding: 9px 18px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 12px 36px rgba(0,0,0,0.22), 0 0 14px rgba(95, 174, 111, 0.2);
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
        background: #5fae6f;
        box-shadow: 0 0 8px #5fae6f;
        animation: adjnPulse 2s infinite;
      }
      #nullsanz-method-pill .nullsanz-spec {
        display: block;
        margin-top: 4px;
        font: 600 10px/1.25 -apple-system, sans-serif;
        color: #a8d5b2;
        letter-spacing: 0.3px;
      }
      @keyframes adjnPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.25); opacity: 0.65; }
      }
      #nullsanz-toast {
        position: fixed;
        z-index: 2147483647;
        top: 90px;
        left: 50%;
        transform: translateX(-50%);
        max-width: min(420px, calc(100vw - 24px));
        display: none;
        background: #181d19;
        color: #e5f7ea;
        border: 1px solid #5fae6f;
        border-radius: 12px;
        padding: 10px 16px;
        font: 600 12px/1.45 -apple-system, sans-serif;
        box-shadow: 0 14px 34px rgba(0,0,0,0.3);
        word-break: break-word;
        text-align: center;
      }
      #nullsanz-toast {
        position: fixed;
        z-index: 2147483647;
        top: 86px;
        left: 50%;
        transform: translateX(-50%);
        max-width: min(420px, calc(100vw - 24px));
        display: none;
        background: #181d19;
        color: #e5f7ea;
        border: 1px solid #5fae6f;
        border-radius: 12px;
        padding: 10px 16px;
        font: 600 12px/1.45 -apple-system, sans-serif;
        box-shadow: 0 14px 34px rgba(0,0,0,0.3);
        word-break: break-word;
        text-align: center;
      }
      #nullsanz-toast.show { display: block; }
      #nullsanz-toast.err { background: #241416; border-color: #e05d5d; color: #fce8e8; }
      
      /* ================= PASSWORD ACCESS MODAL ================= */
      #nullsanz-access-modal {
        position: fixed; inset: 0; z-index: 2147483647;
        display: none; align-items: center; justify-content: center;
        padding: 20px; background: rgba(32, 29, 24, 0.42);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      #nullsanz-access-modal.show { display: flex; }
      #nullsanz-access-card {
        width: min(430px, 100%); background: #fdfaf3; color: #28251f;
        border: 1px solid #e5ded0; border-radius: 22px; padding: 26px;
        box-shadow: 0 28px 80px rgba(55,48,37,.24); text-align: center;
      }
      .nullsanz-access-icon {
        width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 14px;
        display:flex; align-items:center; justify-content:center;
        background:#eee7d8; color:#4b463d; border:1px solid #ddd3c1;
      }
      .nullsanz-access-title { font: 800 19px/1.2 -apple-system, sans-serif; margin-bottom:5px; }
      .nullsanz-access-sub { font: 500 12px/1.5 -apple-system, sans-serif; color:#7b7468; margin-bottom:18px; }
      .nullsanz-access-status {
        display:inline-flex; gap:6px; align-items:center; padding:6px 10px; border-radius:999px;
        background:#f1ece2; border:1px solid #e2d9ca; color:#756c5d;
        font:700 9px/1 -apple-system, sans-serif; letter-spacing:.7px; text-transform:uppercase; margin-bottom:15px;
      }
      .nullsanz-access-status i { width:7px; height:7px; border-radius:50%; background:#b06b5d; display:block; }
      .nullsanz-access-input {
        width:100%; box-sizing:border-box; border:1px solid #d8cfbf; background:#fffdf8;
        color:#29261f; border-radius:12px; padding:12px 13px; outline:none;
        font:700 13px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing:.5px; padding-right:42px;
        transition:.2s ease;
      }
      .nullsanz-access-input:focus { border-color:#8c806c; box-shadow:0 0 0 3px rgba(140,128,108,.12); }
      .nullsanz-access-input.shake { animation: adjnShake .35s ease; }
      .nullsanz-access-btn {
        width:100%; margin-top:10px; border:1px solid #2f2b24; background:#302d27; color:#fffaf0;
        border-radius:12px; padding:12px 14px; cursor:pointer; font:800 12px/1 -apple-system,sans-serif;
        transition:.2s ease; box-shadow:0 7px 18px rgba(48,45,39,.18);
      }
      .nullsanz-access-btn:hover { transform:translateY(-1px); background:#403b33; }
      .nullsanz-access-error { display:none; color:#a33e34; font:600 10.5px/1.4 -apple-system,sans-serif; margin-top:9px; }
      .nullsanz-access-error.show { display:block; }
      .nullsanz-public-option {
        margin-top:12px; padding:10px 12px; border:1px solid #e5ded0; background:#f6f0e5;
        border-radius:12px; display:flex; align-items:center; justify-content:space-between; gap:12px;
        text-align:left; cursor:pointer;
      }
      .nullsanz-public-meta { min-width:0; }
      .nullsanz-public-title { display:block; color:#302c25; font:800 11px/1.2 -apple-system,sans-serif; }
      .nullsanz-public-sub { display:block; margin-top:3px; color:#8b8172; font:600 9.5px/1.3 -apple-system,sans-serif; }
      .nullsanz-public-switch { position:relative; width:40px; height:22px; flex:0 0 auto; }
      .nullsanz-public-switch input { opacity:0; width:0; height:0; position:absolute; }
      .nullsanz-public-slider { position:absolute; inset:0; border-radius:999px; background:#d8cfbf; transition:.2s ease; }
      .nullsanz-public-slider:before { content:''; position:absolute; width:16px; height:16px; left:3px; top:3px; border-radius:50%; background:#fffdf8; box-shadow:0 1px 4px rgba(0,0,0,.18); transition:.2s ease; }
      .nullsanz-public-switch input:checked + .nullsanz-public-slider { background:#7c9a78; }
      .nullsanz-public-switch input:checked + .nullsanz-public-slider:before { transform:translateX(18px); }
      .nullsanz-access-note { margin-top:14px; color:#9a9285; font:500 10px/1.45 -apple-system,sans-serif; }
      .nullsanz-engine-buttons { display:flex; gap:6px; margin-top:10px; }
      .nullsanz-engine-btn { flex:1; border:1px solid #d8cdbb; background:#f7f1e6; color:#5f574b; border-radius:9px; padding:8px 6px; font:700 10px/1 -apple-system,sans-serif; cursor:pointer; }
      .nullsanz-engine-btn.active { background:#dcecdf; border-color:#78b486; color:#3f7a4d; box-shadow:inset 0 0 0 1px #78b486; }
      @keyframes adjnShake { 25%{transform:translateX(-5px)} 50%{transform:translateX(5px)} 75%{transform:translateX(-3px)} }

      /* Cream upload surface — fills the TikTok upload container */
      /* Upload Zone Custom Decoration */
      .nullsanz-upload-zone {
        position: relative !important;
        overflow: hidden !important;
        border: 2px solid #e4dccd !important;
        background: #f7f2e8 !important;
        width: 100% !important;
        min-height: 380px !important;
        box-sizing: border-box !important;
        border-radius: 18px !important;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.55), 0 12px 36px rgba(60,52,40,0.06) !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      /* Hide native TikTok upload elements inside the container so no dashed lines or ghost text bleed */
      /* NOTE: Use clip-path instead of display:none to avoid breaking React component initialization */
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
        border-color: #a79a84 !important;
        box-shadow: 0 0 0 3px rgba(167,154,132,.12), inset 0 0 0 1px rgba(255,255,255,.65) !important;
        transform: scale(1.006);
      }
      .nullsanz-zone-overlay {
        position: absolute;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 380px;
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
      .nullsanz-zone-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 30%;
        filter: brightness(0.65) contrast(1.15);
        pointer-events: none;
        transition: transform 0.6s ease;
        opacity: 0;
      }
      .nullsanz-zone-overlay:hover .nullsanz-zone-bg {
        transform: scale(1.03);
      }
      .nullsanz-zone-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, #fdfaf3, #f4ede0);
        pointer-events: none;
      }
      
      /* Cyber Corner Reticles */
      .nullsanz-bracket {
        position: absolute;
        width: 22px;
        height: 22px;
        border-color: #b2a58f;
        border-style: solid;
        z-index: 12;
        box-shadow: 0 0 8px rgba(139,126,103,.25);
        pointer-events: none;
      }
      .nullsanz-bracket-tl { top: 14px; left: 14px; border-width: 2.5px 0 0 2.5px; border-top-left-radius: 6px; }
      .nullsanz-bracket-tr { top: 14px; right: 14px; border-width: 2.5px 2.5px 0 0; border-top-right-radius: 6px; }
      .nullsanz-bracket-bl { bottom: 14px; left: 14px; border-width: 0 0 2.5px 2.5px; border-bottom-left-radius: 6px; }
      .nullsanz-bracket-br { bottom: 14px; right: 14px; border-width: 0 2.5px 2.5px 0; border-bottom-right-radius: 6px; }

      /* Floating Glass Center Card */
      .nullsanz-zone-card {
        position: relative;
        z-index: 14;
        width: min(440px, calc(100% - 40px));
        background: rgba(253, 250, 243, 0.97);
        backdrop-filter: blur(18px) saturate(140%);
        -webkit-backdrop-filter: blur(18px) saturate(140%);
        border: 1px solid #ddd3c1;
        border-radius: 20px;
        padding: 22px 26px 18px;
        text-align: center;
        box-shadow: 0 20px 50px rgba(72,63,49,.12), 0 0 25px rgba(150,137,113,.08);
        transition: all 0.25s ease;
      }
      .nullsanz-zone-card:hover {
        border-color: #b2a58f;
        transform: translateY(-2px);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 0 35px rgba(84, 190, 104, 0.25);
      }
      .nullsanz-card-logo-img {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        display: block;
        margin: 0 auto 10px;
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
        letter-spacing: 0.6px;
        text-transform: uppercase;
        background: #eee7d8;
        border: 1px solid #ddd3c1;
        color: #625b4e;
        padding: 3px 8px;
        border-radius: 20px;
        margin-bottom: 12px;
      }
      .nullsanz-card-prompt {
        font: 500 12.5px/1.4 -apple-system, sans-serif;
        color: #756e62;
        margin-bottom: 14px;
      }
      .nullsanz-card-btn {
        border: none;
        background: #302d27;
        color: #ffffff;
        font: 700 13px/1 -apple-system, sans-serif;
        padding: 10px 22px;
        border-radius: 12px;
        cursor: pointer;
        box-shadow: 0 4px 18px rgba(48,45,39,.18);
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 7px;
      }
      .nullsanz-card-btn:hover {
        filter: brightness(1.1);
        transform: scale(1.03);
      }
      .nullsanz-card-specs {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 14px;
        font: 600 10.5px/1 -apple-system, sans-serif;
        color: #8d8577;
      }
      .nullsanz-card-specs span:not(:last-child)::after {
        content: "•";
        margin-left: 8px;
        opacity: 0.6;
      }

      /* In-Card Circular Progress Ring (Matching Screenshot 2) */
      .nullsanz-ring-container {
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 10px 0;
      }
      .nullsanz-zone-card.is-processing .nullsanz-idle-content {
        display: none;
      }
      .nullsanz-zone-card.is-processing .nullsanz-ring-container {
        display: flex;
      }
      .nullsanz-ring-wrap {
        position: relative;
        width: 86px;
        height: 86px;
        margin: 0 auto 14px;
      }
      .nullsanz-ring-svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }
      .nullsanz-ring-circle-bg {
        fill: none;
        stroke: rgba(255, 255, 255, 0.1);
        stroke-width: 6;
      }
      .nullsanz-ring-circle-bar {
        fill: none;
        stroke: #8f856f;
        stroke-width: 6;
        stroke-linecap: round;
        stroke-dasharray: 264;
        stroke-dashoffset: 264;
        transition: stroke-dashoffset 0.2s ease;
        filter: drop-shadow(0 0 5px rgba(143,133,111,.35));
      }
      .nullsanz-ring-percentage {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font: 800 19px/1 -apple-system, sans-serif;
        color: #ffffff;
        letter-spacing: -0.5px;
      }
      .nullsanz-ring-title {
        font: 800 14px/1.3 -apple-system, sans-serif;
        color: #ffffff;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .nullsanz-ring-detail {
        font: 500 11.5px/1.4 -apple-system, sans-serif;
        color: #a49e92;
      }

      /* Fallback Overlay */
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
        font: 800 22px/1 -apple-system, sans-serif;
        color: #54be68;
        margin-bottom: 16px;
        letter-spacing: -0.2px;
      }
      #nullsanz-process-title {
        font: 700 16px/1.25 -apple-system, sans-serif;
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
    pill.innerHTML = `
      <span class="nullsanz-line1">
        <span class="nullsanz-dot"></span>
        <span>✦ ✦ Nullsanz Studio v3.0 ✦ ✦ — AKTIF</span>
      </span>
      <span class="nullsanz-spec">Auto-Patch 4K 120FPS • Sound Safe by F R Y 60fps</span>
    `;
    pill.title = 'Nullsanz TikTok Studio v3.0 | Auto-Patch & Sound Safe Active';
    pill.addEventListener('click', () => {
      if (busy) return;
      if (!uploaderEnabled) {
        showToast('Nullsanz Studio sedang Nonaktif. Aktifkan lewat popup ekstensi.', 'err');
        return;
      }
      if (!requireAccess()) return;
      const input = findTikTokVideoInput();
      if (!input) return showToast('Input upload TikTok belum muncul. Buka TikTok Studio > Upload.', 'err');
      input.click();
    });
    document.documentElement.appendChild(pill);
    refreshPillUI();

    accessModal = document.createElement('div');
    accessModal.id = 'nullsanz-access-modal';
    accessModal.innerHTML = `
      <div id="nullsanz-access-card" role="dialog" aria-modal="true" aria-labelledby="nullsanz-access-title">
        <div class="nullsanz-access-icon">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <div class="nullsanz-access-title" id="nullsanz-access-title">Nullsanz Studio • Engine Selector</div>
        <div class="nullsanz-access-sub">Pilih engine kalibrasi video sebelum upload (Maks. 2 GB).</div>
        <div class="nullsanz-access-status" style="color:#2e7d32;"><i></i> AUTO-PATCH UNLOCKED • UNLIMITED</div>
        <input id="nullsanz-access-input" class="nullsanz-access-input" type="password" autocomplete="off" spellcheck="false" placeholder="Masukkan password…">
        <button id="nullsanz-access-btn" class="nullsanz-access-btn" type="button">UNLOCK AUTO-PATCH</button>
        <div id="nullsanz-access-error" class="nullsanz-access-error"></div>
        <div class="nullsanz-public-option" id="nullsanz-engine-selector">
          <span class="nullsanz-public-meta">
            <span class="nullsanz-public-title">Nullsanz Engine</span>
            <span class="nullsanz-public-sub">Pilih engine sebelum Auto-Patch (Default 3.0 Dolby Vision &amp; HEVC)</span>
          </span>
          <div class="nullsanz-engine-buttons">
            <button type="button" data-engine="2.1.5" class="nullsanz-engine-btn active">2.1.5</button>
            <button type="button" data-engine="2.3" class="nullsanz-engine-btn">2.3</button>
            <button type="button" data-engine="3.0" class="nullsanz-engine-btn">3.0</button>
          </div>
        </div>
        <div class="nullsanz-access-note">Akses Full Unlimited • Engine dapat diganti kapan saja sebelum memilih video.</div>
      </div>`;
    document.documentElement.appendChild(accessModal);
    accessInput = accessModal.querySelector('#nullsanz-access-input');
    accessError = accessModal.querySelector('#nullsanz-access-error');
    const accessButton = accessModal.querySelector('#nullsanz-access-btn');
    if (accessButton) accessButton.addEventListener('click', unlockAccess);
    if (accessInput) accessInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); unlockAccess(); }
    });
    if (accessInput) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;width:100%;margin:0;';
      accessInput.parentNode.insertBefore(wrap, accessInput);
      wrap.appendChild(accessInput);
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.setAttribute('aria-label', 'Lihat password');
      preview.setAttribute('title', 'Lihat password');
      preview.textContent = '👁';
      preview.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#756c5d;cursor:pointer;font-size:15px;line-height:1;padding:3px 4px;';
      preview.addEventListener('click', () => {
        const visible = accessInput.type === 'text';
        accessInput.type = visible ? 'password' : 'text';
        preview.textContent = visible ? '👁' : '🙈';
        preview.setAttribute('aria-label', visible ? 'Lihat password' : 'Sembunyikan password');
        preview.setAttribute('title', visible ? 'Lihat password' : 'Sembunyikan password');
        accessInput.focus();
      });
      wrap.appendChild(preview);
    }
    accessModal.querySelectorAll('[data-engine]').forEach(btn => btn.addEventListener('click', () => {
      selectedEngine = btn.dataset.engine || '2.1.5';
      accessModal.querySelectorAll('[data-engine]').forEach(b => b.classList.toggle('active', b === btn));
      try { chrome.storage.local.set({ nullsanzEngine: selectedEngine }); } catch (_) {}
      showToast(`✓ Engine Nullsanz ${selectedEngine} dipilih.`, 'ok');
    }));
    accessModal.addEventListener('click', e => { if (e.target === accessModal && !accessUnlocked) showAccessModal(); });

    toast = document.createElement('div');
    toast.id = 'nullsanz-toast';
    document.documentElement.appendChild(toast);

    overlay = document.createElement('div');
    overlay.id = 'nullsanz-process-overlay';
    overlay.innerHTML = `
      <div id="nullsanz-process-card">
        <img src="${chrome.runtime.getURL('icon128.png')}" alt="Logo" style="width:56px;height:56px;border-radius:14px;margin:0 auto 12px;display:block;box-shadow:0 6px 18px rgba(0,0,0,0.18);">
        <div id="nullsanz-process-logo">Nullsanz Video Studio v3.0</div>
        <div id="nullsanz-process-title">Membaca video…</div>
        <div id="nullsanz-process-detail">TikTok ditahan sampai proses kalibrasi selesai.</div>
        <div id="nullsanz-process-track"><div id="nullsanz-process-bar"></div></div>
        <div id="nullsanz-process-note">Nullsanz Ultra HD Studio • Local container processing (No upload to external servers)</div>
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

    // Regularly ensure upload zone is decorated on TikTok Studio
    try { chrome.storage.local.get(['nullsanzEngine'], r => { if (r?.nullsanzEngine && ['2.1.5','2.3','3.0'].includes(r.nullsanzEngine)) { selectedEngine = r.nullsanzEngine; accessModal?.querySelectorAll('[data-engine]').forEach(b => b.classList.toggle('active', b.dataset.engine === selectedEngine)); } }); } catch (_) {}
    const restored = restoreAccessSession();
    updateAccessPill();
    decorateUploadZone();
    updateUploadZoneAccess();
    if (!restored) setTimeout(showAccessModal, 180);
    setInterval(decorateUploadZone, 750);
  }

  function updateUploadZoneAccess() {
    const zone = document.querySelector('.nullsanz-upload-zone');
    const card = document.querySelector('#nullsanzZoneCard');
    if (!zone || !card) return;
    zone.classList.toggle('nullsanz-zone-locked', !accessUnlocked);
    card.classList.toggle('nullsanz-zone-locked', !accessUnlocked);
    const prompt = card.querySelector('#nullsanzCardPrompt');
    const btn = card.querySelector('.nullsanz-card-btn');
    const tag = card.querySelector('.nullsanz-card-tag');
    if (!accessUnlocked) {
      if (prompt) prompt.textContent = 'Masukkan password untuk membuka akses upload';
      if (btn) { btn.textContent = '🔒 Unlock Auto-Patch'; }
      if (tag) tag.textContent = '✦ ACCESS LOCKED • PASSWORD REQUIRED ✦';
    } else if (activeAccess) {
      if (prompt) prompt.textContent = `Tarik & letakkan video di sini atau klik untuk kalibrasi • ${activeAccess.name}`;
      if (btn) btn.textContent = 'Pilih Video (Auto-Patch)';
      if (tag) tag.textContent = `✦ 8K/4K • ENGINE ${selectedEngine} • ULTRA HD ACTIVE ✦`;
    }
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
    if (existing && document.body.contains(existing)) {
      return existing;
    }

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
    if (!uploaderEnabled) return;

    // Do not decorate if user is already on caption/publish page
    if (document.querySelector('input[placeholder*="caption" i], textarea, [class*="caption" i], [class*="publish" i], [class*="post-btn" i]')) {
      const ov = document.querySelector('.nullsanz-zone-overlay');
      if (ov) ov.remove();
      return;
    }

    if (window.__nullsanzUploadActive && !findTikTokVideoInput()) return;
    window.__nullsanzUploadActive = false;

    // Stable anchor: if overlay is already active in DOM, do NOT tear it down or shift it!
    const existingOverlay = document.querySelector('.nullsanz-zone-overlay');
    if (existingOverlay && document.body.contains(existingOverlay)) {
      return;
    }

    const input = findTikTokVideoInput();
    const btn = Array.from(document.querySelectorAll('button')).find(el => 
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
      <img class="nullsanz-zone-bg" src="${chrome.runtime.getURL('nullsanz-upload-banner.jpg')}" alt="Nullsanz Banner">
      <div class="nullsanz-zone-gradient"></div>
      
      <!-- Cyber Corner Brackets -->
      <div class="nullsanz-bracket nullsanz-bracket-tl"></div>
      <div class="nullsanz-bracket nullsanz-bracket-tr"></div>
      <div class="nullsanz-bracket nullsanz-bracket-bl"></div>
      <div class="nullsanz-bracket nullsanz-bracket-br"></div>

      <!-- Floating Glass Center Card -->
      <div class="nullsanz-zone-card" id="nullsanzZoneCard">
        <!-- Idle Content -->
        <div class="nullsanz-idle-content">
          <img src="${chrome.runtime.getURL('icon48.png')}" class="nullsanz-card-logo-img" alt="Nullsanz Logo">
          <div class="nullsanz-card-title">Nullsanz TikTok Studio v3.0</div>
          <div class="nullsanz-card-tag">✦ 8K 60FPS • 4K 120FPS • ULTRA HD MULTI-ENGINE ACTIVE ✦</div>
          <div class="nullsanz-card-prompt" id="nullsanzCardPrompt">Tarik &amp; letakkan video di sini atau klik untuk kalibrasi Nullsanz</div>
          <button type="button" class="nullsanz-card-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>Pilih Video (Auto-Patch)</span>
          </button>
          <div class="nullsanz-card-specs">
            <span>MP4 / MOV</span>
            <span>H.264 / HEVC</span>
            <span>100% Lokal FastStart</span>
          </div>
        </div>

        <!-- Processing Progress Ring (Active during calibration) -->
        <div class="nullsanz-ring-container">
          <div class="nullsanz-ring-wrap">
            <svg class="nullsanz-ring-svg" viewBox="0 0 100 100">
              <circle class="nullsanz-ring-circle-bg" cx="50" cy="50" r="42"></circle>
              <circle class="nullsanz-ring-circle-bar" id="nullsanzRingBar" cx="50" cy="50" r="42"></circle>
            </svg>
            <div class="nullsanz-ring-percentage" id="nullsanzRingPct">0%</div>
          </div>
          <div class="nullsanz-ring-title" id="nullsanzRingTitle">MEMBACA VIDEO...</div>
          <div class="nullsanz-ring-detail" id="nullsanzRingDetail">TikTok ditahan sampai kalibrasi selesai.</div>
        </div>
      </div>
    `;

    // Click handler to open file picker
    overlayEl.addEventListener('click', (e) => {
      if (busy) return;
      if (!requireAccess()) return;
      const inp = findTikTokVideoInput();
      if (inp) inp.click();
    });

    // Drag-over styling
    overlayEl.addEventListener('dragenter', () => {
      zone.classList.add('nullsanz-drag-over');
      const prompt = overlayEl.querySelector('#nullsanzCardPrompt');
      if (prompt) prompt.textContent = 'Lepaskan video untuk mulai kalibrasi otomatis!';
    });
    overlayEl.addEventListener('dragleave', (e) => {
      if (!overlayEl.contains(e.relatedTarget)) {
        zone.classList.remove('nullsanz-drag-over');
        const prompt = overlayEl.querySelector('#nullsanzCardPrompt');
        if (prompt) prompt.textContent = 'Tarik & letakkan video di sini atau klik untuk kalibrasi';
      }
    });
    overlayEl.addEventListener('drop', () => {
      zone.classList.remove('nullsanz-drag-over');
    });

    zone.appendChild(overlayEl);
    updateUploadZoneAccess();
  }

  function showToast(message, mode = '') {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `show ${mode}`.trim();
    toastTimer = setTimeout(() => {
      toast.className = '';
    }, 4500);
  }

  function setStage(title, pct, detail = '') {
    const p = Math.max(0, Math.min(100, pct));
    
    // Update circular progress ring in upload zone card
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
      const circum = 2 * Math.PI * 42; // 263.89
      const offset = circum - (p / 100) * circum;
      ringBar.style.strokeDashoffset = String(offset);
    }

    // Also update modal overlay as backup
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
    if (pill) {
      if (busy) pill.style.opacity = '0.6';
      else pill.style.opacity = '1';
    }
  }

  async function waitProcessor(timeout = 12000) {
    const start = Date.now();
    while (!processorReady) {
      if (Date.now() - start > timeout) throw new Error('Processor belum siap. Muat ulang TikTok lalu coba lagi.');
      await new Promise(r => setTimeout(r, 50));
    }
  }

  async function processSelection(input, file) {
    if (busy || !file || !isVideoFile(file)) return;
    if (!requireAccess()) return;
    if (file.size > MAX_FILE_BYTES) {
      return showToast(`Video ${fmtBytes(file.size)} melewati limit 500 MB untuk Nullsanz Studio.`, 'err');
    }
    if (!isSupportedContainer(file)) {
      return showToast('File ini tidak terdeteksi sebagai video yang valid.', 'err');
    }

    setBusy(true);
    input.dataset.nullsanzProcessing = '1';
    setStage('Membaca video…', 10, `${file.name} • ${fmtBytes(file.size)}`);

    try {
      // Read arrayBuffer directly from file object (vital: do NOT clear input.value before or after!)
      const buffer = await file.arrayBuffer();

      // Fast-path: Inline processor (direct execution without iframe or timeout)
      if (globalThis.NullsanzVideoProcessor?.processVideoDirect) {
        const requestId = `nullsanz-${Date.now()}-${++requestSeq}`;
        const result = await globalThis.NullsanzVideoProcessor.processVideoDirect({
          requestId,
          buffer,
          fileName: file.name || 'video.mp4',
          fileType: file.type || '',
          fileSize: file.size || buffer.byteLength,
          engine: selectedEngine
        }, (label, progress, detail) => {
          setStage(label, progress, detail);
        });

        const safeOriginalName = (file.name || 'video.mp4').replace(/[\\/:*?"<>|]+/g, '_');
        const base = safeOriginalName.replace(/\.[^.]+$/, '');
        const finalName = result.passthrough
          ? (result.outputName || safeOriginalName)
          : `${base}_NullsanzStudio.mp4`;
        const finalType = result.passthrough
          ? (result.outputMime || file.type || 'application/octet-stream')
          : (result.outputMime || 'video/mp4');
        const outputBuf = (result.output instanceof Uint8Array)
          ? result.output.buffer.slice(result.output.byteOffset, result.output.byteOffset + result.output.byteLength)
          : result.output;

        let targetInput = input.isConnected !== false ? input : findActiveFileInput();
        if (!targetInput) throw new Error('Elemen upload TikTok tidak ditemukan.');

        // iOS WebKit crashes if we wrap the original file in a `new File(...)` constructor,
        // because it loses the OS-level file descriptor pointers needed by AVFoundation to stream.
        // The ultimate workaround: Use the EXACT original File object, and forcefully 
        // redefine its read-only 'name' property via Object.defineProperty to trick the UI.
        let patched;
        if (result.passthrough && isIOS()) {
          patched = file;
          try { Object.defineProperty(patched, 'name', { value: finalName, writable: false }); } catch(e) {}
        } else {
          const blobParts = result.passthrough ? [file] : [outputBuf];
          patched = new File(blobParts, finalName, {
            type: finalType,
            lastModified: file.lastModified || Date.now()
          });
        }
        delete targetInput.dataset.nullsanzProcessing;
        if (targetInput !== input) delete input.dataset.nullsanzProcessing;

        setStage('Siap upload', 100, `${result.mode || 'processed'} • ${fmtBytes(result.inputBytes || file.size)} → ${fmtBytes(outputBuf.byteLength)}`);
        
        replayToTikTok(targetInput, patched, file);
        showToast(`✓ Nullsanz: Pre-upload selesai! Video Ultra HD & Sound Safe aktif.`, 'ok');
        
        hideStage(700);
        setTimeout(dismissUploadOverlay, 800);
        return;
      }

      // Fallback: If inline processor is not present, use iframe
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
        fileSize: file.size || buffer.byteLength
      }, '*', [buffer]);
    } catch (e) {
      delete input.dataset.nullsanzProcessing;
      pending = null;
      setBusy(false);
      hideStage(0);
      showToast(`Nullsanz Studio gagal: ${e?.message || e}`, 'err');
    } finally {
      if (!pending) {
        setBusy(false);
      }
    }
  }

  function replayToTikTok(inputEl, file, originalFile) {
    if (originalFile && file.name) {
      window.postMessage({
        source: 'NULLSANZ_CONTENT',
        type: 'STORE_ORIGINAL_FILE',
        patchedName: file.name,
        originalFile: originalFile
      }, '*');
    }

    let a = inputEl;
    const s = () => {
      if (a?.isConnected === false) a = findActiveFileInput();
      if (!a) return false;

      // Bypass React internal valueTracker
      try {
        const tracker = a._valueTracker;
        if (tracker) tracker.setValue('');
      } catch (_) {}

      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
        if (typeof nativeSetter === 'function') {
          nativeSetter.call(a, dt.files);
        } else {
          a.files = dt.files;
        }
      } catch (e) {
        console.warn('[Nullsanz] DataTransfer assign error:', e);
        try { a.files = dt.files; } catch (_) {}
      }

      a.dataset.nullsanzReady = '1';

      // Reliable event dispatching across Chrome, Edge, Brave, Kiwi, Lemur, and Orion
      a.dispatchEvent(new Event('input', { bubbles: true, composed: true, cancelable: true }));
      a.dispatchEvent(new Event('change', { bubbles: true, composed: true, cancelable: true }));
      return true;
    };

    if (!s() || !isIOS()) return;

    let l = 0;
    const i = () => {
      if (l >= 4 || a?.isConnected === false) return;
      l += 1;
      s();
      setTimeout(i, 500);
    };
    setTimeout(i, 500);
  }

  window.addEventListener('message', event => {
    const data = event.data;
    if (!data) return;

    if ((data.source === 'NULLSANZ_PAGE_HOOK' || data.source === 'Nullsanz_PAGE_HOOK')) {
      if (data.type === 'HOOK_READY') {
        pageHookReady = true;
        if (pill) pill.title = 'Nullsanz TikTok Studio v3.0 • page hook ready';
      } else if (data.type === 'PUBLISH_NORMALIZED') {
        publishSeen++;
        showToast('✓ Nullsanz: Publish request dinormalisasi! Video & Sound aman tanpa kompresi.', 'ok');
      }
      return;
    }

    if ((data.source !== 'NULLSANZ_PROCESSOR' && data.source !== 'FRY_PROCESSOR')) return;
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
        const finalName = data.passthrough
          ? (data.outputName || safeOriginalName)
          : `${base}_NullsanzStudio.mp4`;
        const finalType = data.passthrough
          ? (data.outputMime || originalFile.type || 'application/octet-stream')
          : (data.outputMime || 'video/mp4');
        const patched = new File([data.buffer], finalName, { type: finalType, lastModified: originalFile.lastModified || Date.now() });
        if (!data.passthrough && patched.size < originalFile.size) {
          throw new Error(`SIZE GUARD: output ${fmtBytes(patched.size)} lebih kecil dari source ${fmtBytes(originalFile.size)}.`);
        }
        setStage('Siap upload', 100, `${data.mode || 'processed'} • ${fmtBytes(data.inputBytes)} → ${fmtBytes(data.outputBytes)}`);
        let targetInput = input.isConnected !== false ? input : findActiveFileInput();
        if (targetInput) {
          delete targetInput.dataset.nullsanzProcessing;
          if (targetInput !== input) delete input.dataset.nullsanzProcessing;
          replayToTikTok(targetInput, patched, originalFile);
        }
        showToast(`✓ Nullsanz: Pre-upload selesai! Video Ultra HD & Sound Safe aktif.`, 'ok');
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
