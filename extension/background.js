// Çeviri isteklerini arka planda yapar (sayfanın CORS kısıtından bağımsız).
async function gtx(lines, sl, tl) {
  const body = new URLSearchParams();
  body.set('q', lines.join('\n'));
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl || 'auto')}&tl=${encodeURIComponent(tl)}&dt=t&dj=0`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = await r.json();
  return (data[0] || []).map((s) => s[0] || '').join('');
}

async function translateLines(lines, sl, tl) {
  const joined = await gtx(lines, sl, tl);
  const parts = joined.split('\n');
  while (parts.length > lines.length && parts[parts.length - 1] === '') parts.pop();
  if (parts.length === lines.length) return parts;
  // Satır sayısı tutmadı: tek tek çevir (yedek yol)
  const out = [];
  for (const l of lines) {
    try { out.push((await gtx([l], sl, tl)).replace(/\n/g, ' ').trim()); } catch (_) { out.push(l); }
  }
  return out;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'translate') {
    translateLines(msg.lines, msg.sl, msg.tl)
      .then((res) => sendResponse({ ok: true, res }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // asenkron cevap
  }
});
