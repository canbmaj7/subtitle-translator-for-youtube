// Popup Terim Sözlüğü (Glossary) yöneticisi
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const logic = ns.popup || (typeof require !== 'undefined' ? require('./popup-logic.js') : {});
  const {
    parseGlossaryText = (s) => [],
    glossaryToText = (l) => '',
    updateGlossaryCounter = (el, c, m) => `${c || 0}/${m || 50}`,
  } = logic;

  const glossaryApi = { parseGlossaryText, glossaryToText, updateGlossaryCounter };
  ns.popupGlossary = glossaryApi;
  if (typeof module !== 'undefined') module.exports = glossaryApi;
  if (typeof document === 'undefined' || !document.getElementById) return;

  const elGlossary = document.getElementById('glossary');
  const elCounter = document.getElementById('glossary-counter');
  if (!elGlossary) return;

  const renderCounter = (count) => {
    updateGlossaryCounter(elCounter, count, 50);
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ glossary: [] }, (res) => {
      void (chrome.runtime && chrome.runtime.lastError);
      const list = Array.isArray(res && res.glossary) ? res.glossary : [];
      elGlossary.value = glossaryToText(list);
      renderCounter(list.length);
    });
  }

  elGlossary.addEventListener('input', () => {
    const list = parseGlossaryText(elGlossary.value);
    renderCounter(list.length);
  });

  elGlossary.addEventListener('blur', () => {
    const list = parseGlossaryText(elGlossary.value);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ glossary: list });
    }
    elGlossary.value = glossaryToText(list);
    renderCounter(list.length);
  });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.glossary) {
        const list = Array.isArray(changes.glossary.newValue) ? changes.glossary.newValue : [];
        if (document.activeElement !== elGlossary) {
          elGlossary.value = glossaryToText(list);
        }
        renderCounter(list.length);
      }
    });
  }
})();
