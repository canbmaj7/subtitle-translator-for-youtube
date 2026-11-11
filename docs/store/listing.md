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
• Control it right from the player: click the TR button next to CC to open settings, or right-click / Shift+click to toggle translations instantly
• YouTube gear-style settings menu with dedicated sub-pages: Language, Translation engine, Transcript, Appearance, and Advanced
• Multi-engine support: Auto, Google Translate, Google Gemini, and Groq. When a specific engine is chosen, there is no silent fallback on failure
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
- `host translate.googleapis.com / generativelanguage.googleapis.com / api.groq.com`: Sends caption text (plus surrounding context sentences and video metadata when using Gemini or Groq) to the selected translation service, and validates user-provided API keys directly.
- No remote code: All executable code is completely self-contained within the package.

## Data Usage Declaration (Privacy Practices Tab)
- Collected data: "Website content" (caption text, plus sanitized video title, channel name, short description excerpt, and nearby sentences when using Gemini or Groq) — sent solely to third-party translation endpoints (Google, Gemini, or Groq) directly from the user's browser to perform translation. Context data is never sent to Google Translate; we operate no remote servers. "Authentication information" (user API keys) — stored exclusively on the user's local device.
- Affirmations: We do not sell user data; we do not use or transfer user data for purposes unrelated to the extension's core functionality; we do not use data for creditworthiness or lending determinations.
- Privacy policy URL: https://github.com/canbmaj7/subtitle-translator-for-youtube/blob/main/PRIVACY.md

## Promotional Assets
- Screenshots (1280×800): minimum 1, up to 5 (`docs/store/assets/edge-*.png`)
- Small promo tile (440×280): `docs/store/assets/edge-promo-440x280.png`; large promo tile (1400×560, optional)

## What Changed in 0.6.0 (Release Notes)
- Context-aware translation: with a Gemini or Groq key, the video title, channel and nearby sentences help the AI pick the right terminology.
- Redesigned player button: Left-click opens the settings panel; right-click or Shift+click toggles translation on/off with an on-screen toast.
- YouTube gear-style settings menu with sub-pages: Language, Translation engine, Transcript, Appearance, and Advanced.
- Translation engine selection (Auto, Google Translate, Gemini, Groq) with clear error reporting (no silent fallback when a specific engine fails).
- Real-time API key validation in the toolbar popup with live status badges.
- Built-in Transcript viewer: real-time search, click-to-seek, clipboard copy, and `.srt` / `.txt` download without extra network requests.
- Appearance customizations: font size slider (60%–200%), background opacity (0%–100%), color presets, and original subtitle position.
