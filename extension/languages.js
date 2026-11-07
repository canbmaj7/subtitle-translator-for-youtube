// Desteklenen diller, dil etiketleri ve yön/yazı biçimi yardımcıları.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});

  // Desteklenen hedef dil kodları
  ns.LANGS = [
    'en', 'tr', 'de', 'fr', 'es', 'pt', 'pt-BR', 'it', 'nl', 'pl',
    'ru', 'uk', 'cs', 'sv', 'da', 'fi', 'no', 'el', 'hu', 'ro',
    'bg', 'ar', 'he', 'fa', 'hi', 'bn', 'id', 'ms', 'vi', 'th',
    'zh-CN', 'zh-TW', 'ja', 'ko'
  ];

  // i18n çeviri yardımcısı (chrome.i18n.getMessage sarmalı)
  ns.t = (key, substitutions) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
        const msg = chrome.i18n.getMessage(key, substitutions);
        if (msg) return msg;
      }
    } catch (_) {}
    return key;
  };

  // Dilin arayüz dilindeki adı + parantez içinde kendi adını üretir
  ns.langLabel = (code, uiLocale) => {
    const loc = uiLocale || (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || 'en';
    let nameInUi = '';
    let nameInSelf = '';
    try {
      const dnUi = new Intl.DisplayNames([loc], { type: 'language' });
      nameInUi = dnUi.of(code) || code;
    } catch (_) {
      nameInUi = code;
    }
    try {
      const dnSelf = new Intl.DisplayNames([code], { type: 'language' });
      nameInSelf = dnSelf.of(code) || code;
    } catch (_) {
      nameInSelf = code;
    }
    if (nameInUi.toLowerCase() === nameInSelf.toLowerCase()) {
      return nameInUi;
    }
    return `${nameInUi} (${nameInSelf})`;
  };

  // Sağdan sola (RTL) yazılan diller
  ns.isRtl = (code) => {
    const base = (code || '').split('-')[0].toLowerCase();
    return ['ar', 'he', 'fa', 'ur'].includes(base);
  };

  // Boşluksuz/CJK diller (Çince, Japonca, Korece, Tayca)
  ns.isCjk = (code) => {
    const base = (code || '').split('-')[0].toLowerCase();
    return ['zh', 'ja', 'ko', 'th'].includes(base);
  };
})();
