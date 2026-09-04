const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const vocabulary = require("../vocabulary.js");

function loadEnrichmentHelper(fetchImpl, handler = "handleEnrichVocabulary") {
  const listeners = { addListener() {} };
  const settings = {
    provider: "deepseek",
    aiApiKey: "test-key",
    aiBaseUrl: "https://api.deepseek.com",
    aiModel: "deepseek-v4-flash",
  };
  const sandbox = {
    console,
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    fetch: fetchImpl,
    AbortController,
    setTimeout: () => 0,
    clearTimeout() {},
    importScripts() {},
    chrome: {
      storage: {
        local: {
          setAccessLevel: () => Promise.resolve(),
          get: async () => ({ ytd_settings: settings }),
        },
      },
      action: { onClicked: listeners },
      sidePanel: {
        setPanelBehavior() {},
        setOptions: () => Promise.resolve(),
      },
      runtime: {
        onInstalled: listeners,
        onMessage: listeners,
        openOptionsPage() {},
        getURL: (resourcePath) => `chrome-extension://test/${resourcePath}`,
      },
      tabs: { onUpdated: listeners, onActivated: listeners },
    },
    YTD_SETTINGS: {
      STORAGE_KEY: "ytd_settings",
      normalize: (value) => value,
      chatCompletionsUrl: (baseUrl) => `${baseUrl}/chat/completions`,
    },
    YTD_VOCABULARY: vocabulary,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("background.js"), sandbox);
  return sandbox.__YTD_TRANSLATION_TESTING__[handler];
}

test("DeepSeek vocabulary enrichment returns bounded dictionary and context data", async () => {
  let requestBody;
  const handleEnrichVocabulary = loadEnrichmentHelper(async (url, options) => {
    if (url.startsWith("chrome-extension://")) {
      return { ok: true, text: async () => read("prompts/vocabulary.md") };
    }
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                dictionary: {
                  lemma: "serendipity",
                  phonetic: "/ˌserənˈdɪpəti/",
                  senses: [
                    {
                      partOfSpeech: "noun",
                      definitionEn: "A happy discovery made by chance.",
                      definitionZh: "偶然发现美好事物的机缘。",
                      examples: [
                        {
                          sentence: "The discovery was pure serendipity.",
                          translationZh: "这个发现纯属美好的偶然。",
                        },
                      ],
                    },
                  ],
                },
                contextAnalysis: {
                  sentenceOriginal:
                    "It was serendipity that we found this idea.",
                  sentenceZh: "我们发现这个想法纯属偶然。",
                  meaningInContextZh: "这里表示令人惊喜的偶然发现。",
                  grammarNoteZh: "",
                },
              }),
            },
          },
        ],
      }),
    };
  });

  const result = await handleEnrichVocabulary({
    word: "serendipity",
    context: "It was serendipity that we found this idea.",
    videoTitle: "Unexpected discoveries",
  });

  assert.equal(result.success, true);
  assert.equal(result.dictionary.senses.length, 1);
  assert.equal(result.contextAnalysis.sentenceZh, "我们发现这个想法纯属偶然。");
  assert.deepEqual(requestBody.response_format, { type: "json_object" });
  assert.match(requestBody.messages[1].content, /serendipity/);
  assert.match(requestBody.messages[1].content, /Unexpected discoveries/);
});

test("existing words request context analysis without regenerating a dictionary", async () => {
  let requestBody;
  const analyzeContext = loadEnrichmentHelper(async (url, options) => {
    if (url.startsWith("chrome-extension://")) {
      return { ok: true, text: async () => read("prompts/vocabulary.md") };
    }
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                contextAnalysis: {
                  sentenceOriginal: "This was a moment of serendipity.",
                  sentenceZh: "这是一次机缘巧合。",
                  meaningInContextZh: "这里表示带来好结果的偶然事件。",
                  grammarNoteZh: "a moment of 是名词搭配。",
                },
              }),
            },
          },
        ],
      }),
    };
  }, "handleAnalyzeVocabularyContext");

  const result = await analyzeContext({
    word: "serendipity",
    context: "This was a moment of serendipity.",
    videoTitle: "A second video",
  });

  assert.equal(result.success, true);
  assert.equal(result.contextAnalysis.sentenceZh, "这是一次机缘巧合。");
  assert.match(requestBody.messages[0].content, /Do not regenerate dictionary senses/);
  assert.doesNotMatch(requestBody.messages[0].content, /Return 1 to 5 senses/);
  assert.equal(requestBody.max_tokens, 1600);
});
