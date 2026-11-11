// Uçtan uca test: gerçek eklenti, sahte YouTube sayfasında (ağ istekleri yerelde taklit edilir).
// Çalıştırma: node tests/e2e.cjs   (Playwright ve Chromium gerekir; yoksa atlanır)
// Ortam: PLAYWRIGHT_CORE=<playwright-core yolu>  CHROME_PATH=<chromium çalıştırılabilir>
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

function findPlaywright() {
  const cands = [process.env.PLAYWRIGHT_CORE, 'playwright-core', 'playwright',
    path.join(os.homedir(), '.local/lib/node_modules/@playwright/mcp/node_modules/playwright-core')].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch (_) { /* sıradaki */ } }
  return null;
}
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(os.homedir(), '.cache/ms-playwright');
  if (!fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
  for (const d of dirs) { const p = path.join(base, d, 'chrome-linux64', 'chrome'); if (fs.existsSync(p)) return p; }
  return null;
}

const pw = findPlaywright();
const chromePath = findChrome();
if (!pw || !chromePath) { console.log('e2e: Playwright/Chromium bulunamadı, atlandı'); process.exit(0); }

const EXT = path.join(__dirname, '../extension');
const EVENTS = [
  { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: 'React lets you build user interfaces from components.' }] },
  { tStartMs: 3000, dDurationMs: 3000, segs: [{ utf8: 'A component is just a JavaScript function.' }] },
  { tStartMs: 6000, dDurationMs: 3000, segs: [{ utf8: 'State changes update the screen.' }] },
];
const PAGE = `<!doctype html><html><head><title>Test Video Title - YouTube</title></head><body>
<h1 class="ytd-watch-metadata"><yt-formatted-string>Test Video Title</yt-formatted-string></h1>
<ytd-video-owner-renderer><div id="channel-name"><a>Test Channel</a></div></ytd-video-owner-renderer>
<div id="movie_player" style="position:relative;width:640px;height:360px;background:#000">
  <video></video>
  <div class="ytp-right-controls"><button class="ytp-subtitles-button"></button><button class="ytp-settings-button"></button></div>
</div>
<script>
  window.__t = 1;
  const v = document.querySelector('video');
  Object.defineProperty(v, 'currentTime', { get: () => window.__t, set: (x) => { window.__t = x; }, configurable: true });
  fetch('/api/timedtext?v=vid12345678&lang=en&fmt=json3').then((r) => r.text());
</script></body></html>`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 15000, what = 'koşul') {
  const end = Date.now() + ms; let last;
  while (Date.now() < end) { try { last = await fn(); if (last) return last; } catch (_) { /* yeniden dene */ } await wait(150); }
  throw new Error('zaman aşımı: ' + what);
}

async function launch(profile) {
  const ctx = await pw.chromium.launchPersistentContext(profile, {
    headless: false, executablePath: chromePath, viewport: { width: 900, height: 600 }, locale: 'en-US',
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  return { ctx, sw };
}

async function routes(ctx, counters, geminiHandler) {
  await ctx.route('https://www.youtube.com/**', (route) => {
    const url = route.request().url();
    if (url.includes('/api/timedtext')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ events: EVENTS }) });
    return route.fulfill({ contentType: 'text/html', body: PAGE });
  });
  await ctx.route('https://translate.googleapis.com/**', async (route) => {
    counters.google++;
    if (counters.googleMode === 'fail') return route.fulfill({ status: 500, body: 'boom' });
    if (counters.googleMode === 'slow') await wait(2500);
    const q = new URLSearchParams(route.request().postData() || '').get('q') || '';
    const out = q.split('\n').map((l) => 'TR:' + l).join('\n');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([[[out, q]]]) });
  });
  await ctx.route('https://generativelanguage.googleapis.com/**', async (route) => {
    counters.gemini++;
    const body = JSON.parse(route.request().postData() || '{}');
    counters.geminiBodies.push({ body, headers: route.request().headers(), url: route.request().url() });
    const user = JSON.parse(body.contents[0].parts[0].text);
    const lines = Array.isArray(user) ? user : user.lines;
    const text = JSON.stringify({ translations: lines.map((l) => 'AI:' + l) });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) });
  });
}

