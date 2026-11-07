// İzole dünya: altyazıyı çeker, Türkçeye çevirtir, videonun üstüne çizer.
(() => {
  const TAG = 'yt-tr-ext';
  const TARGET = 'tr';
  const log = (...a) => console.log('[YT-TR]', ...a);

  const state = { key: null, videoId: null, sentences: [], cues: [], idx: 0, raf: 0, ensureTimer: 0 };
  const MAXCH = 70;
  let lastShown = null;
  let settings = { enabled: true, showOriginal: false, size: 100 };
  const applySettings = () => {
    if (!settings.enabled) deactivate();
    else if (state.cues.length) activate();
    if (YTR.refreshUI) YTR.refreshUI();
  };
  chrome.storage.sync.get(settings, (s) => { settings = { ...settings, ...s }; applySettings(); });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local') { if (ch.lastEngine || ch.lastError) YTR.setStatus && YTR.setStatus(ch.lastEngine ? ch.lastEngine.newValue : null, ch.lastError ? ch.lastError.newValue : ''); return; }
    for (const k in ch) settings[k] = ch[k].newValue;
    applySettings();
  });
  chrome.storage.local.get({ lastEngine: '', lastError: '' }, (s) => YTR.setStatus && YTR.setStatus(s.lastEngine, s.lastError));

  // ---- Altyazı adresi yakalama ----
  YTR.initUI(() => settings, (k, v) => chrome.storage.sync.set({ [k]: v }));

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== TAG) return;
    if (e.data.type === 'timedtext') onTimedText(e.data.url, e.data.body);
  });

  function onTimedText(rawUrl, body) {
    let u;
    try { u = new URL(rawUrl); } catch (_) { return; }
    const v = u.searchParams.get('v');
    const lang = (u.searchParams.get('lang') || 'auto').split('-')[0];
    const tlang = u.searchParams.get('tlang');
    if (!v) return;
    // Zaten Türkçe (orijinal ya da YouTube'un kendi çevirisi) ise karışma
    if (!tlang && lang === TARGET) { clearTimeout(state.ensureTimer); resetFor(v, null); return; }
    if (tlang === TARGET) { clearTimeout(state.ensureTimer); resetFor(v, null); return; }
    u.searchParams.delete('tlang');
    u.searchParams.set('fmt', 'json3');
    const key = v + '|' + lang + '|' + (u.searchParams.get('kind') || '');
    if (key === state.key) return;
    clearTimeout(state.ensureTimer);
    resetFor(v, key);
    load(u.toString(), lang, key, tlang ? null : body);
  }

  function resetFor(videoId, key) {
    state.videoId = videoId; state.key = key; state.sentences = []; state.cues = []; state.idx = 0;
    deactivate();
  }

  async function load(url, sl, key, body) {
    try {
      let txt = body;
      if (!txt) { const r = await fetch(url, { credentials: 'include' }); txt = await r.text(); }
      if (!txt) { log('altyazı boş döndü'); return; }
      const json = JSON.parse(txt);
      const sentences = YTR.buildSentences(json.events, sl);
      if (key !== state.key) return;
      state.sentences = sentences;
      rebuild();
      log(sentences.length, 'cümle,', state.cues.length, 'parça, dil:', sl);
      activate();
      translateAll(sentences, sl, key);
    } catch (err) {
      log('altyazı yüklenemedi', err);
    }
  }

  // ---- Çeviri ----
  function rebuild() {
    state.cues = YTR.toCues(state.sentences, MAXCH);
    state.idx = 0;
  }

  async function translateAll(sentences, sl, key) {
    const chunks = [];
    let cur = [], len = 0;
    for (const c of sentences) {
      if (cur.length >= 40 || len + c.text.length > 3000) { chunks.push(cur); cur = []; len = 0; }
      cur.push(c); len += c.text.length + 1;
    }
    if (cur.length) chunks.push(cur);
    let next = 0;
    const worker = async () => {
      while (next < chunks.length && key === state.key) {
        const chunk = chunks[next++];
        const res = await chrome.runtime.sendMessage({ type: 'translate', lines: chunk.map((c) => c.text), sl, tl: TARGET });
        if (key !== state.key) return;
        if (res && res.ok) { if (res.engine && res.engine !== state.engine) { state.engine = res.engine; log('çeviri motoru:', res.engine); } chunk.forEach((c, i) => { c.tr = (res.res[i] || '').trim() || c.text; }); rebuild(); }
        else log('çeviri hatası', res && res.error);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    log('çeviri tamamlandı');
  }

  function overlay() {
    const player = document.getElementById('movie_player');
    if (!player) return null;
    let el = document.getElementById('ytr-overlay');
    if (!el) { el = document.createElement('div'); el.id = 'ytr-overlay'; }
    if (el.parentElement !== player) player.appendChild(el);
    return el;
  }

  function activate() {
    if (!settings.enabled || !state.cues.length) return;
    document.documentElement.classList.add('ytr-active');
    if (!state.raf) state.raf = requestAnimationFrame(tick);
  }
  function deactivate() {
    document.documentElement.classList.remove('ytr-active');
    cancelAnimationFrame(state.raf); state.raf = 0;
    const el = document.getElementById('ytr-overlay');
    if (el) el.replaceChildren();
    lastShown = null;
  }

  function tick() {
    state.raf = requestAnimationFrame(tick);
    const video = document.querySelector('#movie_player video');
    const el = overlay();
    if (!video || !el) return;
    const fs = Math.max(13, Math.round(el.parentElement.clientWidth * 0.023 * (settings.size / 100)));
    if (el.dataset.fs !== String(fs)) { el.dataset.fs = fs; el.style.fontSize = fs + 'px'; }
    const t = video.currentTime * 1000;
    const cues = state.cues;
    // Geri sarma / ileri atlama için dizini düzelt
    if (state.idx >= cues.length || (cues[state.idx] && cues[state.idx].s > t + 5000)) state.idx = 0;
    while (state.idx + 1 < cues.length && cues[state.idx + 1].s <= t) state.idx++;
    let cue = cues[state.idx];
    if (cue && !(cue.s <= t && t < cue.e)) cue = null;
    const sig = cue ? cue.s + '|' + (cue.tr ? cue.tr.length : 0) + '|' + settings.showOriginal + '|' + settings.size : null;
    if (sig === lastShown) return;
    lastShown = sig;
    el.replaceChildren();
    if (!cue) return;
    const line = document.createElement('div');
    line.className = 'ytr-line' + (cue.tr ? '' : ' ytr-pending');
    line.textContent = cue.tr || cue.t;
    el.appendChild(line);
    if (settings.showOriginal && cue.tr) {
      const o = document.createElement('div');
      o.className = 'ytr-line ytr-orig';
      o.textContent = cue.t;
      el.appendChild(o);
    }
  }

  // ---- Video değişimi (YouTube SPA) ve altyazıyı açtırma ----
  function onNavigate() {
    const v = new URLSearchParams(location.search).get('v');
    // Aynı videonun altyazısı zaten alındıysa dokunma (olay altyazıdan sonra gelebilir)
    if (v && v === state.videoId && state.key) return;
    if (v !== state.videoId) resetFor(v, null);
    clearTimeout(state.ensureTimer);
    // Oynatıcı kendiliğinden altyazı isteği yapmazsa (CC kapalı) açtır
    state.ensureTimer = setTimeout(() => {
      if (!state.key && location.pathname === '/watch' && settings.enabled)
        window.postMessage({ source: TAG + '-cmd', type: 'ensureCaptions' }, '*');
    }, 3500);
  }
  document.addEventListener('yt-navigate-finish', onNavigate);
  if (document.readyState !== 'loading') onNavigate();
  else document.addEventListener('DOMContentLoaded', onNavigate);
})();
