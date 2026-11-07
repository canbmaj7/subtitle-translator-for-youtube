const syncDefaults = { enabled: true, showOriginal: false, size: 100 };
chrome.storage.sync.get(syncDefaults, (s) => {
  for (const k of Object.keys(syncDefaults)) {
    const el = document.getElementById(k);
    if (el.type === 'checkbox') el.checked = s[k]; else el.value = s[k];
    el.addEventListener('input', () => chrome.storage.sync.set({ [k]: el.type === 'checkbox' ? el.checked : Number(el.value) }));
  }
});
// Anahtarlar yalnızca yerel depoda (senkronlanmaz)
chrome.storage.local.get({ geminiKey: '', groqKey: '' }, (s) => {
  for (const k of ['geminiKey', 'groqKey']) {
    const el = document.getElementById(k);
    el.value = s[k];
    el.addEventListener('change', () => chrome.storage.local.set({ [k]: el.value.trim() }));
  }
});
const status = document.getElementById('status');
const showStatus = (s) => {
  status.textContent = s.lastEngine ? 'Son çeviri motoru: ' + s.lastEngine + (s.lastError ? ' (uyarı: ' + s.lastError + ')' : '') : (s.lastError ? 'Hata: ' + s.lastError : 'Motor: henüz çeviri yapılmadı');
};
chrome.storage.local.get({ lastEngine: '', lastError: '' }, showStatus);
chrome.storage.onChanged.addListener((_c, area) => { if (area === 'local') chrome.storage.local.get({ lastEngine: '', lastError: '' }, showStatus); });
