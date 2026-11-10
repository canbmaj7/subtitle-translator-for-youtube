const assert = require('assert');
let store = {};
let syncStore = {};
let storageWrites = [];
globalThis.chrome = {
  storage: {
    local: {
      get: async (d) => ({ ...d, ...store }),
      set: async (o) => { storageWrites.push(JSON.parse(JSON.stringify(o))); Object.assign(store, o); },
    },
    sync: {
      get: async (d) => ({ ...d, ...syncStore }),
      set: async (o) => Object.assign(syncStore, o),
    },
  },
  runtime: {},
};
let calls = [];
let reqLog = [];
let plan = {};
const json = (status, body) => ({ ok: status < 400, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), json: async () => body });
globalThis.fetch = async (url, opts) => {
  const host = new URL(url).host; calls.push(host);
  reqLog.push({ url: String(url), opts: opts || {} });
  const p = plan[host]; if (!p) throw new Error('beklenmeyen ' + host);
  return p(url, opts);
};
const {
  translate, cooldown, cooldownCode, config, TranslateError, validateKey, handleMessage,
} = require(require('path').join(__dirname, '../extension/background.js'));
const geminiOK = (arr) => () => json(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ translations: arr }) }] } }] });
const groqOK = (arr) => () => json(200, { choices: [{ message: { content: JSON.stringify({ translations: arr }) } }] });
const gtxOK = () => json(200, [[['bir\n', 'one\n'], ['iki', 'two']]]);
const reset = () => {
  calls = []; reqLog = []; storageWrites = []; plan = {}; syncStore = {};
  for (const k in cooldown) delete cooldown[k];
  for (const k in cooldownCode) delete cooldownCode[k];
};

