// Kanal dili yardımcıları testleri: node tests/channel.test.cjs
const assert = require('assert');
const path = require('path');

globalThis.YTR = {};
const { keyOf, pick, put, MAX_ENTRIES } = require(path.join(__dirname, '../extension/channel.js'));

(() => {
  let passed = 0;
  const total = 6;

  // 1) keyOf: kırpma, <=80 sınırı ve boş anahtar kontrolü
  {
    assert.equal(keyOf(''), '');
    assert.equal(keyOf('   '), '');
    assert.equal(keyOf(null), '');
    assert.equal(keyOf(undefined), '');
    assert.equal(keyOf('  Veritasium  '), 'Veritasium');
    assert.equal(keyOf('Kurzgesagt – In a Nutshell'), 'Kurzgesagt – In a Nutshell');

    const longName = 'A'.repeat(120);
    const kLong = keyOf(longName);
    assert.equal(kLong.length, 80);
    assert.equal(kLong, 'A'.repeat(80));

    const longWithSpaces = '  ' + 'B'.repeat(80) + '  extra  ';
    assert.equal(keyOf(longWithSpaces).length, 80);
    assert.equal(keyOf(longWithSpaces), 'B'.repeat(80));
    passed++;
  }

  // 2) pick: mevcut anahtar, eksik anahtar, boş anahtar ve Map nesnesi desteği
  {
    const map = { 'Veritasium': 'de', '3Blue1Brown': 'fr' };
    assert.equal(pick(map, 'Veritasium'), 'de');
    assert.equal(pick(map, '  Veritasium  '), 'de', 'boşluklar kırpılarak eşleşmeli');
    assert.equal(pick(map, '3Blue1Brown'), 'fr');
    assert.equal(pick(map, 'Kurzgesagt'), null, 'olmayan kanal null dönmeli');

    // Boş anahtar ve boş harita
    assert.equal(pick(map, ''), null);
    assert.equal(pick(map, '   '), null);
    assert.equal(pick(map, null), null);
    assert.equal(pick(null, 'Veritasium'), null);
    assert.equal(pick(undefined, 'Veritasium'), null);

    // Map nesnesi
    const es6Map = new Map([['Kurzgesagt', 'tr']]);
    assert.equal(pick(es6Map, 'Kurzgesagt'), 'tr');
    assert.equal(pick(es6Map, 'Bilinmeyen'), null);
    passed++;
  }

  // 3) put: saf fonksiyon (özgün nesneyi değiştirmez, yeni nesne döner)
  {
    const initial = { 'Veritasium': 'de' };
    const next = put(initial, 'Kurzgesagt', 'tr');
    assert.notEqual(initial, next, 'put yeni bir nesne döndürmeli');
    assert.deepEqual(initial, { 'Veritasium': 'de' }, 'özgün nesne değişmemeli');
    assert.deepEqual(next, { 'Veritasium': 'de', 'Kurzgesagt': 'tr' });

    // Mevcut kaydı güncelleme
    const updated = put(next, 'Veritasium', 'es');
    assert.equal(updated['Veritasium'], 'es');
    assert.equal(Object.keys(updated).length, 2);
    assert.equal(initial['Veritasium'], 'de', 'özgün nesne korunmalı');
    passed++;
  }

  // 4) boş anahtar: put boş anahtar veya boş dil ile haritaya ekleme yapmaz
  {
    const initial = { 'ChanA': 'en' };
    assert.deepEqual(put(initial, '', 'tr'), initial);
    assert.deepEqual(put(initial, '   ', 'tr'), initial);
    assert.deepEqual(put(initial, null, 'tr'), initial);
    assert.deepEqual(put(initial, undefined, 'tr'), initial);
    assert.deepEqual(put(initial, 'ChanB', ''), initial);
    assert.deepEqual(put(initial, 'ChanB', null), initial);
    assert.notEqual(put(initial, '', 'tr'), initial, 'yine de yeni bir kopya nesne dönmeli');
    passed++;
  }

  // 5) sınır (limit): en eski kayıt atılır (FIFO / LRU), güncellenen sona taşınır
  {
    assert.equal(MAX_ENTRIES, 200);

    // Özel sınır max = 3
    let m = {};
    m = put(m, 'ch1', 'l1', 3);
    m = put(m, 'ch2', 'l2', 3);
    m = put(m, 'ch3', 'l3', 3);
    assert.deepEqual(Object.keys(m), ['ch1', 'ch2', 'ch3']);

    // 4. eklenince en eski (ch1) atılır
    m = put(m, 'ch4', 'l4', 3);
    assert.deepEqual(Object.keys(m), ['ch2', 'ch3', 'ch4']);
    assert.equal(m['ch1'], undefined);
    assert.equal(m['ch4'], 'l4');

    // ch2 güncellenince en yeniye (sona) taşınır
    m = put(m, 'ch2', 'l2_new', 3);
    assert.deepEqual(Object.keys(m), ['ch3', 'ch4', 'ch2']);

    // Şimdi bir tane daha eklenirse ch3 atılır (çünkü ch2 yenilenmişti)
    m = put(m, 'ch5', 'l5', 3);
    assert.deepEqual(Object.keys(m), ['ch4', 'ch2', 'ch5']);
    assert.equal(m['ch3'], undefined);
    assert.equal(m['ch2'], 'l2_new');
    passed++;
  }

  // 6) Varsayılan 200 sınırı davranışı
  {
    let bigMap = {};
    for (let i = 1; i <= 210; i++) {
      bigMap = put(bigMap, `channel_${i}`, `lang_${i}`);
    }
    const keys = Object.keys(bigMap);
    assert.equal(keys.length, 200, 'varsayılan sınır 200 olmalı');
    assert.equal(bigMap['channel_1'], undefined, 'ilk 10 kanal atılmış olmalı');
    assert.equal(bigMap['channel_10'], undefined);
    assert.equal(bigMap['channel_11'], 'lang_11', '11. kanal en eski olarak kalmalı');
    assert.equal(bigMap['channel_210'], 'lang_210');
    passed++;
  }

  console.log(`${passed}/${total} kanal testi geçti`);
  if (passed !== total) process.exit(1);
})();
