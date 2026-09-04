# YouTube Digest Enhanced v1.3.0 audit

[中文审核报告](AUDIT.zh-CN.md) | [README](README.md) | [Contributors](CONTRIBUTORS.md)

Audit date: September 4, 2026

## Result

The enhanced edition preserves the upstream YouTube Digest v1.2.0 feature set and adds vocabulary, Obsidian, player bilingual subtitle, and shared translation-cache capabilities. The automated release gate passes with **83 of 83 tests** and **25 extension-package allowlist files**.

Automated tests cannot prove that every future YouTube layout or live Supadata, DeepSeek, Chrome, and Obsidian interaction will work. The final unpacked extension should still be reloaded and exercised on real captioned videos before each release.

## Project lineage and attribution

- Original project: [zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest)
- Original creator and upstream maintainer: [Zara Zhang (@zarazhangrui)](https://github.com/zarazhangrui)
- Upstream release integrated: v1.2.0 plus the latest upstream documentation commits available during this audit
- Enhanced edition maintainer: [Guoduan37 (@guoduan3727-alt)](https://github.com/guoduan3727-alt)
- Development assistance: [OpenAI Codex](https://openai.com/codex/)
- Complete credit details: [CONTRIBUTORS.md](CONTRIBUTORS.md) and the upstream [Contributors graph](https://github.com/zarazhangrui/youtube-digest/graphs/contributors)

The original MIT copyright notice for Zara Zhang remains unchanged in [LICENSE](LICENSE). The full upstream Git history is retained rather than replacing it with a new root commit.

## Functional preservation matrix

| Area | Preserved upstream behavior | Enhanced behavior | Verification |
| --- | --- | --- | --- |
| YouTube page integration | Digest button follows YouTube's responsive toolbar and opens the side panel. | Player subtitle overlay is attached inside the active player and cleaned up on SPA navigation. | Automated content-script and regression tests |
| Transcript | Native caption retrieval, timestamps, click-to-seek, copy, export, and reading-position restoration. | Transcript word selection can open Add word; player and panel share semantic subtitle segments. | Automated transcript, selection, navigation, and export tests |
| Transcript search | Literal, case-insensitive search with previous and next navigation. | Search continues to work after translated rows rerender. | Automated search and translation tests |
| Language views | Original, Chinese, and aligned bilingual modes are shared across Transcript, Overview, and Notes. | Player bilingual subtitles remain an independent switch. | Automated mode persistence and player tests |
| Overview | AI summary, chapters, key quotes, timestamps, and progressive translation. | Reuses the current translation pipeline without removing overview generation. | Automated translation and regression tests |
| Notes | Timestamped player notes, selected-text notes, filters, playback, deletion, and translation. | Vocabulary is a separate collection and does not replace Notes. | Automated notes, selection, and feature-preservation tests |
| Selected text | Explain and Note actions. | Adds a third equal Add word action. | Automated selection-toolbar tests |
| Vocabulary | Not present upstream. | Deduplicated words, multiple video contexts, dictionary enrichment, Markdown copy/export, playback, refresh, and deletion. | Automated vocabulary and enrichment tests |
| Obsidian | Not present upstream. | Official `obsidian://` URI, clipboard-backed long Markdown notes, stable filenames, and repeat updates. | Automated URI, filename, Markdown, and sync tests |
| Translation efficiency | Progressive cached translation. | Full Transcript and player share one base-cue cache plus in-flight requests. | Automated single-request and cache-reuse tests |
| Settings | English and Simplified Chinese settings, local key storage, and fixed DeepSeek provider configuration. | Adds Obsidian vault/folder fields and local vocabulary reset. | Automated settings and release tests |

## Security and privacy checks

- Real API keys are never required in source files. They are entered by the user in the extension Settings page and stored in Chrome local extension storage.
- `config.js`, `.env*`, private-key files, `node_modules`, and `dist` are ignored by Git.
- The release script scans tracked and untracked publishable repository files for common API keys, tokens, private keys, credential assignments, and Obsidian Vault IDs.
- The committed Obsidian smoke test uses a non-secret dummy vault name.
- The extension ZIP is produced from an explicit allowlist. Tests, developer tooling, local configuration, and ignored files are excluded.
- A second history-oriented pattern scan found no key, token, private-key block, or Vault-ID match outside the scanner's own pattern definitions.
- Provider requests and local storage behavior are documented in [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Verification commands

```bash
npm test
npm run check
npm run package
```

On Windows, the repository scripts require a Bash environment such as Git Bash. If the `zip` utility is unavailable, create the ZIP only from the exact file list printed by `scripts/check-release.sh --print-files`, then inspect the archive before publishing it.

## Release gate summary

- JavaScript syntax checks: passed
- Automated tests: 83 passed, 0 failed
- Manifest/package version agreement: passed at 1.3.0
- Package file allowlist: passed with 25 files
- Credential and Vault-ID scan: passed
- Git conflict-marker and whitespace checks: passed
- Live provider and real-video smoke test: required before release when credentials and a suitable video are available
