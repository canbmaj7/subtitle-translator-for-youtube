# Privacy Policy — Subtitle Translator for YouTube

Last updated: 2026-11-11

Subtitle Translator for YouTube ("the extension") translates the captions of the YouTube video you are watching into a language you choose. This policy explains what data the extension handles.

## What the extension does with data
- **Caption text and context.** When you watch a video that has captions, the extension reads that video's caption text and sends it to a translation service to obtain the translation. When AI translation engines are used, basic video metadata is also read to provide context (see Translation services below). Other page contents such as comments, user accounts, and browsing history are never read or sent.
- **Translation services.** Caption text is sent to your selected translation engine:
  - In **Auto** mode, the extension tries the Google Gemini API (if you entered a Gemini key), then the Groq API (if you entered a Groq key), and falls back to Google Translate's public web endpoint (`translate.googleapis.com`).
  - If you choose a specific engine (**Google Translate**, **Google Gemini**, or **Groq**), text is sent only to that chosen service. In this mode, no silent fallback occurs if the chosen engine encounters an error.
  - **Context-aware translation (AI engines only):** When translating via Google Gemini or Groq using your own API key, the extension sends additional context alongside the caption lines to improve translation quality: the video title (sanitized, <= 200 characters), channel name (sanitized, <= 100 characters), a short description excerpt (sanitized, <= 400 characters), and up to 4 preceding and up to 2 succeeding original sentences surrounding the current subtitle batch. This context is used solely by the AI model to infer domain terminology and correct speech-recognition errors. It is sent directly from your browser to your chosen AI provider; it is never sent to our servers (we do not run any) and is never sent to Google Translate (the keyless Google Translate path receives only caption text).
  Each service processes the text under its own terms and privacy policy. Free-tier API plans may use submitted content to improve their products; use a paid key if that matters to you.
- **Transcript viewer and export.** The in-player transcript tool searches, copies, and exports (`.srt` or `.txt`) captions completely locally inside your browser using caption text already received for the current video. It makes zero additional network or translation requests.
- **Settings.** Your choices (on/off, target language, engine preference, font size, background opacity, text color, original subtitle position, wait-for-translation) are stored with `chrome.storage.sync`, so your browser may sync them across your signed-in profiles.
- **API keys.** Keys you enter are stored only in `chrome.storage.local` on your device. They are never synced, never sent to us or any third party, and are used only to authenticate requests directly to the service they belong to. When a key is pasted or tested in the popup, a lightweight test call is made directly to that provider (`generativelanguage.googleapis.com` or `api.groq.com`) to verify status.

## What we do NOT do
- We do not run any server and receive no data from the extension.
- We do not collect, sell, or share personal information; no analytics, no ads, no tracking.
- We do not use or transfer user data for purposes unrelated to the extension's single purpose (translating captions), and not for creditworthiness or lending decisions.

## Permissions
- `storage` — save your settings and keys.
- Access to `youtube.com` — read captions, read video metadata for AI context, and draw the translated subtitle over the player.
- Access to `translate.googleapis.com`, `generativelanguage.googleapis.com`, `api.groq.com` — send caption text and optional context for translation and validate user-provided API keys.

## Contact
Open an issue at https://github.com/canbmaj7/subtitle-translator-for-youtube/issues
