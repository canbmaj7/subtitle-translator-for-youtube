// Transkript sayfası için saf (DOM bağımsız) yardımcılar.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});

  // Oynatıcı tarzı zaman: 0:05, 1:02, 1:02:03 (saat varsa dakika iki haneli)
  function clock(ms) {
    if (typeof ms !== 'number' || isNaN(ms) || ms < 0) return '0:00';
    const sec = Math.floor(ms / 1000);
    const s = String(sec % 60).padStart(2, '0');
    const m = Math.floor(sec / 60) % 60;
    const h = Math.floor(sec / 3600);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }

  // SRT zaman biçimi: HH:MM:SS,mmm
  function srtTime(ms) {
    const t = Math.max(0, Math.floor(ms) || 0);
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    const sec = Math.floor(t / 1000);
    return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)},${pad(t % 1000, 3)}`;
  }

  // Cümle metnini moda göre ayıkla ve trim'le
  function lineText(sn, mode) {
    if (!sn) return '';
    const orig = (sn.text || '').trim();
    const tr = (sn.tr || '').trim();
    const m = mode || 'translation';
    if (m === 'original') return orig;
    if (m === 'both') return tr ? `${tr}\n${orig}` : orig;
    return tr || orig;
  }

  // Cümleleri SRT alt yazı biçimine dönüştür
  function toSrt(sentences, opts) {
    const mode = opts && opts.mode;
    const valid = (sentences || [])
      .map((sn) => ({ s: sn.s || 0, e: sn.e || 0, text: lineText(sn, mode) }))
      .filter((x) => x.text);
    if (!valid.length) return '';
    const blocks = valid.map((cur, i) => {
      const next = valid[i + 1];
      let end = cur.e;
      if (next && end > next.s) end = next.s;
      if (end <= cur.s) end = cur.s + 1;
      return `${i + 1}\n${srtTime(cur.s)} --> ${srtTime(end)}\n${cur.text}`;
    });
    return blocks.join('\n\n') + '\n';
  }

  // Cümleleri düz metin biçimine dönüştür
  function toTxt(sentences, opts) {
    const mode = opts && opts.mode;
    const ts = !!(opts && opts.timestamps);
    const lines = [];
    for (const sn of (sentences || [])) {
      const text = lineText(sn, mode);
      if (!text) continue;
      if (!ts) {
        lines.push(text);
      } else if (mode === 'both' && (sn.tr || '').trim()) {
        lines.push(`[${clock(sn.s)}] ${(sn.tr || '').trim()}`);
        if ((sn.text || '').trim()) lines.push((sn.text || '').trim());
      } else {
        lines.push(`[${clock(sn.s)}] ${text}`);
      }
    }
    return lines.join('\n');
  }

  // Toplam ve çevrilmiş cümle istatistiği
  function stats(sentences) {
    const list = sentences || [];
    const translated = list.filter((s) => s && s.tr && s.tr.trim()).length;
    return { total: list.length, translated };
  }

  // Yerel duyarlı küçük harf dönüşümü
  function toLower(str, loc) {
    if (!str) return '';
    const s = loc === 'tr' ? str.replace(/İ/g, 'i').replace(/I/g, 'ı') : str;
    try { return (loc ? s.toLocaleLowerCase(loc) : s.toLowerCase()).replace(/\u0307/g, ''); }
    catch (_) { return s.toLowerCase().replace(/\u0307/g, ''); }
  }

  function matchesQuery(sn, q, locale) {
    if (!sn) return false;
    const n1 = toLower(q, locale);
    if (toLower(sn.text, locale).includes(n1) || toLower(sn.tr, locale).includes(n1)) return true;
    if (!locale) {
      const nTr = toLower(q, 'tr');
      if (toLower(sn.text, 'tr').includes(nTr) || toLower(sn.tr, 'tr').includes(nTr)) return true;
    }
    return false;
  }

  // Metin veya çeviride arama (boş sorgu -> null, aksi halde eşleşen indisler)
  function search(sentences, query, locale) {
    const q = (query || '').trim();
    if (!q) return null;
    const hits = [];
    (sentences || []).forEach((sn, i) => {
      if (matchesQuery(sn, q, locale)) hits.push(i);
    });
    return hits;
  }

  // Metin veya çeviride cümle filtreleme (eşleşen indeksleri döndürür)
  function filterSentences(sentences, query, locale) {
    const list = Array.isArray(sentences) ? sentences : [];
    const q = (query || '').trim();
    if (!q) return list.map((_, i) => i);
    const hits = [];
    list.forEach((sn, i) => {
      if (matchesQuery(sn, q, locale)) hits.push(i);
    });
    return hits;
  }

  // Zaman damgasına karşılık gelen son cümle indisi (ikili arama)
  function activeIndex(sentences, ms) {
    const list = sentences || [];
    if (!list.length || typeof ms !== 'number' || isNaN(ms) || ms < 0) return -1;
    let lo = 0, hi = list.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].s <= ms) { ans = mid; lo = mid + 1; }
      else { hi = mid - 1; }
    }
    return ans;
  }

  // Merkez etrafında sınırlara yaslanan pencere aralığı
  function windowRange(center, total, size) {
    const tot = Math.max(0, total || 0);
    const win = Math.min(tot, Math.max(0, size || 0));
    if (win === 0) return { from: 0, to: 0 };
    const c = Math.max(0, center || 0);
    let from = c - Math.floor(win / 2);
    if (from + win > tot) from = tot - win;
    if (from < 0) from = 0;
    return { from, to: from + win };
  }

  // İndirme dosya adı üretimi
  function fileName(videoId, lang, ext) {
    const clean = (s) => (s || '').replace(/[^A-Za-z0-9_-]/g, '_');
    const vid = clean((videoId || '').trim()) || 'video';
    return `subtitles-${vid}.${clean(lang)}.${(ext || '').replace(/^\./, '')}`;
  }

  ns.transcript = {
    clock,
    srtTime,
    lineText,
    toSrt,
    toTxt,
    stats,
    search,
    filterSentences,
    activeIndex,
    windowRange,
    fileName,
  };
  Object.assign(ns, ns.transcript);

  if (typeof module !== 'undefined') module.exports = ns.transcript;
})();
