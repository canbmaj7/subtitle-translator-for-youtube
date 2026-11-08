# Subtitle Translator for YouTube
*(YouTube için Altyazı Çevirmeni)*

Translates YouTube captions into your language and shows them over the video, even when YouTube's own auto-translate doesn't offer it. Chrome, Edge and Firefox (MV3).

YouTube'da otomatik çeviri seçeneği olmayan videolarda orijinal altyazıyı seçtiğiniz dile çevirip videonun üstünde gösterir.

## Özellikler / Features
- 30+ hedef dil, RTL (Arapça, İbranice…) ve CJK desteği; varsayılan hedef tarayıcı dilinden gelir.
- Altyazı parçalarını önce **tam cümlelere** birleştirir, çeviri bağlamı korur.
- Oynatıcıda CC'nin yanındaki düğme: tıklayınca panel açılır (aç/kapa, dil, yazı boyutu, orijinal satırı göster, çeviri gelene kadar bekle). Shift+tık hızlı aç/kapa, Esc paneli kapatır.
- Motorlar: **Gemini → Groq → Google** (otomatik yedekleme). Anahtarsız Google çalışır; ücretsiz Gemini/Groq anahtarıyla daha doğal çeviri.
- Dayanıklı çeviri hattı: istek zaman aşımları, 3 yeniden deneme, ilerleme göstergesi, "Yeniden dene" düğmesi; yalnızca oynatma konumunun çevresi (−1 dk / +10 dk) çevrilir, uzun videoda kota yanmaz.
- İsteğe bağlı bekleme modu: çeviri gelmediyse video kısa süre duraklar.
- Hesap, izleme, sunucu yok; ayarlar ve anahtarlar tarayıcıda kalır ([PRIVACY.md](PRIVACY.md)).

## Kurulum / Install

### Mağazalar
| Mağaza | Durum (2026-11-08) |
|---|---|
| Microsoft Edge Add-ons | 0.5.1 incelemede |
| Firefox Add-ons (AMO) | 0.5.1 incelemede |
| Chrome Web Store | henüz yok (5 USD kayıt ücreti) |

Yayınlanınca mağazadan kurulanlar otomatik güncellenir.

### GitHub sürümünden (şimdilik)
[Releases](https://github.com/canbmaj7/subtitle-translator-for-youtube/releases) sayfasından en son `subtitle-translator-<sürüm>.zip` (Chrome/Edge/Brave) veya `...-firefox.zip` dosyasını indirin.
- **Chrome / Edge / Brave:** zip'i bir klasöre çıkarın → `chrome://extensions` (Edge: `edge://extensions`) → Geliştirici modu → **Paketlenmemiş öğe yükle** → klasörü seçin.
- **Firefox (140+):** imzalı paket mağazadan gelene kadar geçici yükleme: `about:debugging` → This Firefox → Load Temporary Add-on → zip. Firefox'ta henüz gerçek test yapılmadı.

Elle kurulumlar otomatik güncellenmez.

İsteğe bağlı: eklenti penceresinden ücretsiz **Gemini** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) ve/veya **Groq** anahtarı girin.

## Nasıl çalışır
- `inject.js` (MAIN world): oynatıcının kendi `/api/timedtext` yanıtını yakalar (YouTube artık `pot` belirteci istiyor, adresi yeniden çekmek boş döner) ve gerekirse altyazıyı açtırır.
- `sentences.js`: json3 olaylarını kelime akışına çevirir, noktalama/duraklama/uzunluğa göre cümlelere birleştirir, ekran parçalarına böler.
- `scheduler.js`: çeviri parçalarını sıraya alır (oynatma konumuna en yakın önce), yeniden deneme ve ilerleme bildirimi.
- `background.js`: çeviri motorları, zaman aşımı ve yedekleme. Anahtarları yalnızca burası okur.
- `content.js` + `ui.js` + `wait.js`: katmanı çizer, oynatıcı düğmesi/paneli, bekleme modu.
- `languages.js`: hedef diller, RTL/CJK yardımcıları, i18n sarmalayıcısı. Metinler `_locales/en|tr`.

## Geliştirme
```
node tests/engine.test.cjs      # motor yedekleme ve zaman aşımı (sahte ağ)
node tests/sentences.test.cjs   # cümle birleştirme, hizalama, diller
node scripts/check-store.cjs    # manifest/ikon/izin/anahtar denetimi
bash scripts/package.sh         # dist/subtitle-translator-<sürüm>.zip (Chrome/Edge)
node scripts/build-firefox.cjs  # dist/subtitle-translator-<sürüm>-firefox.zip
```
Tarayıcı testleri Playwright'ın Chromium'u ile `--load-extension` bayrağıyla yapılır (resmi Chrome 137+ bu bayrağı yok sayar). Kod değişince eklentiyi `chrome://extensions` sayfasında yenileyin, YouTube sekmesini de yenileyin.

Mağaza gönderim rehberleri: [`docs/store/`](docs/store/).

## Yapılacaklar
- Firefox'ta gerçek test, Chrome Web Store.
- Konuşma tanıma (altyazısı olmayan videolar).

Lisans: MIT · [Gizlilik](PRIVACY.md)
