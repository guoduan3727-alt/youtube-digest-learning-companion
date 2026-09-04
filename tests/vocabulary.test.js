const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const vocabulary = require("../vocabulary.js");

const sample = {
  id: "word_1786968000000_demo",
  word: "  serendipity  ",
  meaning: "意外发现美好事物的能力",
  context: "It was pure serendipity that we found this idea.",
  videoId: "ydTeb_I0b94",
  videoTitle: "Learning from unexpected discoveries",
  channelName: "Example Channel",
  timestampSeconds: 125,
  createdAt: Date.UTC(2026, 7, 17, 12, 0, 0),
  dictionary: {
    lemma: "serendipity",
    phonetic: "/ˌserənˈdɪpəti/",
    senses: [
      {
        partOfSpeech: "noun",
        definitionEn: "The chance occurrence of a happy discovery.",
        definitionZh: "意外发现美好事物的机缘。",
        examples: [
          {
            sentence: "Finding the book was pure serendipity.",
            translationZh: "找到这本书纯属美好的偶然。",
          },
        ],
      },
      {
        partOfSpeech: "noun",
        definitionEn: "An ability to make useful discoveries by chance.",
        definitionZh: "偶然发现有价值事物的能力。",
        examples: [
          {
            sentence: "Research often benefits from serendipity.",
            translationZh: "研究常常受益于偶然发现。",
          },
        ],
      },
    ],
  },
  contextAnalysis: {
    sentenceOriginal: "It was pure serendipity that we found this idea.",
    sentenceZh: "我们发现这个想法纯属美好的偶然。",
    meaningInContextZh: "这里表示偶然发生但结果令人惊喜的发现。",
    grammarNoteZh: "pure serendipity 是常见搭配，用于强调完全出于偶然。",
  },
};

test("vocabulary entries retain word, context, and timestamped source", () => {
  const entry = vocabulary.createEntry(sample);
  assert.equal(entry.word, "serendipity");
  assert.equal(entry.normalizedWord, "serendipity");
  assert.equal(entry.timestamp, "2:05");
  assert.equal(
    entry.timestampedUrl,
    "https://www.youtube.com/watch?v=ydTeb_I0b94&t=125s",
  );
  assert.equal(entry.status, "learning");
  assert.equal(entry.occurrences.length, 1);
});

test("Obsidian URI creates an overwrite-safe Markdown note in the chosen vault", () => {
  const entry = vocabulary.createEntry(sample);
  const uri = vocabulary.buildObsidianUri(entry, {
    vault: "Language Learning",
    folder: "YouTube Digest/Vocabulary",
  });
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, "obsidian:");
  assert.equal(parsed.hostname, "new");
  assert.doesNotMatch(uri, /\+/);
  assert.match(uri, /YouTube%20Digest%2FVocabulary/);
  assert.equal(parsed.searchParams.get("vault"), "Language Learning");
  assert.equal(
    parsed.searchParams.get("file"),
    "YouTube Digest/Vocabulary/serendipity.md",
  );
  assert.equal(parsed.searchParams.get("overwrite"), "true");
  assert.match(parsed.searchParams.get("content"), /^---\ntype: vocabulary/m);
  assert.match(parsed.searchParams.get("content"), /status: learning/);
  assert.match(parsed.searchParams.get("content"), /## 1\. Dictionary \/ 词典/);
  assert.match(parsed.searchParams.get("content"), /### Sense 2 · noun/);
  assert.match(parsed.searchParams.get("content"), /> \[!example\] Example 1/);
  assert.match(parsed.searchParams.get("content"), /occurrences: 1/);
  assert.match(parsed.searchParams.get("content"), /## 2\. Video contexts \/ 视频语境（1）/);
  assert.match(parsed.searchParams.get("content"), /> \[!success\] Sentence translation/);
  assert.match(parsed.searchParams.get("content"), /> \[!tip\] Meaning in this sentence/);
  assert.match(parsed.searchParams.get("content"), /Watch at 2:05/);
});

test("Obsidian sync requires an explicit vault and normalizes its folder", () => {
  assert.throws(
    () => vocabulary.buildObsidianUri(sample, { vault: "" }),
    /vault name/i,
  );
  assert.deepEqual(
    vocabulary.normalizeObsidianSettings({
      vault: " My Vault ",
      folder: "\\Languages\\Vocabulary\\",
    }),
    { vault: "My Vault", folder: "Languages/Vocabulary" },
  );
});

test("clipboard Obsidian URI stays short for readable multi-sense notes", () => {
  const uri = vocabulary.buildObsidianUri(sample, {
    vault: "Language Learning",
    folder: "YouTube Digest/Vocabulary",
  }, { useClipboard: true });
  const parsed = new URL(uri);
  assert.equal(parsed.searchParams.get("clipboard"), "true");
  assert.equal(parsed.searchParams.has("content"), false);
  assert.ok(uri.length < 500);
});

test("Obsidian dispatch uses a top-level Chrome tab and clipboard URI", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "sidepanel.js"),
    "utf8",
  );
  assert.match(source, /await navigator\.clipboard\.writeText\(markdown\)/);
  assert.match(source, /await chrome\.tabs\.create\(\{ url: uri, active: true \}\)/);
  assert.doesNotMatch(source, /window\.location\.href\s*=\s*uri/);
});

