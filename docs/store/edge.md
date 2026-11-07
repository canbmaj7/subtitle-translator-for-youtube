# Microsoft Edge Add-ons — gönderim rehberi

Hesap: https://partner.microsoft.com/dashboard/microsoftedge (ücretsiz, Microsoft hesabıyla "Edge programına" kayıt)
Paket: `bash scripts/package.sh` → `dist/subtitle-translator-<sürüm>.zip` (Chrome ile aynı paket; Edge manifest'i olduğu gibi kabul eder)

## Adımlar
1. Partner Center → Edge → "Create new extension" → zip'i yükle.
2. **Availability:** Public, tüm pazarlar. **Category:** Productivity (alternatif: Entertainment).
3. **Properties:** Gizlilik politikası URL'si:
   https://github.com/canbmaj7/subtitle-translator-for-youtube/blob/main/PRIVACY.md
   Bu eklenti uzak kod çalıştırmıyor; kişisel veri toplamıyor (altyazı metni yalnızca çeviri için gönderilir).
4. **Store listings → English (en-US)** (ve istersen Türkçe): açıklamayı `docs/store/listing.md` içindeki ayrıntılı açıklamadan al.
   - Logo: `docs/store/assets/edge-logo-300.png` (300×300)
   - Ekran görüntüleri (1280×800): `edge-1-subtitles.png`, `edge-2-panel.png`, `edge-3-german.png`, `edge-4-popup.png`
   - Küçük tanıtım kutusu (440×280): `edge-promo-440x280.png`
   - Arama terimleri (en fazla 7): youtube, subtitles, captions, translate, translator, multilingual, gemini
   - Destek / web sitesi: https://github.com/canbmaj7/subtitle-translator-for-youtube
5. **Notes for certification** (aşağıdaki metni yapıştır).

## Notes for certification
The extension translates the captions of the YouTube video being watched. It reads caption text on youtube.com and sends it to translate.googleapis.com by default, or to generativelanguage.googleapis.com / api.groq.com only if the user enters their own API key in the popup. No account is needed. To test: open any YouTube video with English captions (e.g. https://www.youtube.com/watch?v=x7X9w_GIm1s), click the extension's button next to the CC button in the player, choose a target language (e.g. Turkish). The translated caption appears over the video. The extension stores settings in chrome.storage.sync and API keys in chrome.storage.local; it has no server and no analytics. Source: https://github.com/canbmaj7/subtitle-translator-for-youtube
