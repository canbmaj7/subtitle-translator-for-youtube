// Çeviri önbelleği: aynı altyazı parçası (kaynak metin + dil çifti) yeniden çevrilmez.
// chrome.storage.local'de parça başına bir kayıt tutar, en eski kayıtlar atılır (LRU).
// Kayıtlar yalnızca bu cihazda kalır; anahtar veya video bilgisi içermez.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const VERSION = 1; // istem/biçim değişince artır: eski kayıtlar kullanılmaz
  const PREFIX = 'tc' + VERSION + ':';
  const INDEX = 'tcIndex' + VERSION;
  const MAX_ENTRIES = 500;

  // İki bağımsız 32 bit FNV-1a: çakışma olasılığı ihmal edilebilir
  function hash(str) {
    let a = 0x811c9dc5, b = 0x01000193;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b + c, 0x85ebca6b) >>> 0;
    }
    return a.toString(36) + b.toString(36) + str.length.toString(36);
  }

  function keyFor(lines, sl, tl) {
    return PREFIX + hash(String(sl) + '|' + String(tl) + '|' + lines.join('\u0001'));
  }

  // Google ile çevrilmiş kayıt, yapay zekâ motoru kullanılabilecekken kullanılmaz (kalite)
  function usable(entry, lines, wantAI) {
    if (!entry || !Array.isArray(entry.res) || entry.res.length !== lines.length) return false;
    if (entry.res.some((x) => typeof x !== 'string')) return false;
    return !(entry.engine === 'Google' && wantAI);
  }

  // store: { get(keys) -> Promise<obj>, set(obj) -> Promise, remove(keys) -> Promise }
  function createCache(store, maxEntries = MAX_ENTRIES) {
    let queue = Promise.resolve(); // dizin okuma-değiştirme-yazma sırası

    async function get(lines, sl, tl, wantAI) {
      if (!lines || !lines.length) return null;
      const key = keyFor(lines, sl, tl);
      const data = await store.get(key);
      const entry = data && data[key];
      if (!usable(entry, lines, wantAI)) return null;
      return { res: entry.res.slice(), engine: entry.engine };
    }

    function put(lines, sl, tl, res, engine) {
      if (!lines || !lines.length || !Array.isArray(res) || res.length !== lines.length) return Promise.resolve();
      const key = keyFor(lines, sl, tl);
      queue = queue.then(async () => {
        const idx = ((await store.get(INDEX))[INDEX] || []).filter((k) => k !== key);
        idx.push(key);
        const drop = idx.length > maxEntries ? idx.splice(0, idx.length - maxEntries) : [];
        await store.set({ [key]: { res, engine: engine || '' }, [INDEX]: idx });
        if (drop.length) await store.remove(drop);
      }).catch(() => {});
      return queue;
    }

    async function clear() {
      const idx = (await store.get(INDEX))[INDEX] || [];
      if (idx.length) await store.remove(idx.concat(INDEX));
    }

    return { get, put, clear };
  }

  // Kullanıcının yapay zekâ motoru kullanabilir durumda olup olmadığı (anahtarın kendisi okunmaz)
  function wantsAI(enginePref, keyStatus) {
    if (enginePref === 'google') return false;
    const ks = keyStatus || {};
    return ['gemini', 'groq'].some((p) => ks[p] && ks[p].state !== 'invalid');
  }

  // send(lines, ctx) fonksiyonunu önbellekle sarar; getLangs() -> { sl, tl }
  function withCache(send, getLangs) {
    let cache = null;
    const area = () => (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || null;
    const ensure = () => {
      if (cache) return cache;
      const s = area();
      if (!s) return null;
      cache = createCache({
        get: (k) => s.get(k),
        set: (o) => s.set(o),
        remove: (k) => s.remove(k),
      });
      return cache;
    };
    return async (lines, ctx) => {
      const c = ensure();
      const { sl, tl } = getLangs();
      let wantAI = false;
      if (c) {
        try {
          const [sy, lo] = await Promise.all([
            chrome.storage.sync.get({ engine: 'auto' }),
            chrome.storage.local.get({ keyStatus: {} }),
          ]);
          wantAI = wantsAI(String(sy.engine || 'auto').toLowerCase(), lo.keyStatus);
          const hit = await c.get(lines, sl, tl, wantAI);
          if (hit) return { ok: true, res: hit.res, engine: hit.engine, cached: true };
        } catch (_) { /* önbellek bozuksa normal çeviriye düş */ }
      }
      const resp = await send(lines, ctx);
      if (c && resp && resp.ok && Array.isArray(resp.res)) c.put(lines, sl, tl, resp.res, resp.engine);
      return resp;
    };
  }

  const api = { createCache, keyFor, usable, wantsAI };
  ns.cache = api;
  ns.withCache = withCache;
  if (typeof module !== 'undefined') module.exports = api;
})();
