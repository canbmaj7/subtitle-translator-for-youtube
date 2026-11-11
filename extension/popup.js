(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const t = (k, subs) => (ns.t ? ns.t(k, subs) : (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage(k, subs)) || k);

  const POPUP_BADGE_MAP = {
    valid: { msgKey: 'keyStatusValid', tone: 'green' },
    invalid: { msgKey: 'keyBadgeInvalid', tone: 'red' },
    quota: { msgKey: 'keyStatusQuota', tone: 'orange' },
    network: { msgKey: 'keyBadgeNetwork', tone: 'gray' },
    unchecked: { msgKey: 'keyStatusUnchecked', tone: 'gray' },
  };

  function popupKeyBadge(provider, rawKey, keyStatus, isTesting) {
    const p = String(provider || '').toLowerCase();
    const info = ns.keyBadgeInfo ? ns.keyBadgeInfo(keyStatus, p) : { hasKey: false, state: 'missing' };
    const hasKey = rawKey !== undefined && rawKey !== null ? Boolean(String(rawKey).trim()) : Boolean(info.hasKey);
    if (!hasKey) return { visible: false, state: 'missing', msgKey: '', tone: '' };
    if (isTesting) return { visible: true, state: 'testing', msgKey: 'keyStatusTesting', tone: 'gray' };
    const st = info.hasKey && POPUP_BADGE_MAP[info.state] ? info.state : 'unchecked';
    const spec = POPUP_BADGE_MAP[st];
    return { visible: true, state: st, msgKey: spec.msgKey, tone: spec.tone };
  }

  function decideKeyAction(rawValue, prevSavedValue, trigger) {
    const value = String(rawValue == null ? '' : rawValue).trim();
    const prev = String(prevSavedValue == null ? '' : prevSavedValue).trim();
    const trig = String(trigger || 'blur').toLowerCase();
    if (!value) {
      if (trig === 'input' && !prev) return { action: 'noop', value: '', shouldSave: false, shouldValidate: false };
      return { action: 'clear', value: '', shouldSave: value !== prev, shouldValidate: false };
    }
    if (trig === 'input' || (trig === 'blur' && value === prev)) {
      return { action: 'noop', value, shouldSave: false, shouldValidate: false };
    }
    return { action: 'validate', value, shouldSave: value !== prev || trig === 'paste', shouldValidate: true };
  }

  function engineOptionState(engineCode, keys, keyStatus) {
    const code = String(engineCode || 'auto').toLowerCase();
    const labelKey = ns.engineLabelKey ? ns.engineLabelKey(code) : 'engineAuto';
    if (code !== 'gemini' && code !== 'groq') return { code, labelKey, hasKey: true, dim: false, noteKey: '' };
    const field = code === 'gemini' ? 'geminiKey' : 'groqKey';
    const hasRaw = keys && typeof keys === 'object' && keys[field] !== undefined && keys[field] !== null;
    const hasKey = hasRaw ? Boolean(String(keys[field]).trim()) : Boolean(ns.keyBadgeInfo && ns.keyBadgeInfo(keyStatus, code).hasKey);
    return { code, labelKey, hasKey, dim: !hasKey, noteKey: hasKey ? '' : 'engineNoKey' };
  }

  function formatEngineIssue(enginePref, lastIssues, trFn) {
    const tr = typeof trFn === 'function' ? trFn : t;
    const issue = ns.findRelevantIssue ? ns.findRelevantIssue(enginePref, lastIssues) : null;
    if (!issue) return null;
    return { engine: issue.engine, code: issue.code, msgKey: issue.msgKey, text: (issue.engine ? issue.engine + ': ' : '') + tr(issue.msgKey) };
  }

  const popupApi = { popupKeyBadge, decideKeyAction, engineOptionState, formatEngineIssue };
  ns.popup = popupApi;
  if (typeof module !== 'undefined') module.exports = popupApi;
  if (typeof document === 'undefined' || !document.getElementById) return;

  try { document.documentElement.lang = chrome.i18n.getUILanguage(); } catch (_) {}

  document.querySelectorAll('[data-i18n]').forEach((el) => { const v = t(el.getAttribute('data-i18n')); if (v) el.textContent = v; });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { const v = t(el.getAttribute('data-i18n-title')); if (v) el.title = v; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { const v = t(el.getAttribute('data-i18n-placeholder')); if (v) el.placeholder = v; });

  const vTag = document.getElementById('version-tag');
  if (vTag && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    vTag.textContent = 'v' + chrome.runtime.getManifest().version;
  }

  // Hedef dil seçenekleri (popüler diller üstte, kalanı alfabetik)
  const selTarget = document.getElementById('target');
  const popular = ['tr', 'en', 'de', 'fr', 'es'];
  const allLangs = Array.isArray(ns.LANGS) ? ns.LANGS : popular;
  const labelOf = (c) => (ns.langLabel ? ns.langLabel(c) : c);
  const addGroup = (groupLabel, codes) => {
    const grp = document.createElement('optgroup');
    grp.label = groupLabel;
    for (const code of codes) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = labelOf(code);
      grp.appendChild(opt);
    }
    selTarget.appendChild(grp);
  };
  const popCodes = popular.filter((c) => allLangs.includes(c));
  const remaining = allLangs.filter((c) => !popular.includes(c)).sort((a, b) => labelOf(a).localeCompare(labelOf(b), undefined, { sensitivity: 'base' }));
  addGroup(t('optgroupPopular'), popCodes);
  addGroup(t('optgroupAll'), remaining);

  const syncDefaults = { enabled: true, showOriginal: false, waitForTranslation: false, size: 100, target: ns.defaultTarget ? ns.defaultTarget() : 'en', engine: 'auto' };
  const elEnabled = document.getElementById('enabled');
  const elOrig = document.getElementById('showOriginal');
  const elWait = document.getElementById('waitForTranslation');
  const elSize = document.getElementById('size');
  const elSizeVal = document.getElementById('sizeVal');
  const engineOpts = Array.from(document.querySelectorAll('.engine-opt'));
  const engineRadios = Array.from(document.querySelectorAll('input[name="engine"]'));
  const elEngineIssue = document.getElementById('engine-issue');
  const chip = document.getElementById('engine-chip');
  const chipText = document.getElementById('engine-text');
  const footerBar = document.getElementById('footer-bar');
  const footerText = document.getElementById('footer-text');

  const keyRefs = {
    gemini: { field: 'geminiKey', input: document.getElementById('geminiKey'), testBtn: document.getElementById('geminiKey-test'), badge: document.getElementById('geminiKey-badge'), note: document.getElementById('engine-note-gemini') },
    groq: { field: 'groqKey', input: document.getElementById('groqKey'), testBtn: document.getElementById('groqKey-test'), badge: document.getElementById('groqKey-badge'), note: document.getElementById('engine-note-groq') },
  };

  let currentEnginePref = 'auto';
  const localState = { geminiKey: '', groqKey: '', keyStatus: {}, lastIssues: [], lastEngine: '' };
  const savedKeys = { gemini: '', groq: '' };
  const testing = { gemini: false, groq: false };
  const reqSeq = { gemini: 0, groq: 0 };

  function renderAll() {
    for (const optEl of engineOpts) {
      const code = optEl.getAttribute('data-engine');
      const radio = optEl.querySelector('input[type="radio"]');
      const selected = code === currentEnginePref;
      optEl.classList.toggle('selected', selected);
      if (radio) radio.checked = selected;
      const st = engineOptionState(code, localState, localState.keyStatus);
      optEl.classList.toggle('dim', st.dim);
      if ((code === 'gemini' || code === 'groq') && keyRefs[code].note) {
        keyRefs[code].note.hidden = !st.noteKey;
        keyRefs[code].note.textContent = st.noteKey ? t(st.noteKey) : '';
      }
    }

    const issue = formatEngineIssue(currentEnginePref, localState.lastIssues, t);
    if (elEngineIssue) {
      elEngineIssue.hidden = !issue;
      elEngineIssue.textContent = issue ? issue.text : '';
    }

    for (const prov of ['gemini', 'groq']) {
      const ref = keyRefs[prov];
      const rawVal = ref.input ? ref.input.value : localState[ref.field];
      const b = popupKeyBadge(prov, rawVal, localState.keyStatus, testing[prov]);
      if (ref.badge) {
        ref.badge.hidden = !b.visible;
        ref.badge.className = b.visible ? `key-badge key-${b.state}` : 'key-badge';
        ref.badge.textContent = b.visible && b.msgKey ? t(b.msgKey) : '';
      }
      if (ref.testBtn) ref.testBtn.disabled = testing[prov] || !String(rawVal || '').trim();
    }

    chip.className = 'chip';
    if (localState.lastEngine) {
      chip.classList.add('chip-' + localState.lastEngine.toLowerCase());
      chipText.textContent = localState.lastEngine;
    } else if (issue) {
      chip.classList.add('chip-error');
      chipText.textContent = t('chipError');
    } else {
      chip.classList.add('chip-ready');
      chipText.textContent = t('chipReady');
    }

    if (issue && !localState.lastEngine) {
      footerBar.classList.add('error');
      footerText.textContent = issue.text;
    } else {
      footerBar.classList.remove('error');
      footerText.textContent = t('infoDefault');
    }
  }

  chrome.storage.sync.get(syncDefaults, (s) => {
    elEnabled.checked = !!s.enabled;
    elOrig.checked = !!s.showOriginal;
    elWait.checked = !!s.waitForTranslation;
    const sz = s.size != null ? s.size : 100;
    elSize.value = sz;
    elSizeVal.textContent = sz + '%';
    if (s.target) selTarget.value = s.target;
    currentEnginePref = String(s.engine || 'auto').toLowerCase();
    renderAll();
  });

  chrome.storage.local.get(localState, (s) => {
    Object.assign(localState, s || {});
    for (const prov of ['gemini', 'groq']) {
      const val = localState[keyRefs[prov].field] || '';
      savedKeys[prov] = String(val).trim();
      keyRefs[prov].input.value = val;
    }
    renderAll();
  });

  elEnabled.addEventListener('change', () => chrome.storage.sync.set({ enabled: elEnabled.checked }));
  elOrig.addEventListener('change', () => chrome.storage.sync.set({ showOriginal: elOrig.checked }));
  elWait.addEventListener('change', () => chrome.storage.sync.set({ waitForTranslation: elWait.checked }));
  elSize.addEventListener('input', () => {
    elSizeVal.textContent = elSize.value + '%';
    chrome.storage.sync.set({ size: Number(elSize.value) });
  });
  selTarget.addEventListener('change', () => chrome.storage.sync.set({ target: selTarget.value }));

  engineRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      currentEnginePref = radio.value;
      chrome.storage.sync.set({ engine: currentEnginePref });
      renderAll();
    });
  });

  function handleKeyTrigger(prov, trigger) {
    const ref = keyRefs[prov];
    const dec = decideKeyAction(ref.input.value, savedKeys[prov], trigger);
    if (dec.action === 'noop') { renderAll(); return; }
    savedKeys[prov] = dec.value;
    localState[ref.field] = dec.value;

    if (dec.action === 'clear') {
      reqSeq[prov]++;
      testing[prov] = false;
      if (localState.keyStatus && localState.keyStatus[prov]) {
        const nextKs = { ...localState.keyStatus };
        delete nextKs[prov];
        localState.keyStatus = nextKs;
      }
      if (dec.shouldSave) chrome.storage.local.set({ [ref.field]: '' });
      renderAll();
      return;
    }

    const seq = ++reqSeq[prov];
    testing[prov] = true;
    renderAll();

    const sendValidate = () => {
      try {
        chrome.runtime.sendMessage({ type: 'validateKey', engine: prov, key: dec.value }, (resp) => {
          void chrome.runtime.lastError;
          if (seq !== reqSeq[prov]) return;
          testing[prov] = false;
          if (resp && typeof resp.state === 'string') {
            localState.keyStatus = { ...(localState.keyStatus || {}), [prov]: { state: resp.state, at: Date.now() } };
          }
          renderAll();
        });
      } catch (_) {
        if (seq === reqSeq[prov]) { testing[prov] = false; renderAll(); }
      }
    };

    if (dec.shouldSave) chrome.storage.local.set({ [ref.field]: dec.value }, sendValidate);
    else sendValidate();
  }

  for (const prov of ['gemini', 'groq']) {
    const ref = keyRefs[prov];
    ref.input.addEventListener('paste', () => setTimeout(() => handleKeyTrigger(prov, 'paste'), 0));
    ref.input.addEventListener('blur', () => handleKeyTrigger(prov, 'blur'));
    ref.input.addEventListener('input', () => handleKeyTrigger(prov, 'input'));
    ref.testBtn.addEventListener('click', () => handleKeyTrigger(prov, 'test'));
  }

  const svgNode = (str) => document.importNode(new DOMParser().parseFromString(str, 'image/svg+xml').documentElement, true);
  const EYE_ON = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  document.querySelectorAll('.eye-btn').forEach((btn) => {
    btn.replaceChildren(svgNode(EYE_ON));
    btn.title = t('btnShowKey');
    btn.setAttribute('aria-label', t('btnShowKey'));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.replaceChildren(svgNode(isPwd ? EYE_OFF : EYE_ON));
      const label = t(isPwd ? 'btnHideKey' : 'btnShowKey');
      btn.title = label;
      btn.setAttribute('aria-label', label);
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.enabled) elEnabled.checked = !!changes.enabled.newValue;
      if (changes.showOriginal) elOrig.checked = !!changes.showOriginal.newValue;
      if (changes.waitForTranslation) elWait.checked = !!changes.waitForTranslation.newValue;
      if (changes.size) {
        const val = changes.size.newValue != null ? changes.size.newValue : 100;
        elSize.value = val;
        elSizeVal.textContent = val + '%';
      }
      if (changes.target && changes.target.newValue) selTarget.value = changes.target.newValue;
      if (changes.engine) {
        currentEnginePref = String(changes.engine.newValue || 'auto').toLowerCase();
        renderAll();
      }
    } else if (area === 'local') {
      if (changes.keyStatus) localState.keyStatus = changes.keyStatus.newValue || {};
      if (changes.lastIssues) localState.lastIssues = changes.lastIssues.newValue || [];
      if (changes.lastEngine) localState.lastEngine = changes.lastEngine.newValue || '';
      for (const prov of ['gemini', 'groq']) {
        const ref = keyRefs[prov];
        if (changes[ref.field]) {
          const nv = changes[ref.field].newValue || '';
          localState[ref.field] = nv;
          savedKeys[prov] = String(nv).trim();
          if (document.activeElement !== ref.input) ref.input.value = nv;
        }
      }
      renderAll();
    }
  });
})();
