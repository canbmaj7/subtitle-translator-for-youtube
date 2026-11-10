// Çeviri motorları (arka plan). Anahtarlar yalnızca burada okunur; sayfa/content script görmez.
// Sıra: Gemini -> Groq -> Google çeviri (anahtarsız son çare).
const GEMINI_MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const INVALID_KEY_RE = /API_KEY_INVALID|API key not valid|invalid_api_key|invalid.*key|key.*invalid/i;
const VALID_CODES = new Set(['nokey', 'invalid', 'quota', 'network', 'timeout', 'server', 'mismatch', 'unknown']);
const cooldown = {}; // motor -> yeniden denenebileceği zaman (ms)
const cooldownCode = {}; // motor -> son hata kodu
const config = { llmTimeoutMs: 30000, gtxTimeoutMs: 15000, validateTimeoutMs: 10000 };

class HttpError extends Error {
  constructor(status, body) {
    super('HTTP ' + status);
    this.status = status;
    const raw = typeof body === 'string' ? body : JSON.stringify(body || '');
    Object.defineProperty(this, 'body', { value: raw.slice(0, 300), enumerable: false });
  }
}

class TranslateError extends Error {
  constructor(issues) {
    const list = Array.isArray(issues) ? issues : [];
    super(list.map((i) => i.engine + ': ' + i.code).join(' | ') || 'çeviri başarısız');
    this.name = 'TranslateError';
    this.issues = list;
    if (list[0]) { this.engine = list[0].engine; this.code = list[0].code; }
  }
}

// Hata nesnesini güvenli, anahtar sızdırmayan durum koduna çevirir
function classifyError(err) {
  if (!err) return 'unknown';
  if (err.name === 'AbortError' || err.name === 'TimeoutError' || err.code === 'timeout') return 'timeout';
  if (VALID_CODES.has(err.code)) return err.code;
  if (typeof err.status === 'number') {
    if (err.status === 0) return 'timeout';
    if (err.status === 429) return 'quota';
    if (err.status === 401 || err.status === 403) return 'invalid';
    if (err.status === 400 && INVALID_KEY_RE.test(String(err.body || ''))) return 'invalid';
    if (err.status >= 500 && err.status < 600) return 'server';
    return 'unknown';
  }
  const msg = String(err.message || '');
  if (/uyuşmadı|mismatch/i.test(msg)) return 'mismatch';
  if (err instanceof TypeError || err.name === 'TypeError' || /network|fetch/i.test(msg)) return 'network';
  return 'unknown';
}

// Anahtar doğrulama HTTP yanıtını durum koduna çevirir ('valid'|'invalid'|'quota'|'network')
function classifyValidation(status, bodyText) {
  if (status >= 200 && status < 300) return 'valid';
  if (status === 401 || status === 403) return 'invalid';
  if (status === 400 && INVALID_KEY_RE.test(String(bodyText || ''))) return 'invalid';
  if (status === 429) return 'quota';
  return 'network';
}

// keyStatus oku-değiştir-yaz kuyruğu (eşzamanlı yazımlarda diğer sağlayıcıyı korur)
let statusQueue = Promise.resolve();
function updateKeyStatus(mutator) {
  statusQueue = statusQueue.then(async () => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    const data = await chrome.storage.local.get({ geminiKey: '', groqKey: '', keyStatus: {} });
    const ks = { ...(data.keyStatus || {}) };
    if (mutator(ks, data) !== false) await chrome.storage.local.set({ keyStatus: ks });
  }).catch(() => {});
  return statusQueue;
}

// Çeviri sırasında öğrenilen anahtar durumunu (yalnızca değiştiyse) yansıtır
function reflectKeyState(provider, state, expectedKey) {
  const field = provider === 'gemini' ? 'geminiKey' : 'groqKey';
  return updateKeyStatus((ks, data) => {
    const curKey = String(data[field] || '').trim();
    if (!curKey || (expectedKey && curKey !== expectedKey)) return false;
    if (ks[provider] && ks[provider].state === state) return false;
    ks[provider] = { state, at: Date.now() };
  });
}

