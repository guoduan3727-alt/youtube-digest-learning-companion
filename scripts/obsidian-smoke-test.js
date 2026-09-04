const vocabulary = require("../vocabulary.js");

const baseTime = Date.UTC(2026, 7, 17, 15, 30, 0);
const first = {
  id: "word_obsidian_merge_smoke",
  word: "youtube-digest-merge-test",
  meaning: "用于验证同词合并和 Obsidian 覆盖更新的测试词条。",
  context: "The first video provides the original test context.",
  videoId: "mergeTestVideoOne",
  videoTitle: "Merge test video one",
  channelName: "YouTube Digest Test",
  timestampSeconds: 42,
  createdAt: baseTime,
  dictionary: {
    lemma: "youtube-digest-merge-test",
    phonetic: "/test/",
    senses: [
      {
        partOfSpeech: "test entry",
        definitionEn: "A deterministic entry used to test vocabulary merging.",
        definitionZh: "用于测试词汇合并的确定性词条。",
        examples: [
          {
            sentence: "This is a generated integration test.",
            translationZh: "这是一个生成的集成测试。",
          },
        ],
      },
    ],
  },
  contextAnalysis: {
    sentenceOriginal: "The first video provides the original test context.",
    sentenceZh: "第一个视频提供了初始测试语境。",
    meaningInContextZh: "这是第一条测试语境。",
    grammarNoteZh: "仅用于连接测试。",
  },
};

const repeatedClick = {
  ...first,
  id: "word_obsidian_merge_smoke_duplicate",
  createdAt: baseTime + 1000,
};

const second = {
  ...first,
  id: "word_obsidian_merge_smoke_second",
  context: "A second video appends another context to the same word.",
  videoId: "mergeTestVideoTwo",
  videoTitle: "Merge test video two",
  timestampSeconds: 95,
  createdAt: baseTime + 2000,
  dictionary: null,
  contextAnalysis: {
    sentenceOriginal: "A second video appends another context to the same word.",
    sentenceZh: "第二个视频为同一个单词追加另一条语境。",
    meaningInContextZh: "这是第二条测试语境。",
    grammarNoteZh: "append ... to ... 表示追加到某处。",
  },
};

const entries = vocabulary.mergeEntryList([repeatedClick, second, first]);
if (entries.length !== 1 || entries[0].occurrences.length !== 2) {
  throw new Error("The smoke-test fixture did not merge to one word and two contexts.");
}

const settings = {
  vault: "youtube-digest-test-vault",
  folder: "YouTube Digest/Vocabulary",
};

process.stdout.write(
  JSON.stringify({
    wordCount: entries.length,
    occurrenceCount: entries[0].occurrences.length,
    file: vocabulary.buildObsidianFilePath(entries[0], settings),
    markdown: vocabulary.buildMarkdown(entries[0]),
    uri: vocabulary.buildObsidianUri(entries[0], settings, {
      useClipboard: true,
    }),
  }),
);
