'use strict';

/*
 * Nullsanz Studio v4.1 — Inline Offline FFmpeg Bridge (MV3 CSP Compliant)
 * Hosted inside chrome-extension:// origin via web_accessible_resources iframe.
 * Spawns local ./ffmpeg-worker.js (zero CDN, zero eval) and relays jobs via postMessage.
 */
(function () {
  const CHANNEL = 'nullsanz-ffmpeg-bridge';
  let worker = null;
  let activeJob = null;
  const queue = [];
  let trustedParentOrigin = null;

  function isAllowedOrigin(origin) {
    if (!origin) return false;
    if (origin === location.origin) return true;
    return /^https:\/\/([a-z0-9-]+\.)*tiktok\.com$/i.test(origin);
  }

  function postToParent(payload, transfer) {
    const target = window.parent || window.top;
    if (!target || target === window) return;
    const origin = trustedParentOrigin || '*';
    if (transfer && transfer.length) {
      target.postMessage({ channel: CHANNEL, ...payload }, origin, transfer);
    } else {
      target.postMessage({ channel: CHANNEL, ...payload }, origin);
    }
  }

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker('ffmpeg-worker.js');
    worker.onmessage = (ev) => {
      const msg = ev.data || {};
      if (!activeJob) return;
      const { requestId } = activeJob;

      if (msg.type === 'progress') {
        postToParent({
          type: 'PROGRESS',
          requestId,
          value: msg.value,
          text: msg.text || ''
        });
        return;
      }

      if (msg.type === 'ready') {
        postToParent({ type: 'READY', requestId });
        finishCurrentJob();
        return;
      }

      if (msg.type === 'done') {
        const transfer = msg.buffer instanceof ArrayBuffer ? [msg.buffer] : [];
        postToParent(
          {
            type: 'DONE',
            requestId,
            buffer: msg.buffer,
            outputExt: msg.outputExt || 'mp4',
            mode: msg.mode || activeJob.action
          },
          transfer
        );
        finishCurrentJob();
        return;
      }

      if (msg.type === 'error') {
        postToParent({
          type: 'ERROR',
          requestId,
          message: msg.message || 'FFmpeg worker gagal memproses video.'
        });
        finishCurrentJob();
      }
    };

    worker.onerror = (err) => {
      const msg = err?.message || 'FFmpeg worker crash.';
      if (activeJob) {
        postToParent({
          type: 'ERROR',
          requestId: activeJob.requestId,
          message: msg
        });
      }
      if (worker) {
        try {
          worker.terminate();
        } catch (_) {}
        worker = null;
      }
      finishCurrentJob();
    };
    return worker;
  }

  function finishCurrentJob() {
    activeJob = null;
    pumpQueue();
  }

  function pumpQueue() {
    if (activeJob || queue.length === 0) return;
    const next = queue.shift();
    activeJob = next;
    try {
      const w = ensureWorker();
      if (next.action === 'PREWARM') {
        w.postMessage({ type: 'PREWARM' });
      } else {
        const transfer = next.buffer instanceof ArrayBuffer ? [next.buffer] : [];
        w.postMessage(
          {
            type: next.action,
            inputExt: next.inputExt || 'mp4',
            buffer: next.buffer,
            ffmpegArgs: next.ffmpegArgs || []
          },
          transfer
        );
      }
    } catch (err) {
      postToParent({
        type: 'ERROR',
        requestId: next.requestId,
        message: err?.message || String(err)
      });
      finishCurrentJob();
    }
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window.parent) return;
    if (!isAllowedOrigin(ev.origin)) return;
    const data = ev.data || {};
    if (data.channel !== CHANNEL) return;

    trustedParentOrigin = ev.origin;
    const action = String(data.action || '').toUpperCase();
    const requestId = data.requestId || 'job';

    if (!['PREWARM', 'PRO_ENCODE', 'REMUX_COPY', 'COMPAT_NORMALIZE'].includes(action)) {
      postToParent({
        type: 'ERROR',
        requestId,
        message: `Aksi bridge tidak dikenal: ${action}`
      });
      return;
    }

    if (action !== 'PREWARM' && !(data.buffer instanceof ArrayBuffer)) {
      postToParent({
        type: 'ERROR',
        requestId,
        message: 'Buffer video tidak valid untuk FFmpeg bridge.'
      });
      return;
    }

    queue.push({
      action,
      requestId,
      buffer: data.buffer || null,
      inputExt: data.inputExt || 'mp4',
      ffmpegArgs: Array.isArray(data.ffmpegArgs) ? data.ffmpegArgs : []
    });
    pumpQueue();
  });

  postToParent({ type: 'BRIDGE_READY' });
})();
