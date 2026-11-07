// Oynatıcı kontrol çubuğuna düğme ve ayar paneli ekler.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const SVGNS = 'http://www.w3.org/2000/svg';
  let getSettings = () => ({}), setSetting = () => {};
  let btn = null, panel = null, refs = {};

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

  function makeIcon() {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 36 36');
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    const r = document.createElementNS(SVGNS, 'rect');
    for (const [k, v] of Object.entries({ x: 7, y: 10, width: 22, height: 16, rx: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 })) r.setAttribute(k, v);
    const t = document.createElementNS(SVGNS, 'text');
    for (const [k, v] of Object.entries({ x: 18, y: 22, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: 'currentColor', 'font-family': 'Roboto,Arial,sans-serif' })) t.setAttribute(k, v);
    t.textContent = 'TR';
    svg.append(r, t);
    return svg;
  }

  function makeButton() {
    const b = el('button', 'ytp-button ytr-btn');
    b.type = 'button';
    b.title = 'Türkçe çeviri (tıkla: aç/kapat · sağ tık: ayarlar)';
    b.setAttribute('aria-label', 'Türkçe çeviri');
    b.appendChild(makeIcon());
    b.addEventListener('click', (e) => { e.stopPropagation(); setSetting('enabled', !getSettings().enabled); });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); togglePanel(); });
    return b;
  }

  function row(label, input) {
    const r = el('label', 'ytr-row');
    r.append(el('span', null, label), input);
    return r;
  }

  function makePanel() {
    const p = el('div', 'ytr-panel');
    p.hidden = true;
    const enabled = el('input'); enabled.type = 'checkbox';
    const orig = el('input'); orig.type = 'checkbox';
    const size = el('input'); size.type = 'range'; size.min = 60; size.max = 200; size.step = 10;
    const sizeVal = el('span', 'ytr-val');
    const sizeWrap = el('span', 'ytr-sizewrap'); sizeWrap.append(size, sizeVal);
    enabled.addEventListener('change', () => setSetting('enabled', enabled.checked));
    orig.addEventListener('change', () => setSetting('showOriginal', orig.checked));
    size.addEventListener('input', () => setSetting('size', Number(size.value)));
    const status = el('div', 'ytr-status', 'Motor: —');
    p.append(el('div', 'ytr-title', 'YouTube Türkçe Altyazı'), row('Türkçe çeviriyi göster', enabled), row('Orijinal metni de göster', orig), row('Yazı boyutu', sizeWrap), status);
    // Panel içindeki etkileşimler oynatıcıya (duraklat, kısayol vb.) ulaşmasın
    for (const ev of ['click', 'dblclick', 'mousedown', 'mouseup', 'keydown', 'keyup', 'contextmenu', 'wheel'])
      p.addEventListener(ev, (e) => e.stopPropagation());
    refs = { enabled, orig, size, sizeVal, status };
    return p;
  }

  function togglePanel(force) {
    if (!panel) return;
    panel.hidden = typeof force === 'boolean' ? !force : !panel.hidden;
  }

  function ensure() {
    const host = document.querySelector('.ytp-right-controls');
    const player = document.getElementById('movie_player');
    if (!host || !player) return;
    if (!btn) btn = makeButton();
    if (!btn.isConnected || !host.contains(btn)) {
      const cc = host.querySelector('.ytp-subtitles-button');
      const gear = host.querySelector('.ytp-settings-button');
      if (cc && cc.parentElement) cc.parentElement.insertBefore(btn, cc.nextSibling);
      else if (gear && gear.parentElement) gear.parentElement.insertBefore(btn, gear);
      else host.prepend(btn);
    }
    if (!panel) panel = makePanel();
    if (panel.parentElement !== player) player.appendChild(panel);
    refresh();
  }

  function refresh() {
    const s = getSettings();
    if (btn) btn.classList.toggle('ytr-on', !!s.enabled);
    if (!refs.enabled) return;
    refs.enabled.checked = !!s.enabled;
    refs.orig.checked = !!s.showOriginal;
    refs.size.value = s.size;
    refs.sizeVal.textContent = s.size + '%';
  }

  ns.initUI = (getS, setS) => {
    getSettings = getS; setSetting = setS;
    setInterval(ensure, 1000); // YouTube kontrolleri yeniden çizebilir
    ensure();
    // Panelin dışına tıklayınca kapat
    document.addEventListener('click', (e) => {
      if (panel && !panel.hidden && !panel.contains(e.target) && !(btn && btn.contains(e.target))) panel.hidden = true;
    }, true);
  };
  ns.refreshUI = refresh;
  ns.setStatus = (engine, error) => {
    if (!refs.status) return;
    refs.status.textContent = engine ? 'Motor: ' + engine + (engine === 'Google' ? ' (anahtarsız — daha iyi çeviri için araç çubuğundan anahtar ekle)' : '') : (error ? 'Çeviri hatası: ' + error : 'Motor: —');
  };
})();
