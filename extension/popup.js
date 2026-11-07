const defaults = { enabled: true, showOriginal: false, size: 100 };
chrome.storage.sync.get(defaults, (s) => {
  for (const k of Object.keys(defaults)) {
    const el = document.getElementById(k);
    if (el.type === 'checkbox') el.checked = s[k]; else el.value = s[k];
    el.addEventListener('input', () => chrome.storage.sync.set({ [k]: el.type === 'checkbox' ? el.checked : Number(el.value) }));
  }
});
