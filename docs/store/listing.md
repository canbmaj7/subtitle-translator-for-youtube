# Store Listing (Chrome Web Store / Edge Add-ons / Firefox AMO)

**Status (2026-11-11):** Edge 0.5.1 live, Firefox 0.5.1 approved.

## Name
- en: Subtitle Translator for YouTube
- tr: YouTube için Altyazı Çevirmeni *(Turkish store text)*

## Summary / Short Description (≤132 characters)
- en: Translates YouTube subtitles into your chosen language and overlays them seamlessly on videos.
- tr: YouTube altyazılarını seçtiğiniz dile çevirir ve video üzerinde kusursuz bir şekilde gösterir. *(Turkish store text)*

## Detailed Description (en)
Watch any YouTube video in your own language, even when YouTube's auto-translate doesn't offer it.

• Translates YouTube's original or auto-generated captions into 30+ languages
• Merges caption fragments into whole sentences first, keeping natural phrasing and context
• Control it right from the player: left-click the button next to CC to toggle translation (or press Alt+Shift+T), right-click / Shift+click to open settings
• YouTube gear-style settings menu with dedicated sub-pages: Language, Translation engine, Transcript, Appearance, and Advanced
• Multi-engine support: Auto, Google Translate, Google Gemini (Fast / Balanced / Best), Groq, and any OpenAI-compatible endpoint you provide. When a specific engine is chosen, there is no silent fallback on failure
• AI-aware translation: with a Gemini, Groq or custom key, the AI first summarizes the video (topic, domain, key terms) and uses it, plus your own glossary, to keep terminology consistent
• Remembers the language you choose per channel
• Interface available in English, Turkish, German, Spanish, French, Brazilian Portuguese, Russian and Arabic
• Automatic API key validation in the popup with live status badges (Valid, Invalid, Quota exceeded, Network error)
• Built-in Transcript viewer: search captions, click to seek video playback, copy to clipboard, or download as .srt / .txt with zero extra network requests
• Fully customizable appearance: font size slider (60%–200%), background opacity (0%–100%), text color presets (white, yellow, green, cyan), and original line position
• Resilient translation pipeline: automatic retries, playback head prioritization, and optional "wait for translation" mode
• Zero accounts, zero tracking, no remote server: your settings and API keys stay securely in your browser

## Single Purpose
Translate the captions of the YouTube video being watched into the user's chosen language and display them over the player.

## Permission Justifications
- `storage`: Saves user preferences (sync) and user-entered API keys (local).
- `host youtube.com` (content script): Reads caption text and video metadata (title, channel, short description for AI context) from the video player, renders translated subtitles over the video, and mounts player controls.
- `optional host https://*/*` (optional, requested at runtime): Only requested when the user enters a custom OpenAI-compatible endpoint, and only for that single address, so caption text can be sent to the server the user chose. Never requested automatically.
- `host translate.googleapis.com / generativelanguage.googleapis.com / api.groq.com`: Sends caption text (plus surrounding context sentences and video metadata when using Gemini or Groq) to the selected translation service, and validates user-provided API keys directly.
- No remote code: All executable code is completely self-contained within the package.

## Data Usage Declaration (Privacy Practices Tab)
- Collected data: "Website content" (caption text, plus sanitized video title, channel name, short description excerpt, and nearby sentences when using Gemini or Groq) — sent solely to the translation endpoint the user selected (Google, Gemini, Groq, or the custom endpoint the user entered) directly from the user's browser to perform translation. Context data is never sent to Google Translate; we operate no remote servers. "Authentication information" (user API keys) — stored exclusively on the user's local device.
- Affirmations: We do not sell user data; we do not use or transfer user data for purposes unrelated to the extension's core functionality; we do not use data for creditworthiness or lending determinations.
- Privacy policy URL: https://github.com/canbmaj7/subtitle-translator-for-youtube/blob/main/PRIVACY.md

## Promotional Assets
- Screenshots (1280×800): minimum 1, up to 5 (`docs/store/assets/edge-*.png`)
- Small promo tile (440×280): `docs/store/assets/edge-promo-440x280.png`; large promo tile (1400×560, optional)

## What Changed in 0.6.0 (Release Notes)
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
