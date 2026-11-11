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

// 5) Varsayılan hedef dil, tarayıcı arayüz dilinden türetilir
const check = (ui, want) => { globalThis.chrome = { i18n: { getUILanguage: () => ui, getMessage: (k) => k } }; assert.equal(YTR.defaultTarget(), want, ui); };
check('tr', 'tr'); check('en-US', 'en'); check('de-DE', 'de'); check('pt-BR', 'pt-BR'); check('pt-PT', 'pt'); check('zh-TW', 'zh-TW'); check('zh', 'zh-CN'); check('nb', 'no'); check('sw', 'en');
console.log('sentences: varsayılan dil testi geçti');

// Yardımcı: Zaman damgalarının monoton ve çakışmasız olduğunu doğrular
function assertMonotonicAndNonOverlapping(sentences, label = '') {
  for (let i = 0; i < sentences.length; i++) {
    const cur = sentences[i];
    assert.ok(cur.s <= cur.e, `${label} #${i}: s (${cur.s}) <= e (${cur.e}) olmalı`);
    if (i > 0) {
      const prev = sentences[i - 1];
      assert.ok(cur.s >= prev.s, `${label} #${i}: s (${cur.s}) >= prev.s (${prev.s}) monoton olmalı`);
      assert.ok(cur.s >= prev.e, `${label} #${i}: s (${cur.s}) >= prev.e (${prev.e}) çakışmasız olmalı`);
    }
  }
}

// 6) (a) 8 ♪'lı satır -> 8 cümle, ♪ korunur, "♪ ♪" çift işaret birleşmesi yok
const musicLines = [
  '♪ first melody line ♪',
  '♪ second melody line ♪',
  '♪ third melody line ♪',
  '♪ fourth melody line ♪',
  '♪ fifth melody line ♪',
  '♪ sixth melody line ♪',
  '♪ seventh melody line ♪',
  '♪ eighth melody line ♪'
];
const musicEvents = musicLines.map((line, i) => ({
  tStartMs: i * 2000,
  dDurationMs: 1900,
  segs: [{ utf8: line }]
}));
const sMusic = YTR.buildSentences(musicEvents, 'en');
assert.equal(sMusic.length, 8, '8 ♪ satırı 8 ayrı cümle üretmeli');
assert.deepEqual(sMusic.map((x) => x.text), musicLines, 'Her satırın ♪ dahil orijinal metni korunmalı');
assert.ok(sMusic.every((x) => x.text.includes('♪')), 'Tüm cümlelerde ♪ korunmalı');
assert.ok(sMusic.every((x) => !x.text.includes('♪ ♪') && !x.text.includes('♪♪')), '"♪ ♪" çift işaret birleşmesi olmamalı');
assertMonotonicAndNonOverlapping(sMusic, 'music8');

// Kelime/token düzeyinde ardışık ♪ işaretli olaylar
const musicTokensEv = [{
  tStartMs: 0,
  dDurationMs: 16000,
  segs: musicLines.flatMap((line, i) => [
    { utf8: '♪', tOffsetMs: i * 2000 },
    { utf8: ` lyric verse ${i + 1}`, tOffsetMs: i * 2000 + 300 },
    { utf8: ' ♪', tOffsetMs: i * 2000 + 1200 }
  ])
}];
const sMusicWordLevel = YTR.buildSentences(musicTokensEv, 'en');
assert.equal(sMusicWordLevel.length, 8, 'Kelime düzeyinde 8 ♪ satırı 8 cümle olmalı');
assert.ok(sMusicWordLevel.every((x) => !x.text.includes('♪ ♪')), 'Kelime düzeyinde de "♪ ♪" birleşmesi olmamalı');
assertMonotonicAndNonOverlapping(sMusicWordLevel, 'musicWordLevel');
console.log('sentences: (a) 8 müzik satırı testi geçti');

// 7) (b) Noktalamasız ~600 karakterlik konuşma -> hiçbir cümle 220 karakteri/14 sn'yi aşmaz, tüm kelimeler sırayla korunur
const speechWords = (
  'today we examine automated speech recognition subtitles and how continuous unpunctuated spoken audio ' +
  'can be safely segmented into readable sentences without dropping or reordering any words along the way ' +
  'in modern web video platforms speech often lacks punctuation marks like periods commas or question marks ' +
  'requiring an intelligent splitting algorithm that enforces upper limits of around two hundred twenty characters ' +
  'and fourteen seconds duration while prioritizing natural pauses between words and ensuring seamless timing ' +
  'for translated captions displayed across various screen sizes and resolutions for learners worldwide'
).split(' ');
const speechRawText = speechWords.join(' ');
assert.ok(speechRawText.length >= 550 && speechRawText.length <= 650, `Konuşma ~600 karakter olmalı (${speechRawText.length})`);

