// Transkript yardımcıları testleri: node tests/transcript.test.cjs
const assert = require('assert');
const path = require('path');

try {
  globalThis.YTR = {};
  const ext = (f) => path.join(__dirname, '../extension', f);
  const T = require(ext('transcript.js'));

  let passed = 0;
  const total = 11;

  // 1) clock: oynatıcı zaman biçimi ve saat geçişi (3599999 / 3600000 ms)
  assert.equal(T.clock(-500), '0:00');
  assert.equal(T.clock(NaN), '0:00');
  assert.equal(T.clock(0), '0:00');
  assert.equal(T.clock(5000), '0:05');
  assert.equal(T.clock(62000), '1:02');
  assert.equal(T.clock(3599999), '59:59');
  assert.equal(T.clock(3600000), '1:00:00');
  assert.equal(T.clock(3723000), '1:02:03');
  assert.equal(T.clock(36000000), '10:00:00');
  passed++;

  // 2) srtTime: HH:MM:SS,mmm biçimi ve sınır değerler
  assert.equal(T.srtTime(-10), '00:00:00,000');
  assert.equal(T.srtTime(0), '00:00:00,000');
  assert.equal(T.srtTime(62345), '00:01:02,345');
  assert.equal(T.srtTime(3599999), '00:59:59,999');
  assert.equal(T.srtTime(3600000), '01:00:00,000');
  passed++;

  // 3) lineText: translation, original, both kipleri ve trim
  assert.equal(T.lineText(null), '');
  assert.equal(T.lineText({ text: '  merhaba  ', tr: '  hello  ' }), 'hello');
  assert.equal(T.lineText({ text: 'merhaba', tr: '' }), 'merhaba');
  assert.equal(T.lineText({ text: 'merhaba', tr: null }), 'merhaba');
  assert.equal(T.lineText({ text: 'merhaba', tr: 'hello' }, 'original'), 'merhaba');
  assert.equal(T.lineText({ text: 'merhaba', tr: 'hello' }, 'both'), 'hello\nmerhaba');
  assert.equal(T.lineText({ text: 'merhaba', tr: null }, 'both'), 'merhaba');
  passed++;

  // 4) toSrt: örtüşme kırpma, boş satır atlama, ardışık numara ve format
  assert.equal(T.toSrt([]), '');
  assert.equal(T.toSrt([{ s: 0, e: 1000, text: '   ', tr: '' }]), '');
  const srtInput = [
    { s: 1000, e: 5000, text: 'birinci', tr: '' },
    { s: 2000, e: 3000, text: '   ', tr: '' }, // boş satır atlanmalı
    { s: 4000, e: 7000, text: 'ikinci', tr: 'çeviri 2' },
    { s: 6000, e: 5000, text: 'üçüncü', tr: '' } // e <= s durumu: en az s + 1 ms
  ];
  const srtOut = T.toSrt(srtInput);
  const expectedSrt =
    '1\n00:00:01,000 --> 00:00:04,000\nbirinci\n\n' +
    '2\n00:00:04,000 --> 00:00:06,000\nçeviri 2\n\n' +
    '3\n00:00:06,000 --> 00:00:06,001\nüçüncü\n';
  assert.equal(srtOut, expectedSrt);

  // 'both' kipiyle SRT
  const srtBoth = T.toSrt([{ s: 0, e: 2000, text: 'World', tr: 'Dünya' }], { mode: 'both' });
  assert.equal(srtBoth, '1\n00:00:00,000 --> 00:00:02,000\nDünya\nWorld\n');
  passed++;

  // 5) toTxt: düz metin, zaman damgaları ve both kipi
  const txtInput = [
    { s: 5000, e: 7000, text: 'Hello', tr: 'Merhaba' },
    { s: 8000, e: 9000, text: '  ', tr: '' }, // atlanmalı
    { s: 62000, e: 65000, text: 'World', tr: null }
  ];
  assert.equal(T.toTxt(txtInput), 'Merhaba\nWorld');
  assert.equal(T.toTxt(txtInput, { mode: 'original' }), 'Hello\nWorld');
  assert.equal(T.toTxt(txtInput, { timestamps: true }), '[0:05] Merhaba\n[1:02] World');
  assert.equal(
    T.toTxt(txtInput, { mode: 'both', timestamps: true }),
    '[0:05] Merhaba\nHello\n[1:02] World'
  );
  assert.equal(
    T.toTxt(txtInput, { mode: 'both', timestamps: false }),
    'Merhaba\nHello\nWorld'
  );
  passed++;

  // 6) stats: toplam ve çevrilmiş cümle sayısı
  assert.deepEqual(T.stats([]), { total: 0, translated: 0 });
  assert.deepEqual(
    T.stats([
      { text: 'a', tr: 'b' },
      { text: 'c', tr: null },
      { text: 'd', tr: '   ' },
      { text: 'e', tr: 'f' }
    ]),
    { total: 4, translated: 2 }
  );
  passed++;

  // 7) search: Türkçe İ/ı, CJK, büyük/küçük harf ve sorgu trim
  assert.equal(T.search([{ text: 'test' }], ''), null);
  assert.equal(T.search([{ text: 'test' }], '   '), null);
  const searchItems = [
    { text: 'IŞIK', tr: 'ışık' },
    { text: 'İstanbul', tr: 'ISTANBUL' },
    { text: 'こんにちは世界', tr: 'hello world' },
    { text: 'nothing here', tr: null }
  ];
  assert.deepEqual(T.search(searchItems, 'ışık', 'tr'), [0]);
  assert.deepEqual(T.search(searchItems, 'IŞIK', 'tr'), [0]);
  assert.deepEqual(T.search(searchItems, 'istanbul', 'tr'), [1]);
  assert.deepEqual(T.search(searchItems, 'İSTANBUL', 'tr'), [1]);
  assert.deepEqual(T.search(searchItems, '  世界  '), [2]);
  assert.deepEqual(T.search(searchItems, 'WORLD'), [2]);
  assert.deepEqual(T.search(searchItems, 'bulunamaz'), []);
  // Geçersiz yerel ayarda hata vermemeli
  assert.deepEqual(T.search(searchItems, 'hello', 'invalid-locale-xyz'), [2]);
  passed++;

  // 8) filterSentences: büyük/küçük harf ve Türkçe i/İ duyarsız, orijinal+çeviri içinde arar, eşleşen indeksleri döndürür
  assert.deepEqual(T.filterSentences([], 'test'), []);
  assert.deepEqual(T.filterSentences(searchItems, ''), [0, 1, 2, 3]);
  assert.deepEqual(T.filterSentences(searchItems, '   '), [0, 1, 2, 3]);
  assert.deepEqual(T.filterSentences(searchItems, 'ışık'), [0]);
  assert.deepEqual(T.filterSentences(searchItems, 'IŞIK'), [0]);
  assert.deepEqual(T.filterSentences(searchItems, 'istanbul'), [1]);
  assert.deepEqual(T.filterSentences(searchItems, 'İSTANBUL'), [1]);
  assert.deepEqual(T.filterSentences([{ text: 'İzmir ve Iğdır', tr: 'Aegean' }], 'izmir ve ığdır'), [0]);
  assert.deepEqual(T.filterSentences([{ text: 'izmir', tr: 'şehir' }], 'İZMİR'), [0]);
  assert.deepEqual(T.filterSentences([{ text: 'city', tr: 'ŞEHİR' }], 'şehir'), [0]);
  assert.deepEqual(T.filterSentences(searchItems, '  世界  '), [2]);
  assert.deepEqual(T.filterSentences(searchItems, 'WORLD'), [2]);
  assert.deepEqual(T.filterSentences(searchItems, 'bulunamaz'), []);
  assert.equal(globalThis.YTR.filterSentences, T.filterSentences);
  assert.equal(globalThis.YTR.toTxt, T.toTxt);
  assert.equal(globalThis.YTR.activeIndex, T.activeIndex);
  passed++;

  // 9) activeIndex: ikili arama ile son cümlenin indisi
  const sentList = [{ s: 1000 }, { s: 3000 }, { s: 5000 }, { s: 8000 }];
  assert.equal(T.activeIndex([], 2000), -1);
  assert.equal(T.activeIndex(sentList, NaN), -1);
  assert.equal(T.activeIndex(sentList, 500), -1); // ilk öğeden önce
  assert.equal(T.activeIndex(sentList, 1000), 0); // tam ilk öğe
  assert.equal(T.activeIndex(sentList, 2000), 0); // aralıkta (cümleler arası boşluk)
  assert.equal(T.activeIndex(sentList, 3000), 1);
  assert.equal(T.activeIndex(sentList, 7999), 2);
  assert.equal(T.activeIndex(sentList, 8000), 3); // tam son öğe
  assert.equal(T.activeIndex(sentList, 99999), 3); // son öğeden sonra
  passed++;

  // 10) windowRange: pencere kaydırma tablosu
  assert.deepEqual(T.windowRange(0, 500, 100), { from: 0, to: 100 });
  assert.deepEqual(T.windowRange(495, 500, 100), { from: 400, to: 500 });
  assert.deepEqual(T.windowRange(20, 50, 100), { from: 0, to: 50 }); // total < size
  assert.deepEqual(T.windowRange(-10, 500, 100), { from: 0, to: 100 }); // center < 0
  assert.deepEqual(T.windowRange(250, 500, 100), { from: 200, to: 300 });
  assert.deepEqual(T.windowRange(0, 0, 100), { from: 0, to: 0 }); // total = 0
  assert.deepEqual(T.windowRange(600, 500, 100), { from: 400, to: 500 }); // center > total
  passed++;

  // 11) fileName: dosya adı formatı ve karakter temizleme
  assert.equal(T.fileName('dQw4w9WgXcQ', 'tr', 'srt'), 'subtitles-dQw4w9WgXcQ.tr.srt');
  assert.equal(T.fileName('', 'en', 'txt'), 'subtitles-video.en.txt');
  assert.equal(T.fileName(null, 'en', 'txt'), 'subtitles-video.en.txt');
  assert.equal(T.fileName('   ', 'en', 'txt'), 'subtitles-video.en.txt');
  assert.equal(T.fileName('vid:123/foo bar', 'pt-BR', '.srt'), 'subtitles-vid_123_foo_bar.pt-BR.srt');
  assert.equal(T.fileName('abc', 'zh_CN', 'srt'), 'subtitles-abc.zh_CN.srt');
  passed++;

  console.log(`${passed}/${total} transkript testi geçti`);
} catch (err) {
  console.error('BAŞARISIZ: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
}
