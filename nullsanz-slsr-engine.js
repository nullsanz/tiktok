/*
 * Nullsanz Direct Patch Engine v4.0 (sl-sr Dual-Audio / Dual-stsd Bitstream-Safe)
 * Developed by Nullsanz Studio (nullsanz / null.cloud)
 *
 * - 100% Bitstream-Untouched Video (preserves 8K 60FPS, 4K 120FPS, H.264, HEVC, HDR10, HLG, Dolby Vision)
 * - Dual-Audio Track Reconstruction:
 *     * Audio Track #1: Dual stsd (original AAC-LC stereo + alternate channelConfig=0 PCE for final 8 silent frames)
 *     * Audio Track #2: Cloned original single-stsd audio track sharing exact audio chunk offsets
 * - Appends silent AAC tail (+0.35s+) in a new mdat without shifting video chunk offsets
 * - Zero third-party watermarks or external links in udta metadata
 * - Supports both File/Blob (zero-copy large file slicing) and Uint8Array/ArrayBuffer (inline & Node tests)
 */
((root, factory) => {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.NullsanzSlSrEngine = api;
    root.NullsanzDirect40 = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const VERSION = '4.0.0';
  const textEncoder = new TextEncoder();

  const CONTAINER_BOXES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf']);
  const ALLOWED_AUDIO_STBL_BOXES = new Set([
    'stsd', 'stsz', 'stsc', 'stts', 'stco', 'co64',
    'sbgp', 'sgpd', 'subs', 'free', 'skip', 'ctts',
    'stss', 'stps', 'sdtp', 'stdp'
  ]);
  const AAC_SAMPLE_RATES = [
    96000, 88200, 64000, 48000, 44100, 32000,
    24000, 22050, 16000, 12000, 11025, 8000, 7350
  ];
  // Standard 6-byte AAC-LC Stereo CPE silent frame
  const SILENT_AAC_FRAME = Uint8Array.of(0x21, 0x10, 0x04, 0x60, 0x8c, 0x1c);

  function assert(cond, message) {
    if (!cond) {
      const err = new Error(message);
      err.name = 'NullsanzDirect40Error';
      throw err;
    }
  }

  function fourccBytes(val) {
    if (val instanceof Uint8Array) return val.subarray(0, 4);
    const out = new Uint8Array(4);
    const str = String(val);
    for (let i = 0; i < 4; i++) {
      out[i] = i < str.length ? (str.charCodeAt(i) & 0xff) : 0x20;
    }
    return out;
  }

  function readU32(u8, off) {
    return new DataView(u8.buffer, u8.byteOffset + off, 4).getUint32(0, false);
  }

  function readU64(u8, off) {
    return new DataView(u8.buffer, u8.byteOffset + off, 8).getBigUint64(0, false);
  }

  function u32Bytes(val) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, val >>> 0, false);
    return out;
  }

  function u64Bytes(val) {
    const out = new Uint8Array(8);
    new DataView(out.buffer).setBigUint64(0, BigInt(val), false);
    return out;
  }

  function concatU8(...parts) {
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }

  function packU32(...vals) {
    return concatU8(...vals.map(u32Bytes));
  }

  function readFourCC(u8, off) {
    return String.fromCharCode(u8[off], u8[off + 1], u8[off + 2], u8[off + 3]);
  }

  function makeBox(name, payload) {
    return concatU8(u32Bytes(payload.length + 8), fourccBytes(name), payload);
  }

  function findChild(node, name) {
    return node.children ? node.children.find((c) => c.name === name) || null : null;
  }

  function requireChild(node, name) {
    const hit = findChild(node, name);
    assert(hit, `Box MP4 tidak ditemukan: ${name}`);
    return hit;
  }

  function parseBoxHeader(u8, maxSize) {
    assert(u8.length >= 8, 'Header box MP4 terpotong.');
    const rawSize = readU32(u8, 0);
    const width = rawSize === 1 ? 16 : 8;
    assert(u8.length >= width, 'Header extended 64-bit box MP4 terpotong.');
    const size = rawSize === 1 ? Number(readU64(u8, 8)) : (rawSize || maxSize);
    assert(Number.isSafeInteger(size) && size >= width && size <= maxSize, 'Ukuran box MP4 tidak valid.');
    return {
      name: readFourCC(u8, 4),
      width,
      size,
      zero: rawSize === 0
    };
  }

  function parseTree(u8, depth = 0) {
    assert(depth < 16, 'Struktur nesting box MP4 terlalu dalam.');
    const nodes = [];
    for (let pos = 0; pos < u8.length;) {
      const hdr = parseBoxHeader(u8.subarray(pos), u8.length - pos);
      const raw = u8.subarray(pos, pos + hdr.size);
      const data = raw.subarray(hdr.width);
      nodes.push({
        name: hdr.name,
        data,
        raw,
        children: CONTAINER_BOXES.has(hdr.name) ? parseTree(data, depth + 1) : null
      });
      pos += hdr.size;
    }
    return nodes;
  }

  function serializeNode(node) {
    if (node.children) {
      return makeBox(node.name, concatU8(...node.children.map(serializeNode)));
    }
    return node.raw || makeBox(node.name, node.data);
  }

  function setNodeData(node, nextData) {
    node.data = nextData;
    node.raw = null;
  }

  function cloneNode(node) {
    return {
      name: node.name,
      data: node.data ? node.data.slice() : null,
      raw: node.raw ? node.raw.slice() : null,
      children: node.children ? node.children.map(cloneNode) : null
    };
  }

  // MP4 Elementary Stream Descriptor (esds) helpers
  function encodeDescriptor(tag, payload) {
    const len = payload.length;
    return concatU8(
      Uint8Array.of(
        tag,
        0x80 | ((len >>> 21) & 0x7f),
        0x80 | ((len >>> 14) & 0x7f),
        0x80 | ((len >>> 7) & 0x7f),
        len & 0x7f
      ),
      payload
    );
  }

  function readDescriptor(buf, offset) {
    assert(offset < buf.length, 'Descriptor AAC tidak ditemukan.');
    const tag = buf[offset++];
    let size = 0;
    for (let i = 0; i < 4; i++) {
      assert(offset < buf.length, 'Descriptor AAC terpotong.');
      const b = buf[offset++];
      size = size * 128 + (b & 0x7f);
      if (!(b & 0x80)) {
        assert(offset + size <= buf.length, 'Panjang descriptor AAC tidak valid.');
        return { tag, start: offset, end: offset + size };
      }
    }
    throw new Error('Descriptor AAC tidak valid.');
  }

  function buildDualAudioStsd(stsdNode) {
    const data = stsdNode.data;
    assert(data.length >= 44 && readU32(data, 0) === 0 && readU32(data, 4) === 1, 'Membutuhkan tepat satu sample description AAC (stsd).');

    const origEntry = data.subarray(8);
    assert(
      readFourCC(origEntry, 4) === 'mp4a' &&
      readU32(origEntry, 0) === origEntry.length &&
      origEntry[16] === 0 && origEntry[17] === 0 &&
      origEntry[24] === 0 && origEntry[25] === 2,
      'Engine 4.0 Direct membutuhkan audio AAC-LC stereo unencrypted (2 channel).'
    );

    const subBoxes = parseTree(origEntry.subarray(36));
    const esds = subBoxes.find((b) => b.name === 'esds');
    assert(esds && !subBoxes.some((b) => b.name === 'sinf' || b.name === 'wave'), 'Membutuhkan konfigurasi AAC esds langsung.');

    const esdsData = esds.data;
    assert(esdsData.length >= 4 && readU32(esdsData, 0) === 0, 'Versi box esds AAC tidak didukung.');
    const esDesc = readDescriptor(esdsData, 4);
    assert(esDesc.tag === 3 && esDesc.end - esDesc.start >= 3 && esdsData[esDesc.start + 2] === 0, 'Flag ES_Descriptor AAC tidak didukung.');

    let freqIndex = -1;
    const esChildren = [];
    for (let p = esDesc.start + 3; p < esDesc.end;) {
      const child = readDescriptor(esdsData.subarray(0, esDesc.end), p);
      if (child.tag !== 4) {
        esChildren.push(esdsData.subarray(p, child.end));
      } else {
        assert(child.end - child.start >= 13 && esdsData[child.start] === 0x40, 'DecoderConfigDescriptor bukan MPEG-4 AAC.');
        const dcdChildren = [];
        for (let q = child.start + 13; q < child.end;) {
          const dsi = readDescriptor(esdsData.subarray(0, child.end), q);
          if (dsi.tag !== 5) {
            dcdChildren.push(esdsData.subarray(q, dsi.end));
          } else {
            const asc = esdsData.subarray(dsi.start, dsi.end);
            assert(
              freqIndex < 0 && asc.length >= 2 && (asc[0] >>> 3) === 2 && (asc[1] & 0x7f) === 0x10,
              'Gunakan AAC-LC stereo standar dengan frame 1024-sample.'
            );
            freqIndex = ((asc[0] & 0x07) << 1) | (asc[1] >>> 7);
            const extBits = Array.from(asc.subarray(2), (byte) => byte.toString(2).padStart(8, '0')).join('');
            assert(
              AAC_SAMPLE_RATES[freqIndex] && (!extBits.includes('1') || /^01010110111001010*$/.test(extBits)),
              'Sample rate atau extension AAC tidak didukung untuk Direct Patch.'
            );

            // Alternate AudioSpecificConfig: AAC-LC with channelConfiguration=0 (PCE)
            const freqBits = freqIndex.toString(2).padStart(4, '0');
            const pceBitStr = '00010' + freqBits + '0000000000001' + freqBits + '00000001000000000000000010000';
            const padded = pceBitStr.padEnd(Math.ceil(pceBitStr.length / 8) * 8, '0') + '00000000';
            const altAsc = Uint8Array.from(padded.match(/.{8}/g), (bits) => parseInt(bits, 2));
            dcdChildren.push(encodeDescriptor(5, altAsc));
          }
          q = dsi.end;
        }
        esChildren.push(encodeDescriptor(4, concatU8(esdsData.subarray(child.start, child.start + 13), ...dcdChildren)));
      }
      p = child.end;
    }

    assert(freqIndex >= 0, 'AudioSpecificConfig AAC tidak ditemukan.');
    setNodeData(
      esds,
      concatU8(
        esdsData.subarray(0, 4),
        encodeDescriptor(3, concatU8(esdsData.subarray(esDesc.start, esDesc.start + 3), ...esChildren)),
        esdsData.subarray(esDesc.end)
      )
    );

    const altEntry = makeBox('mp4a', concatU8(origEntry.subarray(8, 36), ...subBoxes.map(serializeNode)));
    return {
      sampleRate: AAC_SAMPLE_RATES[freqIndex],
      dualStsdPayload: concatU8(packU32(0, 2), origEntry, altEntry)
    };
  }

  function validateTableCount(node, entryWidth) {
    assert(node.data.length >= 8 && readU32(node.data, 0) === 0, `Tabel ${node.name} tidak valid.`);
    const count = readU32(node.data, 4);
    assert(node.data.length === 8 + count * entryWidth && count <= 5_000_000, `Jumlah entri ${node.name} tidak valid.`);
    return count;
  }

  function readIntWidth(u8, off, width) {
    return width === 8 ? Number(readU64(u8, off)) : readU32(u8, off);
  }

  function writeIntWidth(node, off, width, value) {
    assert(
      Number.isSafeInteger(value) && value >= 0 && (width === 8 || value < 0xffffffff),
      'Nilai timing atau track ID MP4 di luar jangkauan.'
    );
    const copy = node.data.slice();
    copy.set(width === 8 ? u64Bytes(value) : u32Bytes(value), off);
    setNodeData(node, copy);
  }

  function parseDurationHeader(node) {
    const ver = node.data[0];
    assert(ver === 0 || ver === 1, `Versi header ${node.name} tidak didukung.`);
    const is64 = ver === 1;
    const isTkhd = node.name === 'tkhd';
    const offset = isTkhd ? (is64 ? 28 : 20) : (is64 ? 24 : 16);
    const width = is64 ? 8 : 4;
    return {
      offset,
      width,
      duration: readIntWidth(node.data, offset, width),
      scale: isTkhd ? 0 : readU32(node.data, offset - 4)
    };
  }

  function extendAudioEditList(audioTrak, mediaDuration, audioScale, movieScale, sampleRate, tkhdDuration, movieDelta) {
    const edts = findChild(audioTrak, 'edts');
    if (!edts) {
      assert(Math.abs(tkhdDuration - Math.round((mediaDuration * movieScale) / audioScale)) <= 1, 'Durasi audio tidak konsisten.');
      return movieDelta;
    }
    const elst = requireChild(edts, 'elst');
    const data = elst.data;
    assert(data[0] === 0 || data[0] === 1, 'Versi elst audio tidak didukung.');
    const width = data[0] === 1 ? 8 : 4;
    const entryCount = readU32(data, 4);
    const rowSize = 2 * width + 4;
    assert((entryCount === 1 || entryCount === 2) && data.length === 8 + entryCount * rowSize, 'Struktur edit list (elst) audio tidak didukung.');

    const lastOff = 8 + (entryCount - 1) * rowSize;
    const segDur = readIntWidth(data, lastOff, width);
    const mediaTime = readIntWidth(data, lastOff + width, width);
    assert(Number.isSafeInteger(mediaTime) && readU32(data, lastOff + 2 * width) === 0x00010000, 'Media rate edit list audio tidak didukung.');

    if (entryCount === 2) {
      const leadMediaTime = data.subarray(8 + width, 8 + 2 * width);
      assert(
        leadMediaTime.every((b) => b === 0xff) && readU32(data, 8 + 2 * width) === 0x00010000,
        'Leading edit list audio tidak didukung.'
      );
    }

    const leadingDur = entryCount === 2 ? readIntWidth(data, 8, width) : 0;
    assert(Math.abs(tkhdDuration - segDur - leadingDur) <= 1, 'Durasi elst audio tidak konsisten dengan tkhd.');

    const remainder = (mediaDuration - mediaTime) * movieScale - segDur * audioScale;
    assert(Math.abs(remainder) <= Math.ceil((2048 * audioScale) / sampleRate) * movieScale, 'Edit list audio tidak mencakup akhir track.');

    const adjustedDelta = movieDelta + Math.max(0, Math.ceil(remainder / audioScale));
    writeIntWidth(elst, lastOff, width, segDur + adjustedDelta);
    return adjustedDelta;
  }

  function buildCleanNullsanzUdta(artist = 'Nullsanz Studio 4.0') {
    const mkItem = (fourcc, text) => {
      const payload = concatU8(packU32(1, 0), textEncoder.encode(text));
      return makeBox(fourcc, makeBox('data', payload));
    };
    const ilst = makeBox(
      'ilst',
      concatU8(
        mkItem(new Uint8Array([0xa9, 0x74, 0x6f, 0x6f]), 'Lavf62.3.100'),
        mkItem(new Uint8Array([0xa9, 0x41, 0x52, 0x54]), artist),
        mkItem(new Uint8Array([0xa9, 0x6e, 0x61, 0x6d]), artist),
        mkItem(new Uint8Array([0xa9, 0x63, 0x6d, 0x74]), 'Nullsanz TikTok Studio v4.0 Direct'),
        mkItem(new Uint8Array([0xa9, 0x77, 0x72, 0x74]), artist),
        mkItem(new Uint8Array([0xa9, 0x61, 0x6c, 0x62]), artist),
        mkItem(new Uint8Array([0xa9, 0x67, 0x72, 0x70]), artist)
      )
    );
    const hdlr = makeBox('hdlr', concatU8(packU32(0), new Uint8Array(4), fourccBytes('mdir'), fourccBytes('appl'), new Uint8Array(9)));
    const meta = makeBox('meta', concatU8(packU32(0), hdlr, ilst));
    return makeBox('udta', meta);
  }

  function wrapInput(input) {
    if (typeof Blob !== 'undefined' && input instanceof Blob) {
      return {
        isBlob: true,
        size: input.size,
        async readSlice(start, end) {
          return new Uint8Array(await input.slice(start, end).arrayBuffer());
        },
        rawSlice(start, end) {
          return input.slice(start, end);
        }
      };
    }
    let u8;
    if (input instanceof Uint8Array) u8 = input;
    else if (input instanceof ArrayBuffer) u8 = new Uint8Array(input);
    else if (ArrayBuffer.isView(input)) u8 = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    else assert(false, 'Input harus berupa File, Blob, Uint8Array, atau ArrayBuffer.');

    return {
      isBlob: false,
      size: u8.byteLength,
      async readSlice(start, end) {
        return u8.subarray(start, end);
      },
      rawSlice(start, end) {
        return u8.subarray(start, end);
      }
    };
  }

  function hasReorderedVideoSamples(input) {
    let bytes;
    if (input instanceof Uint8Array) bytes = input;
    else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
    else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    else return false;

    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const readBoxes = (start, end) => {
      const out = [];
      let p = start;
      while (p + 8 <= end) {
        let size = dv.getUint32(p, false);
        let header = 8;
        if (size === 1) {
          if (p + 16 > end) break;
          const hi = dv.getUint32(p + 8, false);
          const lo = dv.getUint32(p + 12, false);
          if (hi !== 0) break;
          size = lo;
          header = 16;
        } else if (size === 0) {
          size = end - p;
        }
        if (size < header || p + size > end) break;
        out.push({
          type: String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]),
          start: p,
          end: p + size,
          header
        });
        p += size;
      }
      return out;
    };
    const child = (b, type) => readBoxes(b.start + b.header, b.end).find((x) => x.type === type);
    const moov = readBoxes(0, bytes.length).find((x) => x.type === 'moov');
    if (!moov) return false;
    for (const trak of readBoxes(moov.start + moov.header, moov.end).filter((x) => x.type === 'trak')) {
      const mdia = child(trak, 'mdia');
      const hdlr = mdia && child(mdia, 'hdlr');
      if (!hdlr || hdlr.start + hdlr.header + 12 > hdlr.end) continue;
      const handler = readFourCC(bytes, hdlr.start + hdlr.header + 8);
      if (handler !== 'vide') continue;
      const minf = child(mdia, 'minf');
      const stbl = minf && child(minf, 'stbl');
      const ctts = stbl && child(stbl, 'ctts');
      if (!ctts) continue;
      const p = ctts.start + ctts.header;
      if (p + 8 > ctts.end) continue;
      const version = bytes[p];
      const count = dv.getUint32(p + 4, false);
      if (count > 1_000_000 || p + 8 + count * 8 > ctts.end) continue;
      for (let i = 0; i < count; i++) {
        const off = p + 8 + i * 8 + 4;
        const val = version === 1 ? dv.getInt32(off, false) : dv.getUint32(off, false);
        if (val !== 0) return true;
      }
    }
    return false;
  }

  async function runDirectPatch(input, opts = {}) {
    const reader = wrapInput(input);
    const topBoxes = [];
    for (let pos = 0; pos < reader.size;) {
      const hdrBytes = await reader.readSlice(pos, Math.min(reader.size, pos + 16));
      const hdr = parseBoxHeader(hdrBytes, reader.size - pos);
      assert(
        topBoxes.length < 10000 && !['moof', 'sidx', 'mfra', 'ssix'].includes(hdr.name),
        'MP4 fragmented atau indexed tidak didukung oleh Direct Patch (gunakan Engine 4.0 Pro).'
      );
      topBoxes.push({ ...hdr, at: pos });
      pos += hdr.size;
    }

    const moovList = topBoxes.filter((b) => b.name === 'moov');
    const mdatList = topBoxes.filter((b) => b.name === 'mdat');
    assert(
      moovList.length === 1 && mdatList.length >= 1 && moovList[0].width === 8 && moovList[0].size <= 32 * 1024 * 1024,
      'Membutuhkan MP4 standar dengan tepat satu box moov (maks. 32 MB).'
    );

    const origMoovInfo = moovList[0];
    const [moov] = parseTree(await reader.readSlice(origMoovInfo.at, origMoovInfo.at + origMoovInfo.size));
    const traks = moov.children.filter((c) => c.name === 'trak');
    const audioTraks = traks.filter((t) => readFourCC(requireChild(requireChild(t, 'mdia'), 'hdlr').data, 8) === 'soun');
    assert(audioTraks.length === 1, 'Engine 4.0 Direct membutuhkan tepat satu track audio AAC-LC stereo.');

    const audioTrak = audioTraks[0];
    const mdia = requireChild(audioTrak, 'mdia');
    const minf = requireChild(mdia, 'minf');
    const drefData = requireChild(requireChild(minf, 'dinf'), 'dref').data;
    const drefChildren = parseTree(drefData.subarray(8));
    assert(
      readU32(drefData, 0) === 0 &&
      readU32(drefData, 4) === drefChildren.length &&
      drefChildren.length > 0 &&
      drefChildren.every((c) => c.name === 'url ' && readU32(c.data, 0) === 1),
      'Referensi audio eksternal (dref) tidak didukung.'
    );

    const stbl = requireChild(minf, 'stbl');
    assert(stbl.children.every((c) => ALLOWED_AUDIO_STBL_BOXES.has(c.name)), 'Tabel sample audio tidak didukung.');

    const stsd = requireChild(stbl, 'stsd');
    const { sampleRate, dualStsdPayload } = buildDualAudioStsd(stsd);

    const stsz = requireChild(stbl, 'stsz');
    assert(stsz.data.length >= 12 && readU32(stsz.data, 0) === 0, 'Tabel ukuran sample audio (stsz) tidak valid.');
    const uniformSize = readU32(stsz.data, 4);
    const origAudioSamples = readU32(stsz.data, 8);
    assert(
      origAudioSamples > 0 && origAudioSamples <= 5_000_000 &&
      stsz.data.length === 12 + (uniformSize ? 0 : 4 * origAudioSamples),
      'Jumlah sample audio tidak valid.'
    );
    const getSampleSize = (idx) => uniformSize || readU32(stsz.data, 12 + 4 * idx);

    const stsc = requireChild(stbl, 'stsc');
    const stscCount = validateTableCount(stsc, 12);
    const offsetBox = findChild(stbl, 'stco') || requireChild(stbl, 'co64');
    assert(!(findChild(stbl, 'stco') && findChild(stbl, 'co64')), 'Duplikat tabel stco & co64 ditemukan.');
    const offsetWidth = offsetBox.name === 'stco' ? 4 : 8;
    const origChunkCount = validateTableCount(offsetBox, offsetWidth);
    assert(stscCount > 0 && origChunkCount > 0, 'Chunk audio tidak ditemukan.');

    const firstChunkOfRun = (i) => readU32(stsc.data, 8 + 12 * i);
    assert(firstChunkOfRun(0) === 1, 'Run chunk audio pertama tidak dimulai dari 1.');
    for (let i = 0; i < stscCount; i++) {
      assert(
        firstChunkOfRun(i) <= origChunkCount &&
        (i === 0 || firstChunkOfRun(i) > firstChunkOfRun(i - 1)) &&
        readU32(stsc.data, 12 + 12 * i) > 0 &&
        readU32(stsc.data, 16 + 12 * i) === 1,
        'Struktur stsc audio tidak valid atau sudah memiliki multi-description.'
      );
    }

    let runIdx = 0;
    let sampleCursor = 0;
    for (let ci = 0; ci < origChunkCount; ci++) {
      if (runIdx + 1 < stscCount && firstChunkOfRun(runIdx + 1) === ci + 1) runIdx++;
      const spc = readU32(stsc.data, 12 + 12 * runIdx);
      assert(sampleCursor + spc <= origAudioSamples, 'Chunk audio melebihi jumlah sample.');
      let chunkBytes = 0;
      for (let k = 0; k < spc; k++) {
        const sz = getSampleSize(sampleCursor++);
        assert(sz > 0, 'Sample AAC kosong ditemukan.');
        chunkBytes += sz;
      }
      const chunkOff = readIntWidth(offsetBox.data, 8 + ci * offsetWidth, offsetWidth);
      assert(
        mdatList.some((m) => chunkOff >= m.at + m.width && chunkOff + chunkBytes <= m.at + m.size),
        'Offset chunk audio menunjuk ke luar mdat.'
      );
    }
    assert(sampleCursor === origAudioSamples, 'Chunk audio tidak mencakup seluruh sample.');

    const stts = requireChild(stbl, 'stts');
    const sttsCount = validateTableCount(stts, 8);
    let totalAudioTicks = 0;
    let totalSttsSamples = 0;
    const sttsEntries = [];
    for (let i = 0; i < sttsCount; i++) {
      const cnt = readU32(stts.data, 8 + 8 * i);
      const delta = readU32(stts.data, 12 + 8 * i);
      assert(cnt > 0 && delta > 0, 'Timing audio (stts) tidak valid.');
      sttsEntries.push([cnt, delta]);
      totalSttsSamples += cnt;
      totalAudioTicks += cnt * delta;
    }
    assert(totalSttsSamples === origAudioSamples && Number.isSafeInteger(totalAudioTicks), 'Timing stts audio tidak cocok dengan jumlah sample.');

    const mdhd = requireChild(mdia, 'mdhd');
    const mvhd = requireChild(moov, 'mvhd');
    const tkhd = requireChild(audioTrak, 'tkhd');
    const mdhdInfo = parseDurationHeader(mdhd);
    const mvhdInfo = parseDurationHeader(mvhd);
    const tkhdInfo = parseDurationHeader(tkhd);

    assert(
      mdhdInfo.scale > 0 && mvhdInfo.scale > 0 && mdhdInfo.duration > 0 &&
      Math.abs(mdhdInfo.duration - totalAudioTicks) <= Math.ceil((2048 * mdhdInfo.scale) / sampleRate) &&
      (tkhd.data[3] & 1) !== 0 && tkhdInfo.duration > 0,
      'Durasi audio atau flag track tidak didukung.'
    );

    // Silent AAC tail: >= 0.35s (~17-18 frames at 48kHz), last 8 frames mapped to alternate sdi=2
    const tailFrames = Math.max(10, Math.ceil((0.35 * sampleRate) / 1024));
    const headTailFrames = tailFrames - 8;

    // Extend optional per-sample tables in audio stbl
    for (const boxNode of stbl.children) {
      const d = boxNode.data;
      if (boxNode.name === 'sbgp') {
        const hdrLen = d[0] === 1 ? 12 : 8;
        assert((d[0] === 0 || d[0] === 1) && d.length >= hdrLen + 4, 'Sample group audio (sbgp) tidak valid.');
        const count = readU32(d, hdrLen);
        assert(d.length === hdrLen + 4 + count * 8, 'Jumlah entri sbgp tidak valid.');
        let covered = 0;
        for (let i = 0; i < count; i++) covered += readU32(d, hdrLen + 4 + i * 8);
        assert(covered <= origAudioSamples, 'sbgp audio melebihi jumlah sample.');
        const addCount = origAudioSamples - covered + tailFrames;
        if (count && readU32(d, d.length - 4) === 0) {
          const lastCntOff = d.length - 8;
          writeIntWidth(boxNode, lastCntOff, 4, readU32(d, lastCntOff) + addCount);
        } else {
          setNodeData(boxNode, concatU8(d.subarray(0, hdrLen), packU32(count + 1), d.subarray(hdrLen + 4), packU32(addCount, 0)));
        }
      } else if (boxNode.name === 'ctts') {
        const count = validateTableCount(boxNode, 8);
        let covered = 0;
        for (let i = 0; i < count; i++) {
          covered += readU32(d, 8 + i * 8);
          assert(readU32(d, 12 + i * 8) === 0, 'Composition offset audio non-zero tidak didukung.');
        }
        assert(covered === origAudioSamples, 'Jumlah entri ctts audio tidak cocok.');
        setNodeData(boxNode, concatU8(packU32(0, count + 1), d.subarray(8), packU32(tailFrames, 0)));
      } else if (boxNode.name === 'stss' || boxNode.name === 'stps') {
        const count = validateTableCount(boxNode, 4);
        let prev = 0;
        for (let i = 0; i < count; i++) {
          const idx = readU32(d, 8 + i * 4);
          assert(idx > prev && idx <= origAudioSamples, 'Sync sample audio tidak valid.');
          prev = idx;
        }
        setNodeData(
          boxNode,
          concatU8(packU32(0, count + tailFrames), d.subarray(8), packU32(...Array.from({ length: tailFrames }, (_, i) => origAudioSamples + i + 1)))
        );
      } else if (boxNode.name === 'sdtp' || boxNode.name === 'stdp') {
        const width = boxNode.name === 'sdtp' ? 1 : 2;
        assert(d.length === 4 + width * origAudioSamples, 'Tabel sdtp/stdp audio tidak valid.');
        setNodeData(boxNode, concatU8(d, new Uint8Array(width * tailFrames)));
      }
    }

    // Extend durations
    const tailMediaTicks = Math.floor((tailFrames * 1024 * mdhdInfo.scale) / sampleRate);
    const tailMovieTicks = Math.round((tailMediaTicks * mvhdInfo.scale) / mdhdInfo.scale);
    assert(tailMovieTicks > 0, 'Timescale movie terlalu kecil untuk silent tail.');
    const tkhdDelta = extendAudioEditList(
      audioTrak,
      totalAudioTicks,
      mdhdInfo.scale,
      mvhdInfo.scale,
      sampleRate,
      tkhdInfo.duration,
      tailMovieTicks
    );
    writeIntWidth(tkhd, tkhdInfo.offset, tkhdInfo.width, tkhdInfo.duration + tkhdDelta);
    writeIntWidth(mdhd, mdhdInfo.offset, mdhdInfo.width, mdhdInfo.duration + tailMediaTicks);

    // Update stts
    for (let i = 0; i < tailFrames; i++) {
      const delta =
        Math.floor(((i + 1) * 1024 * mdhdInfo.scale) / sampleRate) -
        Math.floor((i * 1024 * mdhdInfo.scale) / sampleRate);
      assert(delta > 0 && delta <= 0xffffffff, 'Timescale audio tidak dapat merepresentasikan frame AAC.');
      const last = sttsEntries[sttsEntries.length - 1];
      if (last && last[1] === delta) last[0]++;
      else sttsEntries.push([1, delta]);
    }
    const nextStts = new Uint8Array(8 + sttsEntries.length * 8);
    const sttsDv = new DataView(nextStts.buffer);
    sttsDv.setUint32(4, sttsEntries.length, false);
    sttsEntries.forEach(([cnt, delta], i) => {
      sttsDv.setUint32(8 + i * 8, cnt, false);
      sttsDv.setUint32(12 + i * 8, delta, false);
    });
    setNodeData(stts, nextStts);

    // Update stsz
    const totalSamples = origAudioSamples + tailFrames;
    const nextStsz = new Uint8Array(12 + 4 * totalSamples);
    const stszDv = new DataView(nextStsz.buffer);
    stszDv.setUint32(8, totalSamples, false);
    for (let i = 0; i < totalSamples; i++) {
      stszDv.setUint32(12 + i * 4, i < origAudioSamples ? getSampleSize(i) : SILENT_AAC_FRAME.length, false);
    }
    setNodeData(stsz, nextStsz);

    // Update stco/co64 pointing the 2 silent tail chunks to the newly appended mdat
    const chunk1Off = reader.size + 8;
    const chunk2Off = chunk1Off + headTailFrames * SILENT_AAC_FRAME.length;
    const nextOffWidth = (offsetWidth === 8 || chunk2Off > 0xffffffff) ? 8 : 4;
    const nextOffBuf = new Uint8Array(8 + (origChunkCount + 2) * nextOffWidth);
    const offDv = new DataView(nextOffBuf.buffer);
    offDv.setUint32(4, origChunkCount + 2, false);
    for (let i = 0; i < origChunkCount + 2; i++) {
      const val = i < origChunkCount ? readIntWidth(offsetBox.data, 8 + i * offsetWidth, offsetWidth) : (i === origChunkCount ? chunk1Off : chunk2Off);
      if (nextOffWidth === 8) offDv.setBigUint64(8 + i * 8, BigInt(val), false);
      else offDv.setUint32(8 + i * 4, val, false);
    }
    offsetBox.name = nextOffWidth === 8 ? 'co64' : 'stco';
    setNodeData(offsetBox, nextOffBuf);

    // Build stsc for Track #2 (all sdi=1) -> clone Track #2 -> upgrade Track #1 to dual stsd (last 8 frames sdi=2)
    const origStscBody = stsc.data.subarray(8);
    const buildStscWithTailSdi = (tailSdi) =>
      concatU8(packU32(0, stscCount + 2), origStscBody, packU32(origChunkCount + 1, headTailFrames, 1, origChunkCount + 2, 8, tailSdi));

    setNodeData(stsc, buildStscWithTailSdi(1));
    const clonedAudioTrak = cloneNode(audioTrak);

    // Track #1 gets dual stsd + sdi=2 for the final 8 silent frames
    setNodeData(stsc, buildStscWithTailSdi(2));
    setNodeData(stsd, dualStsdPayload);

    // Assign fresh track ID to cloned audio track & update mvhd.next_track_ID + duration
    const trackIdOff = (tkhdNode) => (tkhdNode.data[0] === 1 ? 20 : 12);
    const existingIds = traks.map((t) => {
      const th = requireChild(t, 'tkhd');
      return readU32(th.data, trackIdOff(th));
    });
    assert(existingIds.every(Boolean) && new Set(existingIds).size === existingIds.length, 'Track ID tidak valid.');
    const newTrackId = existingIds.reduce((a, b) => Math.max(a, b), 0) + 1;
    const clonedTkhd = requireChild(clonedAudioTrak, 'tkhd');
    writeIntWidth(clonedTkhd, trackIdOff(clonedTkhd), 4, newTrackId);

    const nextIdOff = mvhd.data[0] === 1 ? 108 : 96;
    const prevNextId = readU32(mvhd.data, nextIdOff);
    writeIntWidth(mvhd, nextIdOff, 4, Math.max(newTrackId + 1, prevNextId === 0xffffffff ? 0 : prevNextId));

    if (
      mvhdInfo.duration > 0 &&
      Number.isSafeInteger(mvhdInfo.duration) &&
      !(mvhdInfo.width === 4 && mvhdInfo.duration === 0xffffffff)
    ) {
      const maxDur = traks.reduce((best, t) => {
        const d = parseDurationHeader(requireChild(t, 'tkhd'));
        return Number.isSafeInteger(d.duration) && !(d.width === 4 && d.duration === 0xffffffff)
          ? Math.max(best, d.duration)
          : best;
      }, mvhdInfo.duration);
      writeIntWidth(mvhd, mvhdInfo.offset, mvhdInfo.width, maxDur);
    }

    // Insert cloned audio track right after original audio track
    moov.children.splice(moov.children.indexOf(audioTrak) + 1, 0, clonedAudioTrak);

    // Clean Nullsanz udta (zero third-party links/watermarks)
    moov.children = moov.children.filter((c) => c.name !== 'udta');
    moov.children.push({
      name: 'udta',
      raw: buildCleanNullsanzUdta(opts.artist || 'Nullsanz Studio 4.0'),
      data: null,
      children: null
    });

    // Silent tail mdat payload
    const silentPayload = new Uint8Array(tailFrames * SILENT_AAC_FRAME.length);
    for (let i = 0; i < tailFrames; i++) {
      silentPayload.set(SILENT_AAC_FRAME, i * SILENT_AAC_FRAME.length);
    }

    const tailMdatBox = makeBox('mdat', silentPayload);
    const newMoovBox = serializeNode(moov);

    // Assemble output parts: replace old moov header with 'free' (video offsets stay 100% intact)
    const parts = [];
    for (const boxInfo of topBoxes) {
      if (boxInfo === origMoovInfo) {
        parts.push(u32Bytes(boxInfo.size), fourccBytes('free'), reader.rawSlice(boxInfo.at + 8, boxInfo.at + boxInfo.size));
      } else if (boxInfo.zero) {
        assert(boxInfo.size <= 0xffffffff, 'Box size-zero melebihi batas 32-bit.');
        parts.push(u32Bytes(boxInfo.size), reader.rawSlice(boxInfo.at + 4, boxInfo.at + boxInfo.size));
      } else {
        parts.push(reader.rawSlice(boxInfo.at, boxInfo.at + boxInfo.size));
      }
    }
    parts.push(tailMdatBox, newMoovBox);

    const report = {
      engine: 'Nullsanz Direct 4.0 (sl-sr Dual-Audio)',
      sampleRate,
      origAudioSamples,
      tailFrames,
      totalAudioSamples: totalSamples,
      dualStsd: true,
      audioTrackCount: 2,
      clonedTrackId: newTrackId
    };

    if (reader.isBlob) {
      const blob = new Blob(parts, { type: 'video/mp4' });
      return { blob, bytes: null, report };
    }
    const bytes = concatU8(...parts);
    return { bytes, blob: typeof Blob !== 'undefined' ? new Blob([bytes], { type: 'video/mp4' }) : null, report };
  }

  async function patchDirectBlob(input, opts = {}) {
    const res = await runDirectPatch(input, opts);
    if (res.blob) return res.blob;
    return new Blob([res.bytes], { type: 'video/mp4' });
  }

  async function patchDirectBytes(input, opts = {}) {
    const res = await runDirectPatch(input, opts);
    if (res.bytes) return res;
    const buf = await res.blob.arrayBuffer();
    return { bytes: new Uint8Array(buf), blob: res.blob, report: res.report };
  }

  function verifyDirectOutput(originalInput, patchedInput) {
    const orig = originalInput instanceof Uint8Array ? originalInput : new Uint8Array(originalInput);
    const out = patchedInput instanceof Uint8Array ? patchedInput : new Uint8Array(patchedInput);

    // Parse top-level boxes of output
    const outTop = [];
    for (let p = 0; p < out.length;) {
      const hdr = parseBoxHeader(out.subarray(p), out.length - p);
      outTop.push({ ...hdr, at: p });
      p += hdr.size;
    }
    const moovInfo = outTop.find((b) => b.name === 'moov');
    const mdatList = outTop.filter((b) => b.name === 'mdat');
    if (!moovInfo || mdatList.length < 2) {
      return { ok: false, reason: 'Output tidak memiliki moov + tail mdat.' };
    }

    const [moov] = parseTree(out.subarray(moovInfo.at, moovInfo.at + moovInfo.size));
    const traks = moov.children.filter((c) => c.name === 'trak');
    const audioTraks = traks.filter((t) => readFourCC(requireChild(requireChild(t, 'mdia'), 'hdlr').data, 8) === 'soun');
    if (audioTraks.length !== 2) {
      return { ok: false, reason: `Expected 2 audio tracks, got ${audioTraks.length}` };
    }

    const s1Stbl = requireChild(requireChild(requireChild(audioTraks[0], 'mdia'), 'minf'), 'stbl');
    const s2Stbl = requireChild(requireChild(requireChild(audioTraks[1], 'mdia'), 'minf'), 'stbl');
    const s1Stsd = requireChild(s1Stbl, 'stsd');
    const s2Stsd = requireChild(s2Stbl, 'stsd');
    const s1Off = findChild(s1Stbl, 'stco') || findChild(s1Stbl, 'co64');
    const s2Off = findChild(s2Stbl, 'stco') || findChild(s2Stbl, 'co64');

    const s1Entries = readU32(s1Stsd.data, 4);
    const s2Entries = readU32(s2Stsd.data, 4);
    if (s1Entries !== 2 || s2Entries !== 1) {
      return { ok: false, reason: `Dual-stsd tidak valid (track1=${s1Entries}, track2=${s2Entries})` };
    }
    if (!s1Off || !s2Off || s1Off.data.length !== s2Off.data.length) {
      return { ok: false, reason: 'Shared audio chunk offset table mismatch.' };
    }
    for (let i = 0; i < s1Off.data.length; i++) {
      if (s1Off.data[i] !== s2Off.data[i]) {
        return { ok: false, reason: 'Shared audio chunk offsets differ.' };
      }
    }

    // Verify original mdat bytes are 100% untouched inside output
    const origTop = [];
    for (let p = 0; p < orig.length;) {
      const hdr = parseBoxHeader(orig.subarray(p), orig.length - p);
      origTop.push({ ...hdr, at: p });
      p += hdr.size;
    }
    const origMdat = origTop.find((b) => b.name === 'mdat');
    const outFirstMdat = mdatList[0];
    let videoBitstreamByteIdentical = false;
    if (origMdat && outFirstMdat && origMdat.size === outFirstMdat.size && origMdat.at === outFirstMdat.at) {
      videoBitstreamByteIdentical = true;
      const step = 65536;
      for (let off = 0; off < origMdat.size && videoBitstreamByteIdentical; off += step) {
        const end = Math.min(origMdat.size, off + step);
        for (let i = off; i < end; i++) {
          if (orig[origMdat.at + i] !== out[outFirstMdat.at + i]) {
            videoBitstreamByteIdentical = false;
            break;
          }
        }
      }
    }

    return {
      ok: videoBitstreamByteIdentical,
      reason: videoBitstreamByteIdentical ? '' : 'Original mdat bitstream berbeda.',
      tracks: traks.length,
      audioTracks: audioTraks.length,
      dualStsd: true,
      videoBitstreamByteIdentical,
      mdatByteIdentical: videoBitstreamByteIdentical,
      originalAudioTrackPreserved: true,
      clonedAudioTrackAdded: true
    };
  }

  return {
    version: VERSION,
    patchDirect: runDirectPatch,
    patchDirectBlob,
    patchDirectBytes,
    hasReorderedVideoSamples,
    verifyDirectOutput
  };
});
