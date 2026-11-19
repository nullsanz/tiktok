(() => {
  'use strict';
  const BRIDGE_CHANNEL = 'nullsanz-ffmpeg-bridge';
  let busy = false;
  let stageCallback = null;
  let ffmpegBridgeFrame = null;
  let ffmpegBridgeReady = false;
  let ffmpegBridgeSeq = 0;
  const ffmpegBridgeJobs = new Map();

  function getFfmpegBridgeUrl() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL('ffmpeg-bridge.html');
    }
    if (typeof location !== 'undefined' && location.protocol === 'chrome-extension:') {
      return 'ffmpeg-bridge.html';
    }
    return '';
  }

  function ensureFfmpegBridgeFrame() {
    if (typeof document === 'undefined' || !document.documentElement) {
      throw new Error('FFmpeg Bridge offline hanya tersedia di browser.');
    }
    const bridgeUrl = getFfmpegBridgeUrl();
    if (!bridgeUrl) {
      throw new Error('URL ffmpeg-bridge.html tidak tersedia di context ini.');
    }
    if (ffmpegBridgeFrame && ffmpegBridgeFrame.isConnected) return ffmpegBridgeFrame;

    ffmpegBridgeReady = false;
    ffmpegBridgeFrame = document.createElement('iframe');
    ffmpegBridgeFrame.src = bridgeUrl;
    ffmpegBridgeFrame.setAttribute('aria-hidden', 'true');
    ffmpegBridgeFrame.style.cssText = 'display:none!important;width:0;height:0;border:0;position:fixed;left:-9999px;top:-9999px;';
    document.documentElement.appendChild(ffmpegBridgeFrame);
    return ffmpegBridgeFrame;
  }

  async function waitFfmpegBridgeReady(timeoutMs = 25000) {
    ensureFfmpegBridgeFrame();
    const start = Date.now();
    while (!ffmpegBridgeReady) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('FFmpeg Bridge lokal tidak merespons. Coba reload extension & halaman.');
      }
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  async function runOfflineFfmpegJob(requestId, action, buffer, inputExt, ffmpegArgs) {
    await waitFfmpegBridgeReady();
    const jobId = `nspro-${Date.now()}-${++ffmpegBridgeSeq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ffmpegBridgeJobs.delete(jobId);
        reject(new Error('Nullsanz 4.0 Pro: encoding FFmpeg WASM timeout (30 menit).'));
      }, 30 * 60 * 1000);
      ffmpegBridgeJobs.set(jobId, { resolve, reject, timer, requestId });
      const targetWin = ffmpegBridgeFrame?.contentWindow;
      if (!targetWin) {
        clearTimeout(timer);
        ffmpegBridgeJobs.delete(jobId);
        reject(new Error('Iframe FFmpeg Bridge tidak memiliki contentWindow.'));
        return;
      }
      const transfer = buffer instanceof ArrayBuffer ? [buffer] : [];
      targetWin.postMessage(
        {
          channel: BRIDGE_CHANNEL,
          action,
          requestId: jobId,
          buffer,
          inputExt: inputExt || 'mp4',
          ffmpegArgs: Array.isArray(ffmpegArgs) ? ffmpegArgs : []
        },
        '*',
        transfer
      );
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
      const d = event.data;
      if (!d || d.channel !== BRIDGE_CHANNEL) return;
      if (ffmpegBridgeFrame?.contentWindow && event.source !== ffmpegBridgeFrame.contentWindow) return;

      if (d.type === 'BRIDGE_READY') {
        ffmpegBridgeReady = true;
        return;
      }

      const job = d.requestId ? ffmpegBridgeJobs.get(d.requestId) : null;
      if (!job) return;

      if (d.type === 'PROGRESS') {
        const pct = Math.max(10, Math.min(88, Number(d.value) || 20));
        stage(job.requestId, 'patching', d.text || 'Nullsanz 4.0 Pro • Encoding H.264/AAC lokal…', pct, 'Offline FFmpeg WASM');
        return;
      }
      if (d.type === 'READY') {
        return;
      }
      if (d.type === 'ERROR') {
        clearTimeout(job.timer);
        ffmpegBridgeJobs.delete(d.requestId);
        job.reject(new Error(d.message || 'FFmpeg WASM offline gagal memproses video.'));
        return;
      }
      if (d.type === 'DONE') {
        clearTimeout(job.timer);
        ffmpegBridgeJobs.delete(d.requestId);
        job.resolve(d.buffer);
      }
    });
  }

  function send(type, payload = {}, transfer = []) {
    if (typeof parent !== 'undefined' && parent && parent !== window) {
      parent.postMessage({ source: 'NULLSANZ_PROCESSOR', type, ...payload }, '*', transfer);
    }
  }
  function stage(requestId, key, label, progress, detail = '') {
    if (typeof stageCallback === 'function') {
      try { stageCallback(label, progress, detail, key); } catch (_) {}
    }
    send('STAGE', { requestId, key, label, progress, detail });
  }
  function owned(view) {
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  function asU8(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error('Buffer video tidak valid.');
  }

  function findAscii(bytes, text, from = 0) {
    const pat = [...text].map((ch) => ch.charCodeAt(0));
    outer: for (let i = from; i <= bytes.length - pat.length; i++) {
      for (let j = 0; j < pat.length; j++) if (bytes[i + j] !== pat[j]) continue outer;
      return i;
    }
    return -1;
  }
  function hasBytePattern(bytes, pattern) {
    outer: for (let i = 0; i <= bytes.length - pattern.length; i++) {
      for (let j = 0; j < pattern.length; j++) if (bytes[i + j] !== pattern[j]) continue outer;
      return true;
    }
    return false;
  }

  function detectHdrProfile(bytes, info) {
    const codec = String(info?.codecFamily || info?.codec || '').toLowerCase();
    const result = {
      hevc: codec.includes('hevc') || codec.includes('hvc1') || codec.includes('hev1') || codec.includes('dvh1') || codec.includes('dvhe'),
      main10: false,
      hdr10: false,
      hdr10plus: false,
      hlg: false,
      dolbyVision: false,
      label: 'SDR / unknown',
      reason: ''
    };
    if (!result.hevc) return result;

    const hvcc = findAscii(bytes, 'hvcC');
    if (hvcc >= 4 && hvcc + 6 < bytes.length) {
      const profileIdc = bytes[hvcc + 5] & 0x1f;
      result.main10 = profileIdc === 2;
    }

    result.dolbyVision = findAscii(bytes, 'dvvC') >= 0 || findAscii(bytes, 'dvcC') >= 0;
    result.hdr10plus = hasBytePattern(bytes, [0xB5, 0x00, 0x3C, 0x00, 0x01, 0x04]);

    for (const colorType of ['nclx', 'nclc']) {
      let pos = 0;
      while (pos < bytes.length) {
        const idx = findAscii(bytes, colorType, pos);
        if (idx < 0) break;
        if (idx + 10 < bytes.length) {
          const primaries = (bytes[idx + 4] << 8) | bytes[idx + 5];
          const transfer = (bytes[idx + 6] << 8) | bytes[idx + 7];
          if (primaries === 9 && transfer === 16) result.hdr10 = true;
          if (primaries === 9 && transfer === 18) result.hlg = true;
        }
        pos = idx + 4;
      }
    }

    if (result.dolbyVision && result.hlg) { result.label = 'Dolby Vision • HLG'; result.reason = 'Dolby Vision configuration + BT.2020 HLG detected'; }
    else if (result.dolbyVision) { result.label = 'Dolby Vision'; result.reason = 'Dolby Vision configuration detected'; }
    else if (result.hdr10plus) { result.hdr10 = true; result.label = 'HDR10+'; result.reason = 'dynamic HDR10+ metadata detected'; }
    else if (result.hdr10) { result.label = 'HDR10'; result.reason = 'BT.2020 + PQ metadata detected'; }
    else if (result.hlg) { result.label = 'HLG HDR'; result.reason = 'BT.2020 + HLG metadata detected'; }
    else if (result.main10) { result.label = 'HEVC Main10'; result.reason = '10-bit HEVC profile detected'; }
    return result;
  }

  function validateMediaInfo(info) {
    if (!info || !Number.isFinite(info.width) || !Number.isFinite(info.height)) {
      throw new Error('Resolusi video tidak terbaca.');
    }
    const width = Math.round(Number(info.width));
    const height = Math.round(Number(info.height));
    if (width < 16 || height < 16) throw new Error(`Resolusi ${width}×${height} tidak valid.`);

    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    const within4K = longSide <= 4096 && shortSide <= 2160;
    const within8K = longSide <= 8192 && shortSide <= 4320;
    if (!within8K) {
      throw new Error(`Resolusi ${width}×${height} di atas batas Nullsanz 8K60 (maks. 8192×4320 atau 4320×8192).`);
    }

    const fps = Number(info.maxFps || info.averageFps || 0);
    const maxAllowedFps = within4K ? 120.01 : 60.01;
    if (Number.isFinite(fps) && fps > maxAllowedFps) {
      const mode = within4K ? '4K120' : '8K60';
      const limit = within4K ? 120 : 60;
      throw new Error(`FPS ${fps.toFixed(2)} di atas batas ${mode} (${limit} FPS).`);
    }

    return {
      width,
      height,
      fps,
      shortSide,
      longSide,
      within4K,
      within8K,
      uhdHighLoad: shortSide > 1080 || longSide > 1920 || fps > 60.01
    };
  }

  function nearlyEqual(a, b, epsilon = 0.02) {
    const x = Number(a || 0);
    const y = Number(b || 0);
    if (!x && !y) return true;
    return Math.abs(x - y) <= epsilon;
  }

  function verifyMediaContract(inputInfo, outputInfo, inputHdr, outputHdr) {
    const problems = [];

    if (Math.round(inputInfo.width) !== Math.round(outputInfo.width) ||
        Math.round(inputInfo.height) !== Math.round(outputInfo.height)) {
      problems.push(`resolusi berubah ${inputInfo.width}×${inputInfo.height} → ${outputInfo.width}×${outputInfo.height}`);
    }

    const inCodecFamily = String(inputInfo.codecFamily || '').toLowerCase();
    const outCodecFamily = String(outputInfo.codecFamily || '').toLowerCase();
    const inCodecTag = String(inputInfo.codec || '').toLowerCase();
    const outCodecTag = String(outputInfo.codec || '').toLowerCase();

    if (inCodecFamily !== outCodecFamily) {
      problems.push(`codec family berubah ${inCodecFamily || '?'} → ${outCodecFamily || '?'}`);
    }
    if (inCodecTag && outCodecTag && inCodecTag !== outCodecTag) {
      problems.push(`codec sample entry berubah ${inCodecTag} → ${outCodecTag}`);
    }

    if (Number(inputInfo.videoSamples || 0) !== Number(outputInfo.videoSamples || 0)) {
      problems.push(`jumlah frame/sample berubah ${inputInfo.videoSamples} → ${outputInfo.videoSamples}`);
    }

    if (!nearlyEqual(inputInfo.averageFps, outputInfo.averageFps, 0.02) ||
        !nearlyEqual(inputInfo.maxFps, outputInfo.maxFps, 0.05)) {
      problems.push(
        `timing/FPS berubah ${(inputInfo.averageFps || 0).toFixed?.(3) || inputInfo.averageFps} → ` +
        `${(outputInfo.averageFps || 0).toFixed?.(3) || outputInfo.averageFps}`
      );
    }

    const hdrChecks = [
      ['Main10 / 10-bit', 'main10'],
      ['HDR10', 'hdr10'],
      ['HDR10+', 'hdr10plus'],
      ['HLG', 'hlg'],
      ['Dolby Vision', 'dolbyVision']
    ];
    for (const [label, key] of hdrChecks) {
      if (inputHdr?.[key] === true && outputHdr?.[key] !== true) {
        problems.push(`${label} metadata/signaling hilang`);
      }
    }

    if (problems.length) {
      throw new Error(`Resolution/HDR Safe gagal: ${problems.join('; ')}.`);
    }

    return {
      resolutionByteSafe: true,
      exactResolutionPreserved: true,
      exactVideoTimingPreserved: true,
      codecFamilyPreserved: true,
      codecSampleEntryPreserved: true,
      sourceCodecFamily: inCodecFamily,
      outputCodecFamily: outCodecFamily,
      sourceCodecTag: inCodecTag,
      outputCodecTag: outCodecTag,
      hdrSignalingPreserved: true,
      dolbyVisionPreserved: inputHdr?.dolbyVision ? outputHdr?.dolbyVision === true : null
    };
  }

  function extensionOf(name) {
    const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
    return m ? m[1] : '';
  }

  function mimeForExtension(ext, fallback = '') {
    const map = {
      mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime',
      webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
      mpg: 'video/mpeg', mpeg: 'video/mpeg', ts: 'video/mp2t',
      mts: 'video/mp2t', m2ts: 'video/mp2t', '3gp': 'video/3gpp',
      '3g2': 'video/3gpp2', wmv: 'video/x-ms-wmv', flv: 'video/x-flv'
    };
    return map[ext] || fallback || 'application/octet-stream';
  }

  function sniffMedia(bytes, data = {}) {
    const ext = extensionOf(data.fileName);
    const mime = String(data.fileType || '').toLowerCase();
    const ascii = (start, len) => {
      let s = '';
      for (let i = start; i < Math.min(bytes.length, start + len); i++) {
        const c = bytes[i];
        s += (c >= 32 && c <= 126) ? String.fromCharCode(c) : ' ';
      }
      return s;
    };
    const head = ascii(0, Math.min(bytes.length, 65536));
    let container = ext || 'video';
    if (head.includes('ftyp')) container = /qt  /.test(head) || ext === 'mov' ? 'mov' : 'mp4';
    else if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) container = ext === 'webm' ? 'webm' : 'matroska';
    else if (head.startsWith('RIFF') && head.slice(8, 12) === 'AVI ') container = 'avi';

    const tags = [
      ['hvc1', 'hevc'], ['hev1', 'hevc'], ['dvhe', 'dolby-vision'], ['dvh1', 'dolby-vision'],
      ['avc1', 'avc'], ['avc3', 'avc'], ['av01', 'av1'], ['vp09', 'vp9'], ['vp08', 'vp8'],
      ['ap4h', 'prores'], ['ap4x', 'prores'], ['apch', 'prores'], ['apcn', 'prores'], ['apcs', 'prores'], ['apco', 'prores']
    ];
    let codec = '';
    let codecFamily = '';
    for (const [tag, fam] of tags) {
      if (head.includes(tag)) { codec = tag; codecFamily = fam; break; }
    }
    const audioTags = ['mp4a', 'ac-3', 'ec-3', 'alac', 'Opus', 'opus', 'lpcm', 'sowt', 'twos', 'flac', 'fLaC'];
    let audioCodec = '';
    for (const tag of audioTags) if (head.includes(tag)) { audioCodec = tag; break; }
    const fragmented = head.includes('moof');
    return { container, ext, mime, codec, codecFamily, audioCodec, fragmented };
  }

  function scanIsoTopLevel(bytes) {
    const boxes = [];
    let p = 0;
    const read32 = (o) => ((bytes[o] * 0x1000000) + ((bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3])) >>> 0;
    const typeAt = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    while (p + 8 <= bytes.length) {
      let size = read32(p);
      const type = typeAt(p + 4);
      let header = 8;
      if (size === 1) {
        if (p + 16 > bytes.length) break;
        const hi = read32(p + 8);
        const lo = read32(p + 12);
        size = hi * 0x100000000 + lo;
        header = 16;
      } else if (size === 0) {
        size = bytes.length - p;
      }
      if (!Number.isFinite(size) || size < header || p + size > bytes.length) break;
      boxes.push(type);
      p += size;
    }
    return boxes;
  }

  function exactBytesEqual(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function passthroughResult(original, data, reason, info = null, hdr = null, sniff = null) {
    const ext = extensionOf(data.fileName);
    const sourceInfo = info || {
      width: 0, height: 0,
      codec: sniff?.codec || '', codecFamily: sniff?.codecFamily || sniff?.codec || '',
      averageFps: 0, maxFps: 0, videoSamples: 0,
      audioCodec: sniff?.audioCodec || '', audioSamples: 0,
      fragmented: !!sniff?.fragmented, tracks: []
    };
    const sourceHdr = hdr || detectHdrProfile(original, sourceInfo);
    const output = original.slice();
    if (!exactBytesEqual(original, output)) throw new Error('Universal Safe: byte passthrough verification gagal.');
    return {
      output,
      info: sourceInfo,
      outputInfo: sourceInfo,
      hdr: sourceHdr,
      outputHdr: sourceHdr,
      report: {
        engine: 'Nullsanz Core v4.0 • Universal Safe Passthrough',
        passthrough: true,
        reason,
        container: sniff?.container || ext || 'unknown',
        sourceMime: data.fileType || '',
        sourceExtension: ext,
        mediaPayloadPreserved: true,
        allBytesPreserved: true,
        allMetadataPreserved: true,
        allTracksPreserved: true,
        codecPreserved: true,
        audioCodecPreserved: true
      },
      verification: {
        videoBitstreamByteIdentical: true,
        originalAudioTrackPreserved: true,
        clonedAudioTrackAdded: false,
        wholeFileByteIdentical: true,
        codecFamilyPreserved: true,
        codecSampleEntryPreserved: true,
        hdrSignalingPreserved: true,
        metadataPreservedByteForByte: true,
        allTracksPreserved: true
      },
      mode: 'nullsanz-universal-safe-passthrough',
      passthrough: true,
      outputName: data.fileName || `video.${ext || 'mp4'}`,
      outputMime: data.fileType || mimeForExtension(ext),
      inputBytes: original.byteLength,
      warning: `Universal Safe passthrough: ${reason}`
    };
  }

  async function processVideo(data) {
    const supportedEngines = ['4.0', '4.0-ultra', '4.0-pro', '3.0.5', '3.0', '2.1.5'];
    let selectedEngine = supportedEngines.includes(String(data.engine || '')) ? String(data.engine) : '4.0';
    const requestId = data.requestId;
    const core = globalThis.NullsanzOriginalMp4Core || globalThis.NullsanzMp4Core;
    const direct40 = globalThis.NullsanzSlSrEngine || globalThis.NullsanzDirect40;
    const fastStart40 = globalThis.NullsanzFastStart;
    const pro40 = globalThis.NullsanzProCore;

    if (!core?.patchWithReport || !core?.verifyOutput || !core?.inspectMediaInfo) {
      throw new Error('Nullsanz Media Core tidak termuat.');
    }

    stage(requestId, 'reading', 'Membaca video…', 6);
    const original = asU8(data.buffer);
    if (original.byteLength < 64) throw new Error('File video kosong/tidak valid.');

    const sniff = sniffMedia(original, data);
    stage(
      requestId,
      'checking',
      'Cek container, codec & metadata…',
      15,
      `Engine ${selectedEngine} • ${sniff.container || 'video'} • ${sniff.codec || 'codec auto'} • ${sniff.audioCodec || 'audio auto'}`
    );

    let info = null;
    let hdr = null;
    let limits = null;
    try {
      info = core.inspectMediaInfo(original);
      limits = validateMediaInfo(info);
      hdr = detectHdrProfile(original, info);
    } catch (inspectError) {
      if (selectedEngine !== '4.0-pro') {
        stage(requestId, 'preparing', 'Universal Safe…', 35, 'Struktur kompleks • seluruh file dipertahankan byte-identical');
        return passthroughResult(original, data, inspectError?.message || 'container/codec non-standar', info, hdr, sniff);
      }
      info = {
        width: 0,
        height: 0,
        codec: sniff.codec || '',
        codecFamily: sniff.codecFamily || sniff.codec || '',
        averageFps: 0,
        maxFps: 0,
        videoSamples: 0,
        audioCodec: sniff.audioCodec || '',
        audioSamples: 0,
        fragmented: !!sniff.fragmented,
        tracks: []
      };
      hdr = detectHdrProfile(original, info);
      limits = { fps: 0, uhdHighLoad: false };
    }

    const loadText = limits.uhdHighLoad
      ? `UHD/High-FPS • ${info.width}×${info.height} • ${limits.fps ? limits.fps.toFixed(2) : '?'} FPS`
      : (info.width && info.height
        ? `${info.width}×${info.height} • ${limits.fps ? limits.fps.toFixed(2) : '?'} FPS`
        : `${sniff.container || 'video'} • auto-detect`);
    const hdrText = hdr?.label && hdr.label !== 'SDR / unknown' ? ` • ${hdr.label}` : '';
    let fallbackWarning = '';

    async function runEngine4Ultra(fallbackReason = '') {
      if (!fastStart40?.patchContainer || !fastStart40?.verifyUntouched) {
        throw new Error('Nullsanz Core 4.0 Ultra (FastStart) tidak termuat.');
      }
      stage(
        requestId,
        'preparing',
        'Nullsanz Engine 4.0 Ultra…',
        34,
        `${loadText}${hdrText} • True FastStart Single-Audio`
      );
      await new Promise((r) => setTimeout(r, 0));

      stage(requestId, 'patching', 'Apply FastStart Patch 4.0 Ultra…', 66, 'Bitstream video 100% utuh • Timescale 1000 • Tail Cleaner');
      const ultraRes = fastStart40.patchContainer(original);
      const output = asU8(ultraRes.bytes);
      if (output.byteLength < 1024) throw new Error('Engine 4.0 Ultra: output kosong.');

      stage(requestId, 'finalizing', 'Verifikasi Engine 4.0 Ultra…', 90, 'Cek FastStart + video/audio + HDR/Dolby Vision');
      if (!fastStart40.verifyUntouched(original, output)) {
        throw new Error('Verifikasi Engine 4.0 Ultra gagal: data video/audio berubah.');
      }

      const outputInfo = core.inspectMediaInfo(output);
      const outputHdr = detectHdrProfile(output, outputInfo);
      const mediaContract = verifyMediaContract(info, outputInfo, hdr, outputHdr);

      return {
        output,
        info,
        outputInfo,
        hdr,
        outputHdr,
        report: {
          ...(ultraRes.report || {}),
          engine: fallbackReason
            ? 'Nullsanz Ultra 4.0 (FastStart) [Auto-Fallback]'
            : 'Nullsanz Ultra 4.0 (FastStart)',
          passthrough: false,
          fallbackReason: fallbackReason || undefined,
          sourceResolution: `${info.width}x${info.height}`,
          outputResolution: `${outputInfo.width}x${outputInfo.height}`,
          resolutionPreserved: true,
          fpsPreserved: true,
          sourceCodecFamily: String(info.codecFamily || '').toLowerCase(),
          outputCodecFamily: String(outputInfo.codecFamily || '').toLowerCase(),
          sourceCodecTag: String(info.codec || '').toLowerCase(),
          outputCodecTag: String(outputInfo.codec || '').toLowerCase(),
          codecPreserved: true,
          codecSampleEntryPreserved: true,
          hdrPreserved: true,
          dolbyVisionPreserved: hdr?.dolbyVision ? outputHdr?.dolbyVision === true : null
        },
        verification: {
          ok: true,
          videoBitstreamByteIdentical: true,
          originalAudioTrackPreserved: true,
          clonedAudioTrackAdded: false,
          ...mediaContract
        },
        mode: 'nullsanz-ultra-4.0-faststart',
        passthrough: false,
        outputName: '',
        outputMime: 'video/mp4',
        inputBytes: original.byteLength,
        warning: fallbackReason ? `Auto-Fallback ke 4.0 Ultra: ${fallbackReason}` : ''
      };
    }

    async function runEngine4Pro(fallbackReason = '') {
      if (!pro40?.buildProFfmpegArgs || !pro40?.patchProMp4 || !pro40?.verifyProMp4) {
        throw new Error('Nullsanz Core 4.0 Pro tidak termuat.');
      }

      let sourceAmve = null;
      try {
        sourceAmve = pro40.extractAmveFromSource ? pro40.extractAmveFromSource(original) : null;
      } catch (_) {
        sourceAmve = null;
      }

      let proMeta = {
        width: info?.width || 1080,
        height: info?.height || 1920,
        durationSec: info?.durationSec || 0,
        avgFps: info?.averageFps || info?.maxFps || 60,
        fpsNum: 60000,
        fpsDen: 1001,
        videoBitrateBps: 0,
        hdrMode: hdr?.hlg ? 'hlg' : (hdr?.hdr10 ? 'pq' : 'sdr'),
        hasAudio: (info?.audioSamples || 0) > 0 || !!sniff?.audioCodec
      };
      try {
        proMeta = pro40.inspectMp4Source(original);
      } catch (_) {}

      const resolutionMode = data.resolutionMode === 'native' ? 'native' : '1080p';
      const ffmpegArgs = pro40.buildProFfmpegArgs('__INPUT__', '__OUTPUT__', proMeta, {
        wasm: true,
        preset: 'veryfast',
        threads: 1,
        resolutionMode
      });

      stage(
        requestId,
        'preparing',
        'Nullsanz Engine 4.0 Pro…',
        16,
        `${loadText}${hdrText} • Offline FFmpeg WASM (${resolutionMode === 'native' ? 'Native Res' : '1080p Safe'})`
      );
      const inputExt = extensionOf(data.fileName) || (sniff.container === 'mov' ? 'mov' : 'mp4');
      const encodedBuffer = await runOfflineFfmpegJob(requestId, 'PRO_ENCODE', owned(original), inputExt, ffmpegArgs);
      const encodedBytes = asU8(encodedBuffer);
      if (encodedBytes.byteLength < 1024) {
        throw new Error('Engine 4.0 Pro: output FFmpeg WASM kosong.');
      }

      stage(requestId, 'patching', 'Finalisasi Dual-Audio 4.0 Pro…', 89, 'Inject Dual-stsd + Silent Tail + Clean FastStart');
      const patched = pro40.patchProMp4(encodedBytes, {
        sourceAmve,
        artist: 'Nullsanz Studio 4.0 Pro'
      });
      const output = asU8(patched);
      const proCheck = pro40.verifyProMp4(output);
      if (!proCheck?.ok) {
        throw new Error(`Engine 4.0 Pro: verifikasi gagal (${proCheck?.reason || 'unknown'}).`);
      }

      let outputInfo = info;
      try {
        outputInfo = core.inspectMediaInfo(output);
      } catch (_) {
        try {
          const m = pro40.inspectMp4Source(output);
          outputInfo = {
            width: m.width,
            height: m.height,
            codec: 'avc1',
            codecFamily: 'avc',
            averageFps: m.avgFps,
            maxFps: m.avgFps,
            videoSamples: 0,
            audioCodec: 'mp4a',
            audioSamples: 0,
            fragmented: false,
            tracks: []
          };
        } catch (_) {}
      }
      const outputHdr = detectHdrProfile(output, outputInfo);

      return {
        output,
        info,
        outputInfo,
        hdr,
        outputHdr,
        report: {
          engine: fallbackReason
            ? 'Nullsanz Pro 4.0 (Offline FFmpeg WASM) [Auto-Fallback]'
            : 'Nullsanz Pro 4.0 (Offline FFmpeg WASM)',
          passthrough: false,
          reencoded: true,
          resolutionMode,
          fallbackReason: fallbackReason || undefined,
          sourceResolution: `${info.width || proMeta.width || '?'}x${info.height || proMeta.height || '?'}`,
          outputResolution: `${outputInfo.width || '?'}x${outputInfo.height || '?'}`,
          sourceCodecFamily: String(info.codecFamily || '').toLowerCase(),
          outputCodecFamily: String(outputInfo.codecFamily || 'avc').toLowerCase(),
          sourceCodecTag: String(info.codec || '').toLowerCase(),
          outputCodecTag: String(outputInfo.codec || 'avc1').toLowerCase()
        },
        verification: proCheck,
        mode: 'nullsanz-pro-4.0-wasm',
        passthrough: false,
        outputName: '',
        outputMime: 'video/mp4',
        inputBytes: original.byteLength,
        warning: fallbackReason ? `Auto-Fallback ke 4.0 Pro: ${fallbackReason}` : ''
      };
    }

    // ================= ENGINE 4.0 PRO (INLINE OFFLINE FFMPEG WASM) =================
    if (selectedEngine === '4.0-pro') {
      return await runEngine4Pro('');
    }

    // ================= ENGINE 4.0 ULTRA (TRUE FASTSTART SINGLE-AUDIO) =================
    if (selectedEngine === '4.0-ultra') {
      try {
        return await runEngine4Ultra('');
      } catch (ultraErr) {
        fallbackWarning = `4.0 Ultra fallback → 3.0.5 (${ultraErr?.message || ultraErr})`;
        stage(requestId, 'preparing', 'Auto-Fallback ke Engine 3.0.5…', 38, ultraErr?.message || 'Mencoba Engine 3.0.5 Sentinel');
        selectedEngine = '3.0.5';
      }
    }

    // ================= ENGINE 4.0 DIRECT (sl-sr DUAL-AUDIO / DUAL-STSD) =================
    if (selectedEngine === '4.0' && direct40?.patchDirectBytes) {
      try {
        stage(requestId, 'preparing', 'Nullsanz Engine 4.0 Direct…', 32, `${loadText}${hdrText} • Dual-Audio sl-sr`);
        await new Promise((r) => setTimeout(r, 0));

        stage(requestId, 'patching', 'Apply Direct Patch 4.0 (sl-sr)…', 64, 'Bitstream video 100% utuh • Dual-stsd + Silent Tail');
        const directRes = await direct40.patchDirectBytes(original, { artist: 'Nullsanz Studio 4.0' });
        const output = asU8(directRes.bytes);

        if (output.byteLength < original.byteLength) {
          throw new Error(`SIZE GUARD: hasil ${output.byteLength} byte lebih kecil dari source ${original.byteLength} byte.`);
        }

        stage(requestId, 'finalizing', 'Verifikasi Engine 4.0…', 90, 'Cek mdat bitstream + Dual-Audio + HDR/Dolby Vision');
        const verification = direct40.verifyDirectOutput(original, output);
        if (!verification.ok) {
          throw new Error(verification.reason || 'Verifikasi Engine 4.0 Direct gagal.');
        }

        const outputInfo = core.inspectMediaInfo(output);
        const outputHdr = detectHdrProfile(output, outputInfo);
        const mediaContract = verifyMediaContract(info, outputInfo, hdr, outputHdr);
        Object.assign(verification, mediaContract);

        return {
          output,
          info,
          outputInfo,
          hdr,
          outputHdr,
          report: {
            ...(directRes.report || {}),
            engine: 'Nullsanz Direct 4.0 (sl-sr Dual-Audio)',
            passthrough: false,
            sourceResolution: `${info.width}x${info.height}`,
            outputResolution: `${outputInfo.width}x${outputInfo.height}`,
            resolutionPreserved: true,
            fpsPreserved: true,
            sourceCodecFamily: String(info.codecFamily || '').toLowerCase(),
            outputCodecFamily: String(outputInfo.codecFamily || '').toLowerCase(),
            sourceCodecTag: String(info.codec || '').toLowerCase(),
            outputCodecTag: String(outputInfo.codec || '').toLowerCase(),
            codecPreserved: true,
            codecSampleEntryPreserved: true,
            hdrPreserved: true,
            dolbyVisionPreserved: hdr?.dolbyVision ? outputHdr?.dolbyVision === true : null
          },
          verification,
          mode: 'nullsanz-direct-4.0-slsr',
          passthrough: false,
          outputName: '',
          outputMime: 'video/mp4',
          inputBytes: original.byteLength,
          warning: ''
        };
      } catch (directErr) {
        const directReason = directErr?.message || String(directErr);
        stage(requestId, 'preparing', 'Auto-Fallback ke Engine 4.0 Ultra…', 34, `${directReason} • mencoba True FastStart`);
        try {
          return await runEngine4Ultra(`4.0 Direct (${directReason})`);
        } catch (ultraErr) {
          const ultraReason = ultraErr?.message || String(ultraErr);
          if (typeof document !== 'undefined' && getFfmpegBridgeUrl() && pro40?.buildProFfmpegArgs) {
            try {
              stage(requestId, 'preparing', 'Auto-Fallback ke Engine 4.0 Pro…', 36, `${ultraReason} • encoding FFmpeg lokal`);
              return await runEngine4Pro(`4.0 Direct & Ultra (${ultraReason})`);
            } catch (proErr) {
              fallbackWarning = `4.0 Cascade → 3.0.5 (${proErr?.message || proErr})`;
            }
          } else {
            fallbackWarning = `4.0 Cascade → 3.0.5 (${ultraReason})`;
          }
          stage(requestId, 'preparing', 'Auto-Fallback ke Engine 3.0.5…', 38, fallbackWarning);
          selectedEngine = '3.0.5';
        }
      }
    }

    // ================= LEGACY / SENTINEL ENGINES (3.0.5 / 3.0 / 2.1.5) =================
    const engineVersion = (selectedEngine === '3.0' || selectedEngine === '3.0.5') ? '6.0' : null;
    let engineProfile = { id: selectedEngine, source: `Nullsanz Core ${selectedEngine} (64-bit Sentinel)` };
    const engineChecker = globalThis.NullsanzEngines;
    if (engineVersion && engineChecker?.[engineVersion]?.checkLayout) {
      try {
        const check = await engineChecker[engineVersion].checkLayout(new Blob([original], { type: data.fileType || 'video/mp4' }));
        if (!check?.compatible) {
          throw new Error(check?.reason || `Engine ${engineVersion} menolak struktur video.`);
        }
        engineProfile = { id: selectedEngine, source: `Nullsanz Core ${selectedEngine} • compatibility profile ${engineVersion}` };
      } catch (engineError) {
        stage(requestId, 'checking', 'Engine compatibility…', 18, engineError?.message || String(engineError));
        return passthroughResult(original, data, engineError?.message || 'engine compatibility check gagal', info, hdr, sniff);
      }
    }

    const compat = core.inspectCompatibility(original);
    const trackList = Array.isArray(info?.tracks) ? info.tracks : [];
    const videoTracks = trackList.filter((t) => t.handler === 'vide');
    const audioTracks = trackList.filter((t) => t.handler === 'soun');
    const otherTracks = trackList.filter((t) => !['vide', 'soun'].includes(t.handler));
    const topLevelBoxes = (sniff.container === 'mp4' || sniff.container === 'mov') ? scanIsoTopLevel(original) : [];
    const extraTopLevel = topLevelBoxes.filter((t) => !['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide'].includes(t));

    if (videoTracks.length !== 1 || audioTracks.length !== 1 || otherTracks.length || extraTopLevel.length) {
      const why = [
        videoTracks.length !== 1 ? `video-tracks:${videoTracks.length}` : '',
        audioTracks.length !== 1 ? `audio-tracks:${audioTracks.length}` : '',
        otherTracks.length ? `extra-tracks:${otherTracks.map((t) => t.handler || '?').join('/')}` : '',
        extraTopLevel.length ? `extra-boxes:${[...new Set(extraTopLevel)].join('/')}` : ''
      ].filter(Boolean).join(', ');
      stage(requestId, 'preparing', 'Universal Safe…', 35, `${loadText}${hdrText} • metadata/track kompleks dipertahankan`);
      return passthroughResult(original, data, why || 'metadata/track kompleks', info, hdr, sniff);
    }

    if (compat?.needsRefinery) {
      stage(requestId, 'preparing', 'Universal Safe…', 35, `${loadText}${hdrText} • ${String((compat.reasons || []).join(', ') || 'complex media')}`);
      return passthroughResult(original, data, String((compat.reasons || []).join(', ') || 'struktur/codec kompleks'), info, hdr, sniff);
    }

    stage(requestId, 'preparing', 'Siapin media…', 42, `${loadText}${hdrText} • Nullsanz Sentinel Patch`);
    stage(requestId, 'remuxing', 'Menata container…', 54, 'Video bitstream 100% utuh');
    await new Promise((r) => setTimeout(r, 0));

    let result;
    try {
      stage(requestId, 'patching', 'Lagi apply Nullsanz patch…', 70, engineProfile.source);
      result = core.patchWithReport(original);
      if (result?.report) result.report.engine = engineProfile.source;
    } catch (patchError) {
      stage(requestId, 'patching', 'Fallback Universal Safe…', 76, 'Patch klasik tidak aman • pakai byte-identical passthrough');
      return passthroughResult(original, data, patchError?.message || 'full patch gagal', info, hdr, sniff);
    }

    const output = asU8(result?.bytes);
    if (output.byteLength < 64) throw new Error('Nullsanz Core menghasilkan file kosong.');
    if (output.byteLength < original.byteLength) {
      throw new Error(`SIZE GUARD: hasil ${output.byteLength} byte lebih kecil dari source ${original.byteLength} byte.`);
    }

    stage(requestId, 'finalizing', 'Verifikasi hasil…', 90, 'Cek resolusi + FPS + codec + HDR/Dolby Vision + bitstream');
    const verification = core.verifyOutput(original, output);
    if (verification.videoBitstreamByteIdentical !== true) {
      return passthroughResult(original, data, 'verifikasi video patch tidak identik', info, hdr, sniff);
    }
    if (result.report?.mdatByteIdentical === false) {
      return passthroughResult(original, data, 'verifikasi mdat patch tidak identik', info, hdr, sniff);
    }
    if (verification.originalAudioTrackPreserved !== true) {
      return passthroughResult(original, data, 'verifikasi audio patch tidak identik', info, hdr, sniff);
    }

    const outputInfo = core.inspectMediaInfo(output);
    const outputHdr = detectHdrProfile(output, outputInfo);
    try {
      const mediaContract = verifyMediaContract(info, outputInfo, hdr, outputHdr);
      Object.assign(verification, mediaContract);
    } catch (verifyError) {
      return passthroughResult(original, data, verifyError?.message || 'codec/HDR contract tidak lolos', info, hdr, sniff);
    }

    return {
      output,
      info,
      outputInfo,
      hdr,
      outputHdr,
      report: {
        ...(result.report || {}),
        passthrough: false,
        sourceResolution: `${info.width}x${info.height}`,
        outputResolution: `${outputInfo.width}x${outputInfo.height}`,
        resolutionPreserved: true,
        fpsPreserved: true,
        sourceCodecFamily: String(info.codecFamily || '').toLowerCase(),
        outputCodecFamily: String(outputInfo.codecFamily || '').toLowerCase(),
        sourceCodecTag: String(info.codec || '').toLowerCase(),
        outputCodecTag: String(outputInfo.codec || '').toLowerCase(),
        codecPreserved: true,
        codecSampleEntryPreserved: true,
        hdrPreserved: true,
        dolbyVisionPreserved: hdr?.dolbyVision ? outputHdr?.dolbyVision === true : null
      },
      verification,
      mode: 'nullsanz-core-resolution-codec-safe',
      passthrough: false,
      outputName: '',
      outputMime: 'video/mp4',
      inputBytes: original.byteLength,
      warning: fallbackWarning
    };
  }

  globalThis.NullsanzVideoProcessor = {
    async processVideoDirect(data, onProgress) {
      stageCallback = onProgress;
      try {
        const result = await processVideo(data);
        stage(data.requestId, 'ready', 'Siap upload', 100, result.mode);
        return result;
      } finally {
        stageCallback = null;
      }
    },
    processVideo,
    detectHdrProfile,
    validateMediaInfo,
    verifyMediaContract
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('message', async (event) => {
      const data = event.data;
      if (!data || data.source !== 'NULLSANZ_CONTENT' || data.type !== 'PROCESS') return;
      if (busy) return send('ERROR', { requestId: data.requestId, message: 'Processor masih sibuk.' });
      busy = true;
      try {
        const result = await processVideo(data);
        stage(data.requestId, 'ready', 'Siap upload', 100, result.mode);
        const buffer = owned(result.output);
        send('DONE', {
          requestId: data.requestId,
          buffer,
          inputBytes: result.inputBytes,
          outputBytes: result.output.byteLength,
          info: result.info,
          outputInfo: result.outputInfo,
          hdr: result.hdr,
          outputHdr: result.outputHdr,
          report: result.report,
          verification: result.verification,
          mode: result.mode,
          passthrough: !!result.passthrough,
          outputName: result.outputName || '',
          outputMime: result.outputMime || '',
          warning: result.warning || ''
        }, [buffer]);
      } catch (e) {
        send('ERROR', { requestId: data.requestId, message: e?.message || String(e) });
      } finally {
        busy = false;
      }
    });

    if (typeof parent !== 'undefined' && parent && parent !== window) {
      send('READY');
    }
  }
})();
