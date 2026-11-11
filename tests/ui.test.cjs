// Panel saf mantık ve i18n anahtar eşleme testleri: node tests/ui.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.YTR = { t: (k) => k };
const ext = (f) => path.join(__dirname, '../extension', f);
const APP = require(ext('ui-appearance.js'));
const TRANS_UI = require(ext('ui-transcript.js'));
const UI = require(ext('ui-pages.js'));
const POPUP = require(ext('popup.js'));

const en = JSON.parse(fs.readFileSync(ext('_locales/en/messages.json'), 'utf8'));
const tr = JSON.parse(fs.readFileSync(ext('_locales/tr/messages.json'), 'utf8'));

// 1) issueMessageKey: tüm hata kodları doğru i18n anahtarına eşlenir
assert.equal(UI.issueMessageKey('nokey'), 'issueNokey');
assert.equal(UI.issueMessageKey('invalid'), 'issueInvalid');
assert.equal(UI.issueMessageKey('quota'), 'issueQuota');
assert.equal(UI.issueMessageKey('network'), 'issueNetwork');
assert.equal(UI.issueMessageKey('timeout'), 'issueTimeout');
assert.equal(UI.issueMessageKey('server'), 'issueServer');
assert.equal(UI.issueMessageKey('mismatch'), 'issueMismatch');
assert.equal(UI.issueMessageKey('unknown'), 'issueUnknown');
assert.equal(UI.issueMessageKey('beklenmeyen-kod'), 'issueUnknown');
assert.equal(UI.issueMessageKey(null), 'issueUnknown');

// 2) keyBadgeInfo: keyStatus durumlarına göre rozet ve hasKey bilgisi
assert.deepEqual(UI.keyBadgeInfo(null, 'gemini'), {
  hasKey: false, state: 'missing', msgKey: 'keyStatusMissing',
});
assert.deepEqual(UI.keyBadgeInfo({}, 'groq'), {
  hasKey: false, state: 'missing', msgKey: 'keyStatusMissing',
});
assert.deepEqual(UI.keyBadgeInfo({ gemini: { state: 'valid', at: 1 } }, 'gemini'), {
  hasKey: true, state: 'valid', msgKey: 'keyStatusValid',
});
assert.deepEqual(UI.keyBadgeInfo({ gemini: { state: 'invalid', at: 1 } }, 'gemini'), {
  hasKey: true, state: 'invalid', msgKey: 'keyStatusInvalid',
});
assert.deepEqual(UI.keyBadgeInfo({ groq: { state: 'quota', at: 1 } }, 'groq'), {
  hasKey: true, state: 'quota', msgKey: 'keyStatusQuota',
});
assert.deepEqual(UI.keyBadgeInfo({ groq: { state: 'network', at: 1 } }, 'groq'), {
  hasKey: true, state: 'network', msgKey: 'keyStatusNetwork',
});
assert.deepEqual(UI.keyBadgeInfo({ gemini: { state: 'unchecked', at: 1 } }, 'gemini'), {
  hasKey: true, state: 'unchecked', msgKey: 'keyStatusUnchecked',
});

// 3) findRelevantIssue: seçili motora göre ilgili hata kaydını seçer
const sampleIssues = [
  { engine: 'Gemini', code: 'quota' },
  { engine: 'Groq', code: 'invalid' },
];
assert.equal(UI.findRelevantIssue('google', sampleIssues), null);
assert.deepEqual(UI.findRelevantIssue('gemini', sampleIssues), {
  engine: 'Gemini', code: 'quota', msgKey: 'issueQuota',
});
assert.deepEqual(UI.findRelevantIssue('groq', sampleIssues), {
  engine: 'Groq', code: 'invalid', msgKey: 'issueInvalid',
});
assert.deepEqual(UI.findRelevantIssue('auto', sampleIssues), {
  engine: 'Gemini', code: 'quota', msgKey: 'issueQuota',
});
assert.equal(UI.findRelevantIssue('auto', []), null);
assert.equal(UI.findRelevantIssue('gemini', null), null);

// 4) engineLabelKey: motor etiket anahtarları
assert.equal(UI.engineLabelKey('auto'), 'engineAuto');
assert.equal(UI.engineLabelKey('google'), 'engineGoogle');
assert.equal(UI.engineLabelKey('gemini'), 'engineGemini');
assert.equal(UI.engineLabelKey('groq'), 'engineGroq');
assert.equal(UI.engineLabelKey(''), 'engineAuto');

