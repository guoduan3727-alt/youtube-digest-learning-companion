const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadPlayerSubtitleHelpers() {
  const listeners = { addListener() {} };
  const sandbox = {
    console,
    document: {
      readyState: "loading",
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({}),
    },
    window: {
      location: { pathname: "/watch" },
      addEventListener() {},
    },
    chrome: {
      runtime: {
        onMessage: listeners,
        sendMessage: async () => ({ success: true }),
      },
    },
    MutationObserver: class {
      observe() {}
    },
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("content.js"), sandbox);
  return sandbox.__YTD_PLAYER_SUBTITLE_TESTING__;
}

test("player subtitle switch is additive and independent from transcript mode", () => {
  const html = read("sidepanel.html");
  const script = read("sidepanel.js");
  assert.match(html, /id="playerSubtitlesBtn"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(script, /PLAYER_SUBTITLES_SETTING_KEY/);
  assert.match(script, /action: "configurePlayerSubtitles"/);
  assert.match(script, /action: "updatePlayerSubtitleTranslations"/);
  assert.match(
    script,
    /function getActiveTranscriptSegments\(\) \{\s*return getSharedTranslationSegments\(\);\s*\}/,
  );
  assert.match(script, /:zh:shared:/);
  assert.doesNotMatch(script, /function transcriptTranslationCacheKey[\s\S]{0,120}:zh:semantic:/);

  const toggleBody = script.match(
    /async function togglePlayerSubtitles\(\) \{([\s\S]*?)\n\}/,
  );
  assert.ok(toggleBody);
  assert.doesNotMatch(toggleBody[1], /currentTranscriptMode\s*=/);
});

test("player subtitle cues are sorted, deduplicated, bounded, and plain text", () => {
  const { normalizePlayerSubtitleSegments } = loadPlayerSubtitleHelpers();
  const result = normalizePlayerSubtitleSegments([
    {
      id: "second",
      start: 5,
      end: 9,
      text: "<i>Second</i><br>line",
      translation: "<b>第二行</b>",
    },
    { id: "first", start: 0, end: 4, text: "First line" },
    { id: "first", start: 1, end: 2, text: "duplicate" },
    { id: "bad", start: -1, text: "invalid time" },
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.map(({ id, start, end }) => ({ id, start, end })))),
    [
      { id: "first", start: 0, end: 4 },
      { id: "second", start: 5, end: 9 },
    ],
  );
  assert.equal(result[1].text, "Second\nline");
  assert.equal(result[1].translation, "第二行");
});

test("active player subtitle lookup respects starts, gaps, and cue endings", () => {
  const { findActivePlayerSubtitleIndex } = loadPlayerSubtitleHelpers();
  const segments = [
    { start: 0, end: 3 },
    { start: 5, end: 8 },
    { start: 8, end: 12 },
  ];
  assert.equal(findActivePlayerSubtitleIndex(segments, 0), 0);
  assert.equal(findActivePlayerSubtitleIndex(segments, 2.99), 0);
  assert.equal(findActivePlayerSubtitleIndex(segments, 4), -1);
  assert.equal(findActivePlayerSubtitleIndex(segments, 5), 1);
  assert.equal(findActivePlayerSubtitleIndex(segments, 8), 2);
  assert.equal(findActivePlayerSubtitleIndex(segments, 12), -1);
});

test("overlay uses an isolated shadow root, safe text rendering, and SPA cleanup", () => {
  const script = read("content.js");
  assert.match(script, /host\.attachShadow\(\{ mode: "closed" \}\)/);
  assert.match(script, /player\.appendChild\(host\)/);
  assert.match(script, /playerSubtitleOriginalLine\.textContent = segment\.text/);
  assert.match(script, /playerSubtitleTranslationLine\.textContent =/);
  assert.match(script, /ytd-player-subtitles-active/);
  assert.match(
    script,
    /document\.addEventListener\("yt-navigate-finish", \(\) => \{[\s\S]*?destroyPlayerSubtitles\(\)/,
  );
  assert.match(script, /bottom: clamp\(62px, 11%, 126px\)/);
});
