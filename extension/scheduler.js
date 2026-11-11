// Çeviri zamanlayıcısı: Cümleleri pencereli olarak 3 paralel worker ile çevirir.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});

  const BEHIND_MS = 60 * 1000; // Oynatma konumunun 60 sn gerisi
  const LOOKAHEAD_MS = 10 * 60 * 1000; // 10 dakika ilerisi
  const RETRY_DELAYS = [3000, 10000, 30000];
  const MAX_FAILS = 3;
  const WORKER_COUNT = 3;
  const POLL_INTERVAL_MS = 1500;

  ns.createScheduler = ({
    sentences = [],
    sl,
    target,
    gen,
    getGen,
    getPlayheadMs,
    send,
    onChunkDone,
    onProgress,
  }) => {
    // 1) Chunk'lara böl: en fazla 25 cümle ve 2500 karakter
    const chunks = [];
    let cur = [], len = 0, startIdx = 0;
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      const textLen = (s.text || '').length;
      if (cur.length >= 25 || (cur.length > 0 && len + textLen > 2500)) {
        cur.startIdx = startIdx;
        cur.endIdx = i - 1;
        chunks.push(cur);
        cur = [];
        len = 0;
        startIdx = i;
      }
      cur.push(s);
      len += textLen + 1;
    }
    if (cur.length) {
      cur.startIdx = startIdx;
      cur.endIdx = sentences.length - 1;
      chunks.push(cur);
    }

    chunks.forEach((c) => {
      c.s = c[0].s;
      c.e = c[c.length - 1].e;
      c.done = false;
      c.inFlight = false;
      c.fails = 0;
      c.retryAt = 0;
      c.failed = false;
      const bStart = Math.max(0, c.startIdx - 4);
      const beforeSlice = sentences.slice(bStart, c.startIdx);
      const afterSlice = sentences.slice(c.endIdx + 1, c.endIdx + 3);
      c.ctx = {
        before: beforeSlice.map((s) => (s && s.text != null ? String(s.text) : '')),
        after: afterSlice.map((s) => (s && s.text != null ? String(s.text) : '')),
      };
    });

    let stopped = false;
    let runningWorkers = 0;
    const sleepTimers = new Set();

    const isStale = () => stopped || (getGen && getGen() !== gen);

    // İlerleme durumunu hesapla
    const computeProgress = () => {
      const total = chunks.length;
      const done = chunks.filter((c) => c.done).length;
      const failed = chunks.filter((c) => c.failed).length;
      const inFlight = chunks.some((c) => c.inFlight);

      const t = getPlayheadMs ? getPlayheadMs() : 0;
      const wStart = t - BEHIND_MS;
      const wEnd = t + LOOKAHEAD_MS;
      const hasPendingInWindow = chunks.some(
        (c) => !c.done && !c.failed && c.e >= wStart && c.s <= wEnd
      );
      const active = inFlight || hasPendingInWindow;
      return { total, done, failed, active };
    };

    const notifyProgress = () => {
      if (onProgress) {
        try { onProgress(computeProgress()); } catch (_) {}
      }
    };

    // Aday chunk seçimi
    const pickNext = (now, playhead) => {
      const wStart = playhead - BEHIND_MS;
      const wEnd = playhead + LOOKAHEAD_MS;
      let best = null, bestDist = Infinity;

      for (const c of chunks) {
        if (c.done || c.failed || c.inFlight) continue;
        if (c.retryAt > now) continue;
        // [c.s, c.e] ile [wStart, wEnd] kesişimi: c.e >= wStart && c.s <= wEnd
        if (c.e < wStart || c.s > wEnd) continue;

        // Oynatma konumuna uzaklık
        const d = playhead < c.s ? c.s - playhead : (playhead > c.e ? playhead - c.e : 0);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (best) best.inFlight = true;
      return best;
    };

    const sleep = (ms) => new Promise((resolve) => {
      const timer = setTimeout(() => {
        sleepTimers.delete(timer);
        resolve();
      }, ms);
      sleepTimers.add(timer);
    });

    const runWorker = async () => {
      runningWorkers++;
      try {
        while (!isStale()) {
          const now = Date.now();
          const playhead = getPlayheadMs ? getPlayheadMs() : 0;
          const chunk = pickNext(now, playhead);

          if (chunk) {
            notifyProgress();
            let res = null;
            try {
              res = await send(chunk.map((c) => c.text), chunk.ctx || { before: [], after: [] });
            } catch (err) {
              res = { ok: false, error: err };
            }

            if (isStale()) return;
            chunk.inFlight = false;

            if (res && res.ok && Array.isArray(res.res)) {
              chunk.done = true;
              chunk.forEach((c, i) => {
                c.tr = ((res.res[i] != null ? res.res[i] : '') || '').trim() || c.text;
              });
              notifyProgress();
              if (onChunkDone) {
                try { onChunkDone(chunk, res); } catch (_) {}
              }
            } else {
              chunk.fails++;
              if (chunk.fails >= MAX_FAILS) {
                chunk.failed = true;
              } else {
                const delay = RETRY_DELAYS[chunk.fails - 1] || 30000;
                chunk.retryAt = Date.now() + delay;
              }
              notifyProgress();
            }
            continue;
          }

          const allFinished = chunks.every((c) => c.done || c.failed);
          if (allFinished) break;

          await sleep(POLL_INTERVAL_MS);
        }
      } finally {
        runningWorkers--;
      }
    };

    const ensureWorkers = () => {
      if (isStale() || !chunks.length) return; // boş listede işçi hemen biter, döngü sonsuza gider
      while (runningWorkers < WORKER_COUNT) {
        runWorker();
      }
    };

    const retryFailed = () => {
      let resetAny = false;
      for (const c of chunks) {
        if (c.failed) {
          c.failed = false;
          c.fails = 0;
          c.retryAt = 0;
          resetAny = true;
        }
      }
      if (resetAny) {
        notifyProgress();
        ensureWorkers();
      }
    };

    const stop = () => {
      stopped = true;
      for (const t of sleepTimers) clearTimeout(t);
      sleepTimers.clear();
      for (const c of chunks) {
        if (c.inFlight) c.inFlight = false;
      }
    };

    // Başlangıç bildirimi ve worker'ları başlat
    notifyProgress();
    ensureWorkers();

    return {
      retryFailed,
      stop,
      getProgress: computeProgress,
      notifyProgress,
    };
  };
})();
