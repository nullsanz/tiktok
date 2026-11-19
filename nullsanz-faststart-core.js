'use strict';
/*
 * Nullsanz FastStart Patch (Engine 4.0 Ultra)
 *
 * - Reorders container to True FastStart layout: ftyp -> moov -> empty free -> mdat -> trailing free.
 * - Rescales movie timescale (mvhd) cleanly to 1000 while rescaling tkhd/elst proportionally.
 * - Normalizes track hdlr boxes and strips leftover encoder timestamps/compressor names/udta.
 * - Overwrites the last 4 trailing audio samples in-place with generic AAC filler (preserving
 *   exact sample count, chunk layout, and codec/channel compatibility across stereo & mono).
 * - Leaves 100% of video bitstream bytes untouched.
 */
(function (root) {
  const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta', 'ilst']);
  const TAG_TEXT = 'Nullsanz Studio 4.0 Ultra';
  const AUDIO_TAIL_FILLER = Uint8Array.from([
    0xa0, 0x98, 0x00, 0x40, 0x01, 0x28, 0x00, 0x64, 0x00, 0x00, 0x03, 0x50, 0x00, 0x00, 0x38, 0x00
  ]);
  const AUDIO_TAIL_SAMPLE_COUNT = 4;

  function u32(b, o) {
    return new DataView(b.buffer, b.byteOffset + o, 4).getUint32(0, false);
  }
  function u64(b, o) {
    return Number(new DataView(b.buffer, b.byteOffset + o, 8).getBigUint64(0, false));
  }
  function wU32(b, o, v) {
    new DataView(b.buffer, b.byteOffset + o, 4).setUint32(0, v >>> 0, false);
  }
  function wU64(b, o, v) {
    new DataView(b.buffer, b.byteOffset + o, 8).setBigUint64(0, BigInt(Math.round(v)), false);
  }
  function typeOf(b, o) {
    return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  }
  function setType(b, o, t) {
    for (let i = 0; i < 4; i++) b[o + i] = t.charCodeAt(i);
  }
  function concat(parts) {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
  function box(type, payload) {
    const size = 8 + payload.length;
    if (size > 0xffffffff) throw new Error('Nullsanz FastStart: box ' + type + ' terlalu besar.');
    const out = new Uint8Array(size);
    wU32(out, 0, size);
    setType(out, 4, type);
    out.set(payload, 8);
    return out;
  }
  function readHeader(data, offset, limit) {
    if (offset + 8 > limit) return null;
    let size = u32(data, offset);
    const type = typeOf(data, offset + 4);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > limit) throw new Error('Nullsanz FastStart: box ' + type + ' terpotong.');
      size = u64(data, offset + 8);
      header = 16;
    } else if (size === 0) {
      size = limit - offset;
    }
    if (size < header || offset + size > limit) {
      throw new Error('Nullsanz FastStart: struktur box ' + type + ' tidak valid.');
    }
    return { type, offset, size, header, end: offset + size };
  }
  function parseTree(data, start, end) {
    const out = [];
    let o = start;
    while (o + 8 <= end) {
      const h = readHeader(data, o, end);
      if (!h) break;
      const node = { type: h.type, raw: data.slice(h.offset, h.end), children: null };
      if (CONTAINERS.has(h.type)) {
        node.children = parseTree(data, h.offset + h.header, h.end);
      }
      out.push(node);
      o = h.end;
    }
    return out;
  }
  function child(n, t) {
    return n.children ? n.children.find((c) => c.type === t) || null : null;
  }
  function path(n, ts) {
    let c = n;
    for (const t of ts) {
      c = child(c, t);
      if (!c) return null;
    }
    return c;
  }
  function payloadStart(leaf) {
    return u32(leaf.raw, 0) === 1 ? 16 : 8;
  }
  function serialize(n) {
    return n.children ? box(n.type, concat(n.children.map(serialize))) : n.raw;
  }
  function cloneTree(n) {
    return {
      type: n.type,
      raw: n.raw ? n.raw.slice() : null,
      children: n.children ? n.children.map(cloneTree) : null
    };
  }
  function tracks(moov) {
    return moov.children.filter((c) => c.type === 'trak');
  }
  function handlerOf(trak) {
    const h = path(trak, ['mdia', 'hdlr']);
    if (!h) return '';
    const p = payloadStart(h);
    if (p + 12 > h.raw.byteLength) return '';
    return typeOf(h.raw, p + 8);
  }

  function rewriteHdlr(trak) {
    const mdia = child(trak, 'mdia');
    const h = mdia && child(mdia, 'hdlr');
    if (!h) return;
    const p = payloadStart(h);
    if (p + 12 > h.raw.byteLength) return;
    const handlerType = typeOf(h.raw, p + 8);
    const rest = h.raw.slice(p + 12);
    const isZero = (n) => {
      for (let i = 0; i < n; i++) if (rest[i] !== 0) return false;
      return true;
    };
    let reserved = 0;
    if (rest.length >= 12 && isZero(12)) reserved = 12;
    else if (rest.length >= 8 && isZero(8)) reserved = 8;
    let nameEnd = rest.length;
    const nameStart = reserved;
    while (nameEnd > nameStart && rest[nameEnd - 1] === 0) nameEnd--;
    const nameBytes = rest.slice(nameStart, nameEnd);
    const payload = concat([
      new Uint8Array(4),
      new Uint8Array(4),
      new TextEncoder().encode(handlerType),
      new Uint8Array(12),
      nameBytes,
      new Uint8Array(1)
    ]);
    const idx = mdia.children.indexOf(h);
    mdia.children[idx] = { type: 'hdlr', raw: box('hdlr', payload), children: null };
  }

  function readTimeHeader(leaf) {
    const p = payloadStart(leaf);
    const v = leaf.raw[p];
    return v === 1
      ? {
          version: 1,
          timescaleOffset: p + 20,
          durationOffset: p + 28,
          width: 8,
          timescale: u32(leaf.raw, p + 20),
          duration: u64(leaf.raw, p + 28)
        }
      : {
          version: 0,
          timescaleOffset: p + 12,
          durationOffset: p + 16,
          width: 4,
          timescale: u32(leaf.raw, p + 12),
          duration: u32(leaf.raw, p + 16)
        };
  }
  function readTkhdDuration(tkhd) {
    const p = payloadStart(tkhd);
    const v = tkhd.raw[p];
    const offset = v === 1 ? p + 28 : p + 20;
    return { durationOffset: offset, duration: u32(tkhd.raw, offset) };
  }
  function bumpTkhdDuration(tkhd, newDuration) {
    const info = readTkhdDuration(tkhd);
    const raw = tkhd.raw.slice();
    wU32(raw, info.durationOffset, newDuration);
    tkhd.raw = raw;
  }

  function zeroTimestamps(node) {
    if (node.type === 'mvhd' || node.type === 'tkhd' || node.type === 'mdhd') {
      const raw = node.raw.slice();
      const p = payloadStart(node);
      const version = raw[p];
      if (version === 1) {
        wU64(raw, p + 4, 0);
        wU64(raw, p + 12, 0);
      } else {
        wU32(raw, p + 4, 0);
        wU32(raw, p + 8, 0);
      }
      node.raw = raw;
      return;
    }
    if (node.children) {
      for (const c of node.children) zeroTimestamps(c);
    }
  }

  function zeroCompressorName(outMoov) {
    for (const trak of tracks(outMoov)) {
      if (handlerOf(trak) !== 'vide') continue;
      const stsd = path(trak, ['mdia', 'minf', 'stbl', 'stsd']);
      if (!stsd) continue;
      const p = payloadStart(stsd);
      if (p + 8 > stsd.raw.byteLength) continue;
      if (u32(stsd.raw, p + 4) < 1) continue;
      const entryStart = p + 8;
      if (entryStart + 8 > stsd.raw.byteLength) continue;
      const entrySize = u32(stsd.raw, entryStart);
      const compressorOffset = entryStart + 8 + 42;
      if (entrySize < 82 || compressorOffset + 32 > stsd.raw.byteLength) continue;
      const raw = stsd.raw.slice();
      for (let i = 0; i < 32; i++) raw[compressorOffset + i] = 0;
      stsd.raw = raw;
    }
  }

  function rescaleMovieTimescale(outMoov, newTimescale) {
    const mvhd = child(outMoov, 'mvhd');
    if (!mvhd) return;
    const mvhdInfo = readTimeHeader(mvhd);
    const oldTimescale = mvhdInfo.timescale;
    if (!oldTimescale || oldTimescale === newTimescale) return;
    const ratio = newTimescale / oldTimescale;

    {
      const raw = mvhd.raw.slice();
      wU32(raw, mvhdInfo.timescaleOffset, newTimescale);
      const newDur = Math.round(mvhdInfo.duration * ratio);
      if (mvhdInfo.width === 8) wU64(raw, mvhdInfo.durationOffset, newDur);
      else wU32(raw, mvhdInfo.durationOffset, newDur);
      mvhd.raw = raw;
    }

    for (const trak of tracks(outMoov)) {
      const tkhd = child(trak, 'tkhd');
      if (tkhd) {
        const d = readTkhdDuration(tkhd);
        bumpTkhdDuration(tkhd, Math.round(d.duration * ratio));
      }

      const elst = path(trak, ['edts', 'elst']);
      if (elst) {
        const p = payloadStart(elst);
        const version = elst.raw[p];
        const entryCount = u32(elst.raw, p + 4);
        const entryWidth = version === 1 ? 20 : 12;
        const raw = elst.raw.slice();
        for (let i = 0; i < entryCount; i++) {
          const entryOffset = p + 8 + i * entryWidth;
          if (entryOffset + (version === 1 ? 8 : 4) > raw.byteLength) break;
          if (version === 1) {
            const dv = new DataView(raw.buffer, raw.byteOffset + entryOffset, 8);
            dv.setBigUint64(0, BigInt(Math.round(Number(dv.getBigUint64(0, false)) * ratio)), false);
          } else {
            wU32(raw, entryOffset, Math.round(u32(raw, entryOffset) * ratio));
          }
        }
        elst.raw = raw;
      }
    }
  }

  function readChunkOffsets(trak) {
    const stbl = path(trak, ['mdia', 'minf', 'stbl']);
    const n = stbl && stbl.children.find((c) => c.type === 'stco' || c.type === 'co64');
    if (!n) throw new Error('Nullsanz FastStart: stco/co64 tidak ditemukan.');
    const is64 = n.type === 'co64';
    const p = payloadStart(n);
    const count = u32(n.raw, p + 4);
    const offs = new Array(count);
    let o = p + 8;
    for (let i = 0; i < count; i++) {
      offs[i] = is64 ? u64(n.raw, o) : u32(n.raw, o);
      o += is64 ? 8 : 4;
    }
    return { is64, offsets: offs };
  }
  function setChunkOffsets(trak, offsets, forceUse64) {
    const stbl = path(trak, ['mdia', 'minf', 'stbl']);
    const idx = stbl.children.findIndex((c) => c.type === 'stco' || c.type === 'co64');
    const old = stbl.children[idx];
    const use64 = Boolean(forceUse64 || offsets.some((v) => v > 0xffffffff));
    const step = use64 ? 8 : 4;
    const p = payloadStart(old);
    const payload = new Uint8Array(8 + offsets.length * step);
    payload.set(old.raw.slice(p, p + 4), 0);
    wU32(payload, 4, offsets.length);
    let o = 8;
    for (const v of offsets) {
      if (use64) wU64(payload, o, v);
      else wU32(payload, o, v);
      o += step;
    }
    stbl.children[idx] = { type: use64 ? 'co64' : 'stco', raw: box(use64 ? 'co64' : 'stco', payload), children: null };
  }

  function makeDataAtom(text) {
    const utf8 = new TextEncoder().encode(text);
    const payload = new Uint8Array(8 + utf8.byteLength);
    wU32(payload, 0, 1);
    wU32(payload, 4, 0);
    payload.set(utf8, 8);
    return box('data', payload);
  }
  function makeUdtaBox(tagText) {
    const hdlrPayload = new Uint8Array(20);
    hdlrPayload.set(new TextEncoder().encode('mdir'), 8);
    const hdlr = box('hdlr', hdlrPayload);
    const ilst = box('ilst', box('\u00a9too', makeDataAtom(tagText)));
    const meta = box('meta', concat([new Uint8Array(4), hdlr, ilst]));
    return box('udta', meta);
  }

  function readStsz(trak) {
    const n = path(trak, ['mdia', 'minf', 'stbl', 'stsz']);
    if (!n) return [];
    const p = payloadStart(n);
    const defSize = u32(n.raw, p + 4);
    const count = u32(n.raw, p + 8);
    const sizes = new Array(count);
    if (defSize) {
      sizes.fill(defSize);
    } else {
      let o = p + 12;
      for (let i = 0; i < count; i++, o += 4) sizes[i] = u32(n.raw, o);
    }
    return sizes;
  }
  function readStsc(trak) {
    const n = path(trak, ['mdia', 'minf', 'stbl', 'stsc']);
    if (!n) return [];
    const p = payloadStart(n);
    const count = u32(n.raw, p + 4);
    const rows = [];
    let o = p + 8;
    for (let i = 0; i < count; i++, o += 12) {
      rows.push([u32(n.raw, o), u32(n.raw, o + 4), u32(n.raw, o + 8)]);
    }
    return rows;
  }

  function getSampleSpans(trak) {
    const sizes = readStsz(trak);
    const stsc = readStsc(trak);
    const { offsets } = readChunkOffsets(trak);
    const spans = [];
    if (!sizes.length || !stsc.length || !offsets.length) return spans;
    let sampleIndex = 0;
    for (let chunkNum = 1; chunkNum <= offsets.length && sampleIndex < sizes.length; chunkNum++) {
      let entry = stsc[0];
      for (const e of stsc) if (e[0] <= chunkNum) entry = e;
      const count = Math.min(entry[1], sizes.length - sampleIndex);
      let pos = offsets[chunkNum - 1];
      for (let j = 0; j < count; j++) {
        const len = sizes[sampleIndex++];
        spans.push([pos, len]);
        pos += len;
      }
    }
    return spans;
  }

  function overwriteAudioTail(mediaPayload, audioTrak, mdatContentStart, count) {
    const spans = getSampleSpans(audioTrak);
    if (!spans.length) return 0;
    const n = Math.min(count, spans.length);
    for (let i = spans.length - n; i < spans.length; i++) {
      const [absOffset, size] = spans[i];
      const relOffset = absOffset - mdatContentStart;
      if (relOffset < 0 || relOffset + size > mediaPayload.length) {
        throw new Error('Nullsanz FastStart: sample tail audio di luar batas mdat.');
      }
      for (let b = 0; b < size; b++) {
        mediaPayload[relOffset + b] = b < AUDIO_TAIL_FILLER.length ? AUDIO_TAIL_FILLER[b] : 0;
      }
    }
    return n;
  }

  function makeMdatHeader(payloadLength) {
    const size8 = 8 + payloadLength;
    if (size8 <= 0xffffffff) {
      const h = new Uint8Array(8);
      wU32(h, 0, size8);
      setType(h, 4, 'mdat');
      return h;
    }
    const h = new Uint8Array(16);
    wU32(h, 0, 1);
    setType(h, 4, 'mdat');
    wU64(h, 8, 16 + payloadLength);
    return h;
  }

  function patchContainer(input, opts) {
    opts = opts || {};
    const newMovieTimescale = opts.movieTimescale || 1000;
    input = input instanceof Uint8Array ? input : new Uint8Array(input);

    const top = [];
    let o = 0;
    while (o + 8 <= input.length) {
      const h = readHeader(input, o, input.length);
      if (!h) break;
      top.push(h);
      o = h.end;
    }
    const ftyp = top.find((x) => x.type === 'ftyp');
    const moovTop = top.find((x) => x.type === 'moov');
    const mdats = top.filter((x) => x.type === 'mdat');
    if (!ftyp || !moovTop || mdats.length !== 1) {
      throw new Error('Nullsanz FastStart: membutuhkan ftyp, moov, dan tepat satu mdat.');
    }
    if (top.some((x) => x.type === 'moof' || x.type === 'sidx' || x.type === 'mfra')) {
      throw new Error('Nullsanz FastStart: fragmented MP4 belum didukung oleh mode Ultra.');
    }
    const mdat = mdats[0];
    const mdatContentStart = mdat.offset + mdat.header;
    const mediaPayload = input.slice(mdatContentStart, mdat.end);

    const moov = {
      type: 'moov',
      raw: input.slice(moovTop.offset, moovTop.end),
      children: parseTree(input, moovTop.offset + moovTop.header, moovTop.end)
    };
    const outMoov = cloneTree(moov);

    const audioTrakOriginal = tracks(moov).find((t) => handlerOf(t) === 'soun');
    const audioTailOverwritten = audioTrakOriginal
      ? overwriteAudioTail(mediaPayload, audioTrakOriginal, mdatContentStart, AUDIO_TAIL_SAMPLE_COUNT)
      : 0;

    outMoov.children = outMoov.children.filter((c) => c.type !== 'meta' && c.type !== 'udta');

    zeroTimestamps(outMoov);
    zeroCompressorName(outMoov);
    tracks(outMoov).forEach(rewriteHdlr);
    rescaleMovieTimescale(outMoov, newMovieTimescale);
    outMoov.children.push({ type: 'udta', raw: makeUdtaBox(TAG_TEXT), children: null });

    const ftypBytes = input.slice(ftyp.offset, ftyp.end);
    const free = box('free', new Uint8Array(0));
    const mdatHeader = makeMdatHeader(mediaPayload.length);

    const outTracks = tracks(outMoov);
    const originalOffsets = outTracks.map((t) => readChunkOffsets(t));
    let use64Flags = originalOffsets.map((info) => info.is64);

    let moovBytes = null;
    for (let pass = 0; pass < 2; pass++) {
      outTracks.forEach((t, i) => setChunkOffsets(t, originalOffsets[i].offsets.map(() => 0), use64Flags[i]));
      const moovPlaceholder = serialize(outMoov);
      const newMediaStart = ftypBytes.length + moovPlaceholder.length + free.length + mdatHeader.length;
      const shift = newMediaStart - mdatContentStart;

      const nextUse64Flags = originalOffsets.map((info, i) => {
        const shiftedMax = info.offsets.reduce((m, v) => Math.max(m, v + shift), 0);
        return use64Flags[i] || shiftedMax > 0xffffffff;
      });
      const widthChanged = nextUse64Flags.some((flag, i) => flag !== use64Flags[i]);
      if (widthChanged) {
        use64Flags = nextUse64Flags;
        continue;
      }

      outTracks.forEach((t, i) => {
        const shifted = originalOffsets[i].offsets.map((v) => v + shift);
        setChunkOffsets(t, shifted, use64Flags[i]);
      });
      moovBytes = serialize(outMoov);
      if (moovBytes.length !== moovPlaceholder.length) {
        throw new Error('Nullsanz FastStart: ukuran moov berubah setelah finalisasi offset.');
      }
      break;
    }

    if (!moovBytes) {
      throw new Error('Nullsanz FastStart: gagal menstabilkan offset stco/co64.');
    }

    const trailingFree = box('free', new Uint8Array(0));
    const output = concat([ftypBytes, moovBytes, free, mdatHeader, mediaPayload, trailingFree]);

    return {
      bytes: output,
      report: {
        engine: '4.0-ultra',
        label: TAG_TEXT,
        videoUntouched: true,
        audioTailOverwritten,
        moovMovedBeforeMdat: true,
        movieTimescale: newMovieTimescale
      }
    };
  }

  function verifyUntouched(originalInput, outputInput) {
    const a = originalInput instanceof Uint8Array ? originalInput : new Uint8Array(originalInput);
    const b = outputInput instanceof Uint8Array ? outputInput : new Uint8Array(outputInput);

    function parseFile(buf) {
      const top = [];
      let o = 0;
      while (o + 8 <= buf.length) {
        const h = readHeader(buf, o, buf.length);
        if (!h) break;
        top.push(h);
        o = h.end;
      }
      const moovTop = top.find((x) => x.type === 'moov');
      const mdat = top.find((x) => x.type === 'mdat');
      if (!moovTop || !mdat) throw new Error('missing moov/mdat');
      const moov = {
        type: 'moov',
        raw: buf.slice(moovTop.offset, moovTop.end),
        children: parseTree(buf, moovTop.offset + moovTop.header, moovTop.end)
      };
      return { buf, moov, mdatContentStart: mdat.offset + mdat.header };
    }

    function sampleBytes(file, trak) {
      const spans = getSampleSpans(trak);
      return spans.map(([pos, len]) => file.buf.slice(pos, pos + len));
    }

    try {
      const fa = parseFile(a);
      const fb = parseFile(b);
      const videoA = tracks(fa.moov).find((t) => handlerOf(t) === 'vide');
      const videoB = tracks(fb.moov).find((t) => handlerOf(t) === 'vide');
      if (!videoA || !videoB) return false;
      const audioA = tracks(fa.moov).find((t) => handlerOf(t) === 'soun');
      const audioB = tracks(fb.moov).find((t) => handlerOf(t) === 'soun');

      const videoSamplesA = sampleBytes(fa, videoA);
      const videoSamplesB = sampleBytes(fb, videoB);
      if (videoSamplesA.length !== videoSamplesB.length) return false;
      for (let i = 0; i < videoSamplesA.length; i++) {
        if (videoSamplesA[i].length !== videoSamplesB[i].length) return false;
        for (let j = 0; j < videoSamplesA[i].length; j++) {
          if (videoSamplesA[i][j] !== videoSamplesB[i][j]) return false;
        }
      }

      if (!audioA || !audioB) return !audioA && !audioB;
      const audioSamplesA = sampleBytes(fa, audioA);
      const audioSamplesB = sampleBytes(fb, audioB);
      if (audioSamplesA.length !== audioSamplesB.length) return false;
      const tailStart = Math.max(0, audioSamplesA.length - AUDIO_TAIL_SAMPLE_COUNT);
      for (let i = 0; i < tailStart; i++) {
        if (audioSamplesA[i].length !== audioSamplesB[i].length) return false;
        for (let j = 0; j < audioSamplesA[i].length; j++) {
          if (audioSamplesA[i][j] !== audioSamplesB[i][j]) return false;
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  const NullsanzFastStartEngine = {
    patchContainer,
    verifyUntouched,
    AUDIO_TAIL_SAMPLE_COUNT
  };

  if (root && typeof root === 'object') {
    root.NullsanzFastStart = NullsanzFastStartEngine;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NullsanzFastStartEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