// 5) Görünüm (ui-appearance.js): değer aralığı kırpma, renk ön ayarı ve ayar doğrulama
assert.equal(APP.clampRange(100, 60, 200, 100), 100);
assert.equal(APP.clampRange(30, 60, 200, 100), 60);
assert.equal(APP.clampRange(350, 60, 200, 100), 200);
assert.equal(APP.clampRange('145', 60, 200, 100), 145);
assert.equal(APP.clampRange('abc', 60, 200, 100), 100);
assert.equal(APP.clampRange(null, 0, 100, 78), 78);
assert.equal(APP.clampRange(undefined, 0, 100, 78), 78);
assert.equal(APP.clampRange(true, 0, 100, 78), 78);
assert.equal(APP.clampRange(-20, 0, 100, 78), 0);
assert.equal(APP.clampRange(120, 0, 100, 78), 100);

assert.equal(APP.normalizeColor('yellow'), 'yellow');
assert.equal(APP.normalizeColor('GREEN'), 'green');
assert.equal(APP.normalizeColor('cyan'), 'cyan');
assert.equal(APP.normalizeColor('#ffc53d'), 'yellow');
assert.equal(APP.normalizeColor('#ffeb3b'), 'yellow');
assert.equal(APP.normalizeColor('magenta'), 'white');
assert.equal(APP.normalizeColor(null), 'white');
assert.equal(APP.colorHex('yellow'), '#ffc53d');
assert.equal(APP.colorHex('cyan'), '#22d3ee');
assert.equal(APP.colorHex('invalid'), '#ffffff');

assert.equal(APP.normalizeOrigPosition('above'), 'above');
assert.equal(APP.normalizeOrigPosition('ABOVE'), 'above');
assert.equal(APP.normalizeOrigPosition('below'), 'below');
assert.equal(APP.normalizeOrigPosition('side'), 'below');
assert.equal(APP.normalizeOrigPosition(null), 'below');

assert.deepEqual(APP.normalizeAppearance({}), {
  size: 100,
  bgOpacity: 78,
  bgAlpha: 0.78,
  textColor: 'white',
  colorCss: '#ffffff',
  origPosition: 'below',
});
assert.deepEqual(APP.normalizeAppearance({ size: 250, bgOpacity: -5, textColor: 'yellow', origPosition: 'above' }), {
  size: 200,
  bgOpacity: 0,
  bgAlpha: 0,
  textColor: 'yellow',
  colorCss: '#ffc53d',
  origPosition: 'above',
});

// 6) Transkript satır durumu (ui-transcript.js): çevrilmiş vs bekleyen cümle
assert.deepEqual(TRANS_UI.formatRowState({ text: 'Hello', tr: 'Merhaba' }), {
  mainText: 'Merhaba',
  origText: 'Hello',
  showOrig: true,
  pending: false,
});
assert.deepEqual(TRANS_UI.formatRowState({ text: 'Hello', tr: null }), {
  mainText: 'Hello',
  origText: 'Hello',
  showOrig: false,
  pending: true,
});

// 7) Popup saf mantık (popup.js): rozet seçimi, aksiyon kararı, motor soluklaştırma ve hata mesajı
assert.deepEqual(POPUP.popupKeyBadge('gemini', '', { gemini: { state: 'valid' } }, false), {
  visible: false, state: 'missing', msgKey: '', tone: '',
});
assert.deepEqual(POPUP.popupKeyBadge('gemini', '   ', null, true), {
  visible: false, state: 'missing', msgKey: '', tone: '',
});
assert.deepEqual(POPUP.popupKeyBadge('gemini', 'secret-key', { gemini: { state: 'valid' } }, true), {
  visible: true, state: 'testing', msgKey: 'keyStatusTesting', tone: 'gray',
});
assert.deepEqual(POPUP.popupKeyBadge('gemini', 'secret-key', { gemini: { state: 'valid' } }, false), {
  visible: true, state: 'valid', msgKey: 'keyStatusValid', tone: 'green',
});
assert.deepEqual(POPUP.popupKeyBadge('gemini', 'secret-key', { gemini: { state: 'invalid' } }, false), {
  visible: true, state: 'invalid', msgKey: 'keyBadgeInvalid', tone: 'red',
});
assert.deepEqual(POPUP.popupKeyBadge('groq', 'secret-key', { groq: { state: 'quota' } }, false), {
  visible: true, state: 'quota', msgKey: 'keyStatusQuota', tone: 'orange',
});
assert.deepEqual(POPUP.popupKeyBadge('groq', 'secret-key', { groq: { state: 'network' } }, false), {
  visible: true, state: 'network', msgKey: 'keyBadgeNetwork', tone: 'gray',
});
assert.deepEqual(POPUP.popupKeyBadge('gemini', 'secret-key', {}, false), {
  visible: true, state: 'unchecked', msgKey: 'keyStatusUnchecked', tone: 'gray',
});

