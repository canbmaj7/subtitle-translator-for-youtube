// Panel saf mantık ve i18n anahtar eşleme testleri: node tests/ui.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.YTR = { t: (k) => k };
const ext = (f) => path.join(__dirname, '../extension', f);
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

// 5) Döndürülen tüm mesaj anahtarları hem en hem tr messages.json'da tanımlı olmalı
const keysToCheck = [
  'issueNokey', 'issueInvalid', 'issueQuota', 'issueNetwork',
  'issueTimeout', 'issueServer', 'issueMismatch', 'issueUnknown',
  'keyStatusValid', 'keyStatusInvalid', 'keyStatusQuota',
  'keyStatusNetwork', 'keyStatusUnchecked', 'keyStatusMissing', 'keyAddInfo',
  'engineAuto', 'engineGoogle', 'engineGemini', 'engineGroq',
  'toastTranslationOn', 'toastTranslationOff', 'btnBack',
  'navLanguage', 'navEngine', 'navTranscript', 'navAppearance', 'navAdvanced',
  'comingSoon', 'rowVersion', 'rowRepoPrivacy',
];
for (const k of keysToCheck) {
  assert.ok(en[k] && en[k].message, `en messages.json içinde ${k} eksik`);
  assert.ok(tr[k] && tr[k].message, `tr messages.json içinde ${k} eksik`);
}

console.log('5/5 arayüz testi geçti');
