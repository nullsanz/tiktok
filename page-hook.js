(() => {
  'use strict';
  if (window.__ADJN_METHOD_PAGE_HOOK__) return;
  window.__ADJN_METHOD_PAGE_HOOK__ = true;

  console.info('[Nullsanz TikTok Studio v2.1.5] Sound Safe, Canvas Bypass & Anti-Compress Engine Activated.');

  // ================= CONFIGURATION =================
  const MENTION_USERS = [];
  const PREFIX = '';
  let resolved = true;
  let watermarkEnabled = false;

  function getMentionText(user) {
    return '@' + String(user?.handle || '').replace(/^@/, '');
  }

  function getFullSignature() {
    return PREFIX + MENTION_USERS.map(getMentionText).filter(Boolean).join(' ');
  }

  // Regexes for detecting and cleaning signatures
  const sigRegex = /(?:\s*✦?\s*(?:ADJN\s*)?Method\s*by\s*F\s*R\s*Y\s*60fps\s*✦?(?:\s*(?:<m[^>]*>)?\s*@[A-Za-z0-9._]+\s*(?:<\/m>)?)+)/gi;
  const prefixRegex = /(?:\s*✦?\s*(?:ADJN\s*)?Method\s*by\s*F\s*R\s*Y\s*60fps\s*✦?\s*)/gi;

  // WeakSets for payload deduplication
  const processedWeakSet = new WeakSet();

  // Map to store original files for safe preview (iOS crash prevention)
  const originalFilesMap = new Map();

  // ================= SETTINGS SYNC =================
  function isWatermarkActive() {
    return false;
  }

  window.addEventListener('message', event => {
    const data = event.data;
    if (!data) return;
    if (data.source === 'ADJN_METHOD' && data.type === 'ADJN_SETTINGS' && data.settings) {
      watermarkEnabled = false;
    }
    if (data.source === 'ADJN_CONTENT' && data.type === 'STORE_ORIGINAL_FILE') {
      originalFilesMap.set(data.patchedName, data.originalFile);
      console.info('[Nullsanz Inject] Stored original file for safe preview:', data.patchedName);
    }
  });

  // ================= 0. HOOK URL.createObjectURL (Preview Fix) =================
  const nativeCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function(obj) {
    if (obj instanceof File && originalFilesMap.has(obj.name)) {
      console.info('[Nullsanz Inject] Bypassing video preview to prevent iOS AVPlayer crash. Serving original file.');
      return nativeCreateObjectURL.call(this, originalFilesMap.get(obj.name));
    }
    return nativeCreateObjectURL.apply(this, arguments);
  };

  // ================= MENTION & UID RESOLUTION =================
  async function resolveMention() {
    return;
  }

  // Pre-resolve mention immediately
  try { resolveMention(); } catch (_) {}

  // ================= STRING & MARKUP HELPERS =================
  function stripTags(str) {
    return String(str || '').replace(/<\/?[hm][^>]*>/g, '');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
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

  function appendSignature(rawText) {
    const cleaned = cleanSignature(rawText, false);
    const fullSignature = getFullSignature();
    if (cleaned.endsWith(fullSignature)) return cleaned;
    return cleaned ? (cleaned + '\n\n' + fullSignature) : fullSignature;
  }

  function isOurMention(extra, fullText) {
    if (!extra || Number(extra.type) !== 0) return false;
    const textStr = String(fullText || '');
    const start = Number(extra.start);
    const end = Number(extra.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    const slice = textStr.slice(start, end).toLowerCase();
    const uidStr = String(extra.user_id || extra.userId || '');
    const hashName = String(extra.hashtag_name || '').replace(/^@/, '').toLowerCase();
    return MENTION_USERS.some(user => {
      const mention = getMentionText(user).toLowerCase();
      const uid = String(user?.uid || '0');
      const handle = String(user?.handle || '').replace(/^@/, '').toLowerCase();
      return (
        (uid && uid !== '0' && uidStr === uid) ||
        hashName === handle ||
        slice === mention
      );
    });
  }

  function getNextTagId(extrasList) {
    const existingIds = new Set((Array.isArray(extrasList) ? extrasList : [])
      .filter(e => e && e.tag_id !== undefined && e.tag_id !== null)
      .map(e => String(e.tag_id)));
    let id = 0;
    while (existingIds.has(String(id))) id++;
    return String(id);
  }

  function buildTextExtra(existingExtras, originalText, finalPlainText) {
    const filtered = (Array.isArray(existingExtras) ? existingExtras : [])
      .filter(e => !isOurMention(e, originalText));
    const text = String(finalPlainText || '');
    const signature = getFullSignature();
    const signatureStart = text.lastIndexOf(signature);
    if (signatureStart === -1) return filtered;

    let cursor = signatureStart + PREFIX.length;
    for (const user of MENTION_USERS) {
      const mention = getMentionText(user);
      if (!mention) continue;
      const mentionIdx = text.indexOf(mention, cursor);
      if (mentionIdx === -1) continue;
      const mentionExtra = {
        start: mentionIdx,
        end: mentionIdx + mention.length,
        user_id: String(user?.uid || '0'),
        type: 0,
        hashtag_name: String(user?.handle || '').replace(/^@/, ''),
        tag_id: getNextTagId(filtered)
      };
      if (user?.secUid) mentionExtra.sec_uid = String(user.secUid);
      filtered.push(mentionExtra);
      cursor = mentionIdx + mention.length;
    }
    return filtered;
  }

  function findTagIds(textExtras, finalPlainText) {
    const text = String(finalPlainText || '');
    return MENTION_USERS.map(user => {
      const mention = getMentionText(user);
      const mentionIdx = text.lastIndexOf(mention);
      const mentionEnd = mentionIdx + mention.length;
      const found = Array.isArray(textExtras) ? textExtras.find(e =>
        e && Number(e.type) === 0 &&
        String(e.user_id || e.userId || '') === String(user?.uid || '0') &&
        Number(e.start) === mentionIdx &&
        Number(e.end) === mentionEnd
      ) : null;
      return {
        mention,
        start: mentionIdx,
        tagId: (found && found.tag_id !== undefined) ? String(found.tag_id) : '0'
      };
    });
  }

  function buildMarkupText(currentMarkup, textExtras, finalPlainText) {
    const cleaned = cleanSignature(currentMarkup, true);
    const tagInfo = findTagIds(textExtras, finalPlainText);
    const signatureMarkup = escapeHtml(PREFIX) + tagInfo.map(info =>
      '<m id="' + escapeAttr(info.tagId) + '">' + escapeHtml(info.mention) + '</m>'
    ).join(' ');
    if (!cleaned) return signatureMarkup;
    if (cleaned.indexOf(PREFIX.trim()) !== -1) return cleaned;
    return cleaned + '\n\n' + signatureMarkup;
  }

  // ================= PAYLOAD RECOGNITION =================
  function isPublishUrl(url) {
    if (typeof url !== 'string') return false;
    if (url.includes('tiktok/web/project/post/v1/')) return true;
    if (url.includes('/music/') || url.includes('/sound/') || url.includes('music_id')) return false;
    return /(?:\/project\/post|\/publish\/|\/aweme\/v1\/create|\/item\/create)/i.test(url);
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
      const info = payload?.single_post_req_list?.[0]?.single_post_feature_info;
      return !!(info?.music_info?.music_id_string || info?.music_info?.id);
    } catch (_) {
      return false;
    }
  }

  // ================= PAYLOAD NORMALIZATION =================
  function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') return;
    const musicPresent = hasMusic(payload);

    // 1. Remove cloud canvas recompression flags & inject HD quality preferences
    ['draft', 'canvas_config', 'vedit_segment_info'].forEach(k => {
      if (payload[k] !== undefined) delete payload[k];
    });
    if (payload.cloud_edit_is_use_video_canvas !== undefined) {
      payload.cloud_edit_is_use_video_canvas = false;
    }
    payload.psg_vsp_aud = true; // Preserve Source Quality / Video Sound Profile Audio
    if (payload.enter_post_page_from !== undefined) {
      payload.enter_post_page_from = 1;
    }
    if (payload.post_common_info && typeof payload.post_common_info === 'object') {
      payload.post_common_info.post_type = 3;
      payload.post_common_info.enter_post_page_from = 1;
      payload.post_common_info.psg_vsp_aud = true;
    }
    if (musicPresent && Array.isArray(payload.feature_common_info_list)) {
      payload.feature_common_info_list.forEach(item => {
        if (item?.vedit_common_info) {
          if (item.vedit_common_info.tiktok_snap_shot_lite_params !== undefined) {
            delete item.vedit_common_info.tiktok_snap_shot_lite_params;
          }
          if (item.vedit_common_info.application !== undefined) {
            item.vedit_common_info.application = 1;
          }
        }
      });
    }
    if (Array.isArray(payload.single_post_req_list)) {
      payload.single_post_req_list.forEach(req => {
        req.psg_vsp_aud = true;
        const info = req?.single_post_feature_info;
        if (!info || typeof info !== 'object') return;
        if (info.vedit_segment_info !== undefined) delete info.vedit_segment_info;
        info.cloud_edit_is_use_video_canvas = false;
        info.has_original_audio = 1;
        info.psg_vsp_aud = true;
        info.video_quality_score = 1.0;
        info.is_high_quality = true;
        if (info.music_info && typeof info.music_info === 'object') {
          if (!info.music_info.music_id_string && info.music_info.id) {
            info.music_info.music_id_string = String(info.music_info.id);
          }
        }
      });
    }
  }

  // ================= SIGNATURE INJECTION & STRIPPING =================
  function injectSignature(payload) {
    return false;
  }

  function stripSignature(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (Array.isArray(payload.single_post_req_list)) {
      payload.single_post_req_list.forEach(req => {
        const feat = req?.single_post_feature_info;
        if (!feat || typeof feat !== 'object') return;
        const textStr = String(feat.text || cleanSignature(feat.markup_text || '', false));
        if (Array.isArray(feat.text_extra)) {
          feat.text_extra = feat.text_extra.filter(e => !isOurMention(e, textStr));
        }
        if (Array.isArray(req.text_extra)) {
          req.text_extra = req.text_extra.filter(e => !isOurMention(e, textStr));
        }
        ['text', 'markup_text', 'caption', 'desc', 'description', 'title'].forEach(key => {
          if (typeof feat[key] === 'string' && feat[key]) {
            feat[key] = (key === 'markup_text') ? cleanSignature(feat[key], true) : cleanSignature(feat[key], false);
          }
          if (typeof req[key] === 'string' && req[key]) {
            req[key] = (key === 'markup_text') ? cleanSignature(req[key], true) : cleanSignature(req[key], false);
          }
        });
      });
    }
  }

  function processPayload(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (!isPublishPayload(obj)) return obj;
    if (processedWeakSet.has(obj)) return obj;
    processedWeakSet.add(obj);

    normalizePayload(obj);
    stripSignature(obj);
    return obj;
  }

  function transformJsonString(jsonStr) {
    if (typeof jsonStr !== 'string') return jsonStr;
    try {
      const parsed = JSON.parse(jsonStr);
      processPayload(parsed);
      return JSON.stringify(parsed);
    } catch (_) {
      return jsonStr;
    }
  }

  function reportPublish(transport, url, changed) {
    try {
      window.postMessage({
        source: 'ADJN_PAGE_HOOK',
        type: 'PUBLISH_NORMALIZED',
        transport,
        changed: !!changed,
        url: String(url || '').slice(0, 240)
      }, '*');
    } catch (_) {}
  }

  // ================= 1. HOOK JSON.stringify =================
  const nativeStringify = JSON.stringify;
  JSON.stringify = function(value, replacer, space) {
    if (value && typeof value === 'object') {
      if (value.hasOwnProperty('video_quality_score') || value.hasOwnProperty('is_high_quality')) {
        value.video_quality_score = 1.0;
        value.is_high_quality = true;
      }
      if (isPublishPayload(value)) {
        try {
          processPayload(value);
        } catch (e) {
          console.warn('[ADJN Inject] JSON.stringify processPayload error:', e);
        }
      }
    }
    return nativeStringify.apply(this, arguments);
  };

  // ================= AB CONFIG & POST FLAG HELPERS =================
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
          if ('ab_value' in val && val.ab_value !== '1') { val.ab_value = '1'; changed = true; }
        } else if (typeof val === 'string' && val !== '1') {
          node[key] = '1'; changed = true;
        }
      }
      if (val && typeof val === 'object') changed = enablePhotoPosting(val) || changed;
    }
    return changed;
  }

  function patchAbBody(text) {
    try {
      const json = JSON.parse(text);
      if (enablePhotoPosting(json)) return JSON.stringify(json);
    } catch (_) {}
    return text;
  }

  // ================= 2. HOOK window.fetch =================
  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = async function(input, init = {}) {
      let nextInput = input;
      let nextInit = init;
      const url = typeof input === 'string' ? input : (input?.url || '');

      // Intercept AB config
      if (typeof url === 'string' && url.includes(PHOTO_AB_URL)) {
        const p = nativeFetch.call(this, nextInput, nextInit);
        return p.then(res => {
          if (!res.ok) return res;
          return res.clone().text().then(text => {
            const patched = patchAbBody(text);
            if (patched === text) return res;
            console.info('[ADJN Inject] Photo posting & high-res features enabled ✓');
            return new Response(patched, { status: res.status, statusText: res.statusText, headers: res.headers });
          }).catch(() => res);
        });
      }

      if (isPublishUrl(url)) {
        if (!resolved) {
          try { await resolveMention(); } catch (_) {}
        }
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

    proto.open = function(method, url) {
      this.__adjnUrl = url;
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
                  console.info('[ADJN Inject] Photo posting & high-res enabled (XHR) ✓');
                }
              }
            } catch (_) {}
          }
        });
      }
      return nativeOpen.apply(this, arguments);
    };

    proto.send = function(body) {
      let nextBody = body;
      const url = this.__adjnUrl || '';
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

  window.postMessage({ source: 'ADJN_PAGE_HOOK', type: 'HOOK_READY' }, '*');
})();
