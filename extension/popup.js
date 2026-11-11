(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const logic = ns.popup || (typeof require !== 'undefined' ? require('./popup-logic.js') : {});
  const {
    popupKeyBadge, decideKeyAction, engineOptionState, formatEngineIssue,
    parseCustomEndpoint, normalizeGeminiModel, shouldShowCustomFields, shouldShowGeminiQuality,
  } = logic;
  const t = (k, subs) => (ns.t ? ns.t(k, subs) : (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage(k, subs)) || k);

  const popupApi = logic;
  ns.popup = popupApi;
  if (typeof module !== 'undefined') module.exports = popupApi;
  if (typeof document === 'undefined' || !document.getElementById) return;

  try { document.documentElement.lang = chrome.i18n.getUILanguage(); } catch (_) {}
  document.querySelectorAll('[data-i18n]').forEach((e) => { const v = t(e.getAttribute('data-i18n')); if (v) e.textContent = v; });
  document.querySelectorAll('[data-i18n-title]').forEach((e) => { const v = t(e.getAttribute('data-i18n-title')); if (v) e.title = v; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((e) => { const v = t(e.getAttribute('data-i18n-placeholder')); if (v) e.placeholder = v; });

  const vTag = document.getElementById('version-tag');
  if (vTag && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    vTag.textContent = 'v' + chrome.runtime.getManifest().version;
  }

  const selTarget = document.getElementById('target');
  const popular = ['tr', 'en', 'de', 'fr', 'es'];
  const allLangs = Array.isArray(ns.LANGS) ? ns.LANGS : popular;
  const labelOf = (c) => (ns.langLabel ? ns.langLabel(c) : c);
  const addGroup = (groupLabel, codes) => {
    const grp = document.createElement('optgroup'); grp.label = groupLabel;
    for (const code of codes) {
      const opt = document.createElement('option'); opt.value = code; opt.textContent = labelOf(code); grp.appendChild(opt);
    }
    selTarget.appendChild(grp);
  };
  addGroup(t('optgroupPopular'), popular.filter((c) => allLangs.includes(c)));
  addGroup(t('optgroupAll'), allLangs.filter((c) => !popular.includes(c)).sort((a, b) => labelOf(a).localeCompare(b, undefined, { sensitivity: 'base' })));

  const syncDefaults = { enabled: true, showOriginal: false, waitForTranslation: false, size: 100, target: ns.defaultTarget ? ns.defaultTarget() : 'en', engine: 'auto', geminiModel: 'fast' };
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
  const geminiQualityWrap = document.getElementById('gemini-quality-wrap');
  const geminiQualityBtns = Array.from(document.querySelectorAll('.quality-btn'));
  const customSection = document.getElementById('custom-section');
  const elCustomEndpoint = document.getElementById('customEndpoint');
  const elCustomEndpointGrant = document.getElementById('customEndpoint-grant');
  const elCustomEndpointBadge = document.getElementById('customEndpoint-badge');
  const elCustomModel = document.getElementById('customModel');

  const keyRefs = {
    gemini: { field: 'geminiKey', input: document.getElementById('geminiKey'), testBtn: document.getElementById('geminiKey-test'), badge: document.getElementById('geminiKey-badge'), note: document.getElementById('engine-note-gemini') },
    groq: { field: 'groqKey', input: document.getElementById('groqKey'), testBtn: document.getElementById('groqKey-test'), badge: document.getElementById('groqKey-badge'), note: document.getElementById('engine-note-groq') },
    custom: { field: 'customKey', input: document.getElementById('customKey'), testBtn: document.getElementById('customKey-test'), badge: document.getElementById('customKey-badge'), note: document.getElementById('engine-note-custom') },
  };

  let currentEnginePref = 'auto';
  let currentGeminiModel = 'fast';
  const localState = { geminiKey: '', groqKey: '', customKey: '', customEndpoint: '', customModel: '', keyStatus: {}, lastIssues: [], lastEngine: '' };
  const savedKeys = { gemini: '', groq: '', custom: '' };
  const testing = { gemini: false, groq: false, custom: false };
  const reqSeq = { gemini: 0, groq: 0, custom: 0 };

  function checkCustomPermission(cb) {
    const epVal = elCustomEndpoint ? elCustomEndpoint.value : localState.customEndpoint;
    const parsed = parseCustomEndpoint(epVal);
    if (!parsed.ok) return cb(false, parsed.error);
    if (typeof chrome === 'undefined' || !chrome.permissions || !chrome.permissions.contains) return cb(true, '');
    try {
      chrome.permissions.contains({ origins: [parsed.permissionPattern] }, (hasPerm) => {
        void chrome.runtime.lastError; cb(Boolean(hasPerm), '');
      });
    } catch (_) { cb(false, 'error'); }
  }

  function renderAll() {
    for (const optEl of engineOpts) {
      const code = optEl.getAttribute('data-engine');
      const radio = optEl.querySelector('input[type="radio"]');
      const selected = code === currentEnginePref;
      optEl.classList.toggle('selected', selected);
      if (radio) radio.checked = selected;
      const st = engineOptionState(code, localState, localState.keyStatus);
      optEl.classList.toggle('dim', st.dim);
      if (keyRefs[code] && keyRefs[code].note) {
        keyRefs[code].note.hidden = !st.noteKey;
        keyRefs[code].note.textContent = st.noteKey ? t(st.noteKey) : '';
      }
    }

    if (geminiQualityWrap) geminiQualityWrap.hidden = !shouldShowGeminiQuality(currentEnginePref);
    for (const b of geminiQualityBtns) b.classList.toggle('selected', b.getAttribute('data-quality') === currentGeminiModel);
    if (customSection) customSection.hidden = !shouldShowCustomFields(currentEnginePref);

    checkCustomPermission((hasPerm, err) => {
      if (elCustomEndpointGrant) elCustomEndpointGrant.disabled = hasPerm && !err;
      if (elCustomEndpointBadge) {
        if (!elCustomEndpoint || !elCustomEndpoint.value.trim()) {
          elCustomEndpointBadge.hidden = true;
        } else if (err === 'https_required') {
          elCustomEndpointBadge.hidden = false;
          elCustomEndpointBadge.className = 'key-badge key-invalid';
          elCustomEndpointBadge.textContent = t('issueEndpointHttps');
        } else if (!hasPerm) {
          elCustomEndpointBadge.hidden = false;
          elCustomEndpointBadge.className = 'key-badge key-permission';
          elCustomEndpointBadge.textContent = t('keyBadgePermission');
        } else {
          elCustomEndpointBadge.hidden = true;
        }
      }
    });

    const issue = formatEngineIssue(currentEnginePref, localState.lastIssues, t);
    if (elEngineIssue) {
      elEngineIssue.hidden = !issue;
      elEngineIssue.textContent = issue ? issue.text : '';
    }

    for (const prov of ['gemini', 'groq', 'custom']) {
      const ref = keyRefs[prov];
      if (!ref || !ref.input) continue;
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
      chip.classList.add('chip-error'); chipText.textContent = t('chipError');
    } else {
      chip.classList.add('chip-ready'); chipText.textContent = t('chipReady');
    }

    if (issue && !localState.lastEngine) {
      footerBar.classList.add('error'); footerText.textContent = issue.text;
    } else {
      footerBar.classList.remove('error'); footerText.textContent = t('infoDefault');
    }
  }

  chrome.storage.sync.get(syncDefaults, (s) => {
    elEnabled.checked = !!s.enabled; elOrig.checked = !!s.showOriginal; elWait.checked = !!s.waitForTranslation;
    const sz = s.size != null ? s.size : 100; elSize.value = sz; elSizeVal.textContent = sz + '%';
    if (s.target) selTarget.value = s.target;
    currentEnginePref = String(s.engine || 'auto').toLowerCase();
    currentGeminiModel = normalizeGeminiModel(s.geminiModel);
    renderAll();
  });

  chrome.storage.local.get(localState, (s) => {
    Object.assign(localState, s || {});
    for (const prov of ['gemini', 'groq', 'custom']) {
      const ref = keyRefs[prov];
      if (!ref || !ref.input) continue;
      const val = localState[ref.field] || '';
      savedKeys[prov] = String(val).trim();
      ref.input.value = val;
    }
    if (elCustomEndpoint) elCustomEndpoint.value = localState.customEndpoint || '';
    if (elCustomModel) elCustomModel.value = localState.customModel || '';
    renderAll();
  });

  elEnabled.addEventListener('change', () => chrome.storage.sync.set({ enabled: elEnabled.checked }));
  elOrig.addEventListener('change', () => chrome.storage.sync.set({ showOriginal: elOrig.checked }));
  elWait.addEventListener('change', () => chrome.storage.sync.set({ waitForTranslation: elWait.checked }));
  elSize.addEventListener('input', () => { elSizeVal.textContent = elSize.value + '%'; chrome.storage.sync.set({ size: Number(elSize.value) }); });
  selTarget.addEventListener('change', () => chrome.storage.sync.set({ target: selTarget.value }));

  engineRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      currentEnginePref = radio.value;
      chrome.storage.sync.set({ engine: currentEnginePref });
      renderAll();
    });
  });

  geminiQualityBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentGeminiModel = normalizeGeminiModel(btn.getAttribute('data-quality'));
      chrome.storage.sync.set({ geminiModel: currentGeminiModel });
      renderAll();
    });
  });

  if (elCustomEndpoint) {
    elCustomEndpoint.addEventListener('blur', () => {
      const ep = elCustomEndpoint.value.trim();
      localState.customEndpoint = ep;
      chrome.storage.local.set({ customEndpoint: ep });
      renderAll();
    });
  }
  if (elCustomModel) {
    elCustomModel.addEventListener('blur', () => {
      const mdl = elCustomModel.value.trim();
      localState.customModel = mdl;
      chrome.storage.local.set({ customModel: mdl });
    });
  }
  if (elCustomEndpointGrant) {
    elCustomEndpointGrant.addEventListener('click', () => {
      const parsed = parseCustomEndpoint(elCustomEndpoint.value);
      if (!parsed.ok) {
        if (elCustomEndpointBadge) {
          elCustomEndpointBadge.hidden = false;
          elCustomEndpointBadge.className = 'key-badge key-invalid';
          elCustomEndpointBadge.textContent = t('issueEndpointHttps');
        }
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.permissions && chrome.permissions.request) {
        chrome.permissions.request({ origins: [parsed.permissionPattern] }, (granted) => {
          void chrome.runtime.lastError;
          if (granted) {
            if (keyRefs.custom.input && keyRefs.custom.input.value.trim()) handleKeyTrigger('custom', 'test');
            else renderAll();
          } else {
            renderAll();
          }
        });
      }
    });
  }

  function handleKeyTrigger(prov, trigger) {
    const ref = keyRefs[prov];
    const dec = decideKeyAction(ref.input.value, savedKeys[prov], trigger);
    if (dec.action === 'noop') { renderAll(); return; }
    savedKeys[prov] = dec.value;
    localState[ref.field] = dec.value;

    if (dec.action === 'clear') {
      reqSeq[prov]++; testing[prov] = false;
      if (localState.keyStatus && localState.keyStatus[prov]) {
        const nextKs = { ...localState.keyStatus }; delete nextKs[prov]; localState.keyStatus = nextKs;
      }
      if (dec.shouldSave) chrome.storage.local.set({ [ref.field]: '' });
      renderAll(); return;
    }

    const seq = ++reqSeq[prov]; testing[prov] = true; renderAll();
    const sendValidate = () => {
      try {
        const payload = { type: 'validateKey', engine: prov, key: dec.value };
        if (prov === 'custom') payload.endpoint = (elCustomEndpoint ? elCustomEndpoint.value : localState.customEndpoint) || '';
        chrome.runtime.sendMessage(payload, (resp) => {
          void chrome.runtime.lastError;
          if (seq !== reqSeq[prov]) return;
          testing[prov] = false;
          if (resp && typeof resp.state === 'string') {
            localState.keyStatus = { ...(localState.keyStatus || {}), [prov]: { state: resp.state, at: Date.now() } };
          }
          renderAll();
        });
      } catch (_) { if (seq === reqSeq[prov]) { testing[prov] = false; renderAll(); } }
    };
    if (dec.shouldSave) chrome.storage.local.set({ [ref.field]: dec.value }, sendValidate);
    else sendValidate();
  }

  for (const prov of ['gemini', 'groq', 'custom']) {
    const ref = keyRefs[prov];
    if (!ref || !ref.input) continue;
    ref.input.addEventListener('paste', () => setTimeout(() => handleKeyTrigger(prov, 'paste'), 0));
    ref.input.addEventListener('blur', () => handleKeyTrigger(prov, 'blur'));
    ref.input.addEventListener('input', () => handleKeyTrigger(prov, 'input'));
    if (ref.testBtn) ref.testBtn.addEventListener('click', () => handleKeyTrigger(prov, 'test'));
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  function makeEyeSvg(isOpen) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '14'); svg.setAttribute('height', '14');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    if (isOpen) {
      const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z');
      const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '3');
      svg.append(p, c);
    } else {
      const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24');
      const l = document.createElementNS(SVGNS, 'line'); l.setAttribute('x1', '1'); l.setAttribute('y1', '1'); l.setAttribute('x2', '23'); l.setAttribute('y2', '23');
      svg.append(p, l);
    }
    return svg;
  }

  document.querySelectorAll('.eye-btn').forEach((btn) => {
    btn.replaceChildren(makeEyeSvg(true));
    btn.title = t('btnShowKey'); btn.setAttribute('aria-label', t('btnShowKey'));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.replaceChildren(makeEyeSvg(!isPwd));
      const label = t(isPwd ? 'btnHideKey' : 'btnShowKey');
      btn.title = label; btn.setAttribute('aria-label', label);
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.enabled) elEnabled.checked = !!changes.enabled.newValue;
      if (changes.showOriginal) elOrig.checked = !!changes.showOriginal.newValue;
      if (changes.waitForTranslation) elWait.checked = !!changes.waitForTranslation.newValue;
      if (changes.size) {
        const val = changes.size.newValue != null ? changes.size.newValue : 100;
        elSize.value = val; elSizeVal.textContent = val + '%';
      }
      if (changes.target && changes.target.newValue) selTarget.value = changes.target.newValue;
      if (changes.engine) { currentEnginePref = String(changes.engine.newValue || 'auto').toLowerCase(); renderAll(); }
      if (changes.geminiModel) { currentGeminiModel = normalizeGeminiModel(changes.geminiModel.newValue); renderAll(); }
    } else if (area === 'local') {
      if (changes.keyStatus) localState.keyStatus = changes.keyStatus.newValue || {};
      if (changes.lastIssues) localState.lastIssues = changes.lastIssues.newValue || [];
      if (changes.lastEngine) localState.lastEngine = changes.lastEngine.newValue || '';
      if (changes.customEndpoint) {
        localState.customEndpoint = changes.customEndpoint.newValue || '';
        if (elCustomEndpoint && document.activeElement !== elCustomEndpoint) elCustomEndpoint.value = localState.customEndpoint;
      }
      if (changes.customModel) {
        localState.customModel = changes.customModel.newValue || '';
        if (elCustomModel && document.activeElement !== elCustomModel) elCustomModel.value = localState.customModel;
      }
      for (const prov of ['gemini', 'groq', 'custom']) {
        const ref = keyRefs[prov];
        if (ref && changes[ref.field]) {
          const nv = changes[ref.field].newValue || '';
          localState[ref.field] = nv;
          savedKeys[prov] = String(nv).trim();
          if (ref.input && document.activeElement !== ref.input) ref.input.value = nv;
        }
      }
      renderAll();
    }
  });
})();
