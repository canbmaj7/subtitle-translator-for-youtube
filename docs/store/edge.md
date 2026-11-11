# Microsoft Edge Add-ons — Submission Guide

**Status (2026-11-11):** v0.6.0 submitted and in review (v0.5.1 still live) on [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ohhflleelfaobkbkajkcbdofhmonokfh).

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
   - Screenshots (1280×800): `edge-1-subtitles.png`, `edge-2-panel.png`, `edge-3-transcript.png`, `edge-4-popup.png`
   - Small promo tile (440×280): `edge-promo-440x280.png`
   - Search keywords (up to 7): `youtube, subtitles, captions, translate, translator, multilingual, gemini`
   - Support / Website: https://github.com/canbmaj7/subtitle-translator-for-youtube
5. **Notes for certification:** Paste the text provided below.

## Notes for certification
The extension translates the captions of the YouTube video being watched. It reads caption text on youtube.com and sends it to translate.googleapis.com by default, or to generativelanguage.googleapis.com / api.groq.com only if the user enters their own API key in the popup, or to a single custom HTTPS endpoint only if the user types one in the popup and explicitly grants access to that address (optional host permission, never requested automatically) (where sanitized video title, channel, description snippet, and nearby sentences are included as translation context). No account is needed.

To test:
1. Open any YouTube video with English captions (e.g. https://www.youtube.com/watch?v=x7X9w_GIm1s).
2. Right-click the extension's button next to the `CC` button in the player control bar (or Shift+click) to open the settings panel.
3. Open the "Language" sub-page and choose a target language (e.g. Spanish, German, or Turkish). The translated caption appears over the video.
4. Left-click the button (or press Alt+Shift+T) to toggle translation on/off.
5. In the settings panel, explore the "Appearance" sub-page (font size, opacity, color presets) and the "Transcript" sub-page (search, click-to-seek, copy, and export).

The extension stores preferences in `chrome.storage.sync` and API keys in `chrome.storage.local`; it operates without external servers or analytics. Source: https://github.com/canbmaj7/subtitle-translator-for-youtube

## What changed in 0.6.0 (Release Notes)
- Context-aware AI translation: with a Gemini, Groq or custom key, a one-time video summary (topic, domain, key terms), the title, channel and nearby sentences help the AI pick the right terminology.
- Glossary: keep terms untranslated or force a specific translation (AI engines).
- New engines: Gemini quality tiers (Fast / Balanced / Best) and a custom OpenAI-compatible endpoint (access granted per address).
- Google Translate path hardened: request queue with rate limiting, smarter handling of line mismatches, automatic cooldown after HTTP 429/5xx.
- Better sentence merging for song lyrics and unpunctuated speech.
- Translation cache: already translated caption chunks are reused from local storage, so reopening a video costs no extra API calls.
- Redesigned player button: left-click toggles translation on/off with an on-screen toast; right-click or Shift+click opens the settings panel. New keyboard shortcut: Alt+Shift+T.
- Remembers the target language per channel.
- Interface now available in 8 languages: English, Turkish, German, Spanish, French, Brazilian Portuguese, Russian and Arabic.
- YouTube gear-style settings menu with sub-pages: Language, Translation engine, Transcript, Appearance, and Advanced.
- Translation engine selection with clear error reporting (no silent fallback when a specific engine fails) and real-time API key validation.
- Built-in Transcript viewer: real-time search, click-to-seek, clipboard copy, and `.srt` / `.txt` download without extra network requests.
- New icon and a redesigned popup.
