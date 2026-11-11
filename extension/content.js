// İzole dünya: altyazıyı çeker, hedef dile çevirtir, videonun üstüne çizer.
(() => {
  const TAG = 'yt-tr-ext';
  const log = (...a) => console.log('[YTR]', ...a);
  const baseLang = (c) => (c || '').split('-')[0].toLowerCase();

  const state = { gen: 0, videoId: null, key: null, rawUrl: null, events: null, sl: null, sentences: [], cues: [], idx: 0, raf: 0, ensureTimer: 0, engine: '', progress: null };
  let lastShown = null;
  let settingsLoaded = false, pendingTimedText = null;
  let settings = { enabled: true, showOriginal: false, size: 100, bgOpacity: 78, textColor: 'white', origPosition: 'below', target: YTR.defaultTarget(), waitForTranslation: false };
  let scheduler = null;
  const waitCtrl = YTR.createWaitController ? YTR.createWaitController({
    getVideo: () => document.querySelector('#movie_player video'),
    isEnabled: () => !!settings.waitForTranslation,
    getProgress: () => state.progress,
  }) : null;

  const getVideoTitle = () => {
    const n = document.querySelector('#movie_player .ytp-title-link, h1.ytd-watch-metadata yt-formatted-string');
    return (n && n.textContent && n.textContent.trim()) || document.title.replace(/\s*-\s*YouTube\s*$/i, '').trim() || state.videoId || 'video';
  };
  YTR.getTranscript = () => ({ sentences: state.sentences, sl: state.sl, title: getVideoTitle() });
  YTR.retryFailed = () => { if (scheduler) scheduler.retryFailed(); };

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
    const target = settings.target || YTR.defaultTarget();
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
      if (YTR.setNote) YTR.setNote(tlang ? 'noteYtAuto' : 'noteSameLang');
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
    if (YTR.setNote) YTR.setNote(null);
    if (scheduler) { scheduler.stop(); scheduler = null; }
    if (waitCtrl) waitCtrl.reset();
    state.gen++; state.videoId = videoId; state.key = key; state.sentences = []; state.cues = []; state.idx = 0; state.progress = null;
    if (YTR.setProgress) YTR.setProgress(null);
    if (YTR.onTranscriptUpdate) YTR.onTranscriptUpdate();
    if (YTR.refreshUI) YTR.refreshUI();
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
    if (scheduler) { scheduler.stop(); scheduler = null; }
    if (waitCtrl) waitCtrl.reset();
    if (!state.events || !state.sl || !settings.enabled) return;
    const target = settings.target || YTR.defaultTarget();
    const targetBase = baseLang(target);
    const srcBase = baseLang(state.sl);

    // Kaynak dil tabanı hedef dil tabanına eşitse katmanı kapat
    if (srcBase === targetBase) {
      if (YTR.setNote) YTR.setNote('noteSameLang');
      deactivate();
      if (YTR.refreshUI) YTR.refreshUI();
      return;
    }

    if (YTR.setNote) YTR.setNote(null);
    const sentences = YTR.buildSentences(state.events, state.sl);
    state.sentences = sentences;
    rebuild();
    log(sentences.length, 'cümle,', state.cues.length, 'parça, dil:', state.sl, '->', target);
    activate();
    if (YTR.onTranscriptUpdate) YTR.onTranscriptUpdate();
    if (YTR.refreshUI) YTR.refreshUI();

    if (YTR.createScheduler) {
      scheduler = YTR.createScheduler({
        sentences, sl: state.sl, target, gen: curGen,
        getGen: () => state.gen,
        getPlayheadMs: () => { const v = document.querySelector('#movie_player video'); return v ? v.currentTime * 1000 : 0; },
        send: async (lines) => {
          try { return await chrome.runtime.sendMessage({ type: 'translate', lines, sl: state.sl, tl: target }); }
          catch (err) { return { ok: false, error: String(err && err.message ? err.message : err) }; }
        },
        onChunkDone: (_chunk, res) => {
          if (res && res.engine && res.engine !== state.engine) { state.engine = res.engine; log('çeviri motoru:', res.engine); }
          rebuild();
          if (waitCtrl) waitCtrl.onChunkDone();
          if (YTR.onTranscriptUpdate) YTR.onTranscriptUpdate();
        },
        onProgress: (p) => { state.progress = p; if (YTR.setProgress) YTR.setProgress(p); },
      });
    }
  }

  function onTargetChanged() {
    if (scheduler) { scheduler.stop(); scheduler = null; }
    if (waitCtrl) waitCtrl.reset();
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
    if (waitCtrl) waitCtrl.reset();
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

    const app = YTR.normalizeAppearance ? YTR.normalizeAppearance(settings) : { size: settings.size || 100, bgAlpha: 0.78, colorCss: '#ffffff', origPosition: 'below' };
    const fs = Math.max(13, Math.round(el.parentElement.clientWidth * 0.023 * (app.size / 100)));
    if (el.dataset.fs !== String(fs)) { el.dataset.fs = fs; el.style.fontSize = fs + 'px'; }
    el.style.setProperty('--ytr-bg-alpha', String(app.bgAlpha));
    el.style.setProperty('--ytr-color', app.colorCss);
    const t = video.currentTime * 1000;
    const cues = state.cues;
    if (state.idx >= cues.length || (cues[state.idx] && cues[state.idx].s > t + 5000)) state.idx = 0;
    while (state.idx + 1 < cues.length && cues[state.idx + 1].s <= t) state.idx++;
    let cue = cues[state.idx];
    if (cue && !(cue.s <= t && t < cue.e)) cue = null;

    const waitStatus = waitCtrl && waitCtrl.check(cue);
    if (waitStatus && waitStatus.waiting) {
      const sig = 'waiting|' + (cue ? cue.s : 0) + '|' + app.size + '|' + app.bgAlpha + '|' + app.colorCss;
      if (sig === lastShown) return;
      lastShown = sig;
      el.replaceChildren();
      const line = document.createElement('div');
      line.className = 'ytr-line ytr-pending';
      line.textContent = YTR.t ? YTR.t('waitingText') : 'Çevriliyor…';
      el.appendChild(line);
      return;
    }

    const sig = cue ? `${cue.s}|${cue.tr ? cue.tr.length : 0}|${settings.showOriginal}|${app.size}|${app.bgAlpha}|${app.colorCss}|${app.origPosition}|${settings.target}` : null;
    if (sig === lastShown) return;
    lastShown = sig;
    el.replaceChildren();
    if (!cue) return;
    const line = document.createElement('div');
    line.className = 'ytr-line' + (cue.tr ? '' : ' ytr-pending');
    line.textContent = cue.tr || cue.t;
    if (settings.showOriginal && cue.tr) {
      const o = document.createElement('div');
      o.className = 'ytr-line ytr-orig';
      o.textContent = cue.t;
      if (app.origPosition === 'above') el.append(o, line);
      else el.append(line, o);
    } else {
      el.appendChild(line);
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
