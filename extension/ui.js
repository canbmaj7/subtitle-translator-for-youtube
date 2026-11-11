// Oynatıcı kontrol çubuğuna düğme, bildirim ve dişli menü tarzı ayar paneli ekler.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const SVGNS = 'http://www.w3.org/2000/svg';
  let getSettings = () => ({}), setSetting = () => {};
  let btn = null, panel = null, toast = null, toastTimer = 0;
  let pagesMap = {}, refreshPagesFn = null, onPageActiveFn = null, currentPage = 'main';
  const refs = {};
  const localState = { keyStatus: {}, lastIssues: [], engine: '' };
  let syncEngine = '';

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null && text !== '') e.textContent = text;
    return e;
  };

  function makeIcon() {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 36 36');
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    const setAttrs = (elem, attrs) => { for (const [k, v] of Object.entries(attrs)) elem.setAttribute(k, v); };
    const barTop = document.createElementNS(SVGNS, 'rect');
    setAttrs(barTop, { x: 9, y: 8, width: 18, height: 4.5, fill: 'currentColor' });
    const barBot = document.createElementNS(SVGNS, 'rect');
    setAttrs(barBot, { x: 4, y: 15, width: 28, height: 4.5, fill: 'currentColor' });
    const t = document.createElementNS(SVGNS, 'text');
    setAttrs(t, { x: 18, y: 30, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: 'currentColor', 'font-family': 'ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace', 'letter-spacing': '0.04em' });
    t.textContent = 'TR';
    svg.append(barTop, barBot, t);
    refs.btnText = t;
    return svg;
  }

  function getTargetName(target) {
    try {
      const loc = (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || 'en';
      return new Intl.DisplayNames([loc], { type: 'language' }).of(target) || target;
    } catch (_) { return target; }
  }

  function showToast(text, ms) {
    const player = document.getElementById('movie_player');
    if (!player) return;
    if (!toast) {
      toast = el('div', 'ytr-toast');
      toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
      toast.hidden = true;
    }
    if (toast.parentElement !== player) player.appendChild(toast);
    toast.textContent = text;
    toast.hidden = false;
    toast.classList.add('ytr-toast-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast) { toast.classList.remove('ytr-toast-on'); toast.hidden = true; }
    }, ms || 1500);
  }

  // Yeni kullanıcıya bir kez: sol tık ve sağ tık ne yapar
  function showFirstHint() {
    try {
      chrome.storage.local.get({ hintSeen: false }, (r) => {
        if (r && r.hintSeen) return;
        chrome.storage.local.set({ hintSeen: true });
        setTimeout(() => showToast(ns.t('toastFirstHint'), 6000), 2500);
      });
    } catch (_) {}
  }

  function quickToggleEnabled() {
    const next = !getSettings().enabled;
    setSetting('enabled', next);
    showToast(ns.t(next ? 'toastTranslationOn' : 'toastTranslationOff'));
  }

  function makeButton() {
    const b = el('button', 'ytp-button ytr-btn');
    b.type = 'button';
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-haspopup', 'menu');
    b.appendChild(makeIcon());
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.shiftKey) togglePanel(); else quickToggleEnabled();
    });
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      togglePanel();
    });
    return b;
  }

  function getActiveMenuItems() {
    const pg = pagesMap[currentPage];
    return pg ? Array.from(pg.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="slider"]')).filter((n) => !n.hidden && !n.disabled) : [];
  }

  function showPage(pageId) {
    const prev = currentPage;
    currentPage = pagesMap[pageId] ? pageId : 'main';
    for (const [k, node] of Object.entries(pagesMap)) node.hidden = (k !== currentPage);
    if (onPageActiveFn) onPageActiveFn(currentPage, Boolean(panel && !panel.hidden));
    if (!panel || panel.hidden) return;
    const items = getActiveMenuItems();
    if (!items.length) return;
    let toFocus = items[0];
    if (currentPage === 'main' && prev !== 'main') {
      const trigger = items.find((i) => i.dataset && i.dataset.subpage === prev);
      if (trigger) toFocus = trigger;
    }
    toFocus.focus();
  }

  function onPanelKeyDown(e) {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (currentPage !== 'main') showPage('main');
      else { togglePanel(false); if (btn) btn.focus(); }
      return;
    }
    const items = getActiveMenuItems();
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const target = items[(idx + delta + items.length) % items.length];
      target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Home') {
      e.preventDefault(); items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault(); items[items.length - 1].focus();
    } else if (e.key === 'ArrowRight' && idx >= 0 && items[idx].dataset && items[idx].dataset.subpage) {
      e.preventDefault(); showPage(items[idx].dataset.subpage);
    } else if (e.key === 'ArrowLeft' && currentPage !== 'main') {
      e.preventDefault(); showPage('main');
    } else if ((e.key === 'Enter' || e.key === ' ') && idx >= 0) {
      if (items[idx].tagName === 'A' && e.key === 'Enter') return;
      e.preventDefault(); items[idx].click();
    }
  }

  function makePanel() {
    const p = el('div', 'ytr-panel');
    p.setAttribute('role', 'menu');
    p.setAttribute('aria-label', ns.t('panelTitle'));
    p.hidden = true;

    const built = ns.pages.build({
      getSettings,
      setSetting: (k, v) => { if (k === 'engine') syncEngine = v; setSetting(k, v); refresh(); },
      getLocalState: () => localState,
      showPage,
      getTargetName,
      refs,
    });
    pagesMap = built.pages;
    refreshPagesFn = built.refreshPages;
    onPageActiveFn = built.onPageActive || null;
    for (const node of Object.values(pagesMap)) p.appendChild(node);

    p.addEventListener('keydown', onPanelKeyDown);
    ['click', 'dblclick', 'mousedown', 'mouseup', 'keyup', 'keypress', 'contextmenu', 'wheel', 'pointerdown', 'pointerup'].forEach((ev) => p.addEventListener(ev, (e) => e.stopPropagation()));
    return p;
  }

  function togglePanel(force) {
    if (!panel) return;
    const willOpen = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !willOpen;
    if (btn) btn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) { showPage('main'); refresh(); }
    else if (onPageActiveFn) onPageActiveFn(currentPage, false);
  }

  function ensure() {
    const host = document.querySelector('.ytp-right-controls');
    const player = document.getElementById('movie_player');
    if (!host || !player) return;
    if (!btn) { btn = makeButton(); showFirstHint(); }
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
      ns.setNote(pendingNote);
    }
    if (panel.parentElement !== player) player.appendChild(panel);
    refresh();
  }

  function refresh() {
    const s = getSettings() || {};
    const target = s.target || (ns.defaultTarget ? ns.defaultTarget() : 'en');
    const langCode = target.split('-')[0].toUpperCase();
    const targetName = getTargetName(target);
    const enginePref = String(s.engine || syncEngine || localState.engine || 'auto').toLowerCase();

    if (refs.btnText) refs.btnText.textContent = langCode;
    if (btn) {
      const on = !!s.enabled;
      btn.classList.toggle('ytr-on', on);
      btn.classList.toggle('ytr-off', !on);
      btn.title = ns.t('btnTitle', [targetName]);
      btn.setAttribute('aria-label', ns.t('btnAriaLabel', [targetName]));
      if (panel) btn.setAttribute('aria-expanded', String(!panel.hidden));
    }
    if (refreshPagesFn) refreshPagesFn(target, enginePref);
  }

  function bindStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    if (chrome.storage.local && chrome.storage.local.get) {
      chrome.storage.local.get({ keyStatus: {}, lastIssues: [], engine: '' }, (d) => { if (d) Object.assign(localState, d); refresh(); });
    }
    if (chrome.storage.sync && chrome.storage.sync.get) {
      chrome.storage.sync.get({ engine: '' }, (s) => { if (s && s.engine) syncEngine = s.engine; refresh(); });
    }
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === 'local') {
          if (ch.keyStatus) localState.keyStatus = ch.keyStatus.newValue || {};
          if (ch.lastIssues) localState.lastIssues = ch.lastIssues.newValue || [];
          if (ch.engine) localState.engine = ch.engine.newValue || '';
          refresh();
        } else if (area === 'sync' && ch.engine) {
          syncEngine = ch.engine.newValue || '';
          refresh();
        }
      });
    }
  }

  ns.initUI = (getS, setS) => {
    getSettings = getS; setSetting = setS;
    bindStorage();
    // Eklenti yenilenince/güncellenince bu betik yetim kalır: chrome.* hata fırlatır, döngüyü durdur
    const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
    const timer = setInterval(() => { if (!alive()) { clearInterval(timer); return; } ensure(); }, 1000);
    ensure();
    document.addEventListener('click', (e) => {
      if (panel && !panel.hidden && !panel.contains(e.target) && !(btn && btn.contains(e.target))) togglePanel(false);
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel && !panel.hidden) {
        e.preventDefault(); e.stopPropagation();
        if (currentPage !== 'main') showPage('main');
        else { togglePanel(false); if (btn) btn.focus(); }
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
    refs.progFill.style.width = (p.total > 0 ? Math.round((p.done / p.total) * 100) : 0) + '%';
    refs.retryBtn.hidden = !(p.failed > 0);
  };

  let pendingNote = null;
  ns.setNote = (key) => {
    pendingNote = key;
    if (!refs.note) return;
    refs.note.hidden = !key;
    refs.note.textContent = key ? ns.t(key) : '';
  };

  let pendingStatus = null;
  ns.setStatus = (engine, error) => {
    pendingStatus = [engine, error];
    if (!refs.status) return;
    if (refs.chip && refs.chipText) {
      refs.chip.className = 'ytr-chip';
      if (engine) { refs.chip.classList.add('ytr-engine-' + engine.toLowerCase()); refs.chipText.textContent = engine; }
      else if (error) { refs.chip.classList.add('ytr-engine-error'); refs.chipText.textContent = '!'; }
      else refs.chipText.textContent = ns.t('chipIdle');
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
