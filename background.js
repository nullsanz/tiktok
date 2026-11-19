/* Nullsanz TikTok Studio v4.0 Pro — Background Service Worker */
'use strict';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'OPEN_PATCHER') {
    const query = msg.mode ? `?mode=${encodeURIComponent(String(msg.mode))}` : '';
    const url = chrome.runtime.getURL(`patcher.html${query}`);
    chrome.tabs.create({ url }, () => {
      sendResponse({ ok: !chrome.runtime.lastError, url });
    });
    return true;
  }

  if (msg.type === 'OPEN_TIKTOK_STUDIO') {
    const url = 'https://www.tiktok.com/tiktokstudio/upload';
    chrome.tabs.create({ url }, () => {
      sendResponse({ ok: !chrome.runtime.lastError, url });
    });
    return true;
  }
});
