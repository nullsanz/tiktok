(() => {
  const CAPTION = '#fyp #viral #foryou #trending';
  const storage = chrome.storage?.local;
  const $ = (id) => document.getElementById(id);
  const setSwitch = (el, on) => { if (!el) return; el.classList.toggle('is-on', !!on); el.setAttribute('aria-pressed', String(!!on)); };

  async function load() {
    const s = storage ? await storage.get({ nullsanzMotion: true }) : { nullsanzMotion: true };
    setSwitch($('motionToggle'), s.nullsanzMotion !== false);
    document.documentElement.dataset.motion = s.nullsanzMotion === false ? 'off' : 'on';
  }

  $('motionToggle')?.addEventListener('click', async () => {
    const on = !$('motionToggle').classList.contains('is-on');
    setSwitch($('motionToggle'), on);
    document.documentElement.dataset.motion = on ? 'on' : 'off';
    if (storage) await storage.set({ nullsanzMotion: on });
  });

  $('openTikTokBtn')?.addEventListener('click', () => {
    const url = 'https://www.tiktok.com/';
    try { chrome.tabs.create({ url }); } catch { window.open(url, '_blank', 'noopener,noreferrer'); }
  });

  $('copyCaptionBtn')?.addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(CAPTION);
      const btn = e.currentTarget;
      const note = btn.querySelector('.quick-note');
      const old = note?.textContent;
      if (note) note.textContent = 'Copied ✓';
      setTimeout(() => { if (note) note.textContent = old || CAPTION; }, 1100);
    } catch {}
  });

  $('resetUiBtn')?.addEventListener('click', async () => {
    if (storage) await storage.set({ wanxzyyMotion: true });
    setSwitch($('motionToggle'), true);
    document.documentElement.dataset.motion = 'on';
  });

  // Mirror the existing uploader toggle into the hero status pill.
  const syncHero = () => {
    const active = $('uploaderToggle')?.classList.contains('is-on');
    const hero = $('heroStatus');
    if (hero) hero.textContent = active ? 'ACTIVE' : 'OFF';
    const dot = document.querySelector('.status-pill .dot');
    if (dot) { dot.style.background = active ? 'var(--green)' : '#81758f'; dot.style.boxShadow = active ? '0 0 12px rgba(85,227,154,.8)' : 'none'; }
  };
  $('uploaderToggle')?.addEventListener('click', () => setTimeout(syncHero, 0));
  load().then(syncHero).catch(syncHero);
})();
