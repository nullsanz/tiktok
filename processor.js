(() => {
  'use strict';
  let busy = false;

  let stageCallback = null;

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
    const pat = [...text].map(ch => ch.charCodeAt(0));
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
      hevc: codec.includes('hevc') || codec.includes('hvc1') || codec.includes('hev1'),
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

    // Dolby Vision configuration record in ISO-BMFF/QuickTime HEVC sample entries.
    result.dolbyVision = findAscii(bytes, 'dvvC') >= 0 || findAscii(bytes, 'dvcC') >= 0;

    // HDR10+ registered user-data signature carried inside HEVC SEI.
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

    // Universal-resolution path: never snap/resize to 1080p, 1440p, or any preset.
    // Preserve native resolution/aspect ratio with two validated ceilings:
    //   - up to 4K/DCI 4K (4096×2160): max 120 FPS
    //   - above 4K up to 8K/DCI 8K (8192×4320): max 60 FPS
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    const within4K = longSide <= 4096 && shortSide <= 2160;
    const within8K = longSide <= 8192 && shortSide <= 4320;
    if (!within8K) {
      throw new Error(
        `Resolusi ${width}×${height} di atas batas Nullsanz 8K60 (maks. 8192×4320 atau 4320×8192).`
      );
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
      problems.push(
        `resolusi berubah ${inputInfo.width}×${inputInfo.height} → ${outputInfo.width}×${outputInfo.height}`
      );
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
      problems.push(
        `jumlah frame/sample berubah ${inputInfo.videoSamples} → ${outputInfo.videoSamples}`
      );
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
        const c = bytes[i]; s += (c >= 32 && c <= 126) ? String.fromCharCode(c) : ' ';
      }
      return s;
    };
    const head = ascii(0, Math.min(bytes.length, 65536));
    let container = ext || 'video';
    if (head.includes('ftyp')) container = /qt  /.test(head) || ext === 'mov' ? 'mov' : 'mp4';
    else if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) container = ext === 'webm' ? 'webm' : 'matroska';
    else if (head.startsWith('RIFF') && head.slice(8, 12) === 'AVI ') container = 'avi';

    const tags = [
      ['hvc1','hevc'], ['hev1','hevc'], ['dvhe','dolby-vision'], ['dvh1','dolby-vision'],
      ['avc1','avc'], ['avc3','avc'], ['av01','av1'], ['vp09','vp9'], ['vp08','vp8'],
      ['ap4h','prores'], ['ap4x','prores'], ['apch','prores'], ['apcn','prores'], ['apcs','prores'], ['apco','prores']
    ];
    let codec = '', codecFamily = '';
    for (const [tag, fam] of tags) {
      if (head.includes(tag)) { codec = tag; codecFamily = fam; break; }
    }
    const audioTags = ['mp4a','ac-3','ec-3','alac','Opus','opus','lpcm','sowt','twos','flac','fLaC'];
    let audioCodec='';
    for (const tag of audioTags) if (head.includes(tag)) { audioCodec=tag; break; }
    const fragmented = head.includes('moof');
    return { container, ext, mime, codec, codecFamily, audioCodec, fragmented };
  }

  function scanIsoTopLevel(bytes) {
    const boxes = [];
    let p = 0;
    const read32 = o => ((bytes[o] * 0x1000000) + ((bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3])) >>> 0;
    const typeAt = o => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    while (p + 8 <= bytes.length) {
      let size = read32(p);
      const type = typeAt(p + 4);
      let header = 8;
      if (size === 1) {
        if (p + 16 > bytes.length) break;
        const hi = read32(p + 8), lo = read32(p + 12);
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
        engine: 'Nullsanz Core • Universal Safe Passthrough 3.0',
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
    const selectedEngine = ['2.1.5','2.3','3.0'].includes(String(data.engine || '')) ? String(data.engine) : '2.1.5';
    const engineVersion = selectedEngine === '2.3' ? '5.5' : selectedEngine === '3.0' ? '6.0' : null;
    const requestId = data.requestId;
    const core = globalThis.NullsanzOriginalMp4Core || globalThis.NullsanzMp4Core;
    if (!core?.patchWithReport || !core?.verifyOutput || !core?.inspectMediaInfo) {
      throw new Error('Nullsanz Media Core tidak termuat.');
    }

    stage(requestId, 'reading', 'Membaca video…', 6);
    const original = asU8(data.buffer);
    if (original.byteLength < 64) throw new Error('File video kosong/tidak valid.');

    const sniff = sniffMedia(original, data);

    // Engine 2.3/3.0: use the supplied engine source as a strict
    // compatibility/layout validator, while keeping the actual mutation local
    // in Nullsanz Core. No external engine watermark/branding is written by this extension.
    let engineProfile = { id: selectedEngine, source: 'Nullsanz Core v6.0' };
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
        return passthroughResult(original, data, engineError?.message || 'engine compatibility check gagal', null, null, sniff);
      }
    }
    stage(requestId, 'checking', 'Cek container, codec & metadata…', 15,
      `${sniff.container || 'video'} • ${sniff.codec || 'codec auto'} • ${sniff.audioCodec || 'audio auto'}`);

    let info = null;
    let hdr = null;
    let compat = null;

    try {
      info = core.inspectMediaInfo(original);
      validateMediaInfo(info);
      hdr = detectHdrProfile(original, info);
      compat = core.inspectCompatibility(original);
    } catch (inspectError) {
      // Fragmented MP4, WebM/MKV, unusual MOV atoms, and other structures are
      // deliberately preserved byte-for-byte instead of being rejected.
      stage(requestId, 'preparing', 'Universal Safe…', 35, 'Struktur kompleks • seluruh file dipertahankan byte-identical');
      return passthroughResult(original, data, inspectError?.message || 'container/codec tidak memakai jalur patch MP4 klasik', info, hdr, sniff);
    }

    const limits = validateMediaInfo(info);
    const loadText = limits.uhdHighLoad
      ? `UHD/High-FPS • ${info.width}×${info.height} • ${limits.fps ? limits.fps.toFixed(2) : '?'} FPS`
      : `${info.width}×${info.height} • ${limits.fps ? limits.fps.toFixed(2) : '?'} FPS`;
    const hdrText = hdr?.label && hdr.label !== 'SDR / unknown' ? ` • ${hdr.label}` : '';

    // Preserve multi-track media, subtitles/timecode, alternate audio/video tracks,
    // and extra top-level metadata boxes exactly instead of letting the classic
    // patch discard or reorder them.
    const trackList = Array.isArray(info?.tracks) ? info.tracks : [];
    const videoTracks = trackList.filter(t => t.handler === 'vide');
    const audioTracks = trackList.filter(t => t.handler === 'soun');
    const otherTracks = trackList.filter(t => !['vide', 'soun'].includes(t.handler));
    const topLevelBoxes = (sniff.container === 'mp4' || sniff.container === 'mov') ? scanIsoTopLevel(original) : [];
    const extraTopLevel = topLevelBoxes.filter(t => !['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide'].includes(t));
    if (videoTracks.length !== 1 || audioTracks.length !== 1 || otherTracks.length || extraTopLevel.length) {
      const why = [
        videoTracks.length !== 1 ? `video-tracks:${videoTracks.length}` : '',
        audioTracks.length !== 1 ? `audio-tracks:${audioTracks.length}` : '',
        otherTracks.length ? `extra-tracks:${otherTracks.map(t => t.handler || '?').join('/')}` : '',
        extraTopLevel.length ? `extra-boxes:${[...new Set(extraTopLevel)].join('/')}` : ''
      ].filter(Boolean).join(', ');
      stage(requestId, 'preparing', 'Universal Safe…', 35, `${loadText}${hdrText} • metadata/track kompleks dipertahankan`);
      return passthroughResult(original, data, why || 'metadata/track kompleks', info, hdr, sniff);
    }

    if (compat?.needsRefinery) {
      stage(requestId, 'preparing', 'Universal Safe…', 35,
        `${loadText}${hdrText} • ${String((compat.reasons || []).join(', ') || 'complex media')}`);
      return passthroughResult(
        original, data,
        String((compat.reasons || []).join(', ') || 'struktur/codec kompleks'),
        info, hdr, sniff
      );
    }

    // Nullsanz Method v6.0: The clean 64-bit Duration Sentinel leaves bitstream and audio samples 100% intact,
    // which is fully compatible with Apple AVFoundation and iOS/Orion without crashing!


    // Only the proven-safe classic path is modified. Everything else above
    // is exact-byte passthrough, which preserves every metadata atom/track.
    stage(requestId, 'preparing', 'Siapin media…', 28, `${loadText}${hdrText} • Nullsanz full patch`);
    stage(requestId, 'remuxing', 'Lagi remux…', 45, 'Menata container • video bitstream tidak disentuh');
    await new Promise(r => setTimeout(r, 0));

    let result;
    try {
      stage(requestId, 'patching', 'Lagi apply Nullsanz patch…', 66, engineProfile.source);
      result = core.patchWithReport(original);
      if (result?.report) result.report.engine = engineProfile.source;
    } catch (patchError) {
      stage(requestId, 'patching', 'Fallback Universal Safe…', 72, 'Patch klasik tidak aman untuk file ini • pakai byte-identical passthrough');
      return passthroughResult(original, data, patchError?.message || 'full patch gagal', info, hdr, sniff);
    }

    const output = asU8(result?.bytes);
    if (output.byteLength < 64) throw new Error('Nullsanz Core menghasilkan file kosong.');
    if (output.byteLength < original.byteLength) {
      throw new Error(`SIZE GUARD: hasil ${output.byteLength} byte lebih kecil dari source ${original.byteLength} byte.`);
    }

    stage(requestId, 'finalizing', 'Lagi nyelesaiin…', 90, 'Verifikasi resolusi + FPS + codec + HDR/Dolby Vision + bitstream');
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
      warning: ''
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
