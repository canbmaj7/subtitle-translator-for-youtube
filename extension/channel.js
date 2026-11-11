// Kanal başına dil tercihleri: saf yardımcı fonksiyonlar.
// Kanal adı normalize edilir (≤80 karakter), en son hedeflenen diller saklanır.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const MAX_ENTRIES = 200;

  function keyOf(name) {
    if (name == null) return '';
    let s = String(name).trim();
    if (!s) return '';
    if (s.length > 80) s = s.slice(0, 80).trim();
    return s;
  }

  function pick(map, key) {
    if (!map || !key) return null;
    const k = keyOf(key);
    if (!k) return null;
    if (map instanceof Map) return map.get(k) || null;
    if (typeof map === 'object' && Object.prototype.hasOwnProperty.call(map, k)) {
      return map[k] || null;
    }
    return null;
  }

  function put(map, key, tl, max = MAX_ENTRIES) {
    const k = keyOf(key);
    const val = tl ? String(tl).trim() : '';
    const out = {};
    if (map && typeof map === 'object') {
      const entries = map instanceof Map ? map.entries() : Object.entries(map);
      for (const [ek, ev] of entries) {
        if (ek !== k) out[ek] = ev;
      }
    }
    if (k && val) {
      out[k] = val;
    }
    const limit = Math.max(1, Number(max) || MAX_ENTRIES);
    const keys = Object.keys(out);
    if (keys.length > limit) {
      const dropCount = keys.length - limit;
      for (let i = 0; i < dropCount; i++) {
        delete out[keys[i]];
      }
    }
    return out;
  }

  const api = { keyOf, pick, put, MAX_ENTRIES };
  ns.channel = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
