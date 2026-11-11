// Panel saf mantık ve i18n anahtar eşleme testleri: node tests/ui.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.YTR = { t: (k) => k };
const ext = (f) => path.join(__dirname, '../extension', f);
const APP = require(ext('ui-appearance.js'));
const TRANS_UI = require(ext('ui-transcript.js'));
const UI = require(ext('ui-pages.js'));

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
assert.equal(APP.normalizeColor('#ffeb3b'), 'yellow');
assert.equal(APP.normalizeColor('magenta'), 'white');
assert.equal(APP.normalizeColor(null), 'white');
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
  colorCss: '#ffeb3b',
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

// 7) Döndürülen tüm mesaj anahtarları hem en hem tr messages.json'da tanımlı olmalı
const keysToCheck = [
  'issueNokey', 'issueInvalid', 'issueQuota', 'issueNetwork',
  'issueTimeout', 'issueServer', 'issueMismatch', 'issueUnknown',
  'keyStatusValid', 'keyStatusInvalid', 'keyStatusQuota',
  'keyStatusNetwork', 'keyStatusUnchecked', 'keyStatusMissing', 'keyAddInfo',
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

console.log('7/7 arayüz testi geçti');
