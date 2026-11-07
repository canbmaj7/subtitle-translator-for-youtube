// Cümle birleştirme, kısaltma ve hizalama testleri: node tests/sentences.test.cjs
const assert = require('assert');
const path = require('path');
globalThis.YTR = {};
globalThis.chrome = { i18n: { getMessage: (k) => k, getUILanguage: () => 'tr' } };
const ext = (f) => path.join(__dirname, '../extension', f);
require(ext('languages.js'));
require(ext('sentences.js'));

const mk = (t) => t.split(' ').map((w, i) => ({ tStartMs: i * 400, dDurationMs: 400, segs: [{ utf8: w }] }));

// 1) a.m. / Mr. / ondalık sayı cümleyi bölmez
let s = YTR.buildSentences(mk('They want to know that the system at 3:00 a.m. will not crash. Okay. It costs 3.5 dollars. Mr. Smith left.'), 'en');
assert.deepEqual(s.map((x) => x.text), ['They want to know that the system at 3:00 a.m. will not crash.', 'Okay.', 'It costs 3.5 dollars.', 'Mr. Smith left.']);

// 2) Noktalamasız ASR: kelime zamanlı uzun cümle parçalanır, orijinal kelimeler zamana göre hizalanır ve hiçbiri kaybolmaz
const words = 'it is commonly used to build server side applications like web apps with a framework and it is also popular for data science and machine learning because of its simple syntax'.split(' ');
const ev = [{ tStartMs: 1000, dDurationMs: 9000, segs: words.map((w, i) => ({ utf8: (i ? ' ' : '') + w, tOffsetMs: i * 300 })) }];
s = YTR.buildSentences(ev, 'en');
assert.equal(s.length, 1);
s[0].tr = 'genellikle bir çerçeveyle web uygulamaları gibi sunucu tarafı uygulamaları oluşturmak için kullanılır ve basit sözdizimi nedeniyle veri bilimi ve makine öğrenimi için de popülerdir';
let cues = YTR.toCues(s, 70);
assert.ok(cues.length >= 2);
assert.equal(cues.map((c) => c.t).join(' ').trim(), words.join(' '));
assert.ok(cues.every((c, i) => i === 0 || c.s >= cues[i - 1].s));

// 3) CJK hedefte kısa parçalar
s = YTR.buildSentences(ev, 'en');
s[0].tr = '通常用于使用框架构建服务器端应用程序，例如网络应用程序，并且由于其简单的语法，它在数据科学和机器学习领域也很受欢迎。';
cues = YTR.toCues(s, 30);
assert.ok(cues.length >= 2 && cues.every((c) => c.tr.length <= 36));

// 4) Dil yardımcıları
assert.equal(YTR.LANGS.length, 34);
assert.ok(YTR.isRtl('ar') && YTR.isRtl('he') && !YTR.isRtl('tr'));
assert.ok(YTR.isCjk('ja') && YTR.isCjk('zh-CN') && !YTR.isCjk('de'));
console.log('sentences: 4/4 test geçti');
