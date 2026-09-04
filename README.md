# YouTube Digest Learning Companion

[English](README.md) | [简体中文](README.zh-CN.md)

> [!IMPORTANT]
> **Project lineage:** This project continues development directly on the original YouTube Digest codebase created by [Zara Zhang (@zarazhangrui)](https://github.com/zarazhangrui), available at [zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest). It enhances her project rather than reimplementing it. The upstream Git history and Zara Zhang's MIT copyright are retained. This edition is independently maintained and does not imply her endorsement.

YouTube Digest Learning Companion keeps the original Chrome side-panel workflow and adds a focused language-learning layer: bilingual subtitles inside the player, a reusable vocabulary notebook, bilingual dictionary enrichment, multi-video contexts, and readable Obsidian notes.

The Chrome extension itself remains named **YouTube Digest** for compatibility with the upstream project.

![YouTube Digest demo](YouTube%20Digest%20demo.png)

## Development credits

| Contributor | Role | Contribution |
| --- | --- | --- |
| [Zara Zhang (@zarazhangrui)](https://github.com/zarazhangrui) | Original creator and upstream maintainer | Created the original [YouTube Digest](https://github.com/zarazhangrui/youtube-digest) project on which this edition is directly based. |
| [Guoduan37 (@guoduan3727-alt)](https://github.com/guoduan3727-alt) | Learning Companion maintainer | Directed the enhanced requirements, integration, testing, documentation, and public release. |
| [OpenAI Codex](https://openai.com/codex/) | AI development assistant | Assisted with implementation, upstream integration, regression tests, security review, and documentation. |

GitHub's automatic [Contributors graph](https://github.com/guoduan3727-alt/youtube-digest-learning-companion/graphs/contributors) lists linked commit identities. Codex has no project-specific GitHub identity or verified commit email, so it is credited here, in [CONTRIBUTORS.md](CONTRIBUTORS.md), [NOTICE.md](NOTICE.md), and commit trailers instead of through a fabricated account.

## What this edition adds

| Feature | Entry point | Behavior |
| --- | --- | --- |
| Player bilingual subtitles | Choose **播放器双语** above Full Transcript. | Shows the original line and Chinese translation inside the YouTube player in regular, theater, and full-screen modes. |
| Shared translation cache | Use player subtitles and Full Transcript together. | Both views reuse the same subtitle segments, cached translations, and in-flight requests, avoiding duplicate DeepSeek calls for the same cue. |
| Vocabulary notebook | Select transcript text and choose **Add word**. | Saves the word or phrase with its full sentence, video, channel, and timestamp. |
| Duplicate-safe contexts | Add the same word in another sentence or video. | Keeps one word entry and appends only distinct contexts. Repeating the same timestamp is ignored. |
| Bilingual dictionary | Keep **Generate dictionary details** enabled or generate details later from Words. | Adds pronunciation, multiple senses, English and Chinese definitions, examples, sentence translation, and contextual meaning. |
| Obsidian notes | Configure a vault and folder, then choose **Send to Obsidian**. | Creates or updates one readable Markdown note for each normalized word through the official Obsidian URI. |

All additions are independent of the original Transcript, Overview, Notes, search, explanation, export, and timestamp navigation features.

## Install

1. Download the [latest release ZIP](https://github.com/guoduan3727-alt/youtube-digest-learning-companion/releases/latest) or the [main branch ZIP](https://github.com/guoduan3727-alt/youtube-digest-learning-companion/archive/refs/heads/main.zip).
2. Extract it to a permanent folder.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Open YouTube Digest **Settings** and enter your own [Supadata API key](https://dash.supadata.ai/) and [DeepSeek API key](https://platform.deepseek.com/api_keys).
5. Open a standard YouTube video with native captions and click the extension icon.

Enter API keys only in the extension Settings page. Never place them in source files, chat messages, screenshots, GitHub issues, or commits. Keys are stored in Chrome local extension storage and are not included in this repository or release ZIP.

## Original features, briefly

The original workflow remains available:

- **Transcript:** read, search, copy, export, translate, and click timestamps to seek.
- **Overview:** generate an AI summary, chapters, and key quotes.
- **Notes:** save and revisit timestamped notes.
- **Selected text:** explain a selection or save it as a note.
- **Language mode:** use Original, Chinese, or bilingual content across Transcript, Overview, and Notes.

For the original project's detailed walkthrough, provider background, and design explanation, see [Zara Zhang's upstream README](https://github.com/zarazhangrui/youtube-digest#readme). The sections below focus on this edition's additions.

## Use player bilingual subtitles

1. Open a captioned YouTube video and load its transcript in the side panel.
2. Choose **播放器双语** above Full Transcript.
3. Continue watching in regular, theater, or full-screen mode.
4. Choose the button again to disable the overlay.

The overlay starts near the current playback position, then progressively fills the rest of the video. It temporarily hides YouTube's native caption layer to avoid duplicate source lines and restores it when disabled.

Player subtitles and Full Transcript use the same semantic subtitle segmentation and local translation cache. If both request the same cue, they also share the in-flight request, so the extension does not send two DeepSeek calls for that cue.

## Build the vocabulary notebook

1. Select a word or short phrase inside Transcript.
2. Choose **Add word**.
3. Review the captured sentence and timestamp. Add a personal meaning if useful.
4. Keep **Generate dictionary details** enabled for bilingual AI enrichment, or generate it later from **Words**.
5. Open **Words** to play the source, copy Markdown, refresh details, delete an entry, or export the collection.

Each vocabulary entry can contain:

- Lemma and pronunciation.
- Multiple senses with English and Chinese definitions.
- Examples for each sense with Chinese translations.
- Every saved video sentence, its complete translation, meaning in context, optional language note, and timestamped source link.

### Repeated words and multiple videos

Words are normalized before saving. Adding the same word again does not create a second card:

- The same word at the same video timestamp is ignored as a duplicate.
- The same word at another timestamp or in another video appends a new context.
- Existing dictionary senses are reused. DeepSeek analyzes only the new sentence instead of regenerating the whole dictionary.
- Historical duplicate entries are merged when the collection is read, without dropping their contexts.

## Send vocabulary to Obsidian

1. In YouTube Digest Settings, enter the Obsidian vault name or vault ID.
2. Choose a folder such as `YouTube Digest/Vocabulary`. Obsidian creates it when the note is sent if it does not already exist.
3. In **Words**, choose **Send to Obsidian** for an entry.
4. Allow Chrome to open Obsidian if prompted.

The integration uses the official `obsidian://` URI and does not require a community plugin or an additional API key. For reliable long notes, the extension copies the Markdown to the clipboard and asks Obsidian to create or update the note from that clipboard content.

Each normalized word uses one stable filename, such as `serendipity.md`. Sending it again updates the same note instead of creating another file. The note contains:

1. **Dictionary:** pronunciation, multiple bilingual senses, and examples.
2. **Video contexts:** every captured sentence, translation, contextual meaning, optional language note, and timestamped video link.

Obsidian Properties include learning status, first-added date, updated date, context count, and video count, making the notes suitable for Bases or Dataview.

## Data, providers, and limits

- Supadata receives the YouTube URL to retrieve native captions.
- DeepSeek receives only the content needed for the requested AI feature, such as a transcript batch or selected word and sentence.
- Keys, notes, vocabulary, and recent caches remain in Chrome local storage.
- Vocabulary is sent to Obsidian only when you choose **Send to Obsidian**.
- The extension has no developer-operated account system, analytics, advertising, or telemetry.

The published edition supports Chrome 116 or newer, standard `youtube.com/watch` pages, native captions returned by Supadata, and DeepSeek V4 Flash. Shorts, live streams, private videos, access-restricted videos, and videos without native captions may not work. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for details.

## Verification and release

- Automated tests: **83 passed, 0 failed**.
- Release package: **25 explicitly allowlisted files**.
- Checks include JavaScript syntax, feature regression, credential patterns, private-key blocks, GitHub tokens, and Obsidian Vault IDs.
- Automated tests do not replace a real-video smoke test with the user's own provider accounts.

See [AUDIT.md](AUDIT.md) or [中文审核报告](AUDIT.zh-CN.md). Download [YouTube Digest Learning Companion v1.3.0](https://github.com/guoduan3727-alt/youtube-digest-learning-companion/releases/tag/v1.3.0).

## Attribution and license

This repository retains the original project history and Zara Zhang's MIT copyright notice. See [NOTICE.md](NOTICE.md), [CONTRIBUTORS.md](CONTRIBUTORS.md), the upstream [Contributors graph](https://github.com/zarazhangrui/youtube-digest/graphs/contributors), and [LICENSE](LICENSE).
