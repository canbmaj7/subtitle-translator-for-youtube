# Firefox Add-ons (AMO) — Submission Guide

**Status (2026-11-11):** v0.5.1 approved and live on [Firefox Add-ons (AMO)](https://addons.mozilla.org/addon/subtitle-translator-youtube/).

- Account: https://addons.mozilla.org/developers/ (free, requires a Firefox account)
- Package: `node scripts/build-firefox.cjs` → `dist/subtitle-translator-<version>-firefox.zip` (Firefox 140+)

## Submission / Update Steps
1. Developer Hub → Select the add-on (or "Submit a New Add-on" → **On this site** for new submission) → "Upload New Version" → upload `dist/subtitle-translator-0.6.0-firefox.zip`. Automated validation must pass without errors.
2. "Do you need to submit source code?" → **No** (the code is plain, unbundled, unminified JavaScript; package matches the open-source repository directly).
3. Name, summary (≤250 characters), detailed description: Copy from `docs/store/listing.md`.
4. Category: Language Support (alternative: Photos, Music & Videos). Tags: `youtube, subtitles, translate`.
5. Privacy policy: https://github.com/canbmaj7/subtitle-translator-for-youtube/blob/main/PRIVACY.md
6. License: MIT. Support site: https://github.com/canbmaj7/subtitle-translator-for-youtube
7. Notes for reviewers: Paste the testing instructions from `docs/store/edge.md` ("Notes for certification").
8. Screenshots: `docs/store/assets/edge-*.png`.

## Notes
- Extension ID: `subtitle-translator@canbmaj7.github.io` (defined in the Firefox manifest; cannot be changed).

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
