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
- Redesigned player button: Left-click opens settings panel; right-click or Shift+click quickly toggles translation on/off with toast notification.
- YouTube gear-style settings menu with sub-pages: Language, Translation engine, Transcript, Appearance, and Advanced.
- Direct engine selection (Auto, Google Translate, Gemini, Groq) with clear error reporting (no silent fallback when a specific engine fails).
- Real-time API key validation in the popup with status badges (Valid, Invalid, Quota exceeded, Network error).
- Built-in Transcript viewer: search captions, click-to-seek, copy, and download `.srt` / `.txt` with zero additional network requests.
- Appearance customizations: font size slider (60%–200%), background opacity (0%–100%), color presets, and original subtitle positioning.
