const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function expectAll(source, patterns, label) {
  patterns.forEach((pattern) => {
    assert.match(source, pattern, `${label} is missing ${pattern}`);
  });
}

test("manifest retains the extension surfaces and minimum permissions", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.side_panel.default_path, "sidepanel.html");
  assert.equal(manifest.background.service_worker, "background.js");
  assert.equal(manifest.options_ui.page, "options.html");
  assert.deepEqual(manifest.content_scripts[0].js, ["content.js"]);
  for (const permission of ["sidePanel", "storage", "tabs", "scripting"]) {
    assert.ok(manifest.permissions.includes(permission));
  }
  for (const origin of [
    "https://www.youtube.com/*",
    "https://api.supadata.ai/*",
    "https://api.deepseek.com/*",
  ]) {
    assert.ok(manifest.host_permissions.includes(origin));
  }
});

test("YouTube page controls retain Digest, timestamp notes, seeking, and subtitles", () => {
  const content = read("content.js");
  expectAll(
    content,
    [
      /function createDigestButton\(/,
      /function injectDigestButton\(/,
      /function injectNoteButton\(/,
      /function handleNoteKeyboardShortcut\(/,
      /e\.key !== "n" && e\.key !== "N"/,
      /function saveCurrentNote\(/,
      /message\.action === "getVideoInfo"/,
      /message\.action === "getCurrentTime"/,
      /message\.action === "seekTo"/,
      /message\.action === "configurePlayerSubtitles"/,
      /message\.action === "updatePlayerSubtitleTranslations"/,
      /document\.addEventListener\("yt-navigate-finish"/,
    ],
    "YouTube content feature",
  );
});

test("side panel retains transcript, overview, notes, words, and export controls", () => {
  const html = read("sidepanel.html");
  const script = read("sidepanel.js");
  expectAll(
    html,
    [
      /data-tab="transcript"/,
      /data-tab="overview"/,
      /data-tab="notes"/,
      /data-tab="vocabulary"/,
      /data-transcript-mode="original"/,
      /data-transcript-mode="zh"/,
      /data-transcript-mode="bilingual"/,
      /id="playerSubtitlesBtn"/,
      /id="copyTranscriptBtn"/,
      /id="exportTranscriptBtn"/,
      /id="chapterList"/,
      /id="quotesList"/,
      /id="notesFilterThis"/,
      /id="notesFilterAll"/,
      /id="exportVocabularyBtn"/,
      /id="followPlaybackBtn"/,
    ],
    "Side-panel control",
  );
  expectAll(
    script,
    [
      /async function startDigest\(/,
      /function renderTranscript\(/,
      /async function triggerAnalysis\(/,
      /async function showExplanation\(/,
      /async function loadNotes\(/,
      /async function deleteNote\(/,
      /async function loadVocabulary\(/,
      /async function enrichVocabularyEntry\(/,
      /async function sendVocabularyToObsidian\(/,
      /async function exportVocabularyMarkdown\(/,
      /function startPlaybackTracking\(/,
      /async function translateTranscript\(/,
      /async function syncPlayerSubtitleOverlay\(/,
    ],
    "Side-panel behavior",
  );
});

test("background retains transcript, AI, notes, vocabulary, and relay endpoints", () => {
  const background = read("background.js");
  const actions = [
    "fetchTranscript",
    "analyzeTranscript",
    "explainSelection",
    "saveNote",
    "getNotes",
    "deleteNote",
    "saveVocabulary",
    "getVocabulary",
    "deleteVocabulary",
    "markVocabularySynced",
    "enrichVocabulary",
    "analyzeVocabularyContext",
    "updateVocabularyEnrichment",
    "translateContent",
    "checkConfig",
    "openOptions",
    "openSidePanel",
    "relayToContent",
  ];
  actions.forEach((action) => {
    assert.match(background, new RegExp(`message\\.action === "${action}"`));
  });
  assert.match(background, /mode=native|mode", "native"|mode:\s*"native"/);
  assert.match(read("settings.js"), /deepseek-v4-flash/);
});

test("settings and vocabulary retain local data and Obsidian management", () => {
  const options = read("options.html");
  const optionsScript = read("options.js");
  const vocabulary = read("vocabulary.js");
  expectAll(
    options,
    [
      /id="supadataApiKey"/,
      /id="aiApiKey"/,
      /id="obsidianVault"/,
      /id="obsidianFolder"/,
      /id="copyCustomizationPromptBtn"/,
      /id="clearCacheBtn"/,
      /id="clearNotesBtn"/,
      /id="clearVocabularyBtn"/,
      /id="resetBtn"/,
    ],
    "Settings control",
  );
  expectAll(
    optionsScript,
    [/settingsForm/, /clearCacheBtn/, /clearNotesBtn/, /clearVocabularyBtn/, /resetBtn/],
    "Settings behavior",
  );
  expectAll(
    vocabulary,
    [
      /function normalizeWord\(/,
      /function mergeEntries\(/,
      /function buildMarkdown\(/,
      /function buildObsidianUri\(/,
      /obsidian:\/\/new/,
    ],
    "Vocabulary behavior",
  );
});