// Anahtar boş/dolu durumunda aksiyon kararı (paste / blur / test / input)
assert.deepEqual(POPUP.decideKeyAction('  yeni-anahtar ', '', 'paste'), {
  action: 'validate', value: 'yeni-anahtar', shouldSave: true, shouldValidate: true,
});
assert.deepEqual(POPUP.decideKeyAction('yeni-anahtar', '', 'blur'), {
  action: 'validate', value: 'yeni-anahtar', shouldSave: true, shouldValidate: true,
});
assert.deepEqual(POPUP.decideKeyAction('ayni-anahtar', 'ayni-anahtar', 'blur'), {
  action: 'noop', value: 'ayni-anahtar', shouldSave: false, shouldValidate: false,
});
assert.deepEqual(POPUP.decideKeyAction('ayni-anahtar', 'ayni-anahtar', 'test'), {
  action: 'validate', value: 'ayni-anahtar', shouldSave: false, shouldValidate: true,
});
assert.deepEqual(POPUP.decideKeyAction('   ', 'eski-anahtar', 'blur'), {
  action: 'clear', value: '', shouldSave: true, shouldValidate: false,
});
assert.deepEqual(POPUP.decideKeyAction('', '', 'blur'), {
  action: 'clear', value: '', shouldSave: false, shouldValidate: false,
});
assert.deepEqual(POPUP.decideKeyAction('', 'eski-anahtar', 'input'), {
  action: 'clear', value: '', shouldSave: true, shouldValidate: false,
});
assert.deepEqual(POPUP.decideKeyAction('yaziliyor', 'eski-anahtar', 'input'), {
  action: 'noop', value: 'yaziliyor', shouldSave: false, shouldValidate: false,
});

// Çeviri motoru seçeneği soluklaştırma ve "anahtar yok" notu
assert.deepEqual(POPUP.engineOptionState('auto', { geminiKey: '', groqKey: '' }, {}), {
  code: 'auto', labelKey: 'engineAuto', hasKey: true, dim: false, noteKey: '',
});
assert.deepEqual(POPUP.engineOptionState('google', { geminiKey: '', groqKey: '' }, {}), {
  code: 'google', labelKey: 'engineGoogle', hasKey: true, dim: false, noteKey: '',
});
assert.deepEqual(POPUP.engineOptionState('gemini', { geminiKey: '', groqKey: '' }, {}), {
  code: 'gemini', labelKey: 'engineGemini', hasKey: false, dim: true, noteKey: 'engineNoKey',
});
assert.deepEqual(POPUP.engineOptionState('groq', { geminiKey: '', groqKey: 'gsk_test' }, {}), {
  code: 'groq', labelKey: 'engineGroq', hasKey: true, dim: false, noteKey: '',
});

// Seçili motorun son hatası ve anahtar sızdırmama garantisi
const SECRET = 'AIzaSy_SECRET_DO_NOT_LEAK_12345';
const badgeDump = JSON.stringify(POPUP.popupKeyBadge('gemini', SECRET, { gemini: { state: 'invalid' } }, false));
assert.ok(!badgeDump.includes(SECRET), 'popupKeyBadge çıktısında anahtar yer almamalı');
assert.deepEqual(POPUP.formatEngineIssue('gemini', sampleIssues, (k) => tr[k].message), {
  engine: 'Gemini', code: 'quota', msgKey: 'issueQuota', text: 'Gemini: ' + tr.issueQuota.message,
});
assert.equal(POPUP.formatEngineIssue('google', sampleIssues, (k) => tr[k].message), null);

