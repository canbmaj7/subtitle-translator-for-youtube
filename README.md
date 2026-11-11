# Subtitle Translator for YouTube
*(YouTube için Altyazı Çevirmeni)*

Translates YouTube captions into your preferred language and overlays them seamlessly on the video player, even when YouTube's built-in auto-translate option is unavailable. Built for Chrome, Microsoft Edge, and Firefox (Manifest V3).

## Features

### Player Controls & Settings Panel
- **Player button:** A dedicated translation button (`TR`) sits directly next to the `CC` button in the YouTube control bar.
  - **Left click:** Opens the settings panel.
  - **Right click or Shift + click:** Toggles translation on/off instantly with an on-screen toast notification.
  - **Keyboard navigation:** Full support for `Esc` (closes menu or goes back), arrow keys, and `Enter`.
- **YouTube gear-style settings panel:** A multi-page floating menu modeled after YouTube's native player settings:
  - **Main menu:** Quick translation toggle, active translation status chip, progress bar with retry button, and links to sub-pages.
  - **Language:** Select from 30+ target languages, toggle showing original subtitles alongside translations, or enable "wait for translation" mode.
  - **Translation engine:** Select your active provider (**Auto**, **Google Translate**, **Google Gemini**, or **Groq**). In Auto mode, the extension automatically prioritizes Gemini -> Groq -> Google. When an engine is explicitly selected, the extension **does not silently fall back** on failure, giving you clear visibility into provider errors (quota, invalid key, or network issue).
  - **Transcript:** View all captions and their translations side-by-side in real time.
    - Instant text search across original and translated text.
    - Click any sentence to jump the video to that timestamp.
    - One-click copy all text to clipboard.
    - Download full transcript as `.srt` or `.txt` (with timestamps).
    - **Zero extra translation requests:** Uses caption data already loaded in the player.
  - **Appearance:** Real-time subtitle styling customization:
    - Adjustable font size (60% to 200%).
    - Background box opacity (0% to 100%).
    - Text color presets (White, Yellow, Green, Cyan).
    - Original subtitle position (placed above or below translated text).
  - **Advanced:** Quick view of the installed extension version and repository links.

