// Transkript alt sayfası: arama, zaman kodlu liste, tıklayınca sarma, kopyala ve SRT/TXT indir.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null && text !== '') e.textContent = text;
    return e;
  };

  function getVideoEl() {
    if (typeof document === 'undefined') return null;
    return document.querySelector('#movie_player video') || document.querySelector('video');
  }

  function formatRowState(sn) {
    const orig = String((sn && sn.text) || '').trim();
    const tr = String((sn && sn.tr) || '').trim();
    const hasTr = Boolean(tr);
    return { mainText: hasTr ? tr : orig, origText: orig, showOrig: hasTr && orig !== tr, pending: !hasTr };
  }

  function downloadBlob(content, filename) {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function makeActionBtn(labelKey, onClick) {
    const b = el('button', 'ytr-action-btn ytr-menuitem', ns.t(labelKey));
    b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return b;
  }

  function build(ctx) {
    const { getSettings, showPage, makeBackHeader } = ctx;
    const page = el('div', 'ytr-page ytr-trans-page'); page.hidden = true;
    const backRow = makeBackHeader ? makeBackHeader(ns.t('navTranscript'), () => showPage('main')) : el('div', 'ytr-row ytr-back-row', ns.t('navTranscript'));

    // Arama kutusu
    const searchWrap = el('div', 'ytr-trans-search-wrap');
    const searchLabel = el('label', 'ytr-sr-only', ns.t('searchPlaceholder'));
    searchLabel.setAttribute('for', 'ytr-trans-search');
    const searchInput = el('input', 'ytr-search-input');
    searchInput.type = 'search'; searchInput.id = 'ytr-trans-search';
    searchInput.autocomplete = 'off'; searchInput.spellcheck = false;
    searchInput.placeholder = ns.t('searchPlaceholder');
    searchInput.setAttribute('aria-label', ns.t('searchPlaceholder'));
    searchWrap.append(searchLabel, searchInput);
    for (const ev of ['keyup', 'keypress']) searchInput.addEventListener(ev, (e) => e.stopPropagation());
    searchInput.addEventListener('keydown', (e) => { if (e.key !== 'Escape' && e.key !== 'ArrowDown') e.stopPropagation(); });

    // Cümle listesi ve boş durum mesajı
    const listEl = el('div', 'ytr-trans-list');
    const emptyEl = el('div', 'ytr-placeholder', ns.t('transcriptEmpty'));
    listEl.appendChild(emptyEl);

    let currentSentences = [], renderedRef = null, renderedLen = -1, rowNodes = [];
    let activeIdx = -1, boundVideo = null, isPageActive = false, copyTimer = 0;

    function getTranscriptData() {
      const d = (ns.getTranscript && ns.getTranscript()) || {};
      return { sentences: Array.isArray(d.sentences) ? d.sentences : [], sl: d.sl || '', title: d.title || '' };
    }

    function buildDownloadName(ext) {
      const { title } = getTranscriptData();
      const s = getSettings ? getSettings() : {};
      const lang = s.target || (ns.defaultTarget ? ns.defaultTarget() : 'en');
      return ns.safeFileName ? ns.safeFileName(title, lang, ext) : `subtitles.${lang}.${ext}`;
    }

    const actionsEl = el('div', 'ytr-trans-actions');
    const copyBtn = makeActionBtn('btnCopy', () => {
      if (!currentSentences.length || !ns.toTxt || !navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(ns.toTxt(currentSentences)).then(() => {
        copyBtn.textContent = ns.t('msgCopied');
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => { copyBtn.textContent = ns.t('btnCopy'); }, 1500);
      }).catch(() => {});
    });
    const srtBtn = makeActionBtn('btnDownloadSrt', () => {
      if (currentSentences.length && ns.toSrt) downloadBlob(ns.toSrt(currentSentences), buildDownloadName('srt'));
    });
    const txtBtn = makeActionBtn('btnDownloadTxt', () => {
      if (currentSentences.length && ns.toTxt) downloadBlob(ns.toTxt(currentSentences, { timestamps: true }), buildDownloadName('txt'));
    });
    actionsEl.append(copyBtn, srtBtn, txtBtn);
    page.append(backRow, searchWrap, listEl, actionsEl);

    function applyFilter() {
      const q = searchInput.value || '';
      if (!rowNodes.length) {
        emptyEl.textContent = ns.t('transcriptEmpty');
        emptyEl.hidden = false;
        return;
      }
      if (!q.trim()) {
        for (let i = 0; i < rowNodes.length; i++) rowNodes[i].el.hidden = false;
        emptyEl.hidden = true;
        return;
      }
      const hits = ns.filterSentences ? ns.filterSentences(currentSentences, q) : [];
      const hitSet = new Set(hits);
      for (let i = 0; i < rowNodes.length; i++) {
        rowNodes[i].el.hidden = !hitSet.has(i);
      }
      emptyEl.textContent = ns.t('transcriptNoMatch');
      emptyEl.hidden = hits.length > 0;
    }

    function updateActiveRow(forceScroll) {
      if (!rowNodes.length) return;
      const v = getVideoEl();
      const ms = v ? v.currentTime * 1000 : -1;
      const nextIdx = ns.activeIndex ? ns.activeIndex(currentSentences, ms) : -1;
      if (nextIdx === activeIdx && !forceScroll) return;
      if (activeIdx >= 0 && rowNodes[activeIdx]) {
        rowNodes[activeIdx].el.classList.remove('ytr-trans-active');
      }
      activeIdx = nextIdx;
      if (activeIdx >= 0 && rowNodes[activeIdx]) {
        const node = rowNodes[activeIdx].el;
        node.classList.add('ytr-trans-active');
        if (!(searchInput.value || '').trim() && !node.hidden && node.scrollIntoView) {
          node.scrollIntoView({ block: 'nearest' });
        }
      }
    }

    function syncList() {
      const { sentences } = getTranscriptData();
      currentSentences = sentences;
      const hasAny = sentences.length > 0;
      copyBtn.disabled = !hasAny;
      srtBtn.disabled = !hasAny;
      txtBtn.disabled = !hasAny;

      if (sentences !== renderedRef || sentences.length !== renderedLen) {
        renderedRef = sentences;
        renderedLen = sentences.length;
        rowNodes = [];
        activeIdx = -1;
        const frag = document.createDocumentFragment();
        frag.appendChild(emptyEl);
        for (let i = 0; i < sentences.length; i++) {
          const sn = sentences[i];
          const st = formatRowState(sn);
          const row = el('div', 'ytr-trans-item');
          row.dataset.idx = String(i);
          row.tabIndex = 0;
          const timeEl = el('span', 'ytr-trans-time', ns.clock ? ns.clock(sn.s) : '0:00');
          const bodyEl = el('div', 'ytr-trans-body');
          const mainEl = el('div', 'ytr-trans-main' + (st.pending ? ' ytr-trans-pending' : ''), st.mainText);
          const origEl = el('div', 'ytr-trans-orig', st.origText);
          origEl.hidden = !st.showOrig;
          bodyEl.append(mainEl, origEl);
          row.append(timeEl, bodyEl);
          frag.appendChild(row);
          rowNodes.push({ el: row, mainEl, origEl, tr: sn.tr || '' });
        }
        listEl.replaceChildren(frag);
        applyFilter();
        updateActiveRow(true);
        return;
      }

      // Aynı dizi referansı: yalnızca yeni çevrilen satırları yerinde güncelle
      let changed = false;
      for (let i = 0; i < sentences.length; i++) {
        const sn = sentences[i];
        const node = rowNodes[i];
        const curTr = sn.tr || '';
        if (node && node.tr !== curTr) {
          node.tr = curTr;
          const st = formatRowState(sn);
          node.mainEl.textContent = st.mainText;
          node.mainEl.classList.toggle('ytr-trans-pending', st.pending);
          node.origEl.textContent = st.origText;
          node.origEl.hidden = !st.showOrig;
          changed = true;
        }
      }
      if (changed && (searchInput.value || '').trim()) applyFilter();
      updateActiveRow(false);
    }

    function seekToRow(itemEl) {
      if (!itemEl) return;
      const idx = Number(itemEl.dataset.idx);
      const sn = currentSentences[idx];
      const v = getVideoEl();
      if (sn && v) {
        v.currentTime = (sn.s || 0) / 1000;
        updateActiveRow(false);
      }
    }

    listEl.addEventListener('click', (e) => {
      e.stopPropagation();
      seekToRow(e.target.closest('.ytr-trans-item'));
    });

    listEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const item = e.target.closest('.ytr-trans-item');
        if (item) {
          e.preventDefault();
          e.stopPropagation();
          seekToRow(item);
        }
      }
    });

    searchInput.addEventListener('input', () => applyFilter());

    function onTimeUpdate() {
      if (isPageActive) updateActiveRow(false);
    }

    function setActive(active) {
      isPageActive = Boolean(active);
      if (boundVideo) {
        boundVideo.removeEventListener('timeupdate', onTimeUpdate);
        boundVideo = null;
      }
      if (isPageActive) {
        syncList();
        const v = getVideoEl();
        if (v) {
          boundVideo = v;
          boundVideo.addEventListener('timeupdate', onTimeUpdate);
        }
      }
    }

    function refresh() {
      if (isPageActive) syncList();
    }

    ns.onTranscriptUpdate = () => {
      if (isPageActive) syncList();
    };

    return { page, refresh, setActive, isListening: () => Boolean(boundVideo) };
  }

  const api = { build, formatRowState };
  ns.pages = ns.pages || {};
  ns.pages.transcript = api;

  if (typeof module !== 'undefined') module.exports = api;
})();