// Anahtarı ilgili sağlayıcıya hafif GET isteğiyle doğrular ve keyStatus'a yazar
async function validateKey(engine, key) {
  const provider = String(engine || '').toLowerCase();
  if (provider !== 'gemini' && provider !== 'groq') return 'invalid';
  const field = provider === 'gemini' ? 'geminiKey' : 'groqKey';
  let rawKey = key;
  if (rawKey === undefined && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get({ [field]: '' });
    rawKey = data[field];
  }
  const k = String(rawKey || '').trim();
  if (!k) {
    await updateKeyStatus((ks, cur) => {
      if (key === undefined && String(cur[field] || '').trim()) return false;
      delete ks[provider];
    });
    return null;
  }
  const url = provider === 'gemini'
    ? 'https://generativelanguage.googleapis.com/v1beta/models'
    : 'https://api.groq.com/openai/v1/models';
  const headers = provider === 'gemini'
    ? { 'x-goog-api-key': k }
    : { Authorization: 'Bearer ' + k };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), config.validateTimeoutMs);
  let state;
  try {
    const r = await fetch(url, { method: 'GET', headers, signal: ctrl.signal });
    const txt = r.text ? await r.text() : '';
    state = classifyValidation(r.status, txt);
  } catch (_) {
    state = 'network';
  } finally {
    clearTimeout(t);
  }
  await updateKeyStatus((ks, cur) => {
    if (key === undefined && String(cur[field] || '').trim() !== k) return false;
    ks[provider] = { state, at: Date.now() };
  });
  return state;
}

// Başlangıçta mevcut anahtarlarla keyStatus kayıtlarını senkronize eder
function syncKeyStatus() {
  return updateKeyStatus((ks, data) => {
    let dirty = false;
    for (const [prov, field] of [['gemini', 'geminiKey'], ['groq', 'groqKey']]) {
      const hasKey = Boolean(String(data[field] || '').trim());
      if (hasKey && !ks[prov]) { ks[prov] = { state: 'unchecked', at: Date.now() }; dirty = true; }
      else if (!hasKey && ks[prov]) { delete ks[prov]; dirty = true; }
    }
    return dirty;
  });
}

function getLangName(code) {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; }
  catch (_) { return code; }
}

function mapGtxLang(code) {
  if (!code || code === 'auto') return 'auto';
  if (code === 'zh' || (code.startsWith('zh-') && code !== 'zh-CN' && code !== 'zh-TW')) return 'zh-CN';
  if (code === 'he') return 'iw';
  if (code === 'pt-BR') return 'pt';
  return code;
}

function systemPrompt(sl, tl) {
  const langName = getLangName(tl);
  const src = sl && sl !== 'auto' ? `from the language with code "${sl}" ` : '';
  return [
    `You are a professional subtitle translator. Translate video subtitles ${src}into natural, fluent spoken ${langName}.`,
    'The user sends a JSON array of consecutive subtitle sentences. They come from speech recognition, so they may lack punctuation, split sentences oddly or contain recognition errors: use the surrounding sentences as context and fix obvious mistakes.',
    `Translate ordinary words, titles and idioms into ${langName}. Keep only person names, product names, code and widely used technical terms (e.g. Python, API, framework) in their original form.`,
    'Do not merge, split, reorder or skip items. Do not add explanations.',
    'Reply ONLY with JSON of the form {"translations": [...]} holding exactly as many strings as the input array, in the same order.',
  ].join('\n');
}

function parseTranslations(text, n) {
  let data;
  try { data = JSON.parse(text); } catch (_) {
    const m = String(text).match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return null;
    try { data = JSON.parse(m[0]); } catch (_) { return null; }
  }
  const arr = Array.isArray(data) ? data : data && (data.translations || Object.values(data).find(Array.isArray));
  if (!Array.isArray(arr) || arr.length !== n) return null;
  return arr.map((x) => String(x == null ? '' : x).replace(/\s*\n\s*/g, ' ').trim());
}

