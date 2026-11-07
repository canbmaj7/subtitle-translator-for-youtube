const assert = require('assert');
let store = {};
globalThis.chrome = { storage: { local: { get: async (d) => ({ ...d, ...store }), set: async (o) => Object.assign(store, o) } }, runtime: {} };
let calls = [];
let plan = {};
const json = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });
globalThis.fetch = async (url, opts) => {
  const host = new URL(url).host; calls.push(host);
  const p = plan[host]; if (!p) throw new Error('beklenmeyen ' + host);
  return p(url, opts);
};
const { translate, cooldown, config } = require(require('path').join(__dirname, '../extension/background.js'));
const geminiOK = (arr) => () => json(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ translations: arr }) }] } }] });
const gtxOK = () => json(200, [[['bir\n', 'one\n'], ['iki', 'two']]]);
const reset = () => { calls = []; plan = {}; for (const k in cooldown) delete cooldown[k]; };

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
  plan['api.groq.com'] = () => json(200, { choices: [{ message: { content: '{"translations":["bir","iki"]}' } }] });
  r = await translate(['one', 'two'], 'en', 'tr'); assert.equal(r.engine, 'Groq'); assert.ok(cooldown.Gemini > Date.now());
  // 4) Gemini bekleme süresinde: ikinci çağrıda Gemini'ye hiç gitmez
  calls = []; r = await translate(['one', 'two'], 'en', 'tr'); assert.ok(!calls.includes('generativelanguage.googleapis.com'));
  // 5) Satır sayısı tutmuyor -> bir kez tekrar dener, sonra yedeğe geçer
  reset(); store = { geminiKey: 'k' }; plan['generativelanguage.googleapis.com'] = geminiOK(['sadece bir']); plan['translate.googleapis.com'] = gtxOK;
  r = await translate(['one', 'two'], 'en', 'tr'); assert.equal(r.engine, 'Google'); assert.equal(calls.filter((c) => c.startsWith('generative')).length, 2);
  // 6) Hatalı anahtar (400) -> 10 dk beklemeye alır, Google'a düşer, hata kaydı tutar
  reset(); store = { geminiKey: 'bad' }; plan['generativelanguage.googleapis.com'] = () => json(400, { error: 'API key not valid' }); plan['translate.googleapis.com'] = gtxOK;
  r = await translate(['one', 'two'], 'en', 'tr'); assert.equal(r.engine, 'Google'); assert.match(r.errors[0], /Gemini: HTTP 400/);
  // 7) İlk model 404 -> ikinci modeli dener
  reset(); store = { geminiKey: 'k' }; let n = 0;
  plan['generativelanguage.googleapis.com'] = (u) => (u.includes('flash-lite-latest') ? json(404, { error: 'not found' }) : geminiOK(['bir', 'iki'])());
  r = await translate(['one', 'two'], 'en', 'tr'); assert.equal(r.engine, 'Gemini'); assert.equal(calls.length, 2);
  // 8) Hepsi çökerse hata
  reset(); store = {}; plan['translate.googleapis.com'] = () => json(500, {});
  await assert.rejects(() => translate(['x'], 'en', 'tr'), /HTTP 500/);

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
  console.log('9/9 motor testi geçti');
})().catch((e) => { console.error('BAŞARISIZ:', e.message); process.exit(1); });
