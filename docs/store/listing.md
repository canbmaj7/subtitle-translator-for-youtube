# Mağaza kaydı (Chrome Web Store / Edge Add-ons)

## Ad
- en: Subtitle Translator for YouTube
- tr: YouTube için Altyazı Çevirmeni

## Kısa açıklama (≤132)
(manifest `extDescription` ile aynı)

## Ayrıntılı açıklama (en)
Watch any YouTube video in your own language, even when YouTube's auto-translate doesn't offer it.

• Translates YouTube's original or auto-generated captions into 30+ languages
• Merges caption fragments into whole sentences first, so translations keep their context
• Control it right from the player: a button next to CC opens a panel to switch on/off, change language, font size and show the original line
• Works out of the box with Google Translate; add your own free Gemini or Groq key for higher quality
• Shows translation progress, retries failures automatically, optional "wait for translation" mode
• No account, no tracking, no server: your settings and keys stay in your browser

## Single purpose
Translate the captions of the YouTube video being watched into the user's chosen language and display them over the player.

## İzin gerekçeleri
- storage: ayarları ve kullanıcının girdiği API anahtarlarını saklar.
- host youtube.com (content script): altyazı metnini okur, çeviriyi oynatıcının üstüne çizer, oynatıcı düğmesini ekler.
- host translate.googleapis.com / generativelanguage.googleapis.com / api.groq.com: altyazı metnini çeviri için gönderir.
- Uzaktan kod yok: tüm kod pakette.

## Veri kullanımı beyanı (Privacy practices sekmesi)
- Toplanan veri: "Website content" (altyazı metni) — yalnızca çeviri için üçüncü taraf çeviri servisine gönderilir. "Authentication information" (kullanıcının kendi API anahtarı) — yalnızca cihazda.
- Onay kutuları: satmıyorum; amaç dışı kullanmıyorum; kredi/borç için kullanmıyorum.
- Gizlilik politikası URL'si: PRIVACY.md'nin barındırılmış hâli (GitHub Pages vb.) gerekli.

## Görseller (hazırlanacak)
- Ekran görüntüleri 1280×800 (en az 1, en çok 5)
- Küçük tanıtım kutusu 440×280; büyük 1400×560 (isteğe bağlı)