// 8) Döndürülen tüm mesaj anahtarları hem en hem tr messages.json'da tanımlı olmalı
const keysToCheck = [
  'issueNokey', 'issueInvalid', 'issueQuota', 'issueNetwork',
  'issueTimeout', 'issueServer', 'issueMismatch', 'issueUnknown',
  'keyStatusValid', 'keyStatusInvalid', 'keyStatusQuota',
  'keyStatusNetwork', 'keyStatusUnchecked', 'keyStatusMissing', 'keyAddInfo',
  'btnTestKey', 'keyStatusTesting', 'keyBadgeInvalid', 'keyBadgeNetwork', 'engineNoKey',
  'engineAuto', 'engineGoogle', 'engineGemini', 'engineGroq',
  'toastTranslationOn', 'toastTranslationOff', 'btnBack',
  'navLanguage', 'navEngine', 'navTranscript', 'navAppearance', 'navAdvanced',
  'rowVersion', 'rowRepoPrivacy', 'rowFontSize', 'rowBgOpacity',
  'rowTextColor', 'colorWhite', 'colorYellow', 'colorGreen', 'colorCyan',
  'rowOrigPosition', 'origPosAbove', 'origPosBelow',
  'searchPlaceholder', 'transcriptEmpty', 'transcriptNoMatch',
  'btnCopy', 'msgCopied', 'btnDownloadSrt', 'btnDownloadTxt',
];
for (const k of keysToCheck) {
  assert.ok(en[k] && en[k].message, `en messages.json içinde ${k} eksik`);
  assert.ok(tr[k] && tr[k].message, `tr messages.json içinde ${k} eksik`);
}

// 9) Custom uç nokta (parseCustomEndpoint): https uç nokta kabul edilir ve origin izin deseni doğru üretilir
assert.deepEqual(POPUP.parseCustomEndpoint('https://api.openai.com/v1'), {
  ok: true,
  error: '',
  endpoint: 'https://api.openai.com/v1',
  origin: 'https://api.openai.com',
  permissionPattern: 'https://api.openai.com/*',
});
assert.deepEqual(POPUP.parseCustomEndpoint('https://api.openai.com'), {
  ok: true,
  error: '',
  endpoint: 'https://api.openai.com',
  origin: 'https://api.openai.com',
  permissionPattern: 'https://api.openai.com/*',
});
assert.deepEqual(POPUP.parseCustomEndpoint('https://my-proxy.internal:8443/v1'), {
  ok: true,
  error: '',
  endpoint: 'https://my-proxy.internal:8443/v1',
  origin: 'https://my-proxy.internal:8443',
  permissionPattern: 'https://my-proxy.internal:8443/*',
});

// 10) Custom uç nokta (parseCustomEndpoint): http://, boş, geçersiz metin reddedilir
assert.deepEqual(POPUP.parseCustomEndpoint('http://api.openai.com/v1'), {
  ok: false, error: 'https_required', endpoint: '', origin: '', permissionPattern: '',
});
assert.deepEqual(POPUP.parseCustomEndpoint('ftp://api.openai.com/v1'), {
  ok: false, error: 'https_required', endpoint: '', origin: '', permissionPattern: '',
});
assert.deepEqual(POPUP.parseCustomEndpoint(''), {
  ok: false, error: 'empty', endpoint: '', origin: '', permissionPattern: '',
});
assert.deepEqual(POPUP.parseCustomEndpoint('   '), {
  ok: false, error: 'empty', endpoint: '', origin: '', permissionPattern: '',
});
assert.deepEqual(POPUP.parseCustomEndpoint('///'), {
  ok: false, error: 'empty', endpoint: '', origin: '', permissionPattern: '',
});
assert.deepEqual(POPUP.parseCustomEndpoint(null), {
  ok: false, error: 'empty', endpoint: '', origin: '', permissionPattern: '',
});
assert.deepEqual(POPUP.parseCustomEndpoint(undefined), {
  ok: false, error: 'empty', endpoint: '', origin: '', permissionPattern: '',
});
assert.deepEqual(POPUP.parseCustomEndpoint('not-a-url'), {
  ok: false, error: 'invalid', endpoint: '', origin: '', permissionPattern: '',
});
assert.deepEqual(POPUP.parseCustomEndpoint('https://'), {
  ok: false, error: 'invalid', endpoint: '', origin: '', permissionPattern: '',
});

