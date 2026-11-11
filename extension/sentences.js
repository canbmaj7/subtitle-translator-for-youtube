// json3 altyazı olaylarını cümlelere birleştirir ve ekran için zaman oranlı parçalara böler.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const NOSPACE = /^(zh|ja|ko|th)/;
  const END_RE = /[.!?…。！？]["'”’)\]]*$/;
  const ABBR_RE = /^(mr|mrs|ms|dr|prof|sr|jr|vs|etc|e\.g|i\.e|st|no|a\.m|p\.m|u\.s|inc|ltd|co|approx|fig|dept)\.$/i;
  const TAG_RE = /^[\[(].*[\])]$/; // [Music], (applause) gibi tek başına etiketler
  const NOTE_RE = /[♪♫]/;
  const NOTE_ONLY_RE = /^[♪♫]+$/;

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
      if (k.e <= k.s) {
        k.e = nextStart > k.s ? Math.min(nextStart, k.s + 300) : k.s + 300;
      }
      k.gap = nextStart === Infinity ? Infinity : Math.max(0, nextStart - k.e);
    }
    return tokens;
  }

  // Metin uzunluğu hesaplama yardımcısı
  function calcLen(tokens, start, end, join) {
    let l = 0;
    for (let i = start; i < end; i++) {
      l += tokens[i].t.length;
      if (i > start) l += join.length;
    }
    return l;
  }

  // İki parçayı dengeli bölme (son parça çok kısa kalmasını önler)
  function balanceTwoChunks(combined, join, maxChars, maxDur) {
    const n = combined.length;
    let bestCut = Math.floor(n / 2) - 1;
    let maxGap = -1;
    let found = false;

    const minI = Math.min(2, Math.max(0, n - 2));
    const maxI = Math.max(minI, n - 4);

    for (let i = minI; i <= maxI; i++) {
      const len1 = calcLen(combined, 0, i + 1, join);
      const dur1 = combined[i].e - combined[0].s;
      const len2 = calcLen(combined, i + 1, n, join);
      const dur2 = combined[n - 1].e - combined[i + 1].s;

      if (len1 <= maxChars && dur1 <= maxDur && len2 <= maxChars && dur2 <= maxDur) {
        const gap = i + 1 < n ? Math.max(0, combined[i + 1].s - combined[i].e) : 0;
        if (gap > maxGap) {
          maxGap = gap;
          bestCut = i;
          found = true;
        }
      }
    }

    if (!found) {
      let minDiff = Infinity;
      for (let i = minI; i <= maxI; i++) {
        const len1 = calcLen(combined, 0, i + 1, join);
        const len2 = calcLen(combined, i + 1, n, join);
        const diff = Math.abs(len1 - len2);
        if (diff < minDiff) {
          minDiff = diff;
          bestCut = i;
        }
      }
    }

    return [
      combined.slice(0, bestCut + 1),
      combined.slice(bestCut + 1)
    ];
  }

  // Noktalamasız uzun cümleleri bölme
  function splitSentence(sn, isCjk) {
    const maxChars = isCjk ? 90 : 220;
    const maxDur = isCjk ? Infinity : 14000;
    const textLen = (sn.text || '').length;
    const dur = (sn.e || 0) - (sn.s || 0);

    if (textLen <= maxChars && dur <= maxDur) {
      return [sn];
    }

    const toks = sn.toks || [];
    const join = sn.join != null ? sn.join : (isCjk ? '' : ' ');

    // CJK ve tek token ise karakter bazlı böl
    if (toks.length <= 1) {
      if (textLen <= maxChars) return [sn];
      const n = Math.max(1, Math.ceil(textLen / maxChars));
      const parts = splitInto(sn.text, n);
      const totalLen = parts.reduce((a, p) => a + p.length, 0) || 1;
      let acc = 0;
      const res = [];
      parts.forEach((p, i) => {
        const s = sn.s + Math.round(((sn.e - sn.s) * acc) / totalLen);
        acc += p.length;
        const e = i === parts.length - 1 ? sn.e : sn.s + Math.round(((sn.e - sn.s) * acc) / totalLen);
        if (p) {
          res.push({
            s,
            e: Math.max(s, e),
            text: p,
            tr: null,
            toks: [{ t: p, s, e, gap: 0 }],
            join
          });
        }
      });
      return res.length ? res : [sn];
    }

    // Kelime zamanlı token'ları parçalara böl
    const chunks = [];
    let start = 0;

    while (start < toks.length) {
      const remaining = toks.length - start;
      const remLen = calcLen(toks, start, toks.length, join);
      const remDur = toks[toks.length - 1].e - toks[start].s;

      if (remLen <= maxChars && remDur <= maxDur) {
        if (remaining < 3 && chunks.length > 0) {
          const prev = chunks[chunks.length - 1];
          const combined = prev.concat(toks.slice(start));
          const combLen = calcLen(combined, 0, combined.length, join);
          const combDur = combined[combined.length - 1].e - combined[0].s;

          if (combLen <= maxChars && combDur <= maxDur) {
            chunks[chunks.length - 1] = combined;
          } else {
            const balanced = balanceTwoChunks(combined, join, maxChars, maxDur);
            chunks.splice(chunks.length - 1, 1, ...balanced);
          }
        } else {
          chunks.push(toks.slice(start));
        }
        break;
      }

      let end = start;
      while (end < toks.length) {
        const curLen = calcLen(toks, start, end + 1, join);
        const curDur = toks[end].e - toks[start].s;
        if (curLen > maxChars || curDur > maxDur) break;
        end++;
      }
      if (end === start) end = start + 1;

      let bestCut = -1;
      let maxGap = -1;
      const minCut = Math.min(start + 2, end - 1);

      // 1) En uzun doğal duraklama (jeton arası boşluk) ara
      for (let i = minCut; i < end; i++) {
        if (toks.length - (i + 1) < 3 && toks.length - start >= 6) continue;
        const gap = i + 1 < toks.length ? Math.max(0, toks[i + 1].s - toks[i].e) : 0;
        if (gap > maxGap && gap > 0) {
          maxGap = gap;
          bestCut = i;
        }
      }

      // 2) Duraklama yoksa kelime sınırında böl
      if (bestCut === -1) {
        let cand = end - 1;
        while (cand > start && toks.length - (cand + 1) < 3 && toks.length - start >= 6) {
          cand--;
        }
        bestCut = Math.max(start, cand);
      }

      chunks.push(toks.slice(start, bestCut + 1));
      start = bestCut + 1;
    }

    return chunks.map((chunk) => {
      const text = chunk.map((k) => k.t).join(join);
      const s = chunk[0].s;
      const e = chunk[chunk.length - 1].e;
      const cToks = chunk.map((k) => ({ t: k.t, s: k.s, e: k.e, gap: k.gap }));
      return { s, e, text, tr: null, toks: cToks, join };
    });
  }

  // 2) Kelimeler -> cümleler (toks ve join alanları ile)
  function buildSentences(events, lang) {
    const tokens = toTokens(events, lang);
    const isCjk = ns.isCjk ? ns.isCjk(lang) : NOSPACE.test(lang);
    const join = isCjk ? '' : ' ';
    const rawOut = [];
    let cur = [];
    let len = 0;
    const flush = () => {
      if (!cur.length) return;
      const text = cur.map((k) => k.t).join(join);
      const toks = cur.map((k) => ({ t: k.t, s: k.s, e: k.e, gap: k.gap }));
      rawOut.push({ s: cur[0].s, e: cur[cur.length - 1].e, text, tr: null, toks, join });
      cur = []; len = 0;
    };

    tokens.forEach((k, i) => {
      // Tek başına [Music], (applause) gibi parantezli etiketler
      if (TAG_RE.test(k.t)) {
        if (cur.length) flush();
        cur.push(k);
        flush();
        return;
      }

      // Şarkı sözü (♪ ve ♫) kontrolü: ♪ ile bitip başlayan her satır/ölçü cümle sınırıdır
      if (NOTE_RE.test(k.t)) {
        const isNoteOnly = NOTE_ONLY_RE.test(k.t);
        const startsWithNote = /^[♪♫]/.test(k.t);
        const endsWithNote = /[♪♫]$/.test(k.t);

        if (isNoteOnly) {
          if (!cur.length) {
            cur.push(k);
            len += k.t.length + join.length;
            return;
          }

          const hasWords = cur.some((x) => !NOTE_ONLY_RE.test(x.t));
          if (!hasWords) {
            flush();
            cur.push(k);
            len += k.t.length + join.length;
            return;
          }

          const hasNoteInCur = cur.some((x) => NOTE_RE.test(x.t));
          if (!hasNoteInCur) {
            flush();
            cur.push(k);
            len += k.t.length + join.length;
            return;
          }

          const next = tokens[i + 1];
          const nextIsNote = next && NOTE_RE.test(next.t);
          if (nextIsNote) {
            cur.push(k);
            flush();
            return;
          }

          cur.push(k);
          flush();
          return;
        } else {
          if (startsWithNote && cur.length) flush();
          cur.push(k);
          len += k.t.length + join.length;
          if (endsWithNote) flush();
          return;
        }
      }

      cur.push(k);
      len += k.t.length + join.length;

      // Noktalama ve uzun sessizlik kontrolü
      const next = tokens[i + 1];
      const lowerNext = next && /\.$/.test(k.t) && /^\p{Ll}/u.test(next.t);
      const isEnd = END_RE.test(k.t) && !ABBR_RE.test(k.t) && !lowerNext;
      const longPause = k.gap > 800; // Sessizlik (≥ 1,5 sn jeton arası boşluk dahil)

      if (isEnd || longPause) flush();
    });
    flush();

    // Noktalamasız konuşmada güvenli üst sınır bölmesi (~220 karakter / ~14 sn, CJK ~90 karakter)
    const out = [];
    for (const sn of rawOut) {
      const parts = splitSentence(sn, isCjk);
      out.push(...parts);
    }

    // Zaman damgalarını monoton ve çakışmasız yap, çok kısa gösterimleri uzat
    for (let i = 0; i < out.length; i++) {
      const c = out[i];
      const nextS = i + 1 < out.length ? out[i + 1].s : Infinity;
      if (c.e > nextS) c.e = nextS;
      if (c.e - c.s < 900 && nextS > c.s) {
        c.e = Math.min(c.s + 900, nextS);
      }
      if (c.e < c.s) c.e = c.s;
    }

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
