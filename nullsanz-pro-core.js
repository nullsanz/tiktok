/*
 * Nullsanz Pro Core v4.0 (Pre/Post FFmpeg WASM Dual-Audio + AMVE + HDR Color Matrix)
 * Developed by Nullsanz Studio (nullsanz / null.cloud)
 *
 * - Extracts source resolution, rotation, FPS, bitrate, HDR profile (HLG / PQ / SDR), and AMVE box/SEI
 * - Builds calibrated FFmpeg args (H.264 High@4.2 + AAC 48kHz stereo) with BT.2020 HLG / PQ / BT.709 color preservation
 * - Post-encode FastStart MP4 container builder:
 *     * ftyp + moov + free + mdat (True FastStart)
 *     * Re-injects source AMVE box into video stsd
 *     * Appends 18+ silent AAC tail frames (+0.40s)
 *     * Constructs 3 tracks: Video + Audio #1 (Dual stsd: 1190 + 118004c040002000) + Audio #2 (Single stsd, shared stco)
 * - Clean Nullsanz Studio metadata (Zero third-party watermarks or links)
 */
((root, factory) => {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.NullsanzProCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const VERSION = '4.0.0';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('latin1');

  const toU8 = (input) => {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    throw new Error('Input harus berupa Uint8Array atau ArrayBuffer.');
  };

  const dvOf = (u8) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

  function hexToU8(hex) {
    const clean = hex.replace(/\s+/g, '');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  function ascii(str) {
    return encoder.encode(str);
  }

  function concatU8(parts) {
    let total = 0;
    for (const p of parts) total += p.byteLength;
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.byteLength;
    }
    return out;
  }

  function u32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n >>> 0, false);
    return b;
  }

  function i32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, n | 0, false);
    return b;
  }

  function u16(n) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n & 0xffff, false);
    return b;
  }

  function u64(n) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigUint64(0, BigInt(n), false);
    return b;
  }

  function i64(n) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigInt64(0, BigInt(n), false);
    return b;
  }

  function box(typeBytesOrStr, ...parts) {
    const typeBytes = typeof typeBytesOrStr === 'string' ? ascii(typeBytesOrStr) : typeBytesOrStr;
    const body = concatU8(parts);
    const out = new Uint8Array(8 + body.byteLength);
    new DataView(out.buffer).setUint32(0, out.byteLength >>> 0, false);
    out.set(typeBytes.subarray(0, 4), 4);
    out.set(body, 8);
    return out;
  }

  function fullBox(type, version, flags, ...parts) {
    const vf = new Uint8Array([version & 0xff, (flags >>> 16) & 0xff, (flags >>> 8) & 0xff, flags & 0xff]);
    return box(type, vf, ...parts);
  }

  function tagStr(u8, s, e) {
    return decoder.decode(u8.subarray(s, e));
  }

  function parseBoxes(u8, start = 0, end = u8.byteLength) {
    const dv = dvOf(u8);
    const out = [];
    let p = start;
    while (p + 8 <= end) {
      let size = dv.getUint32(p, false);
      const type = tagStr(u8, p + 4, p + 8);
      let hdr = 8;
      if (size === 1 && p + 16 <= end) {
        size = Number(dv.getBigUint64(p + 8, false));
        hdr = 16;
      } else if (size === 0) {
        size = end - p;
      }
      if (size < hdr || p + size > end) break;
      out.push({ type, start: p, body: p + hdr, end: p + size, size, hdr });
      p += size;
    }
    return out;
  }

  function findChild(u8, parent, type) {
    return parseBoxes(u8, parent.body, parent.end).find((x) => x.type === type) || null;
  }

  function indexOfBytes(haystack, needle, start = 0, end = haystack.byteLength) {
    outer: for (let i = start; i <= end - needle.byteLength; i++) {
      for (let j = 0; j < needle.byteLength; j++) {
        if (haystack[i + j] !== needle[j]) continue outer;
      }
      return i;
    }
    return -1;
  }

  function gcd(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b > 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  function extractAmveFromSource(rawInput) {
    try {
      const u8 = toU8(rawInput);
      const top = parseBoxes(u8, 0, u8.byteLength);
      const moov = top.find((x) => x.type === 'moov');
      if (!moov) return null;
      for (const trak of parseBoxes(u8, moov.body, moov.end).filter((x) => x.type === 'trak')) {
        const mdia = findChild(u8, trak, 'mdia');
        const hdlr = mdia && findChild(u8, mdia, 'hdlr');
        if (!hdlr || tagStr(u8, hdlr.body + 8, hdlr.body + 12) !== 'vide') continue;
        const minf = findChild(u8, mdia, 'minf');
        const stbl = minf && findChild(u8, minf, 'stbl');
        const stsd = stbl && findChild(u8, stbl, 'stsd');
        if (!stsd || stsd.body + 8 > stsd.end) continue;
        const entry = parseBoxes(u8, stsd.body + 8, stsd.end)[0];
        if (!entry || entry.body + 78 > entry.end) continue;
        const kids = parseBoxes(u8, entry.body + 78, entry.end);
        const amve = kids.find((k) => k.type === 'amve');
        if (amve && amve.end - amve.body === 8) {
          return u8.slice(amve.body, amve.end);
        }
        const hvcC = kids.find((k) => k.type === 'hvcC');
        if (hvcC) {
          const marker = new Uint8Array([0x4e, 0x01, 0x94, 0x08]);
          const pos = indexOfBytes(u8, marker, hvcC.body, hvcC.end);
          if (pos !== -1 && pos + 12 <= hvcC.end) {
            return u8.slice(pos + 4, pos + 12);
          }
        }
      }
    } catch (_) {}
    return null;
  }

  function inspectMp4Source(rawInput) {
    const u8 = toU8(rawInput);
    const dv = dvOf(u8);
    const out = {
      isIsoBmff: false,
      width: 0,
      height: 0,
      rotation: 0,
      durationSec: 0,
      avgFps: 0,
      fpsNum: 60000,
      fpsDen: 1001,
      videoBitrateBps: 0,
      videoCodec: '',
      audioCodec: '',
      hasAudio: false,
      hdrMode: 'sdr', // 'hlg' | 'pq' | 'sdr'
      colorPrimaries: 1,
      colorTrc: 1,
      colorSpace: 1,
      colorRange: 0,
      amveBytes: null
    };
    const top = parseBoxes(u8, 0, u8.byteLength);
    const ftyp = top.find((x) => x.type === 'ftyp');
    const moov = top.find((x) => x.type === 'moov');
    if (!moov) return out;
    out.isIsoBmff = !!ftyp || !!moov;

    const mvhd = findChild(u8, moov, 'mvhd');
    if (mvhd) {
      const mv = u8[mvhd.body];
      const mts = mv === 0 ? dv.getUint32(mvhd.body + 12, false) : dv.getUint32(mvhd.body + 20, false);
      const mdur = mv === 0 ? dv.getUint32(mvhd.body + 16, false) : Number(dv.getBigUint64(mvhd.body + 24, false));
      if (mts > 0 && mdur > 0 && mdur < 1e15) out.durationSec = mdur / mts;
    }

    let seenVideo = false;
    for (const trak of parseBoxes(u8, moov.body, moov.end).filter((x) => x.type === 'trak')) {
      const mdia = findChild(u8, trak, 'mdia');
      const hdlr = mdia && findChild(u8, mdia, 'hdlr');
      if (!hdlr || hdlr.body + 12 > hdlr.end) continue;
      const sub = tagStr(u8, hdlr.body + 8, hdlr.body + 12);
      if (sub === 'soun') {
        out.hasAudio = true;
        const sMinf = findChild(u8, mdia, 'minf');
        const sStbl = sMinf && findChild(u8, sMinf, 'stbl');
        const sStsd = sStbl && findChild(u8, sStbl, 'stsd');
        const aEntry = sStsd && parseBoxes(u8, sStsd.body + 8, sStsd.end)[0];
        if (aEntry && !out.audioCodec) out.audioCodec = aEntry.type;
        continue;
      }
      if (sub !== 'vide' || seenVideo) continue;
      seenVideo = true;

      const tkhd = findChild(u8, trak, 'tkhd');
      if (tkhd && tkhd.end - tkhd.body >= 84) {
        const wFixed = dv.getUint32(tkhd.end - 8, false);
        const hFixed = dv.getUint32(tkhd.end - 4, false);
        const w = Math.round(wFixed / 65536);
        const h = Math.round(hFixed / 65536);
        if (w > 0 && h > 0) {
          out.width = w;
          out.height = h;
        }
        const a = dv.getInt32(tkhd.end - 44, false) / 65536;
        const b = dv.getInt32(tkhd.end - 40, false) / 65536;
        if (Math.abs(a) < 0.01 && Math.abs(b - 1) < 0.01) out.rotation = 90;
        else if (Math.abs(a) < 0.01 && Math.abs(b + 1) < 0.01) out.rotation = 270;
        else if (Math.abs(a + 1) < 0.01) out.rotation = 180;
      }

      const mdhd = findChild(u8, mdia, 'mdhd');
      const minf = findChild(u8, mdia, 'minf');
      const stbl = minf && findChild(u8, minf, 'stbl');
      if (mdhd && stbl) {
        const mv = u8[mdhd.body];
        const ts = mv === 0 ? dv.getUint32(mdhd.body + 12, false) : dv.getUint32(mdhd.body + 20, false);
        const dur = mv === 0 ? dv.getUint32(mdhd.body + 16, false) : Number(dv.getBigUint64(mdhd.body + 24, false));
        const vDurSec = ts > 0 && dur > 0 ? dur / ts : out.durationSec;
        if (vDurSec > 0) out.durationSec = vDurSec;

        const stsz = findChild(u8, stbl, 'stsz');
        if (stsz) {
          const uni = dv.getUint32(stsz.body + 4, false);
          const cnt = dv.getUint32(stsz.body + 8, false);
          let totalBytes = 0;
          if (uni > 0) {
            totalBytes = uni * cnt;
          } else {
            for (let i = 0; i < cnt && stsz.body + 12 + (i + 1) * 4 <= stsz.end; i++) {
              totalBytes += dv.getUint32(stsz.body + 12 + i * 4, false);
            }
          }
          if (totalBytes > 0 && vDurSec > 0) {
            out.videoBitrateBps = Math.round((totalBytes * 8) / vDurSec);
          }
          if (cnt > 1 && ts > 0 && dur > 0) {
            const fps = (cnt * ts) / dur;
            out.avgFps = fps;
            if (fps >= 58 && fps < 59.995) {
              const g = gcd(cnt * ts, dur);
              out.fpsNum = Math.round((cnt * ts) / g);
              out.fpsDen = Math.round(dur / g);
            } else if (fps >= 59.995) {
              out.fpsNum = 60000;
              out.fpsDen = 1001;
            } else if (fps > 1) {
              const g = gcd(cnt * ts, dur);
              out.fpsNum = Math.round((cnt * ts) / g);
              out.fpsDen = Math.round(dur / g);
            }
          }
        }

        const stsd = findChild(u8, stbl, 'stsd');
        const entry = stsd && parseBoxes(u8, stsd.body + 8, stsd.end)[0];
        if (entry && entry.body + 78 <= entry.end) {
          out.videoCodec = entry.type;
          const ew = dv.getUint16(entry.body + 24, false);
          const eh = dv.getUint16(entry.body + 26, false);
          if (out.width === 0 && ew > 0 && eh > 0) {
            out.width = ew;
            out.height = eh;
          }
          const kids = parseBoxes(u8, entry.body + 78, entry.end);
          const colr = kids.find((k) => k.type === 'colr');
          const colrType = colr ? tagStr(u8, colr.body, colr.body + 4) : '';
          if (colr && ((colrType === 'nclx' && colr.body + 11 <= colr.end) || (colrType === 'nclc' && colr.body + 10 <= colr.end))) {
            out.colorPrimaries = dv.getUint16(colr.body + 4, false);
            out.colorTrc = dv.getUint16(colr.body + 6, false);
            out.colorSpace = dv.getUint16(colr.body + 8, false);
            out.colorRange = (colrType === 'nclx' && colr.body + 11 <= colr.end) ? ((u8[colr.body + 10] >> 7) & 1) : 0;
            if (out.colorTrc === 18) out.hdrMode = 'hlg';
            else if (out.colorTrc === 16) out.hdrMode = 'pq';
          }
        }
      }
      out.amveBytes = extractAmveFromSource(u8);
    }

    if (!out.videoBitrateBps && out.durationSec > 0) {
      out.videoBitrateBps = Math.round((u8.byteLength * 0.96 * 8) / out.durationSec);
    }
    return out;
  }

  function computeTargetBitrateKbps(srcBitrateBps) {
    if (!Number.isFinite(srcBitrateBps) || srcBitrateBps <= 0) return 10000;
    const scaled = Math.round((srcBitrateBps * 0.877) / 1000);
    return Math.max(6000, Math.min(18000, scaled));
  }

  function buildEsds(trackId, ascHex, maxBitrate = 131801, avgBitrate = 125772) {
    const asc = hexToU8(ascHex);
    const dsi = concatU8([new Uint8Array([0x05, 0x80, 0x80, 0x80, asc.byteLength]), asc]);
    const dcdBody = concatU8([
      new Uint8Array([0x40, 0x15, 0x00, 0x00, 0x00]),
      u32(maxBitrate),
      u32(avgBitrate),
      dsi
    ]);
    const dcd = concatU8([new Uint8Array([0x04, 0x80, 0x80, 0x80, dcdBody.byteLength]), dcdBody]);
    const slc = new Uint8Array([0x06, 0x80, 0x80, 0x80, 0x01, 0x02]);
    const esBody = concatU8([u16(trackId), new Uint8Array([0x00]), dcd, slc]);
    const es = concatU8([new Uint8Array([0x03, 0x80, 0x80, 0x80, esBody.byteLength]), esBody]);
    return fullBox('esds', 0, 0, es);
  }

  function buildMp4aEntry(trackId, ascHex, maxBitrate = 131801, avgBitrate = 125772) {
    const fixedHeader = new Uint8Array(28);
    const dv = dvOf(fixedHeader);
    dv.setUint16(6, 1, false);                       // data_reference_index = 1
    dv.setUint16(16, 2, false);                      // channelcount = 2
    dv.setUint16(18, 16, false);                     // samplesize = 16
    dv.setUint32(24, (48000 * 65536) >>> 0, false);  // samplerate = 48000.0
    const esds = buildEsds(trackId, ascHex, maxBitrate, avgBitrate);
    const btrt = box('btrt', u32(0), u32(maxBitrate), u32(avgBitrate));
    return box('mp4a', fixedHeader, esds, btrt);
  }

  function buildUdta(artist = 'Nullsanz Studio 4.0 Pro') {
    const hdlr = fullBox(
      'hdlr', 0, 0,
      new Uint8Array(4),
      ascii('mdir'),
      ascii('appl'),
      new Uint8Array(9)
    );
    const mkItem = (tagBytes, text) => {
      const data = box('data', u32(1), u32(0), encoder.encode(text));
      return box(new Uint8Array(tagBytes), data);
    };
    const ilst = box(
      'ilst',
      mkItem([0xa9, 0x74, 0x6f, 0x6f], 'Lavf62.3.100'),
      mkItem([0xa9, 0x41, 0x52, 0x54], artist),
      mkItem([0xa9, 0x6e, 0x61, 0x6d], artist),
      mkItem([0xa9, 0x63, 0x6d, 0x74], 'Nullsanz TikTok Studio v4.0 Pro'),
      mkItem([0xa9, 0x77, 0x72, 0x74], artist),
      mkItem([0xa9, 0x61, 0x6c, 0x62], artist),
      mkItem([0xa9, 0x67, 0x72, 0x70], artist)
    );
    const meta = fullBox('meta', 0, 0, hdlr, ilst);
    return box('udta', meta);
  }

  function readSampleTableOffsets(u8, stbl, mdatBodyStart) {
    const dv = dvOf(u8);
    const kids = parseBoxes(u8, stbl.body, stbl.end);
    const stsz = kids.find((x) => x.type === 'stsz');
    const stsc = kids.find((x) => x.type === 'stsc');
    const stco = kids.find((x) => x.type === 'stco');
    const co64 = kids.find((x) => x.type === 'co64');
    if (!stsz || !stsc || (!stco && !co64)) return [];

    const uniSize = dv.getUint32(stsz.body + 4, false);
    const sampleCount = dv.getUint32(stsz.body + 8, false);
    const sizes = new Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      sizes[i] = uniSize > 0 ? uniSize : dv.getUint32(stsz.body + 12 + i * 4, false);
    }

    const chunkOffsets = [];
    if (stco) {
      const n = dv.getUint32(stco.body + 4, false);
      for (let i = 0; i < n; i++) chunkOffsets.push(dv.getUint32(stco.body + 8 + i * 4, false));
    } else {
      const n = dv.getUint32(co64.body + 4, false);
      for (let i = 0; i < n; i++) chunkOffsets.push(Number(dv.getBigUint64(co64.body + 8 + i * 8, false)));
    }

    const stscCount = dv.getUint32(stsc.body + 4, false);
    const runs = [];
    for (let i = 0; i < stscCount; i++) {
      runs.push({
        firstChunk: dv.getUint32(stsc.body + 8 + i * 12, false),
        samplesPerChunk: dv.getUint32(stsc.body + 12 + i * 12, false),
        sdi: dv.getUint32(stsc.body + 16 + i * 12, false)
      });
    }

    const samples = [];
    let sIdx = 0;
    for (let ci = 0; ci < chunkOffsets.length && sIdx < sampleCount; ci++) {
      const cNum = ci + 1;
      let run = runs[0];
      for (const r of runs) {
        if (r.firstChunk <= cNum) run = r;
        else break;
      }
      let off = chunkOffsets[ci];
      for (let k = 0; k < run.samplesPerChunk && sIdx < sampleCount; k++, sIdx++) {
        samples.push({ relOff: off - mdatBodyStart, size: sizes[sIdx] });
        off += sizes[sIdx];
      }
    }
    return samples;
  }

  function patchProMp4(encodedInput, opts = {}) {
    const encodedU8 = toU8(encodedInput);
    const dv = dvOf(encodedU8);
    const top = parseBoxes(encodedU8, 0, encodedU8.byteLength);
    const moov = top.find((x) => x.type === 'moov');
    const mdat = top.find((x) => x.type === 'mdat');
    if (!moov || !mdat) throw new Error('Container MP4 hasil encode tidak valid (moov/mdat hilang).');

    const mdatOrigBody = encodedU8.subarray(mdat.body, mdat.end);
    const moovKids = parseBoxes(encodedU8, moov.body, moov.end);
    const mvhdOrig = moovKids.find((x) => x.type === 'mvhd');
    if (!mvhdOrig) throw new Error('Box mvhd tidak ditemukan.');

    const oldMvhdV = encodedU8[mvhdOrig.body];
    const oldMvhdTs = oldMvhdV === 0
      ? dv.getUint32(mvhdOrig.body + 12, false)
      : dv.getUint32(mvhdOrig.body + 20, false);

    let videTrak = null;
    let sounTrak = null;
    for (const trak of moovKids.filter((x) => x.type === 'trak')) {
      const mdia = findChild(encodedU8, trak, 'mdia');
      const hdlr = mdia && findChild(encodedU8, mdia, 'hdlr');
      if (!hdlr || hdlr.body + 12 > hdlr.end) continue;
      const sub = tagStr(encodedU8, hdlr.body + 8, hdlr.body + 12);
      if (sub === 'vide' && !videTrak) videTrak = trak;
      if (sub === 'soun' && !sounTrak) sounTrak = trak;
    }
    if (!videTrak) throw new Error('Track video tidak ditemukan pada MP4 hasil encode.');

    // 1. Rebuild Video Track (id=1)
    const vTkhd = findChild(encodedU8, videTrak, 'tkhd');
    const vEdts = findChild(encodedU8, videTrak, 'edts');
    const vMdia = findChild(encodedU8, videTrak, 'mdia');
    const vMdhd = findChild(encodedU8, vMdia, 'mdhd');
    const vMinf = findChild(encodedU8, vMdia, 'minf');
    const vStbl = findChild(encodedU8, vMinf, 'stbl');

    const vMdV = encodedU8[vMdhd.body];
    const vMdTs = vMdV === 0 ? dv.getUint32(vMdhd.body + 12, false) : dv.getUint32(vMdhd.body + 20, false);
    const vMdDur = vMdV === 0 ? dv.getUint32(vMdhd.body + 16, false) : Number(dv.getBigUint64(vMdhd.body + 24, false));
    const videoDurSec = vMdTs > 0 ? vMdDur / vMdTs : 1;
    const videoDurMs = Math.max(1, Math.ceil(videoDurSec * 1000));

    const vTkhdOut = encodedU8.slice(vTkhd.start, vTkhd.end);
    const vTkhdDv = dvOf(vTkhdOut);
    const vTkhdVer = vTkhdOut[8];
    vTkhdOut[9] = 0; vTkhdOut[10] = 0; vTkhdOut[11] = 3;
    if (vTkhdVer === 0) {
      vTkhdDv.setUint32(20, 1, false);
      vTkhdDv.setUint32(28, videoDurMs, false);
    } else {
      vTkhdDv.setUint32(28, 1, false);
      vTkhdDv.setBigUint64(36, BigInt(videoDurMs), false);
    }

    let vEdtsOut = new Uint8Array(0);
    if (vEdts) {
      const elst = findChild(encodedU8, vEdts, 'elst');
      if (elst) {
        const ev = encodedU8[elst.body];
        const cnt = dv.getUint32(elst.body + 4, false);
        const parts = [u32(cnt)];
        for (let i = 0; i < cnt; i++) {
          const eo = elst.body + 8 + i * (ev === 0 ? 12 : 20);
          const origSeg = ev === 0 ? dv.getUint32(eo, false) : Number(dv.getBigUint64(eo, false));
          const mediaTime = ev === 0 ? dv.getInt32(eo + 4, false) : Number(dv.getBigInt64(eo + 8, false));
          const rate = encodedU8.subarray(eo + (ev === 0 ? 8 : 16), eo + (ev === 0 ? 12 : 20));
          const newSeg = Math.max(1, Math.round((origSeg * 1000) / (oldMvhdTs || 1000)));
          if (ev === 0) parts.push(u32(newSeg), i32(mediaTime), rate);
          else parts.push(u64(newSeg), i64(mediaTime), rate);
        }
        vEdtsOut = box('edts', fullBox('elst', ev, 0, ...parts));
      }
    }

    const vStblKids = parseBoxes(encodedU8, vStbl.body, vStbl.end);
    const vStsd = vStblKids.find((x) => x.type === 'stsd');
    let vStsdOut = encodedU8.slice(vStsd.start, vStsd.end);
    if (opts.sourceAmve && opts.sourceAmve.byteLength === 8) {
      const vEntry = parseBoxes(encodedU8, vStsd.body + 8, vStsd.end)[0];
      const hasAmve = vEntry && parseBoxes(encodedU8, vEntry.body + 78, vEntry.end).some((k) => k.type === 'amve');
      if (vEntry && !hasAmve) {
        const amveBox = box('amve', toU8(opts.sourceAmve));
        const newEntry = concatU8([encodedU8.subarray(vEntry.start, vEntry.end), amveBox]);
        dvOf(newEntry).setUint32(0, newEntry.byteLength, false);
        vStsdOut = fullBox('stsd', 0, 0, u32(1), newEntry);
      }
    }

    const vStco = vStblKids.find((x) => x.type === 'stco');
    const vCo64 = vStblKids.find((x) => x.type === 'co64');
    const vOrigChunkRelOffs = [];
    if (vStco) {
      const n = dv.getUint32(vStco.body + 4, false);
      for (let i = 0; i < n; i++) vOrigChunkRelOffs.push(dv.getUint32(vStco.body + 8 + i * 4, false) - mdat.body);
    } else if (vCo64) {
      const n = dv.getUint32(vCo64.body + 4, false);
      for (let i = 0; i < n; i++) vOrigChunkRelOffs.push(Number(dv.getBigUint64(vCo64.body + 8 + i * 8, false)) - mdat.body);
    }

    const vStcoPlaceholder = fullBox('stco', 0, 0, u32(vOrigChunkRelOffs.length), new Uint8Array(vOrigChunkRelOffs.length * 4));
    const vOrdered = [vStsdOut];
    for (const t of ['stts', 'ctts', 'stss', 'stsc', 'stsz']) {
      const hit = vStblKids.find((x) => x.type === t);
      if (hit) vOrdered.push(encodedU8.subarray(hit.start, hit.end));
    }
    vOrdered.push(vStcoPlaceholder);
    const vStblOut = box('stbl', ...vOrdered);
    const vMinfKids = parseBoxes(encodedU8, vMinf.body, vMinf.end)
      .filter((x) => x.type !== 'stbl').map((x) => encodedU8.subarray(x.start, x.end));
    const vMinfOut = box('minf', ...vMinfKids, vStblOut);
    const vMdiaKids = parseBoxes(encodedU8, vMdia.body, vMdia.end)
      .filter((x) => x.type !== 'minf').map((x) => encodedU8.subarray(x.start, x.end));
    const vMdiaOut = box('mdia', ...vMdiaKids, vMinfOut);
    const videTrakOut = box('trak', vTkhdOut, vEdtsOut, vMdiaOut);

    // 2. Audio Samples + 18-Frame Silent Tail (+0.40s+)
    const LAVC_DSE_FRAME = hexToU8('de02004c61766336322e31312e31303000422008c11838');
    const AAC_SILENT_CPE = hexToU8('211004608c1c');
    const AAC_PRIMING_CPE = hexToU8('212004608c1c');

    let audioSamples = [];
    let maxBr = 131801;
    let avgBr = 125772;
    if (sounTrak) {
      const sMdia = findChild(encodedU8, sounTrak, 'mdia');
      const sMinf = findChild(encodedU8, sMdia, 'minf');
      const sStbl = findChild(encodedU8, sMinf, 'stbl');
      audioSamples = readSampleTableOffsets(encodedU8, sStbl, mdat.body);
      const sStsd = findChild(encodedU8, sStbl, 'stsd');
      const mp4a0 = sStsd && parseBoxes(encodedU8, sStsd.body + 8, sStsd.end)[0];
      const btrt = mp4a0 && parseBoxes(encodedU8, mp4a0.body + 28, mp4a0.end).find((x) => x.type === 'btrt');
      if (btrt && btrt.end - btrt.body >= 12) {
        maxBr = dv.getUint32(btrt.body + 4, false) || maxBr;
        avgBr = dv.getUint32(btrt.body + 8, false) || avgBr;
      }
    }

    const tailBufs = [];
    let curTailRelOff = mdatOrigBody.byteLength;
    if (audioSamples.length === 0) {
      const baseFrames = Math.max(10, Math.ceil((videoDurSec * 48000) / 1024));
      for (let i = 0; i < baseFrames; i++) {
        const fr = i === 0 ? LAVC_DSE_FRAME : (i === 1 ? AAC_PRIMING_CPE : AAC_SILENT_CPE);
        tailBufs.push(fr);
        audioSamples.push({ relOff: curTailRelOff, size: fr.byteLength });
        curTailRelOff += fr.byteLength;
      }
    }

    const targetMinAudioFrames = Math.max(
      audioSamples.length + 18,
      Math.ceil(((videoDurSec + 0.40) * 48000) / 1024)
    );
    const tailCount = targetMinAudioFrames - audioSamples.length;
    for (let i = 0; i < tailCount; i++) {
      const fr = i === 0 ? LAVC_DSE_FRAME : AAC_SILENT_CPE;
      tailBufs.push(fr);
      audioSamples.push({ relOff: curTailRelOff, size: fr.byteLength });
      curTailRelOff += fr.byteLength;
    }

    const totalAudioFrames = audioSamples.length;
    const totalAudioPcmSamples = totalAudioFrames * 1024;
    const audioDurMs = Math.ceil((totalAudioPcmSamples * 1000) / 48000);
    const mdatFullBody = concatU8([mdatOrigBody, ...tailBufs]);

    const identityMatrix = hexToU8('000100000000000000000000000000000001000000000000000000000000000040000000');

    function buildAudioTrak(trackId, dualStsd) {
      const tkhd = fullBox(
        'tkhd', 0, 3,
        u32(0), u32(0), u32(trackId), u32(0), u32(audioDurMs),
        new Uint8Array(8),
        new Uint8Array([0, 0, 0, 0, 0x01, 0x00, 0, 0]),
        identityMatrix,
        u32(0), u32(0)
      );
      const edts = box('edts', fullBox('elst', 0, 0, u32(1), u32(audioDurMs), i32(0), u32(0x00010000)));
      const mdhd = fullBox('mdhd', 0, 0, u32(0), u32(0), u32(48000), u32(totalAudioPcmSamples), u16(0x55c4), u16(0));
      const hdlr = fullBox('hdlr', 0, 0, u32(0), ascii('soun'), new Uint8Array(12), ascii('SoundHandler\0'));
      const smhd = fullBox('smhd', 0, 0, u16(0), u16(0));
      const dref = fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1));
      const dinf = box('dinf', dref);

      const entry0 = buildMp4aEntry(trackId, '1190', maxBr, avgBr);
      const stsd = dualStsd
        ? fullBox('stsd', 0, 0, u32(2), entry0, buildMp4aEntry(trackId, '118004c040002000', maxBr, avgBr))
        : fullBox('stsd', 0, 0, u32(1), entry0);

      const stts = fullBox('stts', 0, 0, u32(1), u32(totalAudioFrames), u32(1024));
      const stsc = (dualStsd && totalAudioFrames > 8)
        ? fullBox('stsc', 0, 0, u32(2), u32(1), u32(1), u32(1), u32(totalAudioFrames - 7), u32(1), u32(2))
        : fullBox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1));

      const szBuf = new Uint8Array(totalAudioFrames * 4);
      const szDv = dvOf(szBuf);
      for (let i = 0; i < totalAudioFrames; i++) szDv.setUint32(i * 4, audioSamples[i].size, false);
      const stsz = fullBox('stsz', 0, 0, u32(0), u32(totalAudioFrames), szBuf);
      const stco = fullBox('stco', 0, 0, u32(totalAudioFrames), new Uint8Array(totalAudioFrames * 4));
      const sgpd = fullBox('sgpd', 1, 0, ascii('roll'), u32(2), u32(1), new Uint8Array([0xff, 0xff]));
      const sbgp = fullBox('sbgp', 0, 0, ascii('roll'), u32(1), u32(totalAudioFrames), u32(1));

      const stbl = box('stbl', stsd, stts, stsc, stsz, stco, sgpd, sbgp);
      const minf = box('minf', smhd, dinf, stbl);
      const mdia = box('mdia', mdhd, hdlr, minf);
      return box('trak', tkhd, edts, mdia);
    }

    const audioTrak1 = buildAudioTrak(2, true);
    const audioTrak2 = buildAudioTrak(3, false);

    const mvhd = fullBox(
      'mvhd', 0, 0,
      u32(0), u32(0), u32(1000), u32(audioDurMs),
      u32(0x00010000), u16(0x0100), new Uint8Array(10),
      identityMatrix,
      new Uint8Array(24),
      u32(4)
    );

    const ftyp = box('ftyp', ascii('isom'), u32(512), ascii('isomiso2avc1mp41'));
    const udta = buildUdta(opts.artist || 'Nullsanz Studio 4.0 Pro');
    const outMoov = box('moov', mvhd, videTrakOut, audioTrak1, audioTrak2, udta);
    const freeBox = box('free');
    const mdatHdr = concatU8([u32(8 + mdatFullBody.byteLength), ascii('mdat')]);
    const mdatBodyFileOffset = ftyp.byteLength + outMoov.byteLength + freeBox.byteLength + 8;

    // 3. Backfill exact file offsets across Video stco and both shared Audio stco tables
    const moovDv = dvOf(outMoov);
    const traksOut = parseBoxes(outMoov, 8, outMoov.byteLength).filter((x) => x.type === 'trak');

    {
      const stbl = findChild(outMoov, findChild(outMoov, findChild(outMoov, traksOut[0], 'mdia'), 'minf'), 'stbl');
      const stco = findChild(outMoov, stbl, 'stco');
      for (let i = 0; i < vOrigChunkRelOffs.length; i++) {
        moovDv.setUint32(stco.body + 8 + i * 4, (mdatBodyFileOffset + vOrigChunkRelOffs[i]) >>> 0, false);
      }
    }
    for (const ati of [1, 2]) {
      const stbl = findChild(outMoov, findChild(outMoov, findChild(outMoov, traksOut[ati], 'mdia'), 'minf'), 'stbl');
      const stco = findChild(outMoov, stbl, 'stco');
      for (let i = 0; i < totalAudioFrames; i++) {
        moovDv.setUint32(stco.body + 8 + i * 4, (mdatBodyFileOffset + audioSamples[i].relOff) >>> 0, false);
      }
    }

    return concatU8([ftyp, outMoov, freeBox, mdatHdr, mdatFullBody]);
  }

  function verifyProMp4(patchedInput) {
    const u8 = toU8(patchedInput);
    const dv = dvOf(u8);
    const top = parseBoxes(u8, 0, u8.byteLength);
    const moov = top.find((x) => x.type === 'moov');
    const mdat = top.find((x) => x.type === 'mdat');
    if (!moov || !mdat) return { ok: false, reason: 'Missing moov/mdat' };
    const fastStart = moov.start < mdat.start;
    const mvhd = findChild(u8, moov, 'mvhd');
    const traks = parseBoxes(u8, moov.body, moov.end).filter((x) => x.type === 'trak');
    if (traks.length !== 3) return { ok: false, reason: `Expected 3 tracks, got ${traks.length}` };

    const mvhdDur = dv.getUint32(mvhd.body + 16, false);
    if (!mvhdDur || mvhdDur >= 0xffffffff) return { ok: false, reason: 'Invalid mvhd duration' };

    const s1Stbl = findChild(u8, findChild(u8, findChild(u8, traks[1], 'mdia'), 'minf'), 'stbl');
    const s2Stbl = findChild(u8, findChild(u8, findChild(u8, traks[2], 'mdia'), 'minf'), 'stbl');
    const s1Stsd = findChild(u8, s1Stbl, 'stsd');
    const s1Stco = findChild(u8, s1Stbl, 'stco');
    const s2Stco = findChild(u8, s2Stbl, 'stco');
    const entryCount = dv.getUint32(s1Stsd.body + 4, false);
    if (entryCount !== 2) return { ok: false, reason: 'Audio #1 stsd entryCount != 2' };
    if (s1Stco.size !== s2Stco.size) return { ok: false, reason: 'Shared audio stco mismatch' };
    for (let i = 0; i < s1Stco.size; i++) {
      if (u8[s1Stco.start + i] !== u8[s2Stco.start + i]) {
        return { ok: false, reason: 'Shared audio stco bytes differ' };
      }
    }
    return {
      ok: true,
      tracks: traks.length,
      durationMs: mvhdDur,
      fastStart,
      dualStsd: true,
      mdatEnd: mdat.end,
      totalBytes: u8.byteLength
    };
  }

  function buildProFfmpegArgs(inputPath, outputPath, meta = {}, opts = {}) {
    const isWasm = opts.wasm !== false;
    const preset = opts.preset || (isWasm ? 'veryfast' : 'faster');
    const threads = String(opts.threads || (isWasm ? 1 : 4));
    const bitrateK = computeTargetBitrateKbps(meta.videoBitrateBps || 0);
    const keepNativeRes = opts.resolutionMode === 'native';

    let fpsArg = '60000/1001';
    if (meta.avgFps > 1 && meta.avgFps < 59.995 && meta.fpsNum > 0 && meta.fpsDen > 0) {
      fpsArg = `${Math.round(meta.fpsNum)}/${Math.round(meta.fpsDen)}`;
    } else if (meta.avgFps >= 59.995 || meta.avgFps <= 0) {
      fpsArg = '60000/1001';
    }

    let colorArgs;
    if (meta.hdrMode === 'hlg') {
      colorArgs = [
        '-color_primaries', 'bt2020',
        '-color_trc', 'arib-std-b67',
        '-colorspace', 'bt2020nc',
        '-color_range', 'tv',
        '-x264-params', 'colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc'
      ];
    } else if (meta.hdrMode === 'pq') {
      colorArgs = [
        '-color_primaries', 'bt2020',
        '-color_trc', 'smpte2084',
        '-colorspace', 'bt2020nc',
        '-color_range', 'tv',
        '-x264-params', 'colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc'
      ];
    } else {
      colorArgs = [
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-colorspace', 'bt709',
        '-color_range', 'tv'
      ];
    }

    const vf = (isWasm && !keepNativeRes)
      ? "scale=w='if(gt(min(iw\\,ih)\\,1080)\\,if(gt(iw\\,ih)\\,trunc(iw*1080/ih/2)*2\\,1080)\\,trunc(iw/2)*2)':h='if(gt(min(iw\\,ih)\\,1080)\\,if(gt(iw\\,ih)\\,1080\\,trunc(ih*1080/iw/2)*2)\\,trunc(ih/2)*2)'"
      : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';

    const args = ['-nostdin', '-y'];
    if (opts.progressPipe) {
      args.push('-stats', '-stats_period', '1', '-progress', opts.progressPipe);
    }
    args.push(
      '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-sn', '-dn',
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', preset,
      '-profile:v', 'high',
      '-level', keepNativeRes ? '5.1' : '4.2',
      '-threads', threads,
      '-r', fpsArg,
      '-b:v', `${bitrateK}k`,
      '-pix_fmt', 'yuv420p',
      '-tag:v', 'avc1',
      ...colorArgs,
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
      '-map_metadata', '-1', '-map_chapters', '-1',
      outputPath
    );
    return args;
  }

  return {
    version: VERSION,
    extractAmveFromSource,
    inspectMp4Source,
    computeTargetBitrateKbps,
    buildProFfmpegArgs,
    patchProMp4,
    verifyProMp4
  };
});