// Kelime zaman damgaları: her kelime 300 ms, aralarda doğal duraklamalar
const speechEvents = [{
  tStartMs: 0,
  dDurationMs: speechWords.length * 300,
  segs: speechWords.map((w, i) => ({
    utf8: (i ? ' ' : '') + w,
    tOffsetMs: i * 300
  }))
}];
const sSpeech = YTR.buildSentences(speechEvents, 'en');
assert.ok(sSpeech.length >= 3, 'Noktalamasız uzun konuşma birden fazla cümleye bölünmeli');
assert.ok(sSpeech.every((x) => x.text.length <= 220), 'Hiçbir cümle 220 karakter üst sınırını aşmamalı');
assert.ok(sSpeech.every((x) => (x.e - x.s) <= 14000), 'Hiçbir cümle 14 saniye üst sınırını aşmamalı');
assert.equal(sSpeech.map((x) => x.text).join(' '), speechRawText, 'Tüm kelimeler sırayla ve eksiksiz korunmalı');
assertMonotonicAndNonOverlapping(sSpeech, 'speech600');
console.log('sentences: (b) noktalamasız ~600 karakterlik konuşma testi geçti');

// 8) (c) <3 kelimelik kuyruk birleşir
// Gövde + 2 kelimelik kuyruk ("final words")
const headWords = 'we are testing that when a long unpunctuated sentence is broken down any dangling tail with fewer than three words gets merged with the preceding chunk rather than standing alone'.split(' ');
const tailWords = ['final', 'words'];
const allWords = headWords.concat(tailWords);
const tailEvents = [{
  tStartMs: 0,
  dDurationMs: 14300,
  segs: allWords.map((w, i) => ({
    utf8: (i ? ' ' : '') + w,
    tOffsetMs: i * (i < headWords.length ? 450 : 400)
  }))
}];
const sTail = YTR.buildSentences(tailEvents, 'en');
assert.ok(sTail.length >= 1, 'Cümleler oluşmalı');
assert.ok(sTail.every((x) => x.toks.length >= 3), 'Hiçbir cümle 3 kelimeden az kuyruk olmamalı');
assert.ok(sTail[sTail.length - 1].text.endsWith('final words'), 'Kuyruk kelimeleri son cümleye birleştirilmiş olmalı');
assert.equal(sTail.map((x) => x.text).join(' '), allWords.join(' '), 'Tüm kelimeler korunmalı');
assertMonotonicAndNonOverlapping(sTail, 'tailMerge');

// Ayrıca doğal duraklama son 2 kelimeden hemen önce olsa bile (<3 kelime kuralı nedeniyle) orada bölünmemeli
const pauseBeforeTailWords = 'here is another sentence where a pause occurs right before the very last two words'.split(' ');
const pauseBeforeTailEvents = [{
  tStartMs: 0,
  dDurationMs: 15000,
  segs: pauseBeforeTailWords.map((w, i) => ({
    utf8: (i ? ' ' : '') + w,
    tOffsetMs: i * 650 + (i >= pauseBeforeTailWords.length - 2 ? 400 : 0)
  }))
}];
const sPauseTail = YTR.buildSentences(pauseBeforeTailEvents, 'en');
assert.ok(sPauseTail.every((x) => x.toks.length >= 3), 'Duraklamaya rağmen <3 kelimelik kuyruk tek başına kalmamalı');
assert.equal(sPauseTail.map((x) => x.text).join(' '), pauseBeforeTailWords.join(' '));
assertMonotonicAndNonOverlapping(sPauseTail, 'pauseBeforeTail');
console.log('sentences: (c) <3 kelimelik kuyruk birleşme testi geçti');

// 9) (d) CJK (Çince / Japonca)
// Noktalamasız ~140 karakterlik Çince metin (90 karakter sınırını test eder)
const cjkZhText = '这是一段用于测试中文字幕分割算法的长文本在没有任何标点符号的情况下系统必须严格遵守约九十个字符的上限将文本分割成多个合理的句子并且保证所有汉字按原顺序完整保留且字与字之间不能有多余的空格插入';
assert.ok(cjkZhText.length > 90, `Çince metin >90 karakter olmalı (${cjkZhText.length})`);
const cjkZhEvents = [{
  tStartMs: 0,
  dDurationMs: 16000,
  segs: [{ utf8: cjkZhText }]
}];
const sCjkZh = YTR.buildSentences(cjkZhEvents, 'zh');
assert.ok(sCjkZh.length >= 2, 'CJK uzun metin 90 karakter sınırında bölünmeli');
assert.ok(sCjkZh.every((x) => x.text.length <= 90), 'Hiçbir CJK cümlesi 90 karakteri aşmamalı');
assert.equal(sCjkZh.map((x) => x.text).join(''), cjkZhText, 'CJK metni boşluksuz ve eksiksiz korunmalı');
assert.ok(sCjkZh.every((x) => x.join === ''), 'CJK join boş dize olmalı');
assertMonotonicAndNonOverlapping(sCjkZh, 'cjkZh');

