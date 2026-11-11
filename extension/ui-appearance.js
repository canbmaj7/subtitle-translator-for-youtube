// Görünüm alt sayfası ve altyazı stil doğrulama/sınırlama yardımcıları.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});

  const DEFAULTS = {
    size: 100,
    bgOpacity: 78,
    textColor: 'white',
    origPosition: 'below',
  };

  const COLOR_PRESETS = [
    { id: 'white', hex: '#ffffff', labelKey: 'colorWhite' },
    { id: 'yellow', hex: '#ffeb3b', labelKey: 'colorYellow' },
    { id: 'green', hex: '#4ade80', labelKey: 'colorGreen' },
    { id: 'cyan', hex: '#22d3ee', labelKey: 'colorCyan' },
  ];

  const COLOR_MAP = Object.fromEntries(COLOR_PRESETS.map((p) => [p.id, p.hex]));
  const HEX_TO_ID = Object.fromEntries(COLOR_PRESETS.map((p) => [p.hex, p.id]));

  function clampRange(val, min, max, fallback) {
    if (val === null || val === undefined || val === '' || typeof val === 'boolean') return fallback;
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function normalizeColor(val) {
    const raw = String(val || '').trim().toLowerCase();
    if (COLOR_MAP[raw]) return raw;
    if (HEX_TO_ID[raw]) return HEX_TO_ID[raw];
    if (raw === '#fff') return 'white';
    return DEFAULTS.textColor;
  }

  function colorHex(val) {
    return COLOR_MAP[normalizeColor(val)] || COLOR_MAP.white;
  }

  function normalizeOrigPosition(val) {
    return String(val || '').trim().toLowerCase() === 'above' ? 'above' : 'below';
  }

  function normalizeAppearance(s) {
    const src = s && typeof s === 'object' ? s : {};
    const size = clampRange(src.size, 60, 200, DEFAULTS.size);
    const bgOpacity = clampRange(src.bgOpacity, 0, 100, DEFAULTS.bgOpacity);
    const textColor = normalizeColor(src.textColor);
    const origPosition = normalizeOrigPosition(src.origPosition);
    return {
      size,
      bgOpacity,
      bgAlpha: Number((bgOpacity / 100).toFixed(2)),
      textColor,
      colorCss: COLOR_MAP[textColor],
      origPosition,
    };
  }

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null && text !== '') e.textContent = text;
    return e;
  };

  function makeSliderRow(id, labelText, min, max, step, initial, onChange) {
    const wrap = el('div', 'ytr-slider-block');
    const head = el('div', 'ytr-slider-head');
    const label = el('label', 'ytr-row-label', labelText);
    label.setAttribute('for', id);
    const valText = el('span', 'ytr-slider-val', initial + '%');
    head.append(label, valText);

    const input = el('input', 'ytr-range');
    input.type = 'range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);
    input.setAttribute('role', 'slider');
    input.setAttribute('aria-label', labelText);
    input.setAttribute('aria-valuemin', String(min));
    input.setAttribute('aria-valuemax', String(max));
    input.setAttribute('aria-valuenow', String(initial));
    input.setAttribute('aria-valuetext', initial + '%');

    const syncAria = (v) => {
      const s = String(v);
      input.value = s;
      valText.textContent = s + '%';
      input.setAttribute('aria-valuenow', s);
      input.setAttribute('aria-valuetext', s + '%');
    };

    input.addEventListener('input', (e) => {
      e.stopPropagation();
      const clamped = clampRange(input.value, min, max, initial);
      syncAria(clamped);
      onChange(clamped);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
        e.stopPropagation();
      }
    });

    wrap.append(head, input);
    return { wrap, input, setValue: syncAria };
  }

  function build(ctx) {
    const { getSettings, setSetting, showPage, makeBackHeader } = ctx;
    const page = el('div', 'ytr-page');
    page.hidden = true;

    const sizeSlider = makeSliderRow(
      'ytr-slider-size',
      ns.t('rowFontSize'),
      60,
      200,
      5,
      DEFAULTS.size,
      (v) => setSetting('size', v)
    );

    const bgSlider = makeSliderRow(
      'ytr-slider-bg',
      ns.t('rowBgOpacity'),
      0,
      100,
      2,
      DEFAULTS.bgOpacity,
      (v) => setSetting('bgOpacity', v)
    );

    const colorLabel = el('div', 'ytr-section-label', ns.t('rowTextColor'));
    const colorGroup = el('div', 'ytr-color-row');
    colorGroup.setAttribute('role', 'radiogroup');
    colorGroup.setAttribute('aria-label', ns.t('rowTextColor'));
    const colorBtns = {};

    for (const preset of COLOR_PRESETS) {
      const b = el('button', 'ytr-color-btn ytr-menuitem');
      b.type = 'button';
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', 'false');
      const name = ns.t(preset.labelKey);
      b.setAttribute('aria-label', name);
      b.title = name;
      const swatch = el('span', 'ytr-color-swatch');
      swatch.style.backgroundColor = preset.hex;
      const lbl = el('span', 'ytr-color-name', name);
      b.append(swatch, lbl);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        setSetting('textColor', preset.id);
      });
      colorGroup.appendChild(b);
      colorBtns[preset.id] = b;
    }

    const posLabel = el('div', 'ytr-section-label', ns.t('rowOrigPosition'));
    const posItems = {};
    const posWrap = el('div', 'ytr-pos-list');
    for (const [posId, msgKey] of [['above', 'origPosAbove'], ['below', 'origPosBelow']]) {
      const item = el('div', 'ytr-row ytr-menuitem ytr-radio-row');
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', 'false');
      item.tabIndex = 0;
      item.append(el('span', 'ytr-radio-check', '✓'), el('span', 'ytr-row-label', ns.t(msgKey)));
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setSetting('origPosition', posId);
      });
      posWrap.appendChild(item);
      posItems[posId] = item;
    }

    const backRow = makeBackHeader
      ? makeBackHeader(ns.t('navAppearance'), () => showPage('main'))
      : el('div', 'ytr-row ytr-back-row', ns.t('navAppearance'));

    page.append(backRow, sizeSlider.wrap, bgSlider.wrap, colorLabel, colorGroup, posLabel, posWrap);

    function refresh() {
      const app = normalizeAppearance(getSettings ? getSettings() : {});
      sizeSlider.setValue(app.size);
      bgSlider.setValue(app.bgOpacity);
      for (const [id, b] of Object.entries(colorBtns)) {
        const active = id === app.textColor;
        b.classList.toggle('ytr-selected', active);
        b.setAttribute('aria-checked', String(active));
      }
      for (const [id, item] of Object.entries(posItems)) {
        const active = id === app.origPosition;
        item.classList.toggle('ytr-selected', active);
        item.setAttribute('aria-checked', String(active));
      }
    }

    return { page, refresh };
  }

  const api = {
    DEFAULTS,
    COLOR_PRESETS,
    clampRange,
    normalizeColor,
    colorHex,
    normalizeOrigPosition,
    normalizeAppearance,
    build,
  };

  ns.appearance = api;
  Object.assign(ns, {
    clampRange,
    normalizeColor,
    colorHex,
    normalizeOrigPosition,
    normalizeAppearance,
  });
  ns.pages = ns.pages || {};
  ns.pages.appearance = api;

  if (typeof module !== 'undefined') module.exports = api;
})();
