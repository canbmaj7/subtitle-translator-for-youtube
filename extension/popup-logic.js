// Saf popup mantık yardımcıları: rozet eşleme, anahtar aksiyonları ve motor durumları.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});
  const t = (k, subs) => (ns.t ? ns.t(k, subs) : (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage(k, subs)) || k);

  const POPUP_BADGE_MAP = {
    valid: { msgKey: 'keyStatusValid', tone: 'green' },
    invalid: { msgKey: 'keyBadgeInvalid', tone: 'red' },
    quota: { msgKey: 'keyStatusQuota', tone: 'orange' },
    network: { msgKey: 'keyBadgeNetwork', tone: 'gray' },
    permission: { msgKey: 'keyBadgePermission', tone: 'orange' },
    unchecked: { msgKey: 'keyStatusUnchecked', tone: 'gray' },
  };

  const GEMINI_MODELS = new Set(['fast', 'balanced', 'quality']);

  function normalizeGeminiModel(val) {
    const v = String(val || '').toLowerCase();
    return GEMINI_MODELS.has(v) ? v : 'fast';
  }

  function shouldShowCustomFields(engine) {
    return String(engine || '').toLowerCase() === 'custom';
  }

  function shouldShowGeminiQuality(engine) {
    return String(engine || '').toLowerCase() === 'gemini';
  }

  function parseCustomEndpoint(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') {
      return { ok: false, error: 'empty', endpoint: '', origin: '', permissionPattern: '' };
    }
    let trimmed = urlStr.trim().replace(/\/+$/, '');
    if (!trimmed) {
      return { ok: false, error: 'empty', endpoint: '', origin: '', permissionPattern: '' };
    }
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch (_) {
      return { ok: false, error: 'invalid', endpoint: '', origin: '', permissionPattern: '' };
    }
    if (parsed.protocol !== 'https:') {
      return { ok: false, error: 'https_required', endpoint: '', origin: '', permissionPattern: '' };
    }
    trimmed = trimmed.replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
    const origin = parsed.origin;
    return {
      ok: true,
      error: '',
      endpoint: trimmed,
      origin,
      permissionPattern: origin + '/*',
    };
  }

  function popupKeyBadge(provider, rawKey, keyStatus, isTesting) {
    const p = String(provider || '').toLowerCase();
    const info = ns.keyBadgeInfo ? ns.keyBadgeInfo(keyStatus, p) : { hasKey: false, state: 'missing' };
    const hasKey = rawKey !== undefined && rawKey !== null ? Boolean(String(rawKey).trim()) : Boolean(info.hasKey);
    if (!hasKey) return { visible: false, state: 'missing', msgKey: '', tone: '' };
    if (isTesting) return { visible: true, state: 'testing', msgKey: 'keyStatusTesting', tone: 'gray' };
    const st = info.hasKey && POPUP_BADGE_MAP[info.state] ? info.state : 'unchecked';
    const spec = POPUP_BADGE_MAP[st] || POPUP_BADGE_MAP.unchecked;
    return { visible: true, state: st, msgKey: spec.msgKey, tone: spec.tone };
  }

  function decideKeyAction(rawValue, prevSavedValue, trigger) {
    const value = String(rawValue == null ? '' : rawValue).trim();
    const prev = String(prevSavedValue == null ? '' : prevSavedValue).trim();
    const trig = String(trigger || 'blur').toLowerCase();
    if (!value) {
      if (trig === 'input' && !prev) return { action: 'noop', value: '', shouldSave: false, shouldValidate: false };
      return { action: 'clear', value: '', shouldSave: value !== prev, shouldValidate: false };
    }
    if (trig === 'input' || (trig === 'blur' && value === prev)) {
      return { action: 'noop', value, shouldSave: false, shouldValidate: false };
    }
    return { action: 'validate', value, shouldSave: value !== prev || trig === 'paste', shouldValidate: true };
  }

  function engineOptionState(engineCode, keys, keyStatus) {
    const code = String(engineCode || 'auto').toLowerCase();
    const labelKey = ns.engineLabelKey ? ns.engineLabelKey(code) : (code === 'custom' ? 'engineCustom' : 'engineAuto');
    if (code !== 'gemini' && code !== 'groq' && code !== 'custom') {
      return { code, labelKey, hasKey: true, dim: false, noteKey: '' };
    }
    const field = code === 'gemini' ? 'geminiKey' : (code === 'groq' ? 'groqKey' : 'customKey');
    const hasRaw = keys && typeof keys === 'object' && keys[field] !== undefined && keys[field] !== null;
    const hasKey = hasRaw ? Boolean(String(keys[field]).trim()) : Boolean(ns.keyBadgeInfo && ns.keyBadgeInfo(keyStatus, code).hasKey);
    return { code, labelKey, hasKey, dim: !hasKey, noteKey: hasKey ? '' : 'engineNoKey' };
  }

  function formatEngineIssue(enginePref, lastIssues, trFn) {
    const tr = typeof trFn === 'function' ? trFn : t;
    const issue = ns.findRelevantIssue ? ns.findRelevantIssue(enginePref, lastIssues) : null;
    if (!issue) return null;
    return { engine: issue.engine, code: issue.code, msgKey: issue.msgKey, text: (issue.engine ? issue.engine + ': ' : '') + tr(issue.msgKey) };
  }

  const popupApi = {
    POPUP_BADGE_MAP, popupKeyBadge, decideKeyAction, engineOptionState, formatEngineIssue,
    parseCustomEndpoint, normalizeGeminiModel, shouldShowCustomFields, shouldShowGeminiQuality,
  };
  ns.popup = popupApi;
  if (typeof module !== 'undefined') module.exports = popupApi;
})();
