# Privacy Policy — Subtitle Translator for YouTube

Last updated: 2026-11-08

Subtitle Translator for YouTube ("the extension") translates the captions of the YouTube video you are watching into a language you choose. This policy explains what data the extension handles.

## What the extension does with data
- **Caption text.** When you watch a video that has captions, the extension reads that video's caption text and sends it to a translation service to obtain the translation. Nothing else from the page (no browsing history, no account info, no video titles or comments) is read or sent.
- **Translation services.** Caption text is sent, in this order of preference, to: Google Gemini API (only if you entered your own key), Groq API (only if you entered your own key), otherwise Google Translate's public web endpoint (`translate.googleapis.com`). Each service processes the text under its own terms and privacy policy. Free-tier API plans may use submitted content to improve their products; use a paid key if that matters to you.
- **Settings.** Your choices (on/off, target language, font size, show-original, wait-for-translation) are stored with `chrome.storage.sync`, so Chrome may sync them across your signed-in browsers.
- **API keys.** Keys you enter are stored only in `chrome.storage.local` on your device. They are never synced, never sent to us, and are used only to authenticate requests to the service they belong to.

## What we do NOT do
- We do not run any server and receive no data from the extension.
- We do not collect, sell, or share personal information; no analytics, no ads, no tracking.
- We do not use or transfer user data for purposes unrelated to the extension's single purpose (translating captions), and not for creditworthiness or lending decisions.

## Permissions
- `storage` — save your settings and keys.
- Access to `youtube.com` — read captions and draw the translated subtitle over the player.
- Access to `translate.googleapis.com`, `generativelanguage.googleapis.com`, `api.groq.com` — send caption text for translation.

## Contact
Open an issue at https://github.com/canbmaj7/subtitle-translator-for-youtube/issues