(async () => {
  // 1) Anahtar yok -> Google çeviri
  reset(); store = {}; plan['translate.googleapis.com'] = gtxOK;
  let r = await translate(['one', 'two'], 'en', 'tr'); assert.equal(r.engine, 'Google'); assert.deepEqual(r.res, ['bir', 'iki']);
  // 2) Gemini anahtarı var -> Gemini
  reset(); store = { geminiKey: 'k' }; plan['generativelanguage.googleapis.com'] = geminiOK(['bir', 'iki']);
  r = await translate(['one', 'two'], 'en', 'tr'); assert.equal(r.engine, 'Gemini'); assert.deepEqual(r.res, ['bir', 'iki']);
  // 3) Gemini 429 -> Groq
  reset(); store = { geminiKey: 'k', groqKey: 'g' };
  plan['generativelanguage.googleapis.com'] = () => json(429, { error: 'quota' });
  plan['api.groq.com'] = groqOK(['bir', 'iki']);
  r = await translate(['one', 'two'], 'en', 'tr'); assert.equal(r.engine, 'Groq'); assert.ok(cooldown.Gemini > Date.now());
  // 4) Gemini bekleme süresinde: ikinci çağrıda Gemini'ye hiç gitmez
  calls = []; r = await translate(['one', 'two'], 'en', 'tr'); assert.ok(!calls.includes('generativelanguage.googleapis.com'));
  // 5) Satır sayısı tutmuyor -> bir kez tekrar dener, sonra yedeğe geçer
  reset(); store = { geminiKey: 'k' }; plan['generativelanguage.googleapis.com'] = geminiOK(['sadece bir']); plan['translate.googleapis.com'] = gtxOK;
  r = await translate(['one', 'two'], 'en', 'tr'); assert.equal(r.engine, 'Google'); assert.equal(calls.filter((c) => c.startsWith('generative')).length, 2);
  // 6) Hatalı anahtar (400) -> 10 dk beklemeye alır, Google'a düşer, hata kaydı tutar ('Gemini: invalid')
  reset(); store = { geminiKey: 'bad' }; plan['generativelanguage.googleapis.com'] = () => json(400, { error: 'API key not valid' }); plan['translate.googleapis.com'] = gtxOK;
  r = await translate(['one', 'two'], 'en', 'tr'); assert.equal(r.engine, 'Google'); assert.match(r.errors[0], /Gemini: invalid/);
  // 7) İlk model 404 -> ikinci modeli dener
  reset(); store = { geminiKey: 'k' };
  plan['generativelanguage.googleapis.com'] = (u) => (u.includes('flash-lite-latest') ? json(404, { error: 'not found' }) : geminiOK(['bir', 'iki'])());
  r = await translate(['one', 'two'], 'en', 'tr'); assert.equal(r.engine, 'Gemini'); assert.equal(calls.length, 2);
  // 8) Hepsi çökerse hata
  reset(); store = {}; plan['translate.googleapis.com'] = () => json(500, {});
  await assert.rejects(() => translate(['x'], 'en', 'tr'), /Google: server/);

  // 9) Zaman aşımı: signal abort olunca AbortError ile reddeden sahte fetch -> Google'a düşer, cooldown 30s
  reset();
  const origTimeout = config.llmTimeoutMs;
  config.llmTimeoutMs = 50;
  store = { geminiKey: 'k' };
  plan['generativelanguage.googleapis.com'] = (_url, opts) => new Promise((_, reject) => {
    if (opts && opts.signal) {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }
  });
  plan['translate.googleapis.com'] = gtxOK;
  try {
    r = await translate(['one', 'two'], 'en', 'tr');
    assert.equal(r.engine, 'Google');
    assert.ok(r.errors.some((e) => e.includes('timeout')), 'Hata listesinde timeout olmalı');
    assert.ok(cooldown.Gemini > Date.now(), 'Gemini bekleme süresine alınmalı');
  } finally {
    config.llmTimeoutMs = origTimeout;
  }

  // 10) (a) engine='gemini' seçili ve Gemini hata verince Groq/Google'a DÜŞMEZ, TranslateError issues [{engine:'Gemini',code}]
  reset();
  store = { geminiKey: 'k', groqKey: 'g', engine: 'gemini' };
  plan['generativelanguage.googleapis.com'] = () => json(429, { error: 'rate limit' });
  plan['api.groq.com'] = groqOK(['bir', 'iki']);
  plan['translate.googleapis.com'] = gtxOK;
  await assert.rejects(
    () => translate(['one', 'two'], 'en', 'tr'),
    (err) => {
      assert.ok(err instanceof TranslateError);
      assert.equal(err.engine, 'Gemini');
      assert.equal(err.code, 'quota');
      assert.deepEqual(err.issues, [{ engine: 'Gemini', code: 'quota' }]);
      return true;
    },
  );
  assert.deepEqual(calls, ['generativelanguage.googleapis.com'], 'Groq veya Google çağrılmamalı');

  // sync.engine='gemini' ve 401 invalid durumunda da yedek motora düşmez
  reset();
  store = { geminiKey: 'k', groqKey: 'g' };
  syncStore = { engine: 'gemini' };
  plan['generativelanguage.googleapis.com'] = () => json(401, { error: 'unauthorized' });
  await assert.rejects(
    () => translate(['one', 'two'], 'en', 'tr'),
    (err) => {
      assert.ok(err instanceof TranslateError);
      assert.deepEqual(err.issues, [{ engine: 'Gemini', code: 'invalid' }]);
      return true;
    },
  );
  assert.deepEqual(calls, ['generativelanguage.googleapis.com']);

  // 11) (b) auto sırası Gemini -> Groq -> Google
  reset();
  store = { geminiKey: 'k', groqKey: 'g', engine: 'auto' };
  plan['generativelanguage.googleapis.com'] = () => json(429, { error: 'quota' });
  plan['api.groq.com'] = () => json(401, { error: 'invalid_api_key' });
  plan['translate.googleapis.com'] = gtxOK;
  r = await translate(['one', 'two'], 'en', 'tr');
  assert.equal(r.engine, 'Google');
  assert.deepEqual(calls, ['generativelanguage.googleapis.com', 'api.groq.com', 'translate.googleapis.com']);
  assert.deepEqual(r.issues, [
    { engine: 'Gemini', code: 'quota' },
    { engine: 'Groq', code: 'invalid' },
  ]);

  // 12) (c) Seçili motorun anahtarı yoksa code 'nokey'
  reset();
  store = { geminiKey: '', groqKey: 'g', engine: 'gemini' };
  await assert.rejects(
    () => translate(['one'], 'en', 'tr'),
    (err) => {
      assert.ok(err instanceof TranslateError);
      assert.equal(err.engine, 'Gemini');
      assert.equal(err.code, 'nokey');
      assert.deepEqual(err.issues, [{ engine: 'Gemini', code: 'nokey' }]);
      return true;
    },
  );
  assert.equal(calls.length, 0);

  reset();
  store = { geminiKey: 'k', groqKey: '   ', engine: 'groq' };
  await assert.rejects(
    () => translate(['one'], 'en', 'tr'),
    (err) => {
      assert.ok(err instanceof TranslateError);
      assert.equal(err.engine, 'Groq');
      assert.equal(err.code, 'nokey');
      assert.deepEqual(err.issues, [{ engine: 'Groq', code: 'nokey' }]);
      return true;
    },
  );
  assert.equal(calls.length, 0);

  // 13) (d) validateKey Gemini/Groq için valid/invalid/quota/network sonuçları, başlık kullanımı ve keyStatus yazımı
  reset();
  store = { geminiKey: 'gem-key-1', groqKey: 'groq-key-1' };

  // Gemini: valid, invalid, quota, network
  plan['generativelanguage.googleapis.com'] = () => json(200, { models: [] });
  assert.equal(await validateKey('gemini', 'gem-key-1'), 'valid');
  assert.equal(store.keyStatus.gemini.state, 'valid');
  assert.ok(!reqLog[reqLog.length - 1].url.includes('gem-key-1'), 'Gemini anahtarı URL içinde olmamalı');
  assert.equal(reqLog[reqLog.length - 1].opts.headers['x-goog-api-key'], 'gem-key-1');

  plan['generativelanguage.googleapis.com'] = () => json(400, { error: 'API_KEY_INVALID' });
  assert.equal(await validateKey('gemini', 'gem-key-1'), 'invalid');
  assert.equal(store.keyStatus.gemini.state, 'invalid');

  plan['generativelanguage.googleapis.com'] = () => json(429, { error: 'quota' });
  assert.equal(await validateKey('gemini', 'gem-key-1'), 'quota');
  assert.equal(store.keyStatus.gemini.state, 'quota');

  plan['generativelanguage.googleapis.com'] = () => { throw new TypeError('Failed to fetch'); };
  assert.equal(await validateKey('gemini', 'gem-key-1'), 'network');
  assert.equal(store.keyStatus.gemini.state, 'network');

  // Groq: valid, invalid, quota, network (ve mevcut gemini keyStatus korunur)
  plan['api.groq.com'] = () => json(200, { data: [] });
  assert.equal(await validateKey('groq', 'groq-key-1'), 'valid');
  assert.equal(store.keyStatus.groq.state, 'valid');
  assert.equal(store.keyStatus.gemini.state, 'network');
  assert.ok(!reqLog[reqLog.length - 1].url.includes('groq-key-1'), 'Groq anahtarı URL içinde olmamalı');
  assert.equal(reqLog[reqLog.length - 1].opts.headers.Authorization, 'Bearer groq-key-1');

  plan['api.groq.com'] = () => json(401, { error: 'invalid_api_key' });
  assert.equal(await validateKey('groq', 'groq-key-1'), 'invalid');
  assert.equal(store.keyStatus.groq.state, 'invalid');

  plan['api.groq.com'] = () => json(429, { error: 'rate limit' });
  assert.equal(await validateKey('groq', 'groq-key-1'), 'quota');
  assert.equal(store.keyStatus.groq.state, 'quota');

  plan['api.groq.com'] = () => { throw new TypeError('network down'); };
  assert.equal(await validateKey('groq', 'groq-key-1'), 'network');
  assert.equal(store.keyStatus.groq.state, 'network');

  // 14) (e) Anahtar dizgesi hiçbir storage yazımında, log çıktısında, yanıtta veya hata mesajında geçmiyor
  reset();
  const SECRET_GEM = 'AIzaSy_SUPER_SECRET_GEM_987654';
  const SECRET_GROQ = 'gsk_SUPER_SECRET_GROQ_123456';
  store = { geminiKey: SECRET_GEM, groqKey: SECRET_GROQ, engine: 'auto' };
  const logs = [];
  const origConsole = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...a) => logs.push(a.join(' '));
  console.warn = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  const assertNoLeak = (val, label) => {
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    assert.ok(!str.includes(SECRET_GEM), `Gemini anahtarı sızdı (${label}): ${str}`);
    assert.ok(!str.includes(SECRET_GROQ), `Groq anahtarı sızdı (${label}): ${str}`);
  };
  try {
    // Sunucu hata gövdesinde anahtarı geri yansıtsa bile sızmamalı
    plan['generativelanguage.googleapis.com'] = () => json(400, { error: `API key not valid: ${SECRET_GEM}` });
    plan['api.groq.com'] = () => json(401, { error: `invalid_api_key ${SECRET_GROQ}` });
    plan['translate.googleapis.com'] = () => json(403, `forbidden ${SECRET_GEM} ${SECRET_GROQ}`);

    await assert.rejects(
      () => translate(['hello'], 'en', 'tr'),
      (err) => {
        assertNoLeak(err.message, 'err.message');
        assertNoLeak(err.stack || '', 'err.stack');
        assertNoLeak(err, 'err JSON');
        return true;
      },
    );

    // handleMessage üzerinden translate ve validateKey yanıtları
    for (const k in cooldown) delete cooldown[k];
    const msgResp = await new Promise((resolve) => {
      handleMessage({ type: 'translate', lines: ['hello'], sl: 'en', tl: 'tr' }, {}, resolve);
    });
    assert.equal(msgResp.ok, false);
    assertNoLeak(msgResp, 'handleMessage translate yanıtı');

    const valResp = await new Promise((resolve) => {
      handleMessage({ type: 'validateKey', engine: 'gemini', key: SECRET_GEM }, {}, resolve);
    });
    assertNoLeak(valResp, 'handleMessage validateKey yanıtı');

    for (const req of reqLog) {
      assertNoLeak(req.url, 'istek URL');
    }
    for (const w of storageWrites) {
      assertNoLeak(w, 'storage.local.set yazımı');
    }
    assertNoLeak(logs, 'konsol çıktıları');
  } finally {
    console.log = origConsole.log;
    console.warn = origConsole.warn;
    console.error = origConsole.error;
  }

  console.log('14/14 motor testi geçti');
})().catch((e) => { console.error('BAŞARISIZ:', e.message); process.exit(1); });