async function postJson(url, headers, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), config.llmTimeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const txt = await r.text();
    if (!r.ok) throw new HttpError(r.status, txt);
    return JSON.parse(txt);
  } catch (e) {
    if (ctrl.signal.aborted || (e && (e.name === 'AbortError' || e.name === 'TimeoutError'))) {
      throw new HttpError(0, 'timeout');
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function viaGemini(key, lines, sl, tl) {
  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      const data = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { 'x-goog-api-key': key },
        {
          systemInstruction: { parts: [{ text: systemPrompt(sl, tl) }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(lines) }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: { type: 'OBJECT', properties: { translations: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['translations'] },
          },
        },
      );
      const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      const text = parts ? parts.map((p) => p.text || '').join('') : '';
      const out = parseTranslations(text, lines.length);
      if (!out) throw new Error('Gemini yanıtı satır sayısıyla uyuşmadı');
      return out;
    } catch (e) {
      lastErr = e;
      if (!(e instanceof HttpError) || e.status !== 404) throw e;
    }
  }
  throw lastErr;
}

async function viaGroq(key, lines, sl, tl) {
  const data = await postJson(
    'https://api.groq.com/openai/v1/chat/completions',
    { Authorization: 'Bearer ' + key },
    {
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: systemPrompt(sl, tl) }, { role: 'user', content: JSON.stringify(lines) }],
    },
  );
  const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
  const out = parseTranslations(text, lines.length);
  if (!out) throw new Error('Groq yanıtı satır sayısıyla uyuşmadı');
  return out;
}

