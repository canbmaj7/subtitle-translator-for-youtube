# Subtitle Translator for YouTube (YouTube için Altyazı Çevirmeni)

YouTube'da otomatik çeviri seçeneği olmayan videolarda orijinal altyazıyı seçtiğiniz dile çevirip videonun üstünde gösteren Chrome (MV3) eklentisi.

## Kurulum (geliştirici)
1. `chrome://extensions` → Geliştirici modu → **Paketlenmemiş öğe yükle** → `extension/` klasörü.
2. Kod değişince aynı sayfada eklentiyi yenileyin, YouTube sekmesini de yenileyin.
3. İsteğe bağlı: eklenti penceresine ücretsiz **Gemini** (aistudio.google.com/apikey) ve/veya **Groq** anahtarı girin. Anahtar yoksa Google çeviri kullanılır.

## Nasıl çalışır
- `inject.js` (MAIN world): oynatıcının kendi `/api/timedtext` yanıtını yakalar (YouTube artık `pot` belirteci istiyor, adresi yeniden çekmek boş döner) ve gerekirse altyazıyı açtırır.
- `sentences.js`: json3 olaylarını kelime akışına çevirir, noktalama/duraklama/uzunluğa göre cümlelere birleştirir, ekran parçalarına böler.
- `background.js`: çeviri motorları, sıra Gemini → Groq → Google (otomatik yedekleme). Anahtarları yalnızca burası okur.
- `content.js` + `ui.js`: katmanı çizer, oynatıcıya düğme ve ayar paneli ekler.
- `languages.js`: hedef diller, RTL/CJK yardımcıları, i18n sarmalayıcısı. Metinler `_locales/en|tr`.

## Test
```
node tests/engine.test.cjs      # motor yedekleme mantığı (sahte ağ)
node tests/sentences.test.cjs   # cümle birleştirme, hizalama, diller
```
Tarayıcı testleri Playwright'ın Chromium'u ile `--load-extension` bayrağıyla yapılır (resmi Chrome 137+ bu bayrağı yok sayar).

## Yapılacaklar
- Firefox/Edge uyumu, mağaza hazırlığı (gizlilik politikası, ekran görüntüleri).
- Konuşma tanıma (altyazısı olmayan videolar).

## Kurulum / Install

**Chrome, Edge, Brave (geliştirici modu):** [Releases](https://github.com/canbmaj7/subtitle-translator-for-youtube/releases) sayfasından `subtitle-translator-*.zip` dosyasını indirip bir klasöre çıkarın. `chrome://extensions` → "Developer mode" → "Load unpacked" ile klasörü seçin.

**Firefox:** `*-firefox.zip` paketi Mozilla tarafından imzalanana kadar yalnızca geçici yüklenebilir: `about:debugging` → "This Firefox" → "Load Temporary Add-on" → zip içindeki `manifest.json`. (Firefox 140+; Firefox üzerinde henüz test edilmedi.)

**Paket üretmek:** `bash scripts/package.sh` (Chrome/Edge), `node scripts/build-firefox.cjs` (Firefox). Çıktılar `dist/` altına gider.

Gizlilik: [PRIVACY.md](PRIVACY.md) · Lisans: MIT