### Translation & AI Engines
- **Works out of the box:** Default Google Translate endpoint requires no API keys or setup.
- **AI-powered translations:** Add your free **Google Gemini** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) or **Groq** ([console.groq.com/keys](https://console.groq.com/keys)) key in the extension popup for higher-quality, natural translations.
- **Automatic key validation:** When you paste an API key into the popup, it is immediately tested against the provider's API. Live status badges indicate `Valid`, `Invalid`, `Quota exceeded`, or `Network error`.

### Performance & Subtitle Engine
- **Sentence merging:** Caption fragments are reconstructed into complete, grammatically sound sentences based on punctuation and pauses before translation, avoiding choppy word-by-word outputs.
- **Resilient translation pipeline:** Batched requests, timeout protection, automatic 3-step retries with exponential backoff, and localized translation around the playback head (−1 min / +10 min) to conserve API quotas on long videos.
- **Smart idle / sleep mode:** Automatically sleeps when YouTube's native auto-translation is active or when the video's captions are already in the target language.
- **Comprehensive language support:** Over 30 target languages, with full Right-to-Left (Arabic, Hebrew, Persian) and CJK (Chinese, Japanese, Korean) layout, typography, and punctuation handling. Default target language matches your browser's UI language.
- **Privacy by design:** No server, no user accounts, no analytics, no tracking. API keys remain strictly local in `chrome.storage.local` ([PRIVACY.md](PRIVACY.md)).

## Installation

### Store Installations (Recommended)

| Store | Status | Link |
|---|---|---|
| **Firefox Add-ons (AMO)** | **Live** (v0.5.1) | [Install from Mozilla Add-ons](https://addons.mozilla.org/addon/subtitle-translator-youtube/) |
| **Microsoft Edge Add-ons** | **Live** (v0.5.1) | [Install from Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ohhflleelfaobkbkajkcbdofhmonokfh) |
| **Chrome Web Store** | Not yet available | Pending registration ($5 fee) |

*Store installations update automatically. Note: v0.6.0 will become available on the stores after the standard store review process.*

### Manual Installation (from GitHub Releases)

Download the latest release (`subtitle-translator-<version>.zip` for Chromium or `subtitle-translator-<version>-firefox.zip` for Firefox) from the [Releases](https://github.com/canbmaj7/subtitle-translator-for-youtube/releases) page.

- **Chrome / Edge / Brave / Opera / Vivaldi:**
  1. Extract the `.zip` file into a folder on your computer.
  2. Navigate to `chrome://extensions` (or `edge://extensions`).
  3. Turn on **Developer mode** (toggle in the top-right corner).
  4. Click **Load unpacked** and select the unzipped directory.

- **Firefox (140+):**
  - For regular daily use, install the official signed package directly from [Firefox Add-ons](https://addons.mozilla.org/addon/subtitle-translator-youtube/).
  - For development and temporary testing: Open `about:debugging` -> click **This Firefox** -> **Load Temporary Add-on...** -> select `subtitle-translator-<version>-firefox.zip`.

*(Manual installations do not update automatically.)*

## How It Works

- `inject.js` (MAIN world): Intercepts the player's internal `/api/timedtext` requests (as YouTube requires a `pot` token, fetching the caption URL externally returns empty) and enables subtitles if required.
- `sentences.js`: Parses `json3` caption events into word streams, merges them into full sentences using punctuation and pause detection, and calculates display segmentation.
- `transcript.js`: Extracts video metadata and handles transcript exporting (.srt and .txt formatting with timestamps).
- `scheduler.js`: Manages the translation queue, prioritizing chunks near the playback head, scheduling retries, and dispatching progress notifications.
- `background.js`: Coordinates translation providers (Google, Gemini, Groq), enforces request timeouts, validates API keys on input, and handles failover logic in auto mode. API keys are accessed solely by this service worker.
- `ui.js`: Renders the player control button (`TR`), toast notifications, handles keyboard shortcuts, and mounts the floating panel.
- `ui-pages.js`: Manages the YouTube gear-style panel architecture, navigation flow, main page, language selector, and engine selector with status badges.
- `ui-appearance.js`: Controls subtitle appearance options (font size range slider, background opacity slider, color presets, original line positioning).
- `ui-transcript.js`: Powers the in-panel transcript viewer with real-time search, click-to-seek, clipboard copy, and download actions.
- `wait.js`: Optional pause-and-wait feature that briefly pauses the video if translation has not completed yet.
- `popup.html`, `popup.js`, `popup.css`: Toolbar popup for entering API keys, automatic key validation, engine preferences, and general settings.
- `languages.js`: Supported language catalog, RTL/CJK directionality rules, and i18n helpers. Localization strings reside in `_locales/en` and `_locales/tr`.

## Development

Run tests and verification scripts:

```bash
node tests/engine.test.cjs      # Translation engines, fallbacks, and timeouts
node tests/sentences.test.cjs   # Sentence merging, alignment, and language heuristics
node tests/transcript.test.cjs  # Transcript parsing, timestamping, SRT/TXT export
node tests/ui.test.cjs          # UI state, badge mapping, appearance clamping, and i18n keys
node scripts/check-store.cjs    # Manifest, icons, permissions, secrets, and store hygiene
bash scripts/package.sh         # Package for Chrome/Edge (dist/subtitle-translator-<version>.zip)
node scripts/build-firefox.cjs  # Package for Firefox (dist/subtitle-translator-<version>-firefox.zip)
```

Browser testing is conducted with Playwright Chromium using the `--load-extension` flag (standard official Chrome 137+ ignores this flag in automated environments). When making code changes, click the refresh icon on `chrome://extensions` and reload the active YouTube tab.

Store submission guides: [`docs/store/`](docs/store/).

## Roadmap

- Translation cache (reduce redundant API calls for previously translated video segments)
- Context-aware translation (supplying video title, channel name, and surrounding sentences to LLM engines)
- End-to-end automated testing and live Firefox testing
- Speech recognition (on-the-fly captioning for videos lacking native subtitles)
- Chrome Web Store release

## License

MIT License · [Privacy Policy](PRIVACY.md)
