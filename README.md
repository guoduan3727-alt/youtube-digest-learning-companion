# YouTube Digest

[English](README.md) | [简体中文](README.zh-CN.md)

> [!IMPORTANT]
> **Project lineage:** This enhanced edition is built directly on [Zara Zhang's YouTube Digest project (@zarazhangrui)](https://github.com/zarazhangrui/youtube-digest). It extends that codebase; it is not an unrelated reimplementation. Zara Zhang is the original creator, the upstream Git history and MIT copyright are retained, and this independently maintained edition does not imply upstream endorsement. See [NOTICE](NOTICE.md) and [Contributors](CONTRIBUTORS.md).

Turn every YouTube video into a resource for deep learning. YouTube Digest brings transcripts, bilingual translation, AI overviews, explanations, and timestamped notes into one Chrome side panel, so you can study ideas and language without losing your place.

- Turn captions into a readable, searchable learning resource.
- Learn languages with the original transcript, a Simplified Chinese translation, or an aligned bilingual view.
- Put the original line and Chinese translation at the bottom of the video for movie-style bilingual viewing.
- Build understanding with an AI overview, chapters, key quotes, and selected-text explanations.
- Navigate long videos by clicking timestamps in the transcript, overview, or notes.
- Save polished timestamped notes for later study.
- Keep control of your data with your own API keys, local Chrome storage, and no analytics or telemetry.

YouTube Digest is a bring-your-own-key project installed locally from GitHub. It is not available through the Chrome Web Store, does not include API credits, and does not run a developer-operated server.

This enhanced edition is derived from [Zara Zhang's original YouTube Digest (@zarazhangrui)](https://github.com/zarazhangrui/youtube-digest) and retains the full upstream history and MIT license. It is independently maintained and is not presented as an official upstream release. See [Contributors and attribution](CONTRIBUTORS.md), including the original author and the role of OpenAI Codex.

**Quick links:** [Enhanced features](#new-in-this-enhanced-v130-edition) · [Install](#install-manually) · [API setup](#set-up-your-api-keys) · [Player subtitles](#use-youtube-digest) · [Vocabulary and Obsidian](#build-a-vocabulary-notebook-with-obsidian) · [Audit report](AUDIT.md) · [Privacy](PRIVACY.md)

![YouTube Digest demo](YouTube%20Digest%20demo.png)

## New in this enhanced v1.3.0 edition

| Enhancement | How to use it | Result |
| --- | --- | --- |
| Vocabulary capture | Select a word or phrase in Transcript, then choose **Add word**. | Saves the word, complete source sentence, video, channel, and timestamp. |
| Duplicate-safe collection | Add the same word again in another sentence or video. | Keeps one word entry and appends only distinct contexts. The same timestamp is ignored. |
| Bilingual dictionary | Keep **Generate dictionary details** enabled when saving, or choose **Generate details** later. | Adds pronunciation, multiple senses, English and Chinese definitions, examples, sentence translation, and meaning in context. |
| Obsidian word notes | Set a vault and folder in Settings, then choose **Send to Obsidian** in Words. | Creates or updates one readable Markdown note per normalized word through the official Obsidian URI. |
| Player bilingual subtitles | Choose **播放器双语** above Full Transcript. | Shows original and Chinese lines at the bottom of the player in regular, theater, and full-screen modes. The side panel remains available. |
| Shared translation work | Use player subtitles and Full Transcript together. | Both views reuse the same segmented translations, cache entries, and in-flight requests instead of calling DeepSeek twice for the same cue. |

Every item above is additive. The original transcript, Overview, Notes, search, selection explanation, exports, settings, and navigation remain available. See the [functional audit](AUDIT.md) for the complete preservation matrix and test evidence.

### Upstream v1.2.0 features retained

- Search transcript words or phrases and move through every match.
- Use one Original, Chinese, or bilingual setting across Transcript, Overview, and Notes. New videos stay in Original by default.
- Translate visible Overview and Notes content progressively in small cached batches.
- Explain selected transcript text or save it directly as a timestamped note.
- Keep your transcript position across navigation, with the panel closing automatically outside YouTube video pages.

## Five-minute start

1. [Download this enhanced repository](https://github.com/guoduan3727-alt/youtube-digest-enhanced/archive/refs/heads/main.zip) and extract it to a permanent folder.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
3. Open **Settings** and enter your own Supadata and DeepSeek API keys directly. Do not put keys in a file, chat, screenshot, or GitHub issue.
4. Open a standard YouTube video with captions and click the YouTube Digest extension icon.
5. Use Transcript, Overview, Notes, and Words from the right-side panel. Choose **播放器双语** when you want bilingual lines inside the video player.
6. For Obsidian, enter only the vault name or ID and destination folder in Settings. Then use **Send to Obsidian** on a saved word.

The detailed installation, provider setup, feature behavior, costs, privacy notes, and troubleshooting steps continue below.

## Install with your coding agent

You do not need to understand the code or use the command line. Send this message to your coding agent:

> Download or clone this project into a permanent folder I choose, tell me its exact full path, and use that same folder for Chrome's Load unpacked step. If I need a suggestion during this first installation, offer `~/Documents/youtube-digest` on macOS or Linux, or `%USERPROFILE%\Documents\youtube-digest` on Windows, but do not assume either path. Walk me through installation and setup in simple terms. https://github.com/guoduan3727-alt/youtube-digest-enhanced

Your agent should:

1. Ask where you want to keep the project, download or clone it there, and tell you the exact full path. If you want a suggestion, it can offer `~/Documents/youtube-digest` on macOS or Linux, or `%USERPROFILE%\Documents\youtube-digest` on Windows.
2. Open the official Supadata and DeepSeek pages below and help you create your own accounts.
3. Walk you through selecting the exact project folder you chose in Chrome with **Load unpacked**.
4. Show you where to enter your API keys in the extension's **Settings** page.
5. Open a YouTube video with captions and confirm the transcript and translation work.

Keep this folder in the same place after installation. If you move or delete it, Chrome's unpacked extension stops working until you load the extension again from its new permanent folder.

Never paste an API key into an AI chat, source file, screenshot, or public message. Enter keys yourself, directly in the YouTube Digest Settings page. Your coding agent can point to the correct field without seeing the key.

## Install manually

If you prefer to do it yourself:

1. Open [github.com/guoduan3727-alt/youtube-digest-enhanced](https://github.com/guoduan3727-alt/youtube-digest-enhanced).
2. Choose **Code**, then **Download ZIP**.
3. Choose a permanent folder and unzip the project there. Optional suggestions are `~/Documents/youtube-digest` on macOS or Linux, or `%USERPROFILE%\Documents\youtube-digest` on Windows. You may use a different folder.
4. In Chrome, open `chrome://extensions`.
5. Turn on **Developer mode**.
6. Click **Load unpacked**.
7. Select the exact project folder you chose, which must contain `manifest.json`.
8. Pin YouTube Digest from Chrome's Extensions menu if you want quick access.

Because this is an unpacked extension, it does not update automatically. After downloading an update or changing local files, click **Reload** on the YouTube Digest card at `chrome://extensions`, then refresh open YouTube tabs. Moving or deleting the source folder breaks the unpacked extension until you load it again from the new location.

## Set up your API keys

YouTube Digest needs two keys under your own provider accounts:

1. A **Supadata API key** to retrieve YouTube transcripts.
2. A **DeepSeek API key** for overviews, explanations, translation, and automatic note polishing.

### Get a Supadata API key

1. Open the official [Supadata sign-up page](https://dash.supadata.ai/auth/sign-up).
2. Create an account and complete the short onboarding flow.
3. Supadata generates an API key automatically during onboarding.
4. Open the [Supadata dashboard](https://dash.supadata.ai/) whenever you need to find or manage the key.
5. Copy the key and paste it into **Supadata API key** in YouTube Digest Settings.

See the [official Supadata documentation](https://docs.supadata.ai/) if the dashboard flow changes.

### Get a DeepSeek API key

1. Open the official [DeepSeek API Keys page](https://platform.deepseek.com/api_keys).
2. Sign in or create a DeepSeek Platform account when prompted.
3. Choose **Create new API key**, give it a recognizable name such as `YouTube Digest`, and create it.
4. Copy the key immediately. The full key may only be shown once.
5. Paste it into **DeepSeek API key** in YouTube Digest Settings.
6. If DeepSeek reports insufficient balance, add credit in your DeepSeek Platform account and try again.

See the [official DeepSeek API documentation](https://api-docs.deepseek.com/) for current account and API details.

Open **Settings** from the side panel. You can also open the YouTube Digest **Options** page from its card at `chrome://extensions` or by right-clicking its toolbar icon. Paste keys only into these Settings fields. Never paste a key into an AI chat, repository file, screenshot, or public message.

The published version supports DeepSeek V4 Flash as its only AI provider:

```text
Base URL: https://api.deepseek.com
Model: deepseek-v4-flash
```

YouTube Digest sends every DeepSeek request in non-thinking mode for responsive, predictable interactions. The endpoint and model are fixed in Settings, so the only AI credential you enter is your DeepSeek API key. To use another provider or model, copy the safe customization prompt in Settings and give it to a coding agent for your local copy. Never add an API key to that prompt or chat.

Keys and settings are stored in Chrome's local extension storage on your device. Release builds do not include or use `config.js`.

## Use YouTube Digest

1. Open a standard YouTube watch page with captions.
2. Click the YouTube Digest extension icon to open the side panel.
3. Read the timestamped transcript, or choose **Original**, **中文**, or **双语**.
4. Choose **播放器双语** above the transcript to show the original line and Chinese translation at the bottom of the video. Choose it again to turn the overlay off. This switch does not change the selected right-side transcript mode.
5. Open **Overview** when you want AI-generated chapters and key quotes.
6. Select transcript text when you want an AI explanation.
7. Save a note from the player or a key quote, then revisit it from **Notes**.

The player overlay hides YouTube's native caption layer to avoid duplicate source lines and restores it when switched off. Because the overlay lives inside the player, it follows regular, theater, and full-screen viewing. It translates from the current playback position first and then fills the rest of the video progressively. The player and Full Transcript share the same base subtitle translations, local cache, and in-flight work, so requesting the same cue from both surfaces produces only one DeepSeek call. Player translations cached by v1.1.6 are migrated automatically.

## Build a vocabulary notebook with Obsidian

1. Select a word or short phrase in the transcript and choose **Add word**.
2. Review the captured sentence and timestamp, optionally add a personal meaning, and keep **Generate dictionary details** enabled when you want DeepSeek to build a bilingual entry.
3. Open **Words** to replay the source, copy Markdown, or export the full collection.
4. In YouTube Digest Settings, enter your Obsidian vault name or vault ID and choose a folder such as `YouTube Digest/Vocabulary`.
5. Choose **Send to Obsidian** on a word. Obsidian creates or updates `word.md`, with Properties for learning status, first-added date, updated date, context count, and video count.

The generated note has two sections. **Dictionary** contains the lemma, pronunciation, multiple useful senses, bilingual definitions, and examples for each sense. **Video contexts** lists every collected video sentence with its complete Chinese translation, contextual meaning, optional language note, and timestamped source. Older saved words can be completed later with **Generate details**.

Only one entry is kept for each normalized word. Repeating the same word at the same video timestamp does not create a duplicate. Finding it in another video or at another position appends a context. When dictionary details already exist, DeepSeek analyzes only the new sentence instead of regenerating senses and general examples. Historical duplicate entries are merged automatically when the collection is read, without dropping their video contexts.

This integration uses the official `obsidian://` URI. To keep detailed multi-sense notes reliable and avoid an excessively long URI, **Send to Obsidian** briefly copies the generated Markdown to the clipboard and asks Obsidian to use that clipboard content. It does not require an Obsidian community plugin or another API key. Each normalized word uses one stable note name, such as `serendipity.md`, so sending it again updates the same file. Obsidian Bases or Dataview can filter, group, and count vocabulary by status, date, context count, or video count. Chrome may ask for permission to open Obsidian the first time.

Older Obsidian notes named with the previous “word - date - identifier” pattern are not deleted automatically by the URI. After confirming that the new `word.md` contains every context, archive or remove the older files manually in Obsidian.

## What works today

- Google Chrome 116 or newer, using the Side Panel API.
- Standard `youtube.com/watch` video pages.
- Native subtitle tracks returned by Supadata. YouTube Digest prefers English when available, but may show another native language.
- Original, Simplified Chinese, and aligned bilingual transcript views.
- A separately controlled movie-style bilingual overlay inside the video player, without removing side-panel features.
- AI overviews, selected-text explanations, translation, and automatic note polishing.
- Local notes and a local cache for recent transcript and digest results.
- DeepSeek V4 Flash for all published AI features. Other providers require a local code adaptation and are not supported by this published version.

Shorts, live streams, private or access-restricted videos, and videos without an available native transcript may not work. Firefox, Safari, mobile browsers, and other Chromium browsers are not currently tested or supported.

YouTube Digest forces Supadata's `mode=native`. It does not request AI-generated transcripts or perform local audio transcription when native captions are unavailable.

## Supadata free tier and request costs

Current as of August 9, 2026, the [Supadata pricing page](https://supadata.ai/pricing) lists a free tier with **100 credits per month**, no credit card required. Unused credits do not roll over. Supadata pricing can change, so check the current page before relying on these numbers.

The [Supadata transcript documentation](https://docs.supadata.ai/get-transcript) describes the transcript request modes and credit behavior:

- A native transcript request uses **1 credit**, regardless of video duration.
- A generated transcript costs **2 credits per video minute**. YouTube Digest does not use this path because it forces `mode=native`.
- An unavailable native lookup returned as HTTP `206` still uses **1 credit**.

With the current native-only behavior, the free tier can cover roughly 100 transcript lookups per month when each request succeeds once. Retries and unavailable-caption lookups also consume credits, so actual successful-video coverage can be lower.

DeepSeek usage is separate from Supadata. YouTube Digest does not collect payments or resell access. Set spending limits and monitor both accounts.

## DeepSeek V4 Flash pricing

As of August 27, 2026, DeepSeek lists these USD prices per 1 million tokens on its official [pricing page](https://api-docs.deepseek.com/quick_start/pricing/):

| Token type | Off-peak | Peak |
| --- | ---: | ---: |
| Cache-hit input | $0.007 | $0.014 |
| Cache-miss input | $0.22 | $0.44 |
| Output | $0.66 | $1.32 |

Peak hours are 01:00–04:00 and 06:00–10:00 UTC, Monday through Friday. All other hours use off-peak rates.

A measured 20-minute English talk used about **32,600 input tokens** and an estimated **3,500 to 4,500 output tokens** across 43 small translation batches. At current prices, translating the full video costs approximately:

- **Off-peak: $0.003 to $0.010 USD**.
- **Peak: $0.005 to $0.020 USD**.

The lower end assumes most repeated input hits DeepSeek's cache, while the upper end assumes cache misses. Side-panel translation is lazy and progressive, so only rows you approach by scrolling incur calls. Enabling **播放器双语** progressively translates the complete video from the current playback position so viewing can continue without gaps. Both surfaces share one base-cue cache and any translation already in flight, so enabling them together does not duplicate a request for the same cue. Retries, provider behavior, and pricing changes can still increase the final cost, so check the official page before relying on these prices.

## Remix it with your coding agent

This is a personal remix project. Upstream issues and pull requests are not accepted. If something breaks or you want a new feature, download or fork your own copy and ask your coding agent to fix, remix, or personalize it for you.

YouTube Digest uses plain HTML, CSS, and JavaScript with no build step, so it is a friendly starting point for agent-assisted projects. Ideas to try:

- Add more translation languages and let each person choose a learning language.
- Create customized summary templates for lectures, interviews, tutorials, reviews, or research talks.
- Build a vocabulary notebook that saves a word, its sentence, meaning, and video timestamp.
- Export notes and vocabulary to Markdown, CSV, Anki, or another study tool.
- Add personal topic filters that highlight the chapters most relevant to a goal.
- Add optional local-model support for a different privacy and cost tradeoff.
- Improve accessibility with keyboard navigation, font controls, and higher-contrast themes.

Ask your agent to preserve the bring-your-own-key model, keep secrets out of source files, run the checks below, and test the remix on real videos.

If you want another AI provider or model, first open the exact YouTube Digest project folder that Chrome loaded through **Load unpacked** in your coding agent. Then open YouTube Digest Settings and use **Copy customization prompt**. Replace the `[PROVIDER]` and `[MODEL]` placeholders before sending it. Do not include any API key in the prompt or chat. After the agent updates your local copy, enter the key yourself in the Settings field it identifies.

## Privacy and data flow

YouTube Digest makes provider requests directly from the extension:

1. It sends a canonical YouTube watch URL to Supadata to request the native transcript.
2. It sends the transcript and relevant video metadata to DeepSeek when you request AI features.
3. Focused features send only the content they need, such as selected text with context or small transcript batches for translation.
4. The first vocabulary generation sends the selected word, its sentence context, and the video title to DeepSeek to create bilingual dictionary senses, examples, and sentence analysis. When that word already has a dictionary, only the new sentence and video title are sent for contextual analysis.
5. It stores keys, settings, notes, and recent cache entries locally in Chrome.
6. It stores vocabulary locally in Chrome. A word is sent to Obsidian only when you choose **Send to Obsidian**, using an `obsidian://` URI generated on the device.

There is no YouTube Digest account system, advertising, analytics, or telemetry. Supadata and DeepSeek still receive data under their own terms and privacy policies. See [PRIVACY.md](PRIVACY.md) for details.

## Troubleshooting

### The Digest button is missing on a YouTube video

- At `chrome://extensions`, find YouTube Digest and click **Reload**, then refresh the YouTube tab.
- Confirm that you are on a standard `https://www.youtube.com/watch?...` page, not a Short, embed, or live page.
- The current version automatically follows YouTube when its responsive action bar changes. Wait a moment after the page finishes loading.
- If you have an older downloaded copy, resizing the YouTube window horizontally once may reveal the button. Then download the latest version so resizing is no longer required.
- If it is still missing, ask your coding agent to inspect the content script on that exact video page.

### The side panel does not open

- Confirm that you are on a standard `https://www.youtube.com/watch?...` page.
- At `chrome://extensions`, confirm YouTube Digest is enabled and click **Reload**.
- Refresh the YouTube tab after reloading the extension.
- Ask your coding agent to inspect the extension if the problem continues.

### YouTube Digest asks for setup

- Open **Settings** and save both a Supadata key and a DeepSeek key.
- This published version uses the fixed DeepSeek V4 Flash endpoint and model. There are no Base URL or Model fields to configure.
- If Settings says a legacy custom provider was removed, enter a DeepSeek key. The old AI key was cleared so it could not be reused with the wrong service.

### No transcript is found

- Confirm the video is public and has native captions.
- Check your Supadata key, remaining credits, rate limit, and account status.
- Remember that unavailable native lookups and manual retries may still consume credits.

YouTube Digest will not fall back to generated transcription.

### AI requests fail

- A `401` or `403` usually means the DeepSeek key or account access is invalid.
- A `429` usually means a DeepSeek rate or spending limit was reached.
- Confirm the key was created in the DeepSeek Platform account linked above and that the account has available credit.
- If you adapted a local copy for another model, use the Settings customization prompt again and ask your coding agent to inspect that local implementation.

Never share API keys, private transcripts, or personal notes in chats, screenshots, or logs.

## Checks for coding agents

Ask your coding agent to run these commands after changing the project:

```bash
npm test
npm run check
npm run package
```

The agent should also reload the unpacked extension in Chrome and test several real YouTube videos. Automated checks do not prove that live provider requests and YouTube interactions work.

## License

MIT. See [LICENSE](LICENSE).
