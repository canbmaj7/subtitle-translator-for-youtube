# Microsoft Edge Add-ons — Submission Guide

**Status (2026-11-11):** v0.5.1 is live on [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ohhflleelfaobkbkajkcbdofhmonokfh).

- Account: https://partner.microsoft.com/dashboard/microsoftedge (free registration for the Edge Developer Program using a Microsoft account)
- Package: `bash scripts/package.sh` → `dist/subtitle-translator-<version>.zip` (same package as Chrome; Edge accepts the MV3 manifest directly)

## Submission / Update Steps
1. Partner Center → Edge → Select the extension (or "Create new extension" for new submission) → upload the package `dist/subtitle-translator-0.6.0.zip`.
2. **Availability:** Public, all markets. **Category:** Productivity (alternative: Entertainment).
3. **Properties:** Privacy policy URL:
   https://github.com/canbmaj7/subtitle-translator-for-youtube/blob/main/PRIVACY.md
   The extension executes no remote code and collects no personal data (caption text and optional AI video context are sent solely for translation).
4. **Store listings → English (en-US)** (and optionally Turkish): Copy descriptions from `docs/store/listing.md`.
   - Logo: `docs/store/assets/edge-logo-300.png` (300×300)
   - Screenshots (1280×800): `edge-1-subtitles.png`, `edge-2-panel.png`, `edge-3-german.png`, `edge-4-popup.png`
   - Small promo tile (440×280): `edge-promo-440x280.png`
   - Search keywords (up to 7): `youtube, subtitles, captions, translate, translator, multilingual, gemini`
   - Support / Website: https://github.com/canbmaj7/subtitle-translator-for-youtube
5. **Notes for certification:** Paste the text provided below.

## Notes for certification
The extension translates the captions of the YouTube video being watched. It reads caption text on youtube.com and sends it to translate.googleapis.com by default, or to generativelanguage.googleapis.com / api.groq.com only if the user enters their own API key in the popup (where sanitized video title, channel, description snippet, and nearby sentences are included as translation context). No account is needed.

To test:
1. Open any YouTube video with English captions (e.g. https://www.youtube.com/watch?v=x7X9w_GIm1s).
2. Click the extension's `TR` button next to the `CC` button in the player control bar.
3. Open the "Language" sub-page and choose a target language (e.g. Spanish, German, or Turkish). The translated caption appears over the video.
4. Right-click or Shift+click the `TR` button to quickly toggle translation on/off.
5. In the settings panel, explore the "Appearance" sub-page (font size, opacity, color presets) and the "Transcript" sub-page (search, click-to-seek, copy, and export).

The extension stores preferences in `chrome.storage.sync` and API keys in `chrome.storage.local`; it operates without external servers or analytics. Source: https://github.com/canbmaj7/subtitle-translator-for-youtube

## What changed in 0.6.0 (Release Notes)
- Context-aware translation: with a Gemini or Groq key, the video title, channel and nearby sentences help the AI pick the right terminology.
- Redesigned player button: Left-click opens the settings panel; right-click or Shift+click quickly toggles translation on/off with toast notification.
- YouTube gear-style settings menu with sub-pages: Language, Translation engine, Transcript, Appearance, and Advanced.
- Direct engine selection (Auto, Google Translate, Gemini, Groq) with clear error reporting (no silent fallback when a specific engine fails).
- Real-time API key validation in the popup with status badges (Valid, Invalid, Quota exceeded, Network error).
- Built-in Transcript viewer: search captions, click-to-seek, copy, and download `.srt` / `.txt` with zero additional network requests.
- Appearance customizations: font size slider (60%–200%), background opacity (0%–100%), color presets, and original subtitle positioning.
