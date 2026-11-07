# Firefox Add-ons (AMO) — gönderim rehberi

Hesap: https://addons.mozilla.org/developers/ (ücretsiz, Firefox hesabı)
Paket: `node scripts/build-firefox.cjs` → `dist/subtitle-translator-<sürüm>-firefox.zip` (Firefox 140+)

## Adımlar
1. Developer Hub → "Submit a New Add-on" → **On this site** (listelenmiş) → zip'i yükle. Doğrulama hatasız geçmeli.
2. "Do you need to submit source code?" → **No** (kod derlenmiyor/küçültülmüyor, paket kaynağın aynısı).
3. Ad, özet (≤250 karakter), ayrıntılı açıklama: `docs/store/listing.md` (en).
4. Kategori: Language Support (alternatif: Photos, Music & Videos). Etiketler: youtube, subtitles, translate.
5. Gizlilik politikası: https://github.com/canbmaj7/subtitle-translator-for-youtube/blob/main/PRIVACY.md
6. Lisans: MIT. Destek sitesi: https://github.com/canbmaj7/subtitle-translator-for-youtube
7. İnceleyiciye not: `docs/store/edge.md` içindeki "Notes for certification" metni.
8. Ekran görüntüleri: `docs/store/assets/edge-*.png`.

## Notlar
- Eklenti kimliği: `subtitle-translator@canbmaj7.github.io` (manifest'te; sonradan değiştirilemez).
- Firefox'ta gerçek test yapılmadı; reddedilirse inceleyici notuna göre düzeltilir.