// 11) Custom uç nokta (parseCustomEndpoint): sondaki / ve fazladan boşluk temizlenir
assert.deepEqual(POPUP.parseCustomEndpoint('  https://api.openai.com/v1/  '), {
  ok: true,
  error: '',
  endpoint: 'https://api.openai.com/v1',
  origin: 'https://api.openai.com',
  permissionPattern: 'https://api.openai.com/*',
});
assert.deepEqual(POPUP.parseCustomEndpoint('https://api.openai.com/v1///'), {
  ok: true,
  error: '',
  endpoint: 'https://api.openai.com/v1',
  origin: 'https://api.openai.com',
  permissionPattern: 'https://api.openai.com/*',
});
assert.deepEqual(POPUP.parseCustomEndpoint('  https://api.openai.com/v1/chat/completions/  '), {
  ok: true,
  error: '',
  endpoint: 'https://api.openai.com/v1',
  origin: 'https://api.openai.com',
  permissionPattern: 'https://api.openai.com/*',
});
assert.deepEqual(POPUP.parseCustomEndpoint('  https://api.openai.com/  '), {
  ok: true,
  error: '',
  endpoint: 'https://api.openai.com',
  origin: 'https://api.openai.com',
  permissionPattern: 'https://api.openai.com/*',
});

// 12) normalizeGeminiModel: bilinmeyen/boş değerde 'fast' döndürür, fast/balanced/quality'yi korur
assert.equal(POPUP.normalizeGeminiModel(null), 'fast');
assert.equal(POPUP.normalizeGeminiModel(undefined), 'fast');
assert.equal(POPUP.normalizeGeminiModel(''), 'fast');
assert.equal(POPUP.normalizeGeminiModel('   '), 'fast');
assert.equal(POPUP.normalizeGeminiModel('unknown'), 'fast');
assert.equal(POPUP.normalizeGeminiModel('ultra'), 'fast');
assert.equal(POPUP.normalizeGeminiModel('pro'), 'fast');
assert.equal(POPUP.normalizeGeminiModel('fast'), 'fast');
assert.equal(POPUP.normalizeGeminiModel('balanced'), 'balanced');
assert.equal(POPUP.normalizeGeminiModel('quality'), 'quality');
assert.equal(POPUP.normalizeGeminiModel('FAST'), 'fast');
assert.equal(POPUP.normalizeGeminiModel('Balanced'), 'balanced');
assert.equal(POPUP.normalizeGeminiModel('QUALITY'), 'quality');

// 13) custom alanlarının görünürlüğü yalnızca motor 'custom' iken (ilgili fonksiyon varsa)
assert.equal(POPUP.shouldShowCustomFields('custom'), true);
assert.equal(POPUP.shouldShowCustomFields('CUSTOM'), true);
assert.equal(POPUP.shouldShowCustomFields('gemini'), false);
assert.equal(POPUP.shouldShowCustomFields('groq'), false);
assert.equal(POPUP.shouldShowCustomFields('auto'), false);
assert.equal(POPUP.shouldShowCustomFields('google'), false);
assert.equal(POPUP.shouldShowCustomFields(''), false);
assert.equal(POPUP.shouldShowCustomFields(null), false);
assert.equal(POPUP.shouldShowCustomFields(undefined), false);

assert.equal(POPUP.shouldShowGeminiQuality('gemini'), true);
assert.equal(POPUP.shouldShowGeminiQuality('GEMINI'), true);
assert.equal(POPUP.shouldShowGeminiQuality('custom'), false);
assert.equal(POPUP.shouldShowGeminiQuality('groq'), false);
assert.equal(POPUP.shouldShowGeminiQuality('auto'), false);
assert.equal(POPUP.shouldShowGeminiQuality(null), false);

assert.deepEqual(POPUP.engineOptionState('custom', { customKey: 'sk-test' }, {}), {
  code: 'custom', labelKey: 'engineCustom', hasKey: true, dim: false, noteKey: '',
});
assert.deepEqual(POPUP.engineOptionState('custom', { customKey: '' }, {}), {
  code: 'custom', labelKey: 'engineCustom', hasKey: false, dim: true, noteKey: 'engineNoKey',
});
assert.deepEqual(POPUP.popupKeyBadge('custom', 'sk-test', { custom: { state: 'permission' } }, false), {
  visible: true, state: 'permission', msgKey: 'keyBadgePermission', tone: 'orange',
});

console.log('13/13 arayüz testi geçti');
