(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const t = (k, subs) => (ns.t ? ns.t(k, subs) : (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage(k, subs)) || k);

  // CSS büyük harf dönüşümü doğru dil kurallarıyla (ör. Türkçe İ) çalışsın
  try { document.documentElement.lang = chrome.i18n.getUILanguage(); } catch (_) {}

  // i18n metinlerini DOM'a uygula
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const val = t(el.getAttribute('data-i18n'));
    if (val) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const val = t(el.getAttribute('data-i18n-title'));
    if (val) el.title = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const val = t(el.getAttribute('data-i18n-placeholder'));
    if (val) el.placeholder = val;
  });

  // Sürüm etiketi
  const vTag = document.getElementById('version-tag');
  if (vTag && chrome.runtime && chrome.runtime.getManifest) {
    vTag.textContent = 'v' + chrome.runtime.getManifest().version;
  }

  // Hedef dil seçenekleri (popüler diller üstte, kalanı alfabetik)
  const selTarget = document.getElementById('target');
  const popular = ['tr', 'en', 'de', 'fr', 'es'];
  const allLangs = Array.isArray(ns.LANGS) ? ns.LANGS : ['tr', 'en', 'de', 'fr', 'es'];
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
  const remaining = allLangs.filter((c) => !popular.includes(c));
  remaining.sort((a, b) => labelOf(a).localeCompare(labelOf(b), undefined, { sensitivity: 'base' }));

  addGroup(t('optgroupPopular'), popCodes);
  addGroup(t('optgroupAll'), remaining);

  // Senkronize ayarlar (chrome.storage.sync)
  const syncDefaults = { enabled: true, showOriginal: false, waitForTranslation: false, size: 100, target: ns.defaultTarget ? ns.defaultTarget() : 'en' };
  const elEnabled = document.getElementById('enabled');
  const elOrig = document.getElementById('showOriginal');
  const elWait = document.getElementById('waitForTranslation');
  const elSize = document.getElementById('size');
  const elSizeVal = document.getElementById('sizeVal');

  chrome.storage.sync.get(syncDefaults, (s) => {
    elEnabled.checked = !!s.enabled;
    elOrig.checked = !!s.showOriginal;
    elWait.checked = !!s.waitForTranslation;
    elSize.value = s.size != null ? s.size : 100;
    elSizeVal.textContent = (s.size != null ? s.size : 100) + '%';
    if (s.target) selTarget.value = s.target;
  });

  elEnabled.addEventListener('change', () => chrome.storage.sync.set({ enabled: elEnabled.checked }));
  elOrig.addEventListener('change', () => chrome.storage.sync.set({ showOriginal: elOrig.checked }));
  elWait.addEventListener('change', () => chrome.storage.sync.set({ waitForTranslation: elWait.checked }));
  elSize.addEventListener('input', () => {
    elSizeVal.textContent = elSize.value + '%';
    chrome.storage.sync.set({ size: Number(elSize.value) });
  });
  selTarget.addEventListener('change', () => chrome.storage.sync.set({ target: selTarget.value }));

  // Durum çipi ve alt bilgi satırı
  const chip = document.getElementById('engine-chip');
  const chipText = document.getElementById('engine-text');
  const footerBar = document.getElementById('footer-bar');
  const footerText = document.getElementById('footer-text');

  const updateStatus = (engine, error) => {
    chip.className = 'chip';
    if (engine) {
      chip.classList.add('chip-' + engine.toLowerCase());
      chipText.textContent = engine;
    } else if (error) {
      chip.classList.add('chip-error');
      chipText.textContent = t('chipError');
    } else {
      chip.classList.add('chip-ready');
      chipText.textContent = t('chipReady');
    }

    if (error) {
      footerBar.classList.add('error');
      footerText.textContent = error;
      footerText.title = error;
    } else {
      footerBar.classList.remove('error');
      footerText.textContent = t('infoDefault');
      footerText.removeAttribute('title');
    }
  };

  chrome.storage.local.get({ lastEngine: '', lastError: '' }, (s) => updateStatus(s.lastEngine, s.lastError));

  // API Anahtarları (chrome.storage.local)
  const elGemini = document.getElementById('geminiKey');
  const elGroq = document.getElementById('groqKey');

  chrome.storage.local.get({ geminiKey: '', groqKey: '' }, (s) => {
    elGemini.value = s.geminiKey || '';
    elGroq.value = s.groqKey || '';
  });

  // Statik SVG metnini DOM düğümü olarak ekler
  const svgNode = (str) => document.importNode(new DOMParser().parseFromString(str, 'image/svg+xml').documentElement, true);
  const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  const showSaved = (feedbackId) => {
    const fb = document.getElementById(feedbackId);
    if (!fb) return;
    const msg = document.createElement('span');
    msg.textContent = t('msgKeySaved');
    fb.replaceChildren(svgNode(CHECK_SVG), ' ', msg);
    fb.classList.add('visible');
    clearTimeout(fb._t);
    fb._t = setTimeout(() => fb.classList.remove('visible'), 2000);
  };

  const bindKey = (input, key, feedbackId) => {
    input.addEventListener('change', () => {
      chrome.storage.local.set({ [key]: input.value.trim() }, () => showSaved(feedbackId));
    });
  };
  bindKey(elGemini, 'geminiKey', 'geminiKey-feedback');
  bindKey(elGroq, 'groqKey', 'groqKey-feedback');

  // Şifre göster/gizle butonları
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

  // Canlı depolama dinleyicisi (oynatıcı paneli veya arka plandan değişiklikleri yansıt)
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
    } else if (area === 'local') {
      if (changes.lastEngine || changes.lastError) {
        chrome.storage.local.get({ lastEngine: '', lastError: '' }, (s) => updateStatus(s.lastEngine, s.lastError));
      }
      if (changes.geminiKey && document.activeElement !== elGemini) {
        elGemini.value = changes.geminiKey.newValue || '';
      }
      if (changes.groqKey && document.activeElement !== elGroq) {
        elGroq.value = changes.groqKey.newValue || '';
      }
    }
  });
})();
