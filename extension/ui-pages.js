// Ayar paneli alt sayfaları ve saf durum/hata yardımcıları.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});

  const ISSUE_KEYS = {
    nokey: 'issueNokey', invalid: 'issueInvalid', quota: 'issueQuota', network: 'issueNetwork',
    timeout: 'issueTimeout', server: 'issueServer', mismatch: 'issueMismatch', unknown: 'issueUnknown',
  };
  const BADGE_KEYS = {
    valid: 'keyStatusValid', invalid: 'keyStatusInvalid', quota: 'keyStatusQuota',
    network: 'keyStatusNetwork', unchecked: 'keyStatusUnchecked',
  };
  const ENGINE_LABEL_KEYS = {
    auto: 'engineAuto', google: 'engineGoogle', gemini: 'engineGemini', groq: 'engineGroq',
  };

  function issueMessageKey(code) {
    return ISSUE_KEYS[String(code || '').toLowerCase()] || 'issueUnknown';
  }

  function keyBadgeInfo(keyStatus, provider) {
    const p = String(provider || '').toLowerCase();
    const entry = keyStatus && typeof keyStatus === 'object' ? keyStatus[p] : null;
    const state = entry && typeof entry.state === 'string' ? entry.state.toLowerCase() : '';
    if (state && BADGE_KEYS[state]) return { hasKey: true, state, msgKey: BADGE_KEYS[state] };
    return { hasKey: false, state: 'missing', msgKey: 'keyStatusMissing' };
  }

  function findRelevantIssue(enginePref, lastIssues) {
    if (!Array.isArray(lastIssues) || !lastIssues.length) return null;
    const pref = String(enginePref || 'auto').toLowerCase();
    const match = pref === 'auto'
      ? lastIssues.find((i) => i && i.code)
      : lastIssues.find((i) => i && i.code && (!i.engine || String(i.engine).toLowerCase() === pref));
    return match ? { engine: match.engine || '', code: match.code, msgKey: issueMessageKey(match.code) } : null;
  }

  function engineLabelKey(enginePref) {
    return ENGINE_LABEL_KEYS[String(enginePref || 'auto').toLowerCase()] || 'engineAuto';
  }

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null && text !== '') e.textContent = text;
    return e;
  };

  function makeSwitch() {
    const wrap = el('span', 'ytr-switch');
    wrap.setAttribute('aria-hidden', 'true');
    const input = el('input');
    input.type = 'checkbox'; input.tabIndex = -1;
    wrap.append(input, el('span', 'ytr-switch-slider'));
    return { wrap, input };
  }

  function makeCheckboxRow(labelText, descText, onToggle) {
    const r = el('div', 'ytr-row ytr-menuitem');
    r.setAttribute('role', 'menuitemcheckbox');
    r.setAttribute('aria-checked', 'false');
    r.tabIndex = 0;
    const sw = makeSwitch();
    if (descText) {
      const w = el('div', 'ytr-row-text');
      w.append(el('span', 'ytr-row-label', labelText), el('span', 'ytr-row-sub', descText));
      r.append(w, sw.wrap);
    } else {
      r.append(el('span', 'ytr-row-label', labelText), sw.wrap);
    }
    r.addEventListener('click', (e) => { e.stopPropagation(); onToggle(!sw.input.checked); });
    const setChecked = (val) => {
      sw.input.checked = !!val;
      r.setAttribute('aria-checked', String(!!val));
    };
    return { row: r, input: sw.input, setChecked };
  }

  function makeNavRow(labelText, pageId, onOpen) {
    const r = el('div', 'ytr-row ytr-menuitem');
    r.setAttribute('role', 'menuitem');
    r.setAttribute('aria-haspopup', 'true');
    r.dataset.subpage = pageId;
    r.tabIndex = 0;
    const right = el('span', 'ytr-row-right');
    const val = el('span', 'ytr-row-value');
    right.append(val, el('span', 'ytr-row-arrow', '›'));
    r.append(el('span', 'ytr-row-label', labelText), right);
    r.addEventListener('click', (e) => { e.stopPropagation(); onOpen(pageId); });
    return { row: r, val };
  }

  function makeBackHeader(titleText, onBack) {
    const r = el('div', 'ytr-row ytr-menuitem ytr-back-row');
    r.setAttribute('role', 'menuitem');
    r.tabIndex = 0;
    const left = el('span', 'ytr-back-left');
    left.append(el('span', 'ytr-back-arrow', '‹'), el('span', 'ytr-back-text', ns.t('btnBack')));
    r.append(left, el('span', 'ytr-subpage-title', titleText));
    r.addEventListener('click', (e) => { e.stopPropagation(); onBack(); });
    return r;
  }

  function build(ctx) {
    const { getSettings, setSetting, getLocalState, showPage, getTargetName, refs } = ctx;
    const pages = {};

    // Ana Sayfa
    const pMain = el('div', 'ytr-page');
    const header = el('div', 'ytr-header');
    const chip = el('div', 'ytr-chip');
    const chipText = el('span', 'ytr-chip-text', ns.t('chipIdle'));
    chip.append(el('span', 'ytr-chip-dot'), chipText);
    header.append(el('div', 'ytr-title', ns.t('panelTitle')), chip);

    const progBox = el('div', 'ytr-progress-box'); progBox.hidden = true;
    const progRow = el('div', 'ytr-progress-row');
    const progText = el('span', 'ytr-progress-text');
    const retryBtn = el('button', 'ytr-retry-btn', ns.t('btnRetry'));
    retryBtn.type = 'button'; retryBtn.hidden = true;
    retryBtn.addEventListener('click', (e) => { e.stopPropagation(); if (ns.retryFailed) ns.retryFailed(); });
    progRow.append(progText, retryBtn);
    const progBar = el('div', 'ytr-progress-bar');
    const progFill = el('div', 'ytr-progress-fill');
    progBar.append(progFill);
    progBox.append(progRow, progBar);

    const statusBox = el('div', 'ytr-status-box');
    const note = el('div', 'ytr-note'); note.hidden = true;
    const status = el('div', 'ytr-status', ns.t('statusEngineNone'));
    const hint = el('div', 'ytr-hint', ns.t('googleKeyHint')); hint.hidden = true;
    statusBox.append(note, status, hint);

    const chkEnabled = makeCheckboxRow(ns.t('rowTranslation'), null, (v) => setSetting('enabled', v));
    const navLang = makeNavRow(ns.t('navLanguage'), 'lang', showPage);
    const navEng = makeNavRow(ns.t('navEngine'), 'engine', showPage);
    const navTrans = makeNavRow(ns.t('navTranscript'), 'transcript', showPage);
    const navApp = makeNavRow(ns.t('navAppearance'), 'appearance', showPage);
    const navAdv = makeNavRow(ns.t('navAdvanced'), 'advanced', showPage);
    pMain.append(header, progBox, statusBox, chkEnabled.row, navLang.row, navEng.row, navTrans.row, navApp.row, navAdv.row);
    pages.main = pMain;

    // Dil Sayfası
    const pLang = el('div', 'ytr-page'); pLang.hidden = true;
    const chkOrig = makeCheckboxRow(ns.t('rowShowOriginal'), null, (v) => setSetting('showOriginal', v));
    const chkWait = makeCheckboxRow(ns.t('rowWaitForTranslation'), ns.t('descWaitForTranslation'), (v) => setSetting('waitForTranslation', v));
    const langList = el('div', 'ytr-lang-list');
    const langItems = {};
    for (const code of (ns.LANGS || ['tr', 'en'])) {
      const item = el('div', 'ytr-row ytr-menuitem ytr-radio-row');
      item.setAttribute('role', 'menuitemradio'); item.setAttribute('aria-checked', 'false'); item.tabIndex = 0;
      item.append(el('span', 'ytr-radio-check', '✓'), el('span', 'ytr-row-label', ns.langLabel ? ns.langLabel(code) : code));
      item.addEventListener('click', (e) => { e.stopPropagation(); setSetting('target', code); });
      langList.appendChild(item);
      langItems[code] = item;
    }
    pLang.append(makeBackHeader(ns.t('navLanguage'), () => showPage('main')), chkOrig.row, chkWait.row, el('div', 'ytr-section-label', ns.t('rowTargetLang')), langList);
    pages.lang = pLang;

    // Çeviri Motoru Sayfası
    const pEng = el('div', 'ytr-page'); pEng.hidden = true;
    const engItems = {}, engBadges = {};
    const keyInfoBox = el('div', 'ytr-info-box', ns.t('keyAddInfo')); keyInfoBox.hidden = true;
    const issueBox = el('div', 'ytr-issue-box'); issueBox.hidden = true;

    for (const code of ['auto', 'google', 'gemini', 'groq']) {
      const item = el('div', 'ytr-row ytr-menuitem ytr-radio-row');
      item.setAttribute('role', 'menuitemradio'); item.setAttribute('aria-checked', 'false'); item.tabIndex = 0;
      const left = el('span', 'ytr-radio-left');
      left.append(el('span', 'ytr-radio-check', '✓'), el('span', 'ytr-row-label', ns.t(engineLabelKey(code))));
      item.appendChild(left);
      if (code === 'gemini' || code === 'groq') {
        const badge = el('span', 'ytr-key-badge');
        badge.addEventListener('click', (e) => {
          if (!keyBadgeInfo(getLocalState().keyStatus, code).hasKey) { e.stopPropagation(); keyInfoBox.hidden = false; }
        });
        item.appendChild(badge);
        engBadges[code] = badge;
      }
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if ((code === 'gemini' || code === 'groq') && !keyBadgeInfo(getLocalState().keyStatus, code).hasKey) keyInfoBox.hidden = false;
        setSetting('engine', code);
      });
      engItems[code] = item;
    }
    pEng.append(makeBackHeader(ns.t('navEngine'), () => showPage('main')), engItems.auto, engItems.google, engItems.gemini, engItems.groq, keyInfoBox, issueBox);
    pages.engine = pEng;

    // Transkript ve Görünüm (2B yer tutucular)
    for (const [id, titleKey] of [['transcript', 'navTranscript'], ['appearance', 'navAppearance']]) {
      const pg = el('div', 'ytr-page'); pg.hidden = true;
      pg.append(makeBackHeader(ns.t(titleKey), () => showPage('main')), el('div', 'ytr-placeholder', ns.t('comingSoon')));
      pages[id] = pg;
    }

    // Gelişmiş Sayfası
    const pAdv = el('div', 'ytr-page'); pAdv.hidden = true;
    const verRow = el('div', 'ytr-row ytr-menuitem');
    verRow.setAttribute('role', 'menuitem'); verRow.tabIndex = 0;
    let ver = '0.5.2';
    try { if (chrome && chrome.runtime && chrome.runtime.getManifest) ver = chrome.runtime.getManifest().version; } catch (_) {}
    verRow.append(el('span', 'ytr-row-label', ns.t('rowVersion')), el('span', 'ytr-row-value', 'v' + ver));

    const repoLink = el('a', 'ytr-row ytr-menuitem ytr-link-row');
    repoLink.setAttribute('role', 'menuitem'); repoLink.tabIndex = 0;
    repoLink.href = 'https://github.com/canbmaj7/subtitle-translator-for-youtube';
    repoLink.target = '_blank'; repoLink.rel = 'noopener noreferrer';
    repoLink.append(el('span', 'ytr-row-label', ns.t('rowRepoPrivacy')), el('span', 'ytr-row-arrow', '↗'));
    pAdv.append(makeBackHeader(ns.t('navAdvanced'), () => showPage('main')), verRow, repoLink);
    pages.advanced = pAdv;

    Object.assign(refs, {
      enabled: chkEnabled.input, orig: chkOrig.input, wait: chkWait.input,
      status, hint, note, chip, chipText, progBox, progText, progFill, retryBtn,
    });

    function refreshPages(target, enginePref) {
      const s = getSettings(), loc = getLocalState();
      chkEnabled.setChecked(!!s.enabled);
      chkOrig.setChecked(!!s.showOriginal);
      chkWait.setChecked(!!s.waitForTranslation);
      navLang.val.textContent = getTargetName(target);
      navEng.val.textContent = ns.t(engineLabelKey(enginePref));
      navTrans.val.textContent = ns.t('comingSoon');
      navApp.val.textContent = ns.t('comingSoon');

      for (const [code, item] of Object.entries(langItems)) {
        const active = code === target;
        item.classList.toggle('ytr-selected', active);
        item.setAttribute('aria-checked', String(active));
      }
      for (const [code, item] of Object.entries(engItems)) {
        const active = code === enginePref;
        item.classList.toggle('ytr-selected', active);
        item.setAttribute('aria-checked', String(active));
        if (code === 'gemini' || code === 'groq') {
          const info = keyBadgeInfo(loc.keyStatus, code);
          item.classList.toggle('ytr-item-dim', !info.hasKey);
          engBadges[code].className = 'ytr-key-badge ytr-key-' + info.state;
          engBadges[code].textContent = ns.t(info.msgKey);
        }
      }
      const issue = findRelevantIssue(enginePref, loc.lastIssues);
      issueBox.hidden = !issue;
      issueBox.textContent = issue ? (issue.engine ? issue.engine + ': ' : '') + ns.t(issue.msgKey) : '';
    }

    return { pages, refreshPages };
  }

  ns.issueMessageKey = issueMessageKey;
  ns.keyBadgeInfo = keyBadgeInfo;
  ns.findRelevantIssue = findRelevantIssue;
  ns.engineLabelKey = engineLabelKey;
  ns.pages = { build, issueMessageKey, keyBadgeInfo, findRelevantIssue, engineLabelKey };
  if (typeof module !== 'undefined') module.exports = ns.pages;
})();
