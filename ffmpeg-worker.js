/*
 * Nullsanz TikTok Studio v4.0 Pro — Offline FFmpeg WASM Worker
 * 100% Local • Zero eval() • Zero CDN dependency • MV3 CSP Compliant
 */
'use strict';

let core = null;
let busy = false;

function send(type, payload = {}, transfer = []) {
  self.postMessage({ type, ...payload }, transfer);
}

async function loadLocalWasmBytes() {
  const wasmGzUrl = new URL('ffmpeg-core.wasm.gz', self.location.href).href;
  const response = await fetch(wasmGzUrl);
  if (!response.ok) {
    throw new Error(`Gagal memuat binary WASM lokal (HTTP ${response.status}).`);
  }
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Browser tidak mendukung DecompressionStream untuk dekompresi WASM lokal.');
  }
  const decompressedStream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return await new Response(decompressedStream).arrayBuffer();
}

async function ensureCore() {
  if (core) return core;

  send('progress', { value: 6, text: 'Memuat FFmpeg Core lokal…' });
  if (typeof createFFmpegCore !== 'function') {
    importScripts('./ffmpeg-core.js');
  }
  if (typeof createFFmpegCore !== 'function') {
    throw new Error('FFmpeg Core lokal gagal diinisialisasi (createFFmpegCore tidak ditemukan).');
  }

  send('progress', { value: 10, text: 'Menyiapkan FFmpeg WASM lokal (100% offline)…' });
  const wasmBytes = await loadLocalWasmBytes();

  core = await createFFmpegCore({ wasmBinary: wasmBytes });
  if (core.ready) await core.ready;

  send('progress', { value: 14, text: 'FFmpeg WASM Pro siap.' });
  return core;
}

function safeUnlink(ff, filePath) {
  try {
    ff.FS.unlink(filePath);
  } catch (_) {}
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  if (msg.type === 'PREWARM') {
    if (busy) return;
    busy = true;
    try {
      await ensureCore();
      send('ready', { ok: true });
    } catch (e) {
      send('error', { message: e?.message || String(e) });
    } finally {
      busy = false;
    }
    return;
  }

  if (!['PRO_ENCODE', 'REMUX_COPY', 'COMPAT_NORMALIZE'].includes(msg.type) || busy) {
    return;
  }

  busy = true;
  let inputFile = '';
  let outputFile = '';
  let ff = null;

  try {
    ff = await ensureCore();
    const ext = String(msg.inputExt || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    inputFile = 'input.' + ext;
    ff.FS.writeFile(inputFile, new Uint8Array(msg.buffer));

    let args = [];
    let isMov = false;

    if (msg.type === 'REMUX_COPY') {
      isMov = ext === 'mov';
      outputFile = isMov ? 'remux.mov' : 'remux.mp4';
      args = [
        '-i', inputFile,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        '-y', outputFile
      ];
      send('progress', { value: 18, text: 'FFmpeg Copy Remux: menyusun container FastStart…' });
    } else if (msg.type === 'PRO_ENCODE') {
      outputFile = 'nullsanz_pro_output.mp4';
      args = (msg.ffmpegArgs || []).map((v) =>
        v === '__INPUT__' ? inputFile : (v === '__OUTPUT__' ? outputFile : v)
      );
      if (!args.length) {
        throw new Error('Argumen FFmpeg Nullsanz Pro tidak tersedia.');
      }
      send('progress', { value: 18, text: 'Nullsanz 4.0 Pro • Encoding H.264/AAC…' });
    } else {
      outputFile = 'normalized.mp4';
      args = [
        '-i', inputFile,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-ac', '2',
        '-movflags', '+faststart',
        '-y', outputFile
      ];
      send('progress', { value: 18, text: 'FFmpeg compatibility encode H.264/AAC…' });
    }

    const tailLogs = [];
    ff.setLogger((entry) => {
      const line = String(entry?.message || '').trim();
      if (!line) return;
      tailLogs.push(line);
      if (tailLogs.length > 25) tailLogs.shift();
    });

    ff.setProgress((p) => {
      const ratio = Math.max(0, Math.min(1, Number(p?.progress) || 0));
      const pct = 18 + Math.round(ratio * 66);
      const label = msg.type === 'REMUX_COPY'
        ? `Merapikan container… (${Math.round(ratio * 100)}%)`
        : `Encoding H.264/AAC lokal… (${Math.round(ratio * 100)}%)`;
      send('progress', { value: pct, text: label });
    });

    const exitCode = ff.exec(...args);
    if (exitCode !== 0) {
      const detail = tailLogs.slice(-4).join(' | ');
      throw new Error(`FFmpeg gagal (exit ${exitCode})${detail ? ': ' + detail : ''}`);
    }

    const outU8 = ff.FS.readFile(outputFile);
    const outBuffer = outU8.buffer.slice(outU8.byteOffset, outU8.byteOffset + outU8.byteLength);

    send('progress', { value: 86, text: 'Output FFmpeg siap — melanjutkan finalisasi container…' });
    send('done', {
      buffer: outBuffer,
      outputExt: isMov ? 'mov' : 'mp4',
      mode: msg.type
    }, [outBuffer]);
  } catch (e) {
    send('error', { message: e?.message || String(e) });
  } finally {
    if (ff) {
      if (inputFile) safeUnlink(ff, inputFile);
      if (outputFile) safeUnlink(ff, outputFile);
    }
    busy = false;
  }
};