test("same word keeps one entry while distinct video contexts accumulate", () => {
  const repeatedClick = {
    ...sample,
    id: "word_repeated_click",
    createdAt: sample.createdAt + 1000,
  };
  const anotherVideo = {
    ...sample,
    id: "word_another_video",
    videoId: "anotherVideo123",
    videoTitle: "A second lesson",
    timestampSeconds: 48,
    context: "Serendipity also plays a role in scientific discovery.",
    contextAnalysis: {
      sentenceOriginal:
        "Serendipity also plays a role in scientific discovery.",
      sentenceZh: "机缘巧合也在科学发现中发挥作用。",
      meaningInContextZh: "这里表示偶然获得有价值发现的机缘。",
      grammarNoteZh: "play a role in 表示在某事中发挥作用。",
    },
    createdAt: sample.createdAt + 2000,
  };
  const entries = vocabulary.mergeEntryList([
    repeatedClick,
    anotherVideo,
    sample,
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, sample.id);
  assert.equal(entries[0].occurrences.length, 2);
  assert.equal(entries[0].dictionary.senses.length, 2);
  assert.equal(entries[0].videoTitle, "A second lesson");
  const markdown = vocabulary.buildMarkdown(entries[0]);
  assert.match(markdown, /occurrences: 2/);
  assert.match(markdown, /Context 1 · A second lesson · 0:48/);
  assert.match(markdown, /Context 2 · Learning from unexpected discoveries · 2:05/);
});

test("special-character words receive readable stable collision-safe names", () => {
  const first = vocabulary.buildObsidianFilePath(
    { word: "C#" },
    { folder: "Vocabulary" },
  );
  const second = vocabulary.buildObsidianFilePath(
    { word: "C#" },
    { folder: "Vocabulary" },
  );
  assert.equal(first, second);
  assert.match(first, /^Vocabulary\/C- - [a-z0-9]+\.md$/);
});

test("collection export contains summary counts and source links", () => {
  const duplicate = {
    ...sample,
    id: "word_1786968000001_demo2",
    videoId: "secondVideo",
    videoTitle: "Second video",
    timestampSeconds: 61,
    context: "The invention was another example of serendipity.",
    contextAnalysis: {
      sentenceOriginal: "The invention was another example of serendipity.",
      sentenceZh: "这项发明是另一个机缘巧合的例子。",
      meaningInContextZh: "这里表示带来有用结果的偶然发现。",
      grammarNoteZh: "an example of 是常见名词搭配。",
    },
    createdAt: sample.createdAt + 1,
  };
  const markdown = vocabulary.buildCollectionMarkdown([sample, duplicate]);
  assert.match(markdown, /Saved words: 1/);
  assert.match(markdown, /Video contexts: 2/);
  assert.match(markdown, /意外发现美好事物的机缘/);
  assert.match(markdown, /The invention was another example of serendipity/);
  assert.match(markdown, /\[1:01\]\(https:\/\/www\.youtube\.com\/watch\?v=secondVideo&t=61s\)/);
});

test("dictionary normalization limits generated detail and keeps old entries valid", () => {
  const normalized = vocabulary.normalizeDictionary(
    {
      lemma: " test ",
      senses: Array.from({ length: 8 }, (_, index) => ({
        partOfSpeech: "noun",
        definitionZh: `义项 ${index + 1}`,
        examples: Array.from({ length: 5 }, (__, exampleIndex) => ({
          sentence: `Example ${exampleIndex + 1}`,
          translationZh: `例句 ${exampleIndex + 1}`,
        })),
      })),
    },
    "test",
  );
  assert.equal(normalized.senses.length, 5);
  assert.equal(normalized.senses[0].examples.length, 3);
  assert.equal(vocabulary.createEntry({ word: "legacy" }).dictionary, null);
});