const overlayText = (page) => page.evaluate(() => (document.getElementById('ytr-overlay') || {}).innerText || '');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ytr-e2e-'));
  let passed = 0;
  const total = 10;
  try {
    // ---- Senaryo A: anahtarsız (Google), tıklama davranışı, ipucu, önbellek ----
    {
      const { ctx, sw } = await launch(path.join(tmp, 'a'));
      const c = { google: 0, gemini: 0, geminiBodies: [] };
      await routes(ctx, c);
      await sw.evaluate(() => chrome.storage.sync.set({ target: 'tr', enabled: true, engine: 'auto' }));
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('https://www.youtube.com/watch?v=vid12345678');

      // 1) Katman çevrilmiş altyazıyı gösterir
      await until(() => overlayText(page).then((t) => t.includes('TR:React lets you build')), 15000, 'çevrilmiş altyazı');
      assert.ok(c.google >= 1, 'Google çevirisi çağrılmalı');
      passed++;

      // 2) Sol tık çeviriyi kapatır/açar, sağ tık paneli açar
      const btn = page.locator('.ytr-btn');
      await btn.click();
      await until(() => page.evaluate(() => document.querySelector('.ytr-btn').classList.contains('ytr-off')), 3000, 'kapalı sınıfı');
      await until(() => overlayText(page).then((t) => t === ''), 3000, 'katman boşalmalı');
      assert.equal(await page.evaluate(() => document.querySelector('.ytr-panel').hidden), true, 'sol tık paneli açmamalı');
      await btn.click();
      await until(() => overlayText(page).then((t) => t.includes('TR:React lets you build')), 8000, 'yeniden açılınca katman');
      await btn.click({ button: 'right' });
      await until(() => page.evaluate(() => !document.querySelector('.ytr-panel').hidden), 3000, 'panel açılmalı');
      await page.keyboard.press('Escape');
      passed++;

      // 3) İlk kullanım ipucu bir kez gösterilir
      await until(() => page.evaluate(() => { const t = document.querySelector('.ytr-toast'); return t && /Right-click/.test(t.textContent); }), 6000, 'ilk ipucu');
      assert.equal((await sw.evaluate(() => chrome.storage.local.get('hintSeen'))).hintSeen, true);
      passed++;

      // 4) Önbellek kaydı yazıldı
      const keys = Object.keys(await sw.evaluate(() => chrome.storage.local.get(null)));
      assert.ok(keys.some((k) => k.startsWith('tc1:')), 'önbellek kaydı olmalı');
      passed++;

      // 5) Sayfa yenilenince yeniden çeviri istemi YOK, ipucu tekrar çıkmaz
      const before = c.google;
      await page.reload();
      await until(() => overlayText(page).then((t) => t.includes('TR:React lets you build')), 15000, 'önbellekten altyazı');
      await wait(1500);
      assert.equal(c.google, before, 'önbellek isabetinde ağ isteği olmamalı');
      assert.equal(await page.evaluate(() => { const t = document.querySelector('.ytr-toast'); return !t || t.hidden || !/Right-click/.test(t.textContent); }), true, 'ipucu tekrar çıkmamalı');
      passed++;

      assert.deepEqual(errors, [], 'sayfa hatası olmamalı: ' + errors.join(' | '));
      await ctx.close();
    }

    // ---- Senaryo B: Gemini anahtarı (sahte), bağlamlı istem, anahtar URL'de değil ----
    {
      const { ctx, sw } = await launch(path.join(tmp, 'b'));
      const c = { google: 0, gemini: 0, geminiBodies: [] };
      await routes(ctx, c);
      const FAKE = 'AIzaSyFAKE_e2e_key_000000000000000000';
      await sw.evaluate((k) => chrome.storage.local.set({ geminiKey: k }), FAKE);
      await sw.evaluate(() => chrome.storage.sync.set({ target: 'tr', enabled: true, engine: 'auto' }));
      const page = await ctx.newPage();
      await page.goto('https://www.youtube.com/watch?v=vid12345678');
      await until(() => overlayText(page).then((t) => t.includes('AI:React lets you build')), 15000, 'Gemini çevirisi');

      // 6) İstem video bağlamını taşır, çeviri yalnız "lines" için istenir
      const g = c.geminiBodies[0];
      const sys = g.body.systemInstruction.parts[0].text;
      assert.ok(sys.includes('Test Video Title') && sys.includes('Test Channel'), 'başlık ve kanal istemde olmalı');
      const user = JSON.parse(g.body.contents[0].parts[0].text);
      assert.ok(Array.isArray(user.lines) && user.lines.length === 3, 'lines tüm cümleleri içermeli');
      assert.equal(c.google, 0, 'Gemini çalışırken Google çağrılmamalı');
      passed++;

      // 7) Anahtar yalnızca başlıkta; URL, gövde veya depolanan durumda geçmez
      assert.equal(g.headers['x-goog-api-key'], FAKE);
      assert.ok(!g.url.includes(FAKE) && !JSON.stringify(g.body).includes(FAKE));
      const stored = JSON.stringify(await sw.evaluate(() => chrome.storage.local.get(['keyStatus', 'lastIssues', 'lastError', 'lastEngine'])));
      assert.ok(!stored.includes(FAKE), 'anahtar durum kayıtlarına sızmamalı');
      passed++;
      await ctx.close();
    }

    // ---- Senaryo C: hızlı aç-kapa, yavaş çeviri sırasında katman tutarlı kalır ----
    {
      const { ctx, sw } = await launch(path.join(tmp, 'c'));
      const c = { google: 0, gemini: 0, geminiBodies: [], googleMode: 'slow' };
      await routes(ctx, c);
      await sw.evaluate(() => chrome.storage.sync.set({ target: 'tr', enabled: true, engine: 'auto' }));
      const page = await ctx.newPage();
      await page.goto('https://www.youtube.com/watch?v=vid12345678');
      await until(() => page.evaluate(() => !!document.querySelector('.ytr-btn')), 10000, 'düğme');
      const btn = page.locator('.ytr-btn');
      for (let i = 0; i < 6; i++) { await btn.click(); await wait(120); } // 6 tık: kapalı/açık sonu çift sayı = açık
      await until(() => overlayText(page).then((t) => t.includes('TR:React lets you build')), 20000, 'yavaş çeviri sonrası katman');
      const st = await page.evaluate(() => ({ active: document.documentElement.classList.contains('ytr-active'), on: document.querySelector('.ytr-btn').classList.contains('ytr-on') }));
      assert.deepEqual(st, { active: true, on: true }, 'düğme açıkken katman etkin olmalı');
      passed++;
      await ctx.close();
    }

    // ---- Senaryo D: ardışık hata sonrası "Retry" çeviriyi kurtarır ----
    {
      const { ctx, sw } = await launch(path.join(tmp, 'd'));
      const c = { google: 0, gemini: 0, geminiBodies: [], googleMode: 'fail' };
      await routes(ctx, c);
      await sw.evaluate(() => chrome.storage.sync.set({ target: 'tr', enabled: true, engine: 'google' }));
      const page = await ctx.newPage();
      await page.goto('https://www.youtube.com/watch?v=vid12345678');
      await until(() => page.evaluate(() => { const r = document.querySelector('.ytr-retry-btn'); return r && !r.hidden; }), 40000, 'Retry düğmesi (3 hata sonrası)');
      c.googleMode = 'ok';
      await page.evaluate(() => document.querySelector('.ytr-retry-btn').click());
      await until(() => overlayText(page).then((t) => t.includes('TR:React lets you build')), 15000, 'Retry sonrası çeviri');
      passed++;
      await ctx.close();
    }

    // ---- Senaryo E: eklenti yenilenince yetim sayfa "sayfayı yenile" uyarısı verir ----
    {
      const { ctx, sw } = await launch(path.join(tmp, 'e'));
      const c = { google: 0, gemini: 0, geminiBodies: [], googleMode: 'ok' };
      await routes(ctx, c);
      await sw.evaluate(() => chrome.storage.sync.set({ target: 'tr', enabled: true, engine: 'auto' }));
      const page = await ctx.newPage();
      await page.goto('https://www.youtube.com/watch?v=vid12345678');
      await until(() => overlayText(page).then((t) => t.includes('TR:React lets you build')), 15000, 'ilk çeviri');
      await until(() => page.evaluate(() => !!document.querySelector('.ytr-panel')), 8000, 'panel oluşmalı');
      await sw.evaluate(() => chrome.runtime.reload()).catch(() => {});
      await wait(2500);
      // Sayfa yenilenmeden yeni bir altyazı isteği: yetim betik çeviri göndermeyi dener
      await page.evaluate(() => fetch('/api/timedtext?v=other1234567&lang=en&fmt=json3').then((r) => r.text()));
      await until(() => page.evaluate(() => /Reload this page|sayfayı yenile/i.test(document.querySelector('.ytr-panel').innerText + document.querySelector('.ytr-panel').textContent)), 25000, 'yetim uyarısı');
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await wait(3500);
      assert.ok(errs.length <= 1, 'yetim betik saniyede bir hata fırlatmamalı: ' + errs.length + ' hata');
      passed++;
      await ctx.close();
    }

    console.log(`${passed}/${total} uçtan uca test geçti`);
    if (passed !== total) process.exitCode = 1;
  } catch (e) {
    console.error('BAŞARISIZ:', e.message);
    process.exitCode = 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
