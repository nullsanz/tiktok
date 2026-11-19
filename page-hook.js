(() => {
  'use strict';
  if (window.__NULLSANZ_METHOD_PAGE_HOOK__) return;
  window.__NULLSANZ_METHOD_PAGE_HOOK__ = true;

  console.info('[Nullsanz TikTok Studio v4.0 Pro] SoundSafe, CoverSafe, Canvas Bypass & Anti-Softban Engine Activated.');

  // ================= CONFIGURATION =================
  // Nullsanz Edition: 100% Zero Watermark, Zero Forced Mentions, Anti-Softban Safe
  let soundSafeEnabled = true;

  // Regexes for cleaning any leftover third-party signatures
  const sigRegex = /(?:\s*✦?\s*(?:(?:Method|Patcher|Ekstension)\s*)?by\s*[A-Za-z0-9._\s]+\s*60fps\s*✦?(?:\s*(?:<m[^>]*>)?\s*@[A-Za-z0-9._]+\s*(?:<\/m>)?)+)/gi;
  const prefixRegex = /(?:\s*✦?\s*(?:(?:Method|Patcher|Ekstension)\s*)?by\s*[A-Za-z0-9._\s]+\s*60fps\s*✦?\s*)/gi;

  // CoverSafe field matcher (protects cover/thumbnail/poster fields from accidental mutation)
  const COVER_FIELD_RE = /(?:^|_)(?:cover|thumbnail|poster)(?:_|$)/i;

  // WeakSet for payload deduplication
  const processedWeakSet = new WeakSet();

  // Map to store original files for safe preview (iOS AVPlayer crash prevention)
  const originalFilesMap = new Map();

  // Capture native JSON.stringify early so internal cloning never recurses
  const nativeStringify = JSON.stringify;

  // ================= SETTINGS SYNC =================
  function isSoundSafeActive() {
    try {
      const ds = document.documentElement?.dataset?.nullsanzSoundSafe;
      if (ds === '0') return false;
      if (ds === '1') return true;
    } catch (_) {}
    return soundSafeEnabled;
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (
      (data.source === 'NULLSANZ_METHOD' || data.source === 'Nullsanz_METHOD') &&
      (data.type === 'NULLSANZ_SETTINGS' || data.type === 'Nullsanz_SETTINGS') &&
      data.settings
    ) {
      if (data.settings.soundSafeEnabled !== undefined) {
        soundSafeEnabled = !!data.settings.soundSafeEnabled;
      }
    }
    if (data.source === 'NULLSANZ_CONTENT' && data.type === 'STORE_ORIGINAL_FILE') {
      originalFilesMap.set(data.patchedName, data.originalFile);
      console.info('[Nullsanz v4.0] Stored original file for safe preview:', data.patchedName);
    }
  });

  // ================= 0. HOOK URL.createObjectURL (Preview Fix) =================
  const nativeCreateObjectURL = URL.createObjectURL;
  if (typeof nativeCreateObjectURL === 'function') {
    URL.createObjectURL = function (obj) {
      if (typeof File !== 'undefined' && obj instanceof File && originalFilesMap.has(obj.name)) {
        console.info('[Nullsanz v4.0] Bypassing video preview for smooth playback. Serving original file.');
        return nativeCreateObjectURL.call(this, originalFilesMap.get(obj.name));
      }
      return nativeCreateObjectURL.apply(this, arguments);
    };
  }

  // ================= STRING HELPERS =================
  function stripTags(str) {
    return String(str || '').replace(/<\/?[hm][^>]*>/g, '');
  }

  function cleanSignature(str, isMarkup) {
    const zeroWidthSpaces = String.fromCharCode(8203, 8204, 8205);
    const base = isMarkup ? String(str || '') : stripTags(str);
    return base
      .replace(/&amp;/g, '&')
      .split(zeroWidthSpaces).join('')
      .replace(sigRegex, '')
      .replace(prefixRegex, '')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }

  // ================= PAYLOAD RECOGNITION =================
  function isPublishUrl(url) {
    if (typeof url !== 'string') return false;
    if (url.includes('tiktok/web/project/post/v1/')) return true;
    if (url.includes('/music/') || url.includes('/sound/') || url.includes('music_id')) return false;
    return /(?:\/project\/post|\/publish\/|\/aweme\/v1\/create|\/item\/create|\/project\/create)/i.test(url);
  }

  function isPublishPayload(obj) {
    return !!(obj && typeof obj === 'object' && (
      Array.isArray(obj.single_post_req_list) ||
      Array.isArray(obj.post_items) ||
      Array.isArray(obj.item_list) ||
      obj.post_common_info ||
      obj.item_common_info ||
      obj.publish_info ||
      obj.item_info
    ));
  }

  function hasMusic(payload) {
    try {
      const list = Array.isArray(payload?.single_post_req_list) ? payload.single_post_req_list : [];
      return list.some((req) => {
        const music = req?.single_post_feature_info?.music_info;
        return !!(music?.music_id_string || music?.id);
      });
    } catch (_) {
      return false;
    }
  }

  // ================= COVERSAFE SNAPSHOT / RESTORE =================
  function cloneJsonSafe(val) {
    if (val === null || val === undefined || typeof val !== 'object') return val;
    try {
      return JSON.parse(nativeStringify(val));
    } catch (_) {
      return val;
    }
  }

  function snapshotCoverFields(payload) {
    const snapshot = [];
    const seen = new WeakSet();
    const walk = (node) => {
      if (!node || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (COVER_FIELD_RE.test(key)) {
          snapshot.push({ owner: node, key, value: cloneJsonSafe(value) });
          continue;
        }
        if (value && typeof value === 'object') walk(value);
      }
    };
    walk(payload);
    return snapshot;
  }

  function restoreCoverFields(snapshot) {
    let restored = false;
    for (const item of snapshot) {
      const next = cloneJsonSafe(item.value);
      try {
        if (nativeStringify(item.owner[item.key]) !== nativeStringify(next)) {
          item.owner[item.key] = next;
          restored = true;
        }
      } catch (_) {
        item.owner[item.key] = next;
        restored = true;
      }
    }
    return restored;
  }

  // ================= PAYLOAD NORMALIZATION (SOUNDSAFE + ANTI-SOFTBAN) =================
  function stripCanvasConfigs(obj, seen = new WeakSet()) {
    if (!obj || typeof obj !== 'object' || seen.has(obj)) return false;
    seen.add(obj);
    let changed = false;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (stripCanvasConfigs(item, seen)) changed = true;
      }
      return changed;
    }

    for (const key of ['draft', 'canvas_config', 'vedit_segment_info', 'tiktok_snap_shot_lite_params']) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        delete obj[key];
        changed = true;
      }
    }
    if (obj.cloud_edit_is_use_video_canvas !== undefined && obj.cloud_edit_is_use_video_canvas !== false) {
      obj.cloud_edit_is_use_video_canvas = false;
      changed = true;
    }
    if (obj.is_canvas_video !== undefined && obj.is_canvas_video !== false) {
      obj.is_canvas_video = false;
      changed = true;
    }

    for (const key of Object.keys(obj)) {
      if (COVER_FIELD_RE.test(key)) continue;
      if (obj[key] && typeof obj[key] === 'object') {
        if (stripCanvasConfigs(obj[key], seen)) changed = true;
      }
    }
    return changed;
  }

  function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    let changed = false;
    const setIfDifferent = (obj, key, value) => {
      if (obj && obj[key] !== value) {
        obj[key] = value;
        changed = true;
      }
    };
    const musicPresent = hasMusic(payload);

    // 1. Recursively strip canvas/draft configs that trigger 30fps cloud fallback (skipping cover fields)
    if (stripCanvasConfigs(payload)) changed = true;

    // 2. Safe HD quality & SoundSafe preferences (Anti-Softban: NEVER force post_type=3, enter_post_page_from=1, or fake 144fps)
    setIfDifferent(payload, 'allow_upload_hd', 1);
    setIfDifferent(payload, 'is_high_quality', true);
    setIfDifferent(payload, 'high_quality_video', 1);
    setIfDifferent(payload, 'disable_auto_bitrate', true);
    setIfDifferent(payload, 'cloud_edit_is_use_video_canvas', false);
    setIfDifferent(payload, 'psg_vsp_aud', true);

    if (payload.post_common_info && typeof payload.post_common_info === 'object') {
      setIfDifferent(payload.post_common_info, 'allow_upload_hd', 1);
      setIfDifferent(payload.post_common_info, 'is_high_quality', 1);
      setIfDifferent(payload.post_common_info, 'psg_vsp_aud', true);
    }

    // 3. vedit_common_info normalization when music is attached (prevents audio mute/canvas wrap)
    if (musicPresent && Array.isArray(payload.feature_common_info_list)) {
      for (const item of payload.feature_common_info_list) {
        const vedit = item?.vedit_common_info;
        if (!vedit || typeof vedit !== 'object') continue;
        if (Object.prototype.hasOwnProperty.call(vedit, 'tiktok_snap_shot_lite_params')) {
          delete vedit.tiktok_snap_shot_lite_params;
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(vedit, 'application')) {
          setIfDifferent(vedit, 'application', 1);
        }
      }
    }

    // 4. Per-item feature normalization
    if (Array.isArray(payload.single_post_req_list)) {
      for (const req of payload.single_post_req_list) {
        if (!req || typeof req !== 'object') continue;
        setIfDifferent(req, 'psg_vsp_aud', true);
        setIfDifferent(req, 'allow_upload_hd', 1);
        const info = req.single_post_feature_info;
        if (!info || typeof info !== 'object') continue;

        setIfDifferent(info, 'cloud_edit_is_use_video_canvas', false);
        setIfDifferent(info, 'has_original_audio', 1);
        setIfDifferent(info, 'psg_vsp_aud', true);
        setIfDifferent(info, 'video_quality_score', 1.0);
        setIfDifferent(info, 'is_high_quality', true);
        setIfDifferent(info, 'is_high_quality_video', 1);
        setIfDifferent(info, 'upload_high_quality', true);
        setIfDifferent(info, 'disable_auto_bitrate', true);
        setIfDifferent(info, 'allow_upload_hd', 1);
        setIfDifferent(info, 'hd_post_enable', 1);

        if (info.music_info && typeof info.music_info === 'object') {
          if (!info.music_info.music_id_string && info.music_info.id) {
            info.music_info.music_id_string = String(info.music_info.id);
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  // ================= ZERO-WATERMARK CLEANUP =================
  function stripSignature(payload) {
    if (!payload || typeof payload !== 'object') return false;
    let changed = false;
    if (Array.isArray(payload.single_post_req_list)) {
      for (const req of payload.single_post_req_list) {
        const feat = req?.single_post_feature_info;
        if (!feat || typeof feat !== 'object') continue;
        for (const key of ['text', 'markup_text', 'caption', 'desc', 'description', 'title']) {
          if (typeof feat[key] === 'string' && feat[key]) {
            const next = key === 'markup_text' ? cleanSignature(feat[key], true) : cleanSignature(feat[key], false);
            if (next !== feat[key]) {
              feat[key] = next;
              changed = true;
            }
          }
          if (typeof req[key] === 'string' && req[key]) {
            const next = key === 'markup_text' ? cleanSignature(req[key], true) : cleanSignature(req[key], false);
            if (next !== req[key]) {
              req[key] = next;
              changed = true;
            }
          }
        }
      }
    }
    return changed;
  }

  function processPayload(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (!isPublishPayload(obj)) return false;
    if (processedWeakSet.has(obj)) return false;
    processedWeakSet.add(obj);

    // CoverSafe: Snapshot all cover/thumbnail/poster fields BEFORE any modification
    const coverSnapshot = snapshotCoverFields(obj);

    let changed = false;
    if (isSoundSafeActive()) {
      changed = normalizePayload(obj) || changed;
    }
    changed = stripSignature(obj) || changed;

    // CoverSafe: Guarantee cover/thumbnail/poster fields remain 100% intact
    if (restoreCoverFields(coverSnapshot)) changed = true;

    return changed;
  }

  function transformJsonString(jsonStr) {
    if (typeof jsonStr !== 'string' || !jsonStr) return jsonStr;
    try {
      const parsed = JSON.parse(jsonStr);
      const changed = processPayload(parsed);
      if (!changed) return jsonStr;
      return nativeStringify(parsed);
    } catch (_) {
      return jsonStr;
    }
  }

  function reportPublish(transport, url, changed) {
    try {
      window.postMessage({
        source: 'NULLSANZ_PAGE_HOOK',
        type: 'PUBLISH_NORMALIZED',
        transport,
        changed: !!changed,
        soundSafe: isSoundSafeActive(),
        coverSafe: true,
        url: String(url || '').slice(0, 240)
      }, '*');
    } catch (_) {}
  }

  // ================= 1. HOOK JSON.stringify =================
  JSON.stringify = function (value, replacer, space) {
    if (value && typeof value === 'object') {
      try {
        if (isSoundSafeActive() && (Object.prototype.hasOwnProperty.call(value, 'video_quality_score') || Object.prototype.hasOwnProperty.call(value, 'is_high_quality'))) {
          value.video_quality_score = 1.0;
          value.is_high_quality = true;
        }
        if (isPublishPayload(value)) {
          processPayload(value);
        }
      } catch (e) {
        console.warn('[Nullsanz v4.0] JSON.stringify processPayload error:', e);
      }
    }
    return nativeStringify.apply(this, arguments);
  };

  // ================= AB CONFIG (ANTI-SOFTBAN SAFE: PHOTO POSTING ONLY) =================
  const PHOTO_AB_URL = '/api/v1/web/project/get/ab/';
  function enablePhotoPosting(node) {
    if (Array.isArray(node)) {
      let changed = false;
      for (const item of node) changed = enablePhotoPosting(item) || changed;
      return changed;
    }
    if (!node || typeof node !== 'object') return false;
    let changed = false;
    if (node.second_key === 'web_crea_photo_posting' && node.ab_value !== '1') {
      node.ab_value = '1';
      changed = true;
    }
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (key === 'web_crea_photo_posting') {
        if (val && typeof val === 'object') {
          if ('ab_value' in val && val.ab_value !== '1') {
            val.ab_value = '1';
            changed = true;
          }
        } else if (typeof val === 'string' && val !== '1') {
          node[key] = '1';
          changed = true;
        }
      }
      if (val && typeof val === 'object') changed = enablePhotoPosting(val) || changed;
    }
    return changed;
  }

  function patchAbBody(text) {
    try {
      const json = JSON.parse(text);
      if (enablePhotoPosting(json)) return nativeStringify(json);
    } catch (_) {}
    return text;
  }

  // ================= 2. HOOK window.fetch =================
  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = async function (input, init = {}) {
      let nextInput = input;
      let nextInit = init;
      const url = typeof input === 'string' ? input : (input?.url || '');

      if (typeof url === 'string' && url.includes(PHOTO_AB_URL)) {
        const p = nativeFetch.call(this, nextInput, nextInit);
        return p.then((res) => {
          if (!res.ok) return res;
          return res.clone().text().then((text) => {
            const patched = patchAbBody(text);
            if (patched === text) return res;
            console.info('[Nullsanz v4.0] Photo posting feature enabled ✓');
            return new Response(patched, { status: res.status, statusText: res.statusText, headers: res.headers });
          }).catch(() => res);
        });
      }

      if (isPublishUrl(url)) {
        let changed = false;
        try {
          if (typeof nextInit?.body === 'string') {
            const transformed = transformJsonString(nextInit.body);
            if (transformed !== nextInit.body) {
              nextInit = { ...nextInit, body: transformed };
              changed = true;
            }
          } else if (typeof Request !== 'undefined' && input instanceof Request && !nextInit?.body) {
            const method = String(input.method || 'GET').toUpperCase();
            if (method !== 'GET' && method !== 'HEAD') {
              const text = await input.clone().text();
              const transformed = transformJsonString(text);
              if (transformed !== text) {
                nextInput = new Request(input, { body: transformed });
                changed = true;
              }
            }
          }
        } catch (_) {}
        reportPublish('fetch', url, changed);
      }
      return nativeFetch.call(this, nextInput, nextInit);
    };
  }

  // ================= 3. HOOK XMLHttpRequest =================
  const proto = window.XMLHttpRequest?.prototype;
  if (proto) {
    const nativeOpen = proto.open;
    const nativeSend = proto.send;

    proto.open = function (method, url) {
      this.__nullsanzUrl = url;
      if (typeof url === 'string' && url.includes(PHOTO_AB_URL)) {
        this.addEventListener('readystatechange', function () {
          if (this.readyState === 4 && this.status >= 200 && this.status < 300) {
            try {
              const desc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
              if (desc && desc.get) {
                const raw = desc.get.call(this);
                const patched = patchAbBody(raw);
                if (patched !== raw) {
                  Object.defineProperty(this, 'responseText', { configurable: true, get: () => patched });
                  Object.defineProperty(this, 'response', { configurable: true, get: () => patched });
                  console.info('[Nullsanz v4.0] Photo posting enabled (XHR) ✓');
                }
              }
            } catch (_) {}
          }
        });
      }
      return nativeOpen.apply(this, arguments);
    };

    proto.send = function (body) {
      let nextBody = body;
      const url = this.__nullsanzUrl || '';
      if (isPublishUrl(url)) {
        let changed = false;
        try {
          if (typeof body === 'string') {
            const transformed = transformJsonString(body);
            if (transformed !== body) {
              nextBody = transformed;
              changed = true;
            }
          }
        } catch (_) {}
        reportPublish('xhr', url, changed);
      }
      return nativeSend.call(this, nextBody);
    };
  }

  // Expose testable helpers on window.__NULLSANZ_HOOK_API__ (read-only internal diagnostics)
  try {
    Object.defineProperty(window, '__NULLSANZ_HOOK_API__', {
      configurable: true,
      enumerable: false,
      value: {
        version: '4.0.0',
        processPayload,
        transformJsonString,
        isSoundSafeActive
      }
    });
  } catch (_) {}

  window.postMessage({ source: 'NULLSANZ_PAGE_HOOK', type: 'HOOK_READY', version: '4.0.0' }, '*');
})();
