// scripts/canary.cjs
// Gerçek YouTube'a karşı sözleşme (contract) denetimi.
// Playwright ile eklentiyi yükler, sabit bir videoyu açar ve YouTube DOM,
// ağ istekleri (/api/timedtext) ve eklenti entegrasyon varsayımlarını doğrular.

const fs = require('fs');
const os = require('os');
const path = require('path');

function findPlaywright() {
  const cands = [
    process.env.PLAYWRIGHT_CORE,
    'playwright-core',
    'playwright',
    path.join(os.homedir(), '.local/lib/node_modules/@playwright/mcp/node_modules/playwright-core'),
  ].filter(Boolean);
  for (const c of cands) {
    try {
      return require(c);
    } catch (_) {}
  }
  return null;
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(os.homedir(), '.cache/ms-playwright');
  if (!fs.existsSync(base)) return null;
  const dirs = fs
    .readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  for (const d of dirs) {
    const p = path.join(base, d, 'chrome-linux64', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function dismissConsent(page) {
  try {
    const rejectSelectors = [
      'button[aria-label*="Reject all" i]',
      'button[aria-label*="Reject the use of cookies" i]',
      'button[aria-label*="Tümünü reddet" i]',
      'ytd-consent-bump-v2-lightbox button',
      'ytd-consent-bump-v3-lightbox button',
      'form[action*="consent"] button',
    ];
    for (const sel of rejectSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible().catch(() => false)) {
        console.log(`[Canary] Consent penceresi algılandı (${sel}), "Reject all" tıklanıyor...`);
        await loc.click().catch(() => {});
        return true;
      }
    }

    const rejectRoleBtn = page.getByRole('button', { name: /reject all|tümünü reddet|reject/i });
    if (await rejectRoleBtn.isVisible().catch(() => false)) {
      console.log('[Canary] Consent düğmesi rol ile algılandı, tıklanıyor...');
      await rejectRoleBtn.click().catch(() => {});
      return true;
    }
  } catch (_) {}
  return false;
}

(async () => {
  console.log('====================================================');
  console.log('YouTube Uyumluluk Sözleşme Denetimi (Canary)');
  console.log('====================================================');

  const pw = findPlaywright();
  const chromePath = findChrome();

  if (!pw || !chromePath) {
    console.error('HATA: Playwright veya Chromium bulunamadı.');
    console.error('Lütfen "npm i --no-save playwright-core" ve "npx playwright-core install --with-deps chromium" çalıştırın.');
    process.exit(1);
  }

  const EXT = path.resolve(__dirname, '../extension');
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'ytr-canary-'));
  const targetVideoUrl = process.env.CANARY_VIDEO_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  let ctx = null;
  const failures = [];
  const ytrLogs = [];
  let timedTextUrl = null;
  let potPresent = false;
  let potValue = null;

  try {
    console.log(`[Canary] Chromium çalıştırılıyor: ${chromePath}`);
    ctx = await pw.chromium.launchPersistentContext(tmpProfile, {
      headless: false,
      executablePath: chromePath,
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXT}`,
        `--load-extension=${EXT}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    let sw = ctx.serviceWorkers()[0];
    if (!sw) {
      sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null);
    }
    if (sw) {
      await sw.evaluate(() => {
        // Sahte anahtar ve güvenli varsayılanlar; gerçek anahtar ya da kullanıcı verisi yok
        chrome.storage.sync.set({ target: 'tr', enabled: true, engine: 'auto' });
        chrome.storage.local.set({ geminiKey: 'AIzaSyFAKE_canary_test_key_000000000000' });
      }).catch(() => {});
    }

    const page = await ctx.newPage();

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[YTR]')) {
        ytrLogs.push(text);
      }
    });

    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('/api/timedtext')) {
        timedTextUrl = u;
        try {
          const parsed = new URL(u);
          if (parsed.searchParams.has('pot')) {
            potPresent = true;
            potValue = parsed.searchParams.get('pot');
          }
        } catch (_) {}
      }
    });

    console.log(`[Canary] YouTube sayfasına gidiliyor: ${targetVideoUrl}`);
    try {
      await page.goto(targetVideoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (netErr) {
      console.error(`[Canary] Ağ hatası: Sayfaya erişilemedi: ${netErr.message}`);
      failures.push(`Ağ erişim hatası: ${netErr.message}`);
    }

    if (failures.length === 0) {
      console.log('[Canary] 20 saniye bekleniyor ve oynatıcı durumu izleniyor...');
      const startTime = Date.now();
      const waitDurationMs = 20000;
      let ccClicked = false;

      while (Date.now() - startTime < waitDurationMs) {
        await dismissConsent(page);

        const elapsed = Date.now() - startTime;
        // timedtext isteği henüz gelmediyse altyazı düğmesini tetikle ve video oynatımını başlat
        if (elapsed > 4000 && !timedTextUrl && !ccClicked) {
          const clicked = await page.evaluate(() => {
            const btn = document.querySelector('.ytp-subtitles-button');
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          }).catch(() => false);
          if (clicked) {
            ccClicked = true;
            console.log('[Canary] Altyazı tetikleyici: .ytp-subtitles-button tıklandı');
          }
        }

        if (elapsed > 2000) {
          await page.evaluate(() => {
            const v = document.querySelector('#movie_player video');
            if (v && v.paused) {
              v.play().catch(() => {});
            }
          }).catch(() => {});
        }

        await sleep(1000);
      }

      console.log('\n--- Varsayım Kontrolleri ---');

      // (a) DOM elemanları kontrolleri
      const domStatus = await page.evaluate(() => {
        return {
          moviePlayer: !!document.querySelector('#movie_player'),
          rightControls: !!document.querySelector('.ytp-right-controls'),
          subtitlesButton: !!document.querySelector('.ytp-subtitles-button'),
          videoElement: !!document.querySelector('#movie_player video'),
        };
      }).catch(() => ({}));

      if (domStatus.moviePlayer) {
        console.log('  ✓ (a) DOM: #movie_player mevcut');
      } else {
        console.log('  ✗ (a) DOM: #movie_player BULUNAMADI');
        failures.push("DOM varsayımı bozuldu: '#movie_player' bulunamadı");
      }

      if (domStatus.rightControls) {
        console.log('  ✓ (a) DOM: .ytp-right-controls mevcut');
      } else {
        console.log('  ✗ (a) DOM: .ytp-right-controls BULUNAMADI');
        failures.push("DOM varsayımı bozuldu: '.ytp-right-controls' bulunamadı");
      }

      if (domStatus.subtitlesButton) {
        console.log('  ✓ (a) DOM: .ytp-subtitles-button mevcut');
      } else {
        console.log('  ✗ (a) DOM: .ytp-subtitles-button BULUNAMADI');
        failures.push("DOM varsayımı bozuldu: '.ytp-subtitles-button' bulunamadı");
      }

      if (domStatus.videoElement) {
        console.log('  ✓ (a) DOM: #movie_player video mevcut');
      } else {
        console.log('  ✗ (a) DOM: #movie_player video BULUNAMADI');
        failures.push("DOM varsayımı bozuldu: '#movie_player video' bulunamadı");
      }

      // (b) Eklentinin düğmesi
      const hasYtrBtn = await page.evaluate(() => !!document.querySelector('.ytr-btn')).catch(() => false);
      if (hasYtrBtn) {
        console.log('  ✓ (b) Eklenti düğmesi: .ytr-btn DOM\'a eklendi');
      } else {
        console.log('  ✗ (b) Eklenti düğmesi: .ytr-btn BULUNAMADI');
        failures.push("Eklenti arayüz varsayımı bozuldu: '.ytr-btn' DOM'a eklenmedi");
      }

      // (c) /api/timedtext isteği ve parametreleri
      if (timedTextUrl) {
        console.log('  ✓ (c) Ağ: /api/timedtext isteği gözlendi');
        try {
          const parsed = new URL(timedTextUrl);
          const v = parsed.searchParams.get('v');
          const lang = parsed.searchParams.get('lang');

          if (v) {
            console.log(`  ✓ (c) Ağ: URL 'v' parametresi mevcut (${v})`);
          } else {
            console.log('  ✗ (c) Ağ: URL \'v\' parametresi EKSİK');
            failures.push("/api/timedtext URL sözleşmesi bozuldu: 'v' parametresi yok");
          }

          if (lang) {
            console.log(`  ✓ (c) Ağ: URL 'lang' parametresi mevcut (${lang})`);
          } else {
            console.log('  ✗ (c) Ağ: URL \'lang\' parametresi EKSİK');
            failures.push("/api/timedtext URL sözleşmesi bozuldu: 'lang' parametresi yok");
          }

          if (potPresent) {
            console.log(`  ℹ (c) Bilgi: 'pot' parametresi mevcut (${potValue ? potValue.slice(0, 16) + '...' : 'var'})`);
          } else {
            console.log('  ℹ (c) Bilgi: \'pot\' parametresi bu istekte bulunamadı');
          }
        } catch (e) {
          console.log(`  ✗ (c) Ağ: timedtext URL çözümlenemedi: ${e.message}`);
          failures.push(`/api/timedtext URL çözümlenemedi: ${e.message}`);
        }
      } else {
        console.log('  ✗ (c) Ağ: /api/timedtext isteği GÖZLENMEDİ');
        failures.push("Ağ sözleşmesi bozuldu: '/api/timedtext' isteği gözlenmedi");
      }

      // (d) Eklenti konsol günlüğü
      const hasSentenceLog = ytrLogs.some((l) => /cümle/i.test(l));
      const hasEmptyLog = ytrLogs.some((l) => /altyazı boş döndü/i.test(l));

      if (hasSentenceLog || hasEmptyLog) {
        const matched = ytrLogs.find((l) => /cümle|altyazı boş döndü/i.test(l));
        console.log(`  ✓ (d) Konsol: [YTR] günlüğü doğrulandı ("${matched}")`);
      } else {
        console.log('  ✗ (d) Konsol: [YTR] cümle sayısı veya \'altyazı boş döndü\' günlüğü GÖRÜLMEDİ');
        if (ytrLogs.length > 0) {
          console.log('    Yakalanan [YTR] günlükleri:\n      ' + ytrLogs.join('\n      '));
        } else {
          console.log('    Hiçbir [YTR] günlüğü yakalanmadı.');
        }
        failures.push("Konsol sözleşmesi bozuldu: [YTR] 'cümle' veya 'altyazı boş döndü' günlüğü görülmedi");
      }
    }
  } catch (err) {
    console.error(`[Canary] Beklenmeyen hata: ${err.message}`);
    failures.push(`Beklenmeyen hata: ${err.message}`);
  } finally {
    if (ctx) {
      await ctx.close().catch(() => {});
    }
    fs.rmSync(tmpProfile, { recursive: true, force: true });
  }

  console.log('\n====================================================');
  if (failures.length === 0) {
    console.log('SONUÇ: BAŞARILI - YouTube uyumluluk sözleşmesi geçerli.');
    console.log('====================================================');
    process.exit(0);
  } else {
    console.log('SONUÇ: BAŞARISIZ - Aşağıdaki varsayımlar bozuldu:');
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
    console.log('====================================================');
    process.exit(1);
  }
})();
