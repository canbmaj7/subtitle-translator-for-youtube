// json3 altyazı olaylarını cümlelere birleştirir ve ekran için zaman oranlı parçalara böler.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const NOSPACE = /^(zh|ja|ko|th)/;
  const END_RE = /[.!?…。！？]["'”’)\]]*$/;
  const ABBR_RE = /^(mr|mrs|ms|dr|prof|sr|jr|vs|etc|e\.g|i\.e|st|no)\.$/i;
  const TAG_RE = /^[\[(♪].*[\])♪]$/; // [Music], (applause), ♪

  // 1) Olaylar -> zaman damgalı kelimeler
  function toTokens(events, lang) {
    const ev = (events || []).filter((e) => e.segs && e.segs.some((s) => (s.utf8 || '').replace(/\n/g, '').trim()));
    const tokens = [];
    ev.forEach((e, i) => {
      const start = e.tStartMs || 0;
      const nextS = i + 1 < ev.length ? ev[i + 1].tStartMs : Infinity;
      const evEnd = Math.min(start + (e.dDurationMs || 2500), nextS);
      const wordLevel = e.segs.some((s) => (s.tOffsetMs || 0) > 0);
      if (wordLevel) {
        for (const s of e.segs) {
          const t = (s.utf8 || '').replace(/\s*\n\s*/g, ' ').trim();
          if (t) tokens.push({ t, s: start + (s.tOffsetMs || 0), evEnd });
        }
      } else {
        const text = e.segs.map((s) => s.utf8 || '').join('').replace(/\s*\n\s*/g, ' ').trim();
        const words = (ns.isCjk ? ns.isCjk(lang) : NOSPACE.test(lang)) ? [text] : text.split(/\s+/);
        const total = words.reduce((a, w) => a + w.length + 1, 0);
        let acc = 0;
        for (const w of words) {
          tokens.push({ t: w, s: start + Math.round(((evEnd - start) * acc) / total), evEnd });
          acc += w.length + 1;
        }
      }
    });
    // Bitiş zamanları
    for (let i = 0; i < tokens.length; i++) {
      const k = tokens[i];
      const nextStart = i + 1 < tokens.length ? tokens[i + 1].s : Infinity;
      k.e = Math.min(nextStart, k.evEnd, k.s + Math.max(700, k.t.length * 100));
      if (k.e <= k.s) k.e = k.s + 300;
      k.gap = nextStart === Infinity ? Infinity : nextStart - k.e;
    }
    return tokens;
  }

  // 2) Kelimeler -> cümleler (toks ve join alanları ile)
  function buildSentences(events, lang) {
    const tokens = toTokens(events, lang);
    const join = (ns.isCjk ? ns.isCjk(lang) : NOSPACE.test(lang)) ? '' : ' ';
    const out = [];
    let cur = [];
    let len = 0;
    const flush = () => {
      if (!cur.length) return;
      const text = cur.map((k) => k.t).join(join);
      const toks = cur.map((k) => ({ t: k.t, s: k.s }));
      out.push({ s: cur[0].s, e: cur[cur.length - 1].e, text, tr: null, toks, join });
      cur = []; len = 0;
    };
    tokens.forEach((k, i) => {
      const prev = cur[cur.length - 1];
      if (TAG_RE.test(k.t) && cur.length) flush(); // [Music] kendi başına olsun
      cur.push(k); len += k.t.length + 1;
      const isEnd = END_RE.test(k.t) && !ABBR_RE.test(k.t);
      const longPause = k.gap > 800;
      const tooLong = len > 220 || (len > 130 && /[,;:]$/.test(k.t));
      if (isEnd || longPause || tooLong || TAG_RE.test(k.t)) flush();
    });
    flush();
    // Çok kısa gösterimleri uzat (bir sonrakini ezmeden)
    out.forEach((c, i) => {
      const lim = i + 1 < out.length ? out[i + 1].s : Infinity;
      if (c.e - c.s < 900) c.e = Math.min(c.s + 900, lim);
    });
    return out;
  }

  // 3) Metni n dengeli parçaya böl (kelime sınırlarında, noktalamayı tercih ederek)
  function splitInto(text, n) {
    if (n <= 1) return [text];
    const spaced = !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0e00-\u0e7f]/.test(text);
    const words = spaced ? text.split(/\s+/) : Array.from(text);
    const sep = spaced ? ' ' : '';
    if (words.length <= n) return words.concat(Array(n - words.length).fill('')).slice(0, n).map((w) => w);
    const total = text.length;
    const cuts = [];
    let pos = 0, wi = 0;
    for (let k = 1; k < n; k++) {
      const target = (total * k) / n;
      let best = -1, bestScore = Infinity, p = pos;
      for (let i = wi; i < words.length - (n - k); i++) {
        p += words[i].length + sep.length;
        const score = Math.abs(p - target) - (/[,;:.!?]$/.test(words[i]) ? 12 : 0);
        if (score < bestScore) { bestScore = score; best = i; }
        if (p > target + 25) break;
      }
      if (best < wi) best = wi;
      for (let i = wi; i <= best; i++) pos += words[i].length + sep.length;
      cuts.push(best);
      wi = best + 1;
    }
    const parts = [];
    let from = 0;
    for (const c of cuts) { parts.push(words.slice(from, c + 1).join(sep)); from = c + 1; }
    parts.push(words.slice(from).join(sep));
    return parts;
  }

  // 4) Cümleler -> ekran parçaları ({s, e, t: orijinal, tr: çeviri|null})
  function toCues(sentences, maxChars) {
    const cues = [];
    for (const sn of sentences) {
      const shown = sn.tr || sn.text;
      const n = Math.max(1, Math.ceil(shown.length / maxChars));
      const main = splitInto(shown, n);
      const total = main.reduce((a, p) => a + p.length + 1, 0);
      let acc = 0;
      const origFallback = sn.tr ? splitInto(sn.text, main.length) : null;
      main.forEach((p, i) => {
        const s = sn.s + Math.round(((sn.e - sn.s) * acc) / total);
        acc += p.length + 1;
        const e = i === main.length - 1 ? sn.e : sn.s + Math.round(((sn.e - sn.s) * acc) / total);
        if (!p) return;
        // Çeviri yoksa (bekleyen durum)
        if (!sn.tr) {
          cues.push({ s, e, t: p, tr: null });
          return;
        }
        // Tek parçalı cümlelerde tüm orijinal metin gösterilir
        if (main.length === 1) {
          cues.push({ s, e, t: sn.text, tr: p });
          return;
        }
        // Birden fazla parçada zaman aralığındaki kelimelerden birleştir
        const winStart = i === 0 ? -Infinity : s;
        const winEnd = i === main.length - 1 ? Infinity : e;
        const words = (sn.toks || []).filter((w) => w.s >= winStart && w.s < winEnd);
        const join = sn.join != null ? sn.join : ' ';
        const t = words.length ? words.map((w) => w.t).join(join) : (origFallback[i] || '');
        cues.push({ s, e, t, tr: p });
      });
    }
    return cues;
  }

  ns.buildSentences = buildSentences;
  ns.toCues = toCues;
  ns.splitInto = splitInto;
})();