async function gtx(lines, sl, tl) {
  const body = new URLSearchParams();
  body.set('q', lines.join('\n'));
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(mapGtxLang(sl) || 'auto')}&tl=${encodeURIComponent(mapGtxLang(tl))}&dt=t&dj=0`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), config.gtxTimeoutMs);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: ctrl.signal });
    if (!r.ok) throw new HttpError(r.status, '');
    const data = await r.json();
    return (data[0] || []).map((s) => s[0] || '').join('');
  } catch (e) {
    if (ctrl.signal.aborted || (e && (e.name === 'AbortError' || e.name === 'TimeoutError'))) throw new HttpError(0, 'timeout');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function viaGtx(lines, sl, tl) {
  const parts = (await gtx(lines, sl, tl)).split('\n');
  while (parts.length > lines.length && parts[parts.length - 1] === '') parts.pop();
  if (parts.length === lines.length) return parts;
  const out = [];
  for (const l of lines) {
    try { out.push((await gtx([l], sl, tl)).replace(/\n/g, ' ').trim()); } catch (_) { out.push(l); }
  }
  return out;
}

async function translate(lines, sl, tl) {
  const localData = await chrome.storage.local.get({ geminiKey: '', groqKey: '', engine: '' });
  const geminiKey = String(localData.geminiKey || '').trim();
  const groqKey = String(localData.groqKey || '').trim();
  let enginePref = localData.engine || '';
  try {
    if (chrome.storage && chrome.storage.sync && chrome.storage.sync.get) {
      const s = await chrome.storage.sync.get({ engine: '' });
      if (s && s.engine) enginePref = s.engine;
    }
  } catch (_) {}
  enginePref = String(enginePref || 'auto').toLowerCase();

  const specs = {
    gemini: ['Gemini', geminiKey, () => viaGemini(geminiKey, lines, sl, tl), 'gemini'],
    groq: ['Groq', groqKey, () => viaGroq(groqKey, lines, sl, tl), 'groq'],
    google: ['Google', 'ok', () => viaGtx(lines, sl, tl), null],
  };

  const chain = [];
  if (enginePref === 'gemini' || enginePref === 'groq' || enginePref === 'google') {
    const [name, key, run, prov] = specs[enginePref];
    if (!key) throw new TranslateError([{ engine: name, code: 'nokey' }]);
    if (name !== 'Google' && cooldown[name] && cooldown[name] > Date.now()) {
      throw new TranslateError([{ engine: name, code: cooldownCode[name] || 'unknown' }]);
    }
    chain.push([name, run, prov, key]);
  } else {
    if (geminiKey) chain.push(['Gemini', specs.gemini[2], 'gemini', geminiKey]);
    if (groqKey) chain.push(['Groq', specs.groq[2], 'groq', groqKey]);
    chain.push(['Google', specs.google[2], null, '']);
  }

  const issues = [];
  for (const [name, run, prov, key] of chain) {
    if (name !== 'Google' && cooldown[name] && cooldown[name] > Date.now()) {
      issues.push({ engine: name, code: cooldownCode[name] || 'unknown' });
      continue;
    }
    try {
      let res;
      try { res = await run(); } catch (e) {
        if (e instanceof HttpError && e.status < 500) throw e;
        if (e instanceof HttpError) await new Promise((ok) => setTimeout(ok, 1500));
        res = await run();
      }
      if (prov) await reflectKeyState(prov, 'valid', key);
      return { res, engine: name, issues, errors: issues.map((i) => i.engine + ': ' + i.code) };
    } catch (e) {
      const code = classifyError(e);
      if (name !== 'Google') {
        const st = e instanceof HttpError ? e.status : 0;
        if (code === 'invalid' || st === 400 || st === 401 || st === 403) cooldown[name] = Date.now() + 10 * 60 * 1000;
        else if (code === 'quota') cooldown[name] = Date.now() + 60 * 1000;
        else cooldown[name] = Date.now() + 30 * 1000;
        cooldownCode[name] = code;
        if (prov && (code === 'invalid' || code === 'quota')) await reflectKeyState(prov, code, key);
      }
      issues.push({ engine: name, code });
    }
  }
  throw new TranslateError(issues);
}

function handleMessage(msg, _sender, sendResponse) {
  if (msg && msg.type === 'translate') {
    translate(msg.lines, msg.sl, msg.tl)
      .then((r) => {
        const lastError = r.errors && r.errors.length ? r.errors.join(' | ') : '';
        chrome.storage.local.set({ lastEngine: r.engine, lastIssues: r.issues, lastError });
        sendResponse({ ok: true, res: r.res, engine: r.engine, issues: r.issues });
      })
      .catch((err) => {
        const issues = (err && Array.isArray(err.issues) && err.issues.length)
          ? err.issues
          : [{ engine: '', code: classifyError(err) }];
        const primary = issues[0];
        const error = { engine: primary.engine, code: primary.code };
        const lastError = issues.map((i) => (i.engine ? i.engine + ': ' : '') + i.code).join(' | ');
        chrome.storage.local.set({ lastEngine: '', lastIssues: issues, lastError });
        sendResponse({ ok: false, error, issues });
      });
    return true;
  }
  if (msg && msg.type === 'validateKey') {
    const provider = String(msg.engine || msg.provider || '').toLowerCase();
    if (provider !== 'gemini' && provider !== 'groq') {
      sendResponse({ ok: false });
      return false;
    }
    validateKey(provider, msg.key)
      .then((state) => sendResponse({ ok: true, state }))
      .catch(() => sendResponse({ ok: false, state: 'network' }));
    return true;
  }
}

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area && area !== 'local') return;
    if (changes.geminiKey) { delete cooldown.Gemini; delete cooldownCode.Gemini; }
    if (changes.groqKey) { delete cooldown.Groq; delete cooldownCode.Groq; }
    if (changes.geminiKey || changes.groqKey) {
      updateKeyStatus((ks, data) => {
        for (const [prov, field] of [['gemini', 'geminiKey'], ['groq', 'groqKey']]) {
          if (!changes[field]) continue;
          const raw = changes[field].newValue !== undefined ? changes[field].newValue : data[field];
          if (String(raw || '').trim()) ks[prov] = { state: 'unchecked', at: Date.now() };
          else delete ks[prov];
        }
      });
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  syncKeyStatus();
  chrome.runtime.onMessage.addListener(handleMessage);
}

if (typeof module !== 'undefined') {
  module.exports = {
    translate, parseTranslations, cooldown, cooldownCode, config, HttpError, TranslateError,
    classifyError, classifyValidation, validateKey, handleMessage,
  };
}