// Japonca noktalama işaretleri ile cümle bölme (。！？)
const jaEvents = [
  { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'こんにちは！' }] },
  { tStartMs: 2000, dDurationMs: 2000, segs: [{ utf8: '今日は良い天気ですね。' }] },
  { tStartMs: 4000, dDurationMs: 2000, segs: [{ utf8: '富士山は見えますか？' }] },
  { tStartMs: 6000, dDurationMs: 2000, segs: [{ utf8: 'とても綺麗です。' }] }
];
const sJa = YTR.buildSentences(jaEvents, 'ja');
assert.equal(sJa.length, 4, 'Japonca noktalama işaretlerinden 4 cümle ayrılmalı');
assert.deepEqual(sJa.map((x) => x.text), ['こんにちは！', '今日は良い天気ですね。', '富士山は見えますか？', 'とても綺麗です。']);
assert.ok(sJa.every((x) => x.join === ''));
assertMonotonicAndNonOverlapping(sJa, 'cjkJa');

// Noktalamasız ~100 karakterlik Japonca metin (≈90 karakter sınırını test eder)
const jaLongText = '日本語の字幕処理において句読点が存在しない非常に長い音声認識の結果であってもシステムは約九十文字の上限を基準として適切に文を分割し全体の意味や単語の順序を壊すことなく正確に画面上に表示する必要があります';
assert.ok(jaLongText.length > 90, `Japonca metin >90 karakter olmalı (${jaLongText.length})`);
const sJaLong = YTR.buildSentences([{ tStartMs: 0, dDurationMs: 12000, segs: [{ utf8: jaLongText }] }], 'ja');
assert.ok(sJaLong.length >= 2, 'Japonca uzun metin ≈90 karakter sınırında bölünmeli');
assert.ok(sJaLong.every((x) => x.text.length <= 90), 'Hiçbir Japonca cümle parçası 90 karakteri aşmamalı');
assert.equal(sJaLong.map((x) => x.text).join(''), jaLongText, 'Japonca metin boşluksuz ve eksiksiz korunmalı');
assert.ok(sJaLong.every((x) => x.join === ''));
assertMonotonicAndNonOverlapping(sJaLong, 'jaLong');
console.log('sentences: (d) CJK testi geçti');

// 10) (e) s/e zaman damgaları monoton, çakışmasız
// (i) 900 ms'den kısa süren olaylar (ekran uzatma çakışma yaratmamalı)
const shortEvents = [
  { tStartMs: 0, dDurationMs: 200, segs: [{ utf8: 'One.' }] },
  { tStartMs: 400, dDurationMs: 300, segs: [{ utf8: 'Two.' }] },
  { tStartMs: 800, dDurationMs: 200, segs: [{ utf8: 'Three.' }] },
  { tStartMs: 1200, dDurationMs: 400, segs: [{ utf8: 'Four.' }] }
];
const sShort = YTR.buildSentences(shortEvents, 'en');
assert.equal(sShort.length, 4);
assertMonotonicAndNonOverlapping(sShort, 'shortEvents');

// (ii) ≥1,5 sn sessizlik sınırı (cümle bölmeli ve zaman damgası çakışmasız olmalı)
const silenceEvents = [
  { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: 'First part of speech' }] },
  { tStartMs: 4800, dDurationMs: 2000, segs: [{ utf8: 'Second part after pause' }] }
];
const sSilence = YTR.buildSentences(silenceEvents, 'en');
assert.equal(sSilence.length, 2, '≥1.5 sn sessizlikte cümle bölünmeli');
assertMonotonicAndNonOverlapping(sSilence, 'silenceEvents');
assert.ok(sSilence[1].s - sSilence[0].e >= 800, 'Sessizlik boşluğu korunmalı');

// (iii) Düzensiz / sıkışık zaman damgalarında monotonluk ve çakışmasızlık güvencesi
const chaoticEvents = [
  { tStartMs: 0, dDurationMs: 500, segs: [{ utf8: 'Hello world.' }] },
  { tStartMs: 300, dDurationMs: 600, segs: [{ utf8: 'Next quick sentence.' }] },
  { tStartMs: 700, dDurationMs: 100, segs: [{ utf8: 'Tiny.' }] },
  { tStartMs: 900, dDurationMs: 3000, segs: [{ utf8: 'Final longer phrase here.' }] }
];
const sChaotic = YTR.buildSentences(chaoticEvents, 'en');
assertMonotonicAndNonOverlapping(sChaotic, 'chaoticEvents');

// (iv) toCues çıktısında da zaman damgaları monoton olmalı
const sForCues = YTR.buildSentences(mk('This is a longer test sentence to verify cues generation timestamps monotonicity.'), 'en');
sForCues[0].tr = 'Bu işaretler zaman damgası monotonluğunu doğrulamak için daha uzun bir test cümlesidir.';
const cuesTest = YTR.toCues(sForCues, 25);
for (let i = 0; i < cuesTest.length; i++) {
  assert.ok(cuesTest[i].s <= cuesTest[i].e, `Cue #${i} s <= e`);
  if (i > 0) {
    assert.ok(cuesTest[i].s >= cuesTest[i - 1].s, `Cue #${i} s (${cuesTest[i].s}) >= prev.s (${cuesTest[i - 1].s})`);
  }
}
console.log('sentences: (e) zaman damgaları monoton ve çakışmasız testi geçti');

