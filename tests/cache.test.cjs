// Çeviri önbelleği testleri: node tests/cache.test.cjs
const assert = require('assert');
const path = require('path');

globalThis.YTR = {};
const { createCache, keyFor, usable, wantsAI, withCache, VERSION } = require(path.join(__dirname, '../extension/cache.js'));

// chrome.storage.local benzeri bellek içi depo
function fakeStore() {
  const data = {};
  const pick = (k) => {
    if (k && typeof k === 'object' && !Array.isArray(k)) {
      const out = { ...k };
      for (const x of Object.keys(k)) if (x in data) out[x] = JSON.parse(JSON.stringify(data[x]));
      return out;
    }
    const keys = Array.isArray(k) ? k : [k];
    const out = {};
    for (const x of keys) if (x in data) out[x] = JSON.parse(JSON.stringify(data[x]));
    return out;
  };
  return {
    data,
    get: async (k) => pick(k),
    set: async (o) => { for (const k in o) data[k] = JSON.parse(JSON.stringify(o[k])); },
    remove: async (k) => { for (const x of (Array.isArray(k) ? k : [k])) delete data[x]; },
  };
}

(async () => {
  let passed = 0;
  const total = 11;
  const L = ['Hello world', 'How are you'];

  // 1) Yaz-oku gidiş dönüş ve VERSION 2
  {
    assert.equal(VERSION, 2);
    assert.ok(keyFor(L, 'en', 'tr').startsWith('tc2:'), 'anahtar tc2: ile başlamalı');
    const store = fakeStore();
    // Eski v1 kaydı görmezden gelinir
    store.data['tc1:eski'] = { res: ['Eski 1', 'Eski 2'], engine: 'Gemini' };
    const c = createCache(store);
    assert.equal(await c.get(L, 'en', 'tr', false), null);
    await c.put(L, 'en', 'tr', ['Merhaba dünya', 'Nasılsın'], 'Gemini');
    const hit = await c.get(L, 'en', 'tr', false);
    assert.deepEqual(hit, { res: ['Merhaba dünya', 'Nasılsın'], engine: 'Gemini' });
    passed++;
  }

  // 2) Anahtar: kaynak dil, hedef dil, variant ve metin ayırır; aynı girdi aynı anahtarı verir
  {
    assert.equal(keyFor(L, 'en', 'tr'), keyFor(L.slice(), 'en', 'tr'));
    assert.equal(keyFor(L, 'en', 'tr'), keyFor(L, 'en', 'tr', ''));
    assert.notEqual(keyFor(L, 'en', 'tr'), keyFor(L, 'en', 'de'));
    assert.notEqual(keyFor(L, 'en', 'tr'), keyFor(L, 'fr', 'tr'));
    assert.notEqual(keyFor(L, 'en', 'tr', 'fast'), keyFor(L, 'en', 'tr', 'quality'));
    assert.notEqual(keyFor(L, 'en', 'tr', ''), keyFor(L, 'en', 'tr', 'custom:gpt-4o'));
    assert.notEqual(keyFor(['a b'], 'en', 'tr'), keyFor(['a', 'b'], 'en', 'tr'));
    assert.notEqual(keyFor(['ab', 'c'], 'en', 'tr'), keyFor(['a', 'bc'], 'en', 'tr'));
    const c = createCache(fakeStore());
    await c.put(L, 'en', 'tr', ['x', 'y'], 'Gemini');
    assert.equal(await c.get(L, 'en', 'de', false), null, 'başka hedef dil isabet etmemeli');
    passed++;
  }

  // 3) Google kaydı, yapay zekâ kullanılabilirken atlanır; yoksa kullanılır
  {
    const c = createCache(fakeStore());
    await c.put(L, 'en', 'tr', ['g1', 'g2'], 'Google');
    assert.equal(await c.get(L, 'en', 'tr', true), null);
    assert.equal((await c.get(L, 'en', 'tr', false)).engine, 'Google');
    await c.put(L, 'en', 'tr', ['a1', 'a2'], 'Gemini'); // yapay zekâ kaydı üzerine yazar
    assert.equal((await c.get(L, 'en', 'tr', true)).engine, 'Gemini');
    passed++;
  }

  // 4) Bozuk veya uyumsuz kayıt kullanılmaz
  {
    assert.equal(usable(null, L, false), false);
    assert.equal(usable({ res: ['tek'], engine: 'Gemini' }, L, false), false);
    assert.equal(usable({ res: ['a', 5], engine: 'Gemini' }, L, false), false);
    assert.equal(usable({ res: 'x', engine: 'Gemini' }, L, false), false);
    const store = fakeStore();
    const c = createCache(store);
    store.data[keyFor(L, 'en', 'tr')] = { res: ['yalnız bir'], engine: 'Gemini' };
    assert.equal(await c.get(L, 'en', 'tr', false), null);
    await c.put(L, 'en', 'tr', ['eksik'], 'Gemini'); // uzunluk tutmayan yazım reddedilir
    assert.deepEqual(store.data[keyFor(L, 'en', 'tr')].res, ['yalnız bir']);
    assert.equal(await c.get([], 'en', 'tr', false), null);
    passed++;
  }

  // 5) LRU: sınır aşılınca en eski kayıt atılır, okunan/yenilenen kalır
  {
    const store = fakeStore();
    const c = createCache(store, 3);
    for (const n of ['a', 'b', 'c']) await c.put([n], 'en', 'tr', [n.toUpperCase()], 'Gemini');
    await c.put(['a'], 'en', 'tr', ['A2'], 'Gemini'); // a yenilenir (en yeni)
    await c.put(['d'], 'en', 'tr', ['D'], 'Gemini'); // b en eski olduğu için atılır
    assert.equal(await c.get(['b'], 'en', 'tr', false), null);
    assert.equal((await c.get(['a'], 'en', 'tr', false)).res[0], 'A2');
    assert.ok(await c.get(['c'], 'en', 'tr', false));
    assert.ok(await c.get(['d'], 'en', 'tr', false));
    assert.equal(store.data['tcIndex2'].length, 3);
    passed++;
  }

  // 6) Eşzamanlı yazımlar dizini bozmaz
  {
    const store = fakeStore();
    const c = createCache(store, 50);
    await Promise.all(Array.from({ length: 20 }, (_, i) => c.put(['s' + i], 'en', 'tr', ['t' + i], 'Gemini')));
    assert.equal(store.data['tcIndex2'].length, 20);
    assert.equal(new Set(store.data['tcIndex2']).size, 20);
    for (let i = 0; i < 20; i++) assert.equal((await c.get(['s' + i], 'en', 'tr', false)).res[0], 't' + i);
    passed++;
  }

  // 7) clear: kayıtları ve dizini siler
  {
    const store = fakeStore();
    const c = createCache(store);
    await c.put(L, 'en', 'tr', ['x', 'y'], 'Gemini');
    await c.clear();
    assert.equal(Object.keys(store.data).length, 0);
    assert.equal(await c.get(L, 'en', 'tr', false), null);
    passed++;
  }

  // 8) wantsAI: anahtar durumuna ve motor tercihine göre; gemini, groq ve custom dahil
  {
    assert.equal(wantsAI('auto', {}), false);
    assert.equal(wantsAI('auto', { gemini: { state: 'valid' } }), true);
    assert.equal(wantsAI('auto', { gemini: { state: 'quota' } }), true);
    assert.equal(wantsAI('auto', { gemini: { state: 'invalid' } }), false);
    assert.equal(wantsAI('google', { gemini: { state: 'valid' } }), false);
    assert.equal(wantsAI('groq', { groq: { state: 'unchecked' } }), true);
    assert.equal(wantsAI('auto', { custom: { state: 'valid' } }), true);
    assert.equal(wantsAI('custom', { custom: { state: 'unchecked' } }), true);
    assert.equal(wantsAI('auto', { custom: { state: 'invalid' } }), false);
    assert.equal(wantsAI('google', { custom: { state: 'valid' } }), false);
    assert.equal(wantsAI('auto', undefined), false);
    passed++;
  }

  // 9) get/put variant ayrımı: farklı variant kayıtları birbirine karışmaz
  {
    const c = createCache(fakeStore());
    await c.put(L, 'en', 'tr', ['hızlı 1', 'hızlı 2'], 'Gemini', 'fast');
    await c.put(L, 'en', 'tr', ['kaliteli 1', 'kaliteli 2'], 'Gemini', 'quality');
    assert.equal(await c.get(L, 'en', 'tr', true), null, 'varsayılan boş variant isabet etmemeli');
    assert.deepEqual((await c.get(L, 'en', 'tr', true, 'fast')).res, ['hızlı 1', 'hızlı 2']);
    assert.deepEqual((await c.get(L, 'en', 'tr', true, 'quality')).res, ['kaliteli 1', 'kaliteli 2']);
    passed++;
  }

  // 10) withCache: getLangs() { sl, tl } döndürdüğünde (variant yok -> '') çalışır
  {
    const localStore = fakeStore();
    const syncStore = fakeStore();
    globalThis.chrome = { storage: { local: localStore, sync: syncStore } };
    let sendCalls = 0;
    const wrapped = withCache(async (lines) => {
      sendCalls++;
      return { ok: true, res: lines.map((x) => 'TR:' + x), engine: 'Gemini' };
    }, () => ({ sl: 'en', tl: 'tr' }));
    const r1 = await wrapped(L);
    assert.equal(r1.ok, true);
    assert.equal(r1.cached, undefined);
    assert.equal(sendCalls, 1);
    const r2 = await wrapped(L);
    assert.equal(r2.ok, true);
    assert.equal(r2.cached, true);
    assert.equal(sendCalls, 1);
    passed++;
  }

  // 11) withCache: getLangs() { sl, tl, variant } döndürdüğünde variant değişince yeniden çevirir
  {
    const localStore = fakeStore();
    const syncStore = fakeStore();
    globalThis.chrome = { storage: { local: localStore, sync: syncStore } };
    let currentVariant = 'gemini:fast';
    let sendCalls = 0;
    const wrapped = withCache(async (lines) => {
      sendCalls++;
      return { ok: true, res: lines.map((x) => currentVariant + ':' + x), engine: 'Gemini' };
    }, () => ({ sl: 'en', tl: 'tr', variant: currentVariant }));

    const rFast = await wrapped(L);
    assert.deepEqual(rFast.res, ['gemini:fast:Hello world', 'gemini:fast:How are you']);
    assert.equal(sendCalls, 1);

    currentVariant = 'gemini:quality';
    const rQual = await wrapped(L);
    assert.deepEqual(rQual.res, ['gemini:quality:Hello world', 'gemini:quality:How are you']);
    assert.equal(sendCalls, 2, 'farklı variant önbelleği atlamalı');

    // Tekrar fast'e dönünce önbellekten gelir
    currentVariant = 'gemini:fast';
    const rFastCached = await wrapped(L);
    assert.equal(rFastCached.cached, true);
    assert.deepEqual(rFastCached.res, ['gemini:fast:Hello world', 'gemini:fast:How are you']);
    assert.equal(sendCalls, 2);
    passed++;
  }

  console.log(`${passed}/${total} önbellek testi geçti`);
  if (passed !== total) process.exit(1);
})().catch((e) => { console.error('BAŞARISIZ:', e.message); process.exit(1); });
