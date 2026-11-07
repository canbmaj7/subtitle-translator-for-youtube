// Çeviri motorları (arka plan). Anahtarlar yalnızca burada okunur; sayfa/content script görmez.
// Sıra: Gemini -> Groq -> Google çeviri (anahtarsız son çare).
const GEMINI_MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const cooldown = {}; // motor -> yeniden denenebileceği zaman (ms)

class HttpError extends Error {
  constructor(status, body) { super('HTTP ' + status + ' ' + String(body || '').slice(0, 160)); this.status = status; }
}

// Hedef dilin İngilizce adı
function getLangName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
  } catch (_) {
    return code;
  }
}

// Google GTX API dil kodu eşlemesi
function mapGtxLang(code) {
  if (!code || code === 'auto') return 'auto';
  if (code === 'zh') return 'zh-CN';
  if (code === 'zh-CN' || code === 'zh-TW') return code;
  if (code.startsWith('zh-')) return 'zh-CN';
  if (code === 'he') return 'iw';
  if (code === 'no') return 'no';
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
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const txt = await r.text();
  if (!r.ok) throw new HttpError(r.status, txt);
  return JSON.parse(txt);
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
      const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts
        ? data.candidates[0].content.parts.map((p) => p.text || '').join('') : '';
      const out = parseTranslations(text, lines.length);
      if (!out) throw new Error('Gemini yanıtı satır sayısıyla uyuşmadı');
      return out;
    } catch (e) {
      lastErr = e;
      if (!(e instanceof HttpError) || e.status !== 404) throw e; // yalnızca "model yok" ise sonrakini dene
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
  const gtxSl = mapGtxLang(sl);
  const gtxTl = mapGtxLang(tl);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(gtxSl || 'auto')}&tl=${encodeURIComponent(gtxTl)}&dt=t&dj=0`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new HttpError(r.status, '');
  const data = await r.json();
  return (data[0] || []).map((s) => s[0] || '').join('');
}

async function viaGtx(lines, sl, tl) {
  const parts = (await gtx(lines, sl, tl)).split('\n');
  while (parts.length > lines.length && parts[parts.length - 1] === '') parts.pop();
  if (parts.length === lines.length) return parts;
  const out = []; // satır sayısı tutmadı: tek tek çevir
  for (const l of lines) {
    try { out.push((await gtx([l], sl, tl)).replace(/\n/g, ' ').trim()); } catch (_) { out.push(l); }
  }
  return out;
}

async function translate(lines, sl, tl) {
  const keys = await chrome.storage.local.get({ geminiKey: '', groqKey: '' });
  const chain = [];
  if (keys.geminiKey) chain.push(['Gemini', () => viaGemini(keys.geminiKey, lines, sl, tl)]);
  if (keys.groqKey) chain.push(['Groq', () => viaGroq(keys.groqKey, lines, sl, tl)]);
  chain.push(['Google', () => viaGtx(lines, sl, tl)]);
  const errors = [];
  for (const [name, run] of chain) {
    if (name !== 'Google' && cooldown[name] && cooldown[name] > Date.now()) continue;
    try {
      let res;
      try { res = await run(); } catch (e) {
        // Satır sayısı uyuşmazlığı ya da geçici sunucu hatası (5xx): bir kez daha dene
        if (e instanceof HttpError && e.status < 500) throw e;
        if (e instanceof HttpError) await new Promise((ok) => setTimeout(ok, 1500));
        res = await run();
      }
      return { res, engine: name, errors };
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 0;
      if (status === 429) cooldown[name] = Date.now() + 60 * 1000;
      else if (status === 400 || status === 401 || status === 403) cooldown[name] = Date.now() + 10 * 60 * 1000;
      errors.push(name + ': ' + (e && e.message ? e.message : e));
    }
  }
  throw new Error(errors.join(' | ') || 'çeviri başarısız');
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'translate') {
      translate(msg.lines, msg.sl, msg.tl)
        .then((r) => { chrome.storage.local.set({ lastEngine: r.engine, lastError: r.errors.join(' | ') }); sendResponse({ ok: true, res: r.res, engine: r.engine }); })
        .catch((err) => { chrome.storage.local.set({ lastEngine: '', lastError: String(err.message || err) }); sendResponse({ ok: false, error: String(err.message || err) }); });
      return true; // asenkron cevap
    }
  });
}
if (typeof module !== 'undefined') module.exports = { translate, parseTranslations, cooldown };
