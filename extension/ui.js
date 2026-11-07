// Oynatıcı kontrol çubuğuna düğme ve ayar paneli ekler.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const SVGNS = 'http://www.w3.org/2000/svg';
  let getSettings = () => ({}), setSetting = () => {};
  let btn = null, panel = null, refs = {};

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };

  // Açma/kapama anahtarı (toggle switch) oluşturur
  function makeSwitch(onChange) {
    const label = el('label', 'ytr-switch');
    const input = el('input');
    input.type = 'checkbox';
    const slider = el('span', 'ytr-switch-slider');
    label.append(input, slider);
    if (onChange) input.addEventListener('change', onChange);
    return { label, input };
  }

  function makeIcon() {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 36 36');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    const r = document.createElementNS(SVGNS, 'rect');
    for (const [k, v] of Object.entries({ x: 7, y: 10, width: 22, height: 16, rx: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 })) r.setAttribute(k, v);
    const t = document.createElementNS(SVGNS, 'text');
    for (const [k, v] of Object.entries({ x: 18, y: 22, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: 'currentColor', 'font-family': 'Roboto,Arial,sans-serif' })) t.setAttribute(k, v);
    t.textContent = 'TR';
    svg.append(r, t);
    refs.btnText = t;
    return svg;
  }

  function getTargetName(target) {
    let name = target;
    try {
      const loc = (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || 'en';
      const dn = new Intl.DisplayNames([loc], { type: 'language' });
      name = dn.of(target) || target;
    } catch (_) {}
    return name;
  }

  function makeButton() {
    const b = el('button', 'ytp-button ytr-btn');
    b.type = 'button'; b.setAttribute('aria-expanded', 'false');
    b.appendChild(makeIcon());
    b.addEventListener('click', (e) => { e.stopPropagation(); e.shiftKey ? setSetting('enabled', !getSettings().enabled) : togglePanel(); });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); togglePanel(); });
    return b;
  }

  function row(labelText, input) {
    const r = el('div', 'ytr-row');
    const l = el('span', 'ytr-row-label', labelText);
    r.append(l, input);
    return r;
  }

  function rowWithDesc(labelText, descText, input) {
    const r = el('div', 'ytr-row');
    const w = el('div', 'ytr-row-text');
    w.append(el('span', 'ytr-row-label', labelText), el('span', 'ytr-row-sub', descText));
    r.append(w, input);
    return r;
  }

  function makePanel() {
    const p = el('div', 'ytr-panel');
    p.hidden = true;

    // Başlık ve motor etiketi
    const header = el('div', 'ytr-header');
    const title = el('div', 'ytr-title', ns.t('panelTitle'));
    const chip = el('div', 'ytr-chip');
    const chipDot = el('span', 'ytr-chip-dot');
    const chipText = el('span', 'ytr-chip-text', ns.t('chipIdle'));
    chip.append(chipDot, chipText);
    header.append(title, chip);

    // İlerleme satırı
    const progBox = el('div', 'ytr-progress-box');
    progBox.hidden = true;
    const progRow = el('div', 'ytr-progress-row');
    const progText = el('span', 'ytr-progress-text');
    const retryBtn = el('button', 'ytr-retry-btn', ns.t('btnRetry'));
    retryBtn.type = 'button';
    retryBtn.hidden = true;
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (ns.retryFailed) ns.retryFailed();
    });
    progRow.append(progText, retryBtn);
    const progBar = el('div', 'ytr-progress-bar');
    const progFill = el('div', 'ytr-progress-fill');
    progBar.append(progFill);
    progBox.append(progRow, progBar);

    // Çeviri aç/kapa
    const swEnabled = makeSwitch(() => setSetting('enabled', swEnabled.input.checked));
    const rEnabled = row(ns.t('rowTranslation'), swEnabled.label);

    // Hedef dil seçimi
    const select = el('select', 'ytr-select');
    const langs = ns.LANGS || ['tr', 'en'];
    for (const code of langs) {
      const opt = el('option', null, ns.langLabel ? ns.langLabel(code) : code);
      opt.value = code;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => setSetting('target', select.value));

    // Orijinal metni göster
    const swOrig = makeSwitch(() => setSetting('showOriginal', swOrig.input.checked));
    const rOrig = row(ns.t('rowShowOriginal'), swOrig.label);

    // Çeviri gelene kadar bekle
    const swWait = makeSwitch(() => setSetting('waitForTranslation', swWait.input.checked));
    const rWait = rowWithDesc(ns.t('rowWaitForTranslation'), ns.t('descWaitForTranslation'), swWait.label);

    // Yazı boyutu
    const size = el('input', 'ytr-range');
    size.type = 'range'; size.min = 60; size.max = 200; size.step = 10;
    const sizeVal = el('span', 'ytr-val');
    const sizeWrap = el('div', 'ytr-sizewrap');
    sizeWrap.append(size, sizeVal);
    size.addEventListener('input', () => setSetting('size', Number(size.value)));
    const rSize = row(ns.t('rowFontSize'), sizeWrap);

    // Durum ve ipucu kutusu
    const statusBox = el('div', 'ytr-status-box');
    const status = el('div', 'ytr-status', ns.t('statusEngineNone'));
    const hint = el('div', 'ytr-hint', ns.t('googleKeyHint'));
    hint.hidden = true;
    statusBox.append(status, hint);

    p.append(header, progBox, rEnabled, row(ns.t('rowTargetLang'), select), rOrig, rWait, rSize, statusBox);

    // Panel içi etkileşimlerin oynatıcıya sızmasını engelle
    for (const ev of ['click', 'dblclick', 'mousedown', 'mouseup', 'keydown', 'keyup', 'keypress', 'contextmenu', 'wheel', 'pointerdown', 'pointerup']) {
      p.addEventListener(ev, (e) => e.stopPropagation());
    }

    Object.assign(refs, {
      enabled: swEnabled.input, orig: swOrig.input, wait: swWait.input, target: select,
      size, sizeVal, status, hint, chip, chipText, progBox, progText, progFill, retryBtn,
    });
    return p;
  }

  function togglePanel(force) {
    if (!panel) return;
    panel.hidden = typeof force === 'boolean' ? !force : !panel.hidden;
    if (btn) btn.setAttribute('aria-expanded', String(!panel.hidden));
  }

  function ensure() {
    const host = document.querySelector('.ytp-right-controls');
    const player = document.getElementById('movie_player');
    if (!host || !player) return;
    if (!btn) btn = makeButton();
    if (!btn.isConnected || !host.contains(btn)) {
      const cc = host.querySelector('.ytp-subtitles-button');
      const gear = host.querySelector('.ytp-settings-button');
      if (cc && cc.parentElement) cc.parentElement.insertBefore(btn, cc.nextSibling);
      else if (gear && gear.parentElement) gear.parentElement.insertBefore(btn, gear);
      else host.prepend(btn);
    }
    if (!panel) {
      panel = makePanel();
      if (pendingStatus) ns.setStatus(pendingStatus[0], pendingStatus[1]);
      if (pendingProgress) ns.setProgress(pendingProgress);
    }
    if (panel.parentElement !== player) player.appendChild(panel);
    refresh();
  }

  function refresh() {
    const s = getSettings();
    const target = s.target || (ns.defaultTarget ? ns.defaultTarget() : 'en');
    const langCode = target.split('-')[0].toUpperCase();
    const targetName = getTargetName(target);

    if (refs.btnText) refs.btnText.textContent = langCode;

    if (btn) {
      btn.classList.toggle('ytr-on', !!s.enabled);
      btn.title = ns.t('btnTitle', [targetName]);
      btn.setAttribute('aria-label', ns.t('btnAriaLabel', [targetName]));
      if (panel) btn.setAttribute('aria-expanded', String(!panel.hidden));
    }

    if (!refs.enabled) return;
    refs.enabled.checked = !!s.enabled;
    refs.orig.checked = !!s.showOriginal;
    if (refs.wait) refs.wait.checked = !!s.waitForTranslation;
    if (refs.target && refs.target.value !== target) refs.target.value = target;
    refs.size.value = s.size != null ? s.size : 100;
    refs.sizeVal.textContent = (s.size != null ? s.size : 100) + '%';
  }

  ns.initUI = (getS, setS) => {
    getSettings = getS; setSetting = setS;
    setInterval(ensure, 1000); // YouTube kontrolleri yeniden çizebilir
    ensure();
    // Panelin dışına tıklayınca kapat
    document.addEventListener('click', (e) => {
      if (panel && !panel.hidden && !panel.contains(e.target) && !(btn && btn.contains(e.target))) {
        togglePanel(false);
      }
    }, true);
    // Esc ile paneli kapat (oynatıcıya sızmasını engelle)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel && !panel.hidden) {
        e.preventDefault();
        e.stopPropagation();
        togglePanel(false);
      }
    }, true);
  };
  ns.refreshUI = refresh;

  let pendingProgress = null;
  ns.setProgress = (p) => {
    pendingProgress = p;
    if (btn) {
      btn.classList.toggle('ytr-busy', !!(p && p.active));
      btn.classList.toggle('ytr-err', !!(p && p.failed > 0));
    }
    if (!refs.progBox) return;
    if (!p || !p.total) { refs.progBox.hidden = true; return; }
    refs.progBox.hidden = false;
    if (p.active) refs.progText.textContent = ns.t('progressTranslating', [String(p.done), String(p.total)]);
    else if (p.failed > 0) refs.progText.textContent = ns.t('progressFailed', [String(p.failed)]);
    else if (p.done === p.total) refs.progText.textContent = ns.t('progressReady');
    else refs.progText.textContent = ns.t('progressTranslating', [String(p.done), String(p.total)]);
    const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
    refs.progFill.style.width = pct + '%';
    refs.retryBtn.hidden = !(p.failed > 0);
  };

  let pendingStatus = null; // panel oluşmadan gelen bilgiyi sakla
  ns.setStatus = (engine, error) => {
    pendingStatus = [engine, error];
    if (!refs.status) return;

    if (refs.chip && refs.chipText) {
      refs.chip.className = 'ytr-chip';
      if (engine) { refs.chip.classList.add('ytr-engine-' + engine.toLowerCase()); refs.chipText.textContent = engine; }
      else if (error) { refs.chip.classList.add('ytr-engine-error'); refs.chipText.textContent = '!'; }
      else { refs.chipText.textContent = ns.t('chipIdle'); }
    }

    if (engine) {
      refs.status.textContent = ns.t('statusEngine', [engine]);
      if (refs.hint) refs.hint.hidden = (engine !== 'Google');
    } else if (error) {
      refs.status.textContent = ns.t('statusError', [error]);
      if (refs.hint) refs.hint.hidden = true;
    } else {
      refs.status.textContent = ns.t('statusEngineNone');
      if (refs.hint) refs.hint.hidden = true;
    }
  };
})();
