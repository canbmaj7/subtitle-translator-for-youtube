// MAIN world: oynatıcının kendi altyazı isteklerini yakalar ve altyazıyı gerekirse açtırır.
(() => {
  const TAG = 'yt-tr-ext';
  const isTT = (u) => typeof u === 'string' && u.includes('/api/timedtext');
  const report = (u, body) => {
    try { window.postMessage({ source: TAG, type: 'timedtext', url: new URL(u, location.href).href, body: body || null }, '*'); } catch (_) {}
  };

  const origFetch = window.fetch;
  window.fetch = function (input) {
    const p = origFetch.apply(this, arguments);
    try {
      const u = typeof input === 'string' ? input : input && input.url;
      if (isTT(u)) {
        p.then((res) => res.clone().text().then((t) => report(u, t), () => report(u))).catch(() => report(u));
      }
    } catch (_) {}
    return p;
  };
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) {
    try {
      if (isTT(String(u))) {
        const url = String(u);
        this.addEventListener('load', () => {
          let body = null;
          try {
            if (this.responseType === '' || this.responseType === 'text') body = this.responseText;
            else if (this.responseType === 'arraybuffer') body = new TextDecoder().decode(this.response);
            else if (this.responseType === 'json') body = JSON.stringify(this.response);
          } catch (_) {}
          report(url, body);
        });
      }
    } catch (_) {}
    return origOpen.apply(this, arguments);
  };

  // content.js'ten gelen komutlar
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== TAG + '-cmd') return;
    const p = document.getElementById('movie_player');
    if (!p) return;
    if (e.data.type === 'ensureCaptions') {
      try {
        const tracks = (p.getOption && p.getOption('captions', 'tracklist')) || [];
        if (tracks.length && p.toggleSubtitlesOn) p.toggleSubtitlesOn();
        window.postMessage({ source: TAG, type: 'ensureResult', tracks: tracks.length }, '*');
      } catch (_) {}
    }
  });
})();
