// İzole dünya: altyazıyı çeker, hedef dile çevirtir, videonun üstüne çizer.
(() => {
  const TAG = 'yt-tr-ext';
  const log = (...a) => console.log('[YTR]', ...a);
  const baseLang = (c) => (c || '').split('-')[0].toLowerCase();

  const state = { gen: 0, videoId: null, key: null, rawUrl: null, events: null, sl: null, sentences: [], cues: [], idx: 0, raf: 0, ensureTimer: 0, engine: '' };
  let lastShown = null;
  let settingsLoaded = false, pendingTimedText = null;
  let settings = { enabled: true, showOriginal: false, size: 100, target: 'tr' };

  const applySettings = () => {
    if (!settings.enabled) deactivate();
    else if (state.cues.length) activate();
    else if (state.events && state.sl) process(); // kapalıyken yüklenen altyazıyı yeniden açılınca işle
    if (YTR.refreshUI) YTR.refreshUI();
  };

  // Ayarlar yüklenene kadar çeviri başlamaz
  chrome.storage.sync.get(settings, (s) => {
    settings = { ...settings, ...s };
    settingsLoaded = true;
    applySettings();
    if (pendingTimedText) {
      const { url, body } = pendingTimedText;
      pendingTimedText = null;
      onTimedText(url, body);
    }
  });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local') {
      if (ch.lastEngine || ch.lastError) YTR.setStatus && YTR.setStatus(ch.lastEngine ? ch.lastEngine.newValue : null, ch.lastError ? ch.lastError.newValue : '');
      return;
    }
    let targetChanged = false;
    for (const k in ch) {
      if (k === 'target' && ch[k].newValue !== settings.target) targetChanged = true;
      settings[k] = ch[k].newValue;
    }
    if (targetChanged) onTargetChanged();
    else applySettings();
  });
  chrome.storage.local.get({ lastEngine: '', lastError: '' }, (s) => YTR.setStatus && YTR.setStatus(s.lastEngine, s.lastError));

  // ---- Altyazı adresi yakalama ----
  YTR.initUI(() => settings, (k, v) => chrome.storage.sync.set({ [k]: v }));

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== TAG) return;
    if (e.data.type === 'timedtext') {
      if (!settingsLoaded) { pendingTimedText = { url: e.data.url, body: e.data.body }; return; }
      onTimedText(e.data.url, e.data.body);
    }
  });

  function onTimedText(rawUrl, body) {
    let u;
    try { u = new URL(rawUrl); } catch (_) { return; }
    const v = u.searchParams.get('v');
    const lang = u.searchParams.get('lang') || 'auto';
    const tlang = u.searchParams.get('tlang');
    if (!v) return;

    state.rawUrl = rawUrl;
    const target = settings.target || 'tr';
    const targetBase = baseLang(target);
    const srcBase = baseLang(lang);
    const tlangBase = tlang ? baseLang(tlang) : null;

    // Kaynak dil veya YouTube'un kendi tlang çevirisi hedefe eşitse karışma
    if ((!tlang && srcBase === targetBase) || (tlang && (tlang === target || tlangBase === targetBase))) {
      clearTimeout(state.ensureTimer);
      state.videoId = v; state.sl = lang;
      // Yalnızca gerçek kaynak altyazıyı önbelleğe al (tlang gövdesi zaten çevrilmiştir)
      if (body && !tlang) { try { state.events = JSON.parse(body).events; } catch (_) {} }
      resetFor(v, null);
      state.skip = v;
      return;
    }

    u.searchParams.delete('tlang');
    u.searchParams.set('fmt', 'json3');
    const key = v + '|' + lang + '|' + (u.searchParams.get('kind') || '');
    if (key === state.key) return;
    clearTimeout(state.ensureTimer);
    resetFor(v, key);
    load(u.toString(), lang, tlang ? null : body);
  }

  function resetFor(videoId, key) {
    state.gen++; state.videoId = videoId; state.key = key; state.sentences = []; state.cues = []; state.idx = 0;
    deactivate();
  }

  async function load(url, sl, body) {
    const curGen = ++state.gen;
    try {
      let txt = body;
      if (!txt) { const r = await fetch(url, { credentials: 'include' }); txt = await r.text(); }
      if (curGen !== state.gen) return;
      if (!txt) { log('altyazı boş döndü'); return; }
      const json = JSON.parse(txt);
      state.events = json.events; state.sl = sl;
      process();
    } catch (err) {
      log('altyazı yüklenemedi', err);
    }
  }

  // Ham olaylardan cümle ve çeviri akışını başlatır
  function process() {
    const curGen = ++state.gen;
    if (!state.events || !state.sl || !settings.enabled) return;
    const target = settings.target || 'tr';
    const targetBase = baseLang(target);
    const srcBase = baseLang(state.sl);

    // Kaynak dil tabanı hedef dil tabanına eşitse katmanı kapat
    if (srcBase === targetBase) {
      deactivate();
      if (YTR.refreshUI) YTR.refreshUI();
      return;
    }

    const sentences = YTR.buildSentences(state.events, state.sl);
    state.sentences = sentences;
    rebuild();
    log(sentences.length, 'cümle,', state.cues.length, 'parça, dil:', state.sl, '->', target);
    activate();
    translateAll(sentences, state.sl, curGen, target);
  }

  function onTargetChanged() {
    if (YTR.refreshUI) YTR.refreshUI();
    if (!settings.enabled) return;
    if (state.events && state.sl) process();
    else if (state.rawUrl) load(state.rawUrl, state.sl || 'auto', null);
  }

  // ---- Çeviri ve Zamanlama ----
  function rebuild() {
    const isCjk = YTR.isCjk ? YTR.isCjk(settings.target) : /^(zh|ja|ko|th)/.test(settings.target);
    state.cues = YTR.toCues(state.sentences, isCjk ? 30 : 70);
    state.idx = 0;
  }

  async function translateAll(sentences, sl, gen, target) {
    const chunks = [];
    let cur = [], len = 0;
    for (const c of sentences) {
      if (cur.length >= 40 || len + c.text.length > 3000) { chunks.push(cur); cur = []; len = 0; }
      cur.push(c); len += c.text.length + 1;
    }
    if (cur.length) chunks.push(cur);
    chunks.forEach((c) => { c.s = c[0].s; c.e = c[c.length - 1].e; c.done = false; });

    // Oynatma konumuna en yakın, henüz çevrilmemiş bölümü seç
    const pickNext = () => {
      const video = document.querySelector('#movie_player video');
      const t = video ? video.currentTime * 1000 : 0;
      let best = null, bestD = Infinity;
      for (const c of chunks) {
        if (c.done) continue;
        const d = t < c.s ? c.s - t : t > c.e ? t - c.e : 0;
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) best.done = true;
      return best;
    };

    const worker = async () => {
      let chunk;
      while (gen === state.gen && (chunk = pickNext())) {
        const res = await chrome.runtime.sendMessage({ type: 'translate', lines: chunk.map((c) => c.text), sl, tl: target });
        if (gen !== state.gen) return;
        if (res && res.ok) {
          if (res.engine && res.engine !== state.engine) { state.engine = res.engine; log('çeviri motoru:', res.engine); }
          chunk.forEach((c, i) => { c.tr = (res.res[i] || '').trim() || c.text; });
          rebuild();
        } else {
          log('çeviri hatası', res && res.error);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (gen === state.gen) log('çeviri tamamlandı');
  }

  function overlay() {
    const player = document.getElementById('movie_player');
    if (!player) return null;
    let el = document.getElementById('ytr-overlay');
    if (!el) { el = document.createElement('div'); el.id = 'ytr-overlay'; }
    const rtl = YTR.isRtl ? YTR.isRtl(settings.target) : /^(ar|he|fa|ur)/.test(settings.target);
    el.dir = rtl ? 'rtl' : 'ltr';
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

    const rtl = YTR.isRtl ? YTR.isRtl(settings.target) : /^(ar|he|fa|ur)/.test(settings.target);
    const targetDir = rtl ? 'rtl' : 'ltr';
    if (el.dir !== targetDir) el.dir = targetDir;

    const fs = Math.max(13, Math.round(el.parentElement.clientWidth * 0.023 * (settings.size / 100)));
    if (el.dataset.fs !== String(fs)) { el.dataset.fs = fs; el.style.fontSize = fs + 'px'; }
    const t = video.currentTime * 1000;
    const cues = state.cues;
    if (state.idx >= cues.length || (cues[state.idx] && cues[state.idx].s > t + 5000)) state.idx = 0;
    while (state.idx + 1 < cues.length && cues[state.idx + 1].s <= t) state.idx++;
    let cue = cues[state.idx];
    if (cue && !(cue.s <= t && t < cue.e)) cue = null;
    const sig = cue ? cue.s + '|' + (cue.tr ? cue.tr.length : 0) + '|' + settings.showOriginal + '|' + settings.size + '|' + settings.target : null;
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
    if (v && v === state.videoId && state.key) return;
    if (v !== state.videoId) {
      state.events = null; state.sl = null; state.rawUrl = null; state.skip = null;
      resetFor(v, null);
    }
    clearTimeout(state.ensureTimer);
    let tries = 0;
    const ensure = () => {
      if (state.key || state.skip === v || location.pathname !== '/watch' || !settings.enabled || tries >= 5) return;
      tries++;
      window.postMessage({ source: TAG + '-cmd', type: 'ensureCaptions' }, '*');
      state.ensureTimer = setTimeout(ensure, 2500);
    };
    state.ensureTimer = setTimeout(ensure, 2500);
  }
  document.addEventListener('yt-navigate-finish', onNavigate);
  if (document.readyState !== 'loading') onNavigate();
  else document.addEventListener('DOMContentLoaded', onNavigate);
})();
