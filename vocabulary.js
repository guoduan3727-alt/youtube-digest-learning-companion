/**
 * Pure vocabulary and Obsidian helpers shared by the extension UI, service
 * worker, and Node tests. No API keys or user data are stored in this file.
 */
var YTD_VOCABULARY = (() => {
  const STORAGE_KEY = "ytd_vocabulary";
  const OBSIDIAN_SETTINGS_KEY = "ytd_obsidian_settings";
  const DEFAULT_OBSIDIAN_FOLDER = "YouTube Digest/Vocabulary";

  function cleanText(value, maxLength) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  function normalizeWord(value) {
    return cleanText(value, 120)
      .replace(/^[\s"“”'‘’([{<]+|[\s"“”'‘’\])}>.,!?;:，。！？；：]+$/g, "")
      .trim();
  }

  function normalizeObsidianSettings(input = {}) {
    return {
      vault: cleanText(input.vault, 200),
      folder:
        cleanText(input.folder, 500)
          .replace(/\\/g, "/")
          .replace(/^\/+|\/+$/g, "") || DEFAULT_OBSIDIAN_FOLDER,
    };
  }

  function formatTimestamp(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function normalizeDictionary(input, fallbackWord = "") {
    if (!input || typeof input !== "object") return null;
    const senses = (Array.isArray(input.senses) ? input.senses : [])
      .slice(0, 5)
      .map((sense) => {
        if (!sense || typeof sense !== "object") return null;
        const examples = (Array.isArray(sense.examples) ? sense.examples : [])
          .slice(0, 3)
          .map((example) => ({
            sentence: cleanText(example?.sentence, 1000),
            translationZh: cleanText(example?.translationZh, 1000),
          }))
          .filter((example) => example.sentence);
        const normalized = {
          partOfSpeech: cleanText(sense.partOfSpeech, 80),
          definitionEn: cleanText(sense.definitionEn, 1000),
          definitionZh: cleanText(sense.definitionZh, 1000),
          examples,
        };
        return normalized.definitionEn || normalized.definitionZh
          ? normalized
          : null;
      })
      .filter(Boolean);
    if (!senses.length) return null;
    return {
      lemma: normalizeWord(input.lemma) || normalizeWord(fallbackWord),
      phonetic: cleanText(input.phonetic, 120),
      senses,
    };
  }

  function normalizeContextAnalysis(input, fallbackSentence = "") {
    if (!input || typeof input !== "object") return null;
    const normalized = {
      sentenceOriginal:
        cleanText(input.sentenceOriginal, 3000) ||
        cleanText(fallbackSentence, 3000),
      sentenceZh: cleanText(input.sentenceZh, 3000),
      meaningInContextZh: cleanText(input.meaningInContextZh, 1200),
      grammarNoteZh: cleanText(input.grammarNoteZh, 1600),
    };
    return normalized.sentenceZh ||
      normalized.meaningInContextZh ||
      normalized.grammarNoteZh
      ? normalized
      : null;
  }

  function mergeContextAnalysis(existing, incoming, fallbackSentence = "") {
    const first = normalizeContextAnalysis(existing, fallbackSentence) || {};
    const second = normalizeContextAnalysis(incoming, fallbackSentence) || {};
    return normalizeContextAnalysis(
      {
        sentenceOriginal: second.sentenceOriginal || first.sentenceOriginal,
        sentenceZh: second.sentenceZh || first.sentenceZh,
        meaningInContextZh:
          second.meaningInContextZh || first.meaningInContextZh,
        grammarNoteZh: second.grammarNoteZh || first.grammarNoteZh,
      },
      fallbackSentence,
    );
  }

  function createOccurrence(input = {}) {
    const videoId = cleanText(input.videoId, 30);
    const timestampSeconds = Math.max(
      0,
      Math.floor(Number(input.timestampSeconds) || 0),
    );
    const createdAt = Number.isFinite(Number(input.createdAt))
      ? Number(input.createdAt)
      : Date.now();
    const context = cleanText(input.context, 3000);
    const canonicalUrl = videoId
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
      : "";
    const fallbackId = `occ_${createdAt}_${videoId || "manual"}_${timestampSeconds}`
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 100);

    return {
      id: cleanText(input.id || input.occurrenceId, 100) || fallbackId,
      context,
      videoId,
      videoTitle: cleanText(input.videoTitle, 500) || "Untitled Video",
      channelName: cleanText(input.channelName, 300),
      timestamp: formatTimestamp(timestampSeconds),
      timestampSeconds,
      timestampedUrl: canonicalUrl
        ? `${canonicalUrl}&t=${timestampSeconds}s`
        : "",
      createdAt,
      contextAnalysis: normalizeContextAnalysis(input.contextAnalysis, context),
    };
  }

  function occurrenceKey(input = {}) {
    const occurrence = createOccurrence(input);
    if (occurrence.videoId) {
      return `${occurrence.videoId}|${occurrence.timestampSeconds}`;
    }
    return `manual|${occurrence.context.toLocaleLowerCase("en-US")}`;
  }

  function hasOccurrenceContent(occurrence) {
    return Boolean(
      occurrence.videoId ||
        occurrence.context ||
        occurrence.timestampSeconds ||
        occurrence.contextAnalysis,
    );
  }

  function mergeOccurrences(inputs = []) {
    const merged = new Map();
    for (const input of Array.isArray(inputs) ? inputs : []) {
      const occurrence = createOccurrence(input);
      if (!hasOccurrenceContent(occurrence)) continue;
      const key = occurrenceKey(occurrence);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, occurrence);
        continue;
      }
      merged.set(key, {
        ...existing,
        context: occurrence.context || existing.context,
        videoTitle:
          occurrence.videoTitle !== "Untitled Video"
            ? occurrence.videoTitle
            : existing.videoTitle,
        channelName: occurrence.channelName || existing.channelName,
        createdAt: Math.min(existing.createdAt, occurrence.createdAt),
        contextAnalysis: mergeContextAnalysis(
          existing.contextAnalysis,
          occurrence.contextAnalysis,
          occurrence.context || existing.context,
        ),
      });
    }
    return Array.from(merged.values())
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-200);
  }

  function mergePersonalNotes(existing, incoming) {
    const first = cleanText(existing, 1000);
    const second = cleanText(incoming, 1000);
    if (!first) return second;
    if (!second || first === second) return first;
    return cleanText(`${first}；${second}`, 1000);
  }

  function createEntry(input = {}) {
    const word = normalizeWord(input.word);
    if (!word) throw new Error("Choose a word or short phrase first.");

    const videoId = cleanText(input.videoId, 30);
    const timestampSeconds = Math.max(
      0,
      Math.floor(Number(input.timestampSeconds) || 0),
    );
    const createdAt = Number.isFinite(Number(input.createdAt))
      ? Number(input.createdAt)
      : Date.now();
    const idSuffix = String(input.idSuffix || "")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 24);
    const id = cleanText(input.id, 100) ||
      `word_${createdAt}_${idSuffix || Math.random().toString(36).slice(2, 8)}`;
    const providedOccurrences = Array.isArray(input.occurrences)
      ? input.occurrences
      : [];
    const occurrences = mergeOccurrences(
      providedOccurrences.length
        ? providedOccurrences
        : [
            {
              id: `occ_${id}`,
              context: input.context,
              videoId,
              videoTitle: input.videoTitle,
              channelName: input.channelName,
              timestampSeconds,
              createdAt,
              contextAnalysis: input.contextAnalysis,
            },
          ],
    );
    const latestOccurrence = occurrences[occurrences.length - 1] || null;
    const updatedAt = Math.max(
      Number(input.updatedAt) || createdAt,
      ...occurrences.map((occurrence) => occurrence.createdAt),
    );

    return {
      id,
      word,
      normalizedWord: word.toLocaleLowerCase("en-US"),
      meaning: cleanText(input.meaning, 1000),
      context: latestOccurrence?.context || cleanText(input.context, 3000),
      videoId: latestOccurrence?.videoId || videoId,
      videoTitle:
        latestOccurrence?.videoTitle ||
        cleanText(input.videoTitle, 500) ||
        "Untitled Video",
      channelName:
        latestOccurrence?.channelName || cleanText(input.channelName, 300),
      timestamp:
        latestOccurrence?.timestamp || formatTimestamp(timestampSeconds),
      timestampSeconds:
        latestOccurrence?.timestampSeconds ?? timestampSeconds,
      timestampedUrl: latestOccurrence?.timestampedUrl || "",
      status: ["learning", "review", "known"].includes(input.status)
        ? input.status
        : "learning",
      createdAt,
      updatedAt,
      obsidianSyncedAt: Number(input.obsidianSyncedAt) || null,
      dictionary: normalizeDictionary(input.dictionary, word),
      contextAnalysis:
        latestOccurrence?.contextAnalysis ||
        normalizeContextAnalysis(input.contextAnalysis, input.context),
      occurrences,
      occurrenceCount: occurrences.length,
      enrichmentError: cleanText(input.enrichmentError, 500),
    };
  }

  function mergeEntries(existingInput, incomingInput) {
    const existing = createEntry(existingInput);
    const incoming = createEntry(incomingInput);
    if (existing.normalizedWord !== incoming.normalizedWord) {
      throw new Error("Only identical normalized words can be merged.");
    }
    return createEntry({
      ...existing,
      id: existing.id,
      word: existing.word,
      meaning: mergePersonalNotes(existing.meaning, incoming.meaning),
      dictionary: existing.dictionary || incoming.dictionary,
      status: existing.status,
      createdAt: Math.min(existing.createdAt, incoming.createdAt),
      updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
      obsidianSyncedAt: Math.max(
        Number(existing.obsidianSyncedAt) || 0,
        Number(incoming.obsidianSyncedAt) || 0,
      ) || null,
      occurrences: mergeOccurrences([
        ...existing.occurrences,
        ...incoming.occurrences,
      ]),
      enrichmentError:
        incoming.enrichmentError || existing.enrichmentError,
    });
  }

  function mergeEntryList(entriesInput = []) {
    const normalizedEntries = (Array.isArray(entriesInput) ? entriesInput : [])
      .map((entry) => {
        try {
          return createEntry(entry);
        } catch (_error) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.createdAt - b.createdAt);
    const byWord = new Map();
    for (const entry of normalizedEntries) {
      const existing = byWord.get(entry.normalizedWord);
      byWord.set(
        entry.normalizedWord,
        existing ? mergeEntries(existing, entry) : entry,
      );
    }
    return Array.from(byWord.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  function yamlString(value) {
    return JSON.stringify(String(value || ""));
  }

  function markdownCallout(type, title, value) {
    const body = String(value || "")
      .split(/\r?\n/)
      .map((line) => `> ${line}`);
    return [`> [!${type}] ${title}`, ...body].join("\n");
  }

  function buildMarkdown(entryInput) {
    const entry = createEntry(entryInput);
    const added = new Date(entry.createdAt).toISOString();
    const updated = new Date(entry.updatedAt).toISOString();
    const dictionary = entry.dictionary;
    const occurrences = [...entry.occurrences].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    const videoCount = new Set(
      occurrences.map((occurrence) => occurrence.videoId).filter(Boolean),
    ).size;

    const lines = [
      "---",
      "type: vocabulary",
      `word: ${yamlString(entry.word)}`,
      `status: ${entry.status}`,
      `added: ${yamlString(added)}`,
      `updated: ${yamlString(updated)}`,
      "source: youtube",
      `occurrences: ${occurrences.length}`,
      `videos: ${videoCount}`,
      "tags:",
      "  - vocabulary",
      "  - youtube-digest",
      "---",
      "",
      `# ${entry.word}`,
      "",
      "## 1. Dictionary / 词典",
      "",
    ];

    if (dictionary) {
      const wordCard = [
        `**Lemma / 原形：** ${dictionary.lemma || entry.word}`,
        dictionary.phonetic
          ? `**Pronunciation / 音标：** ${dictionary.phonetic}`
          : "",
        `**Status / 状态：** ${entry.status}`,
        entry.meaning ? `**Personal note / 个人备注：** ${entry.meaning}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      lines.push(markdownCallout("summary", "Word card / 单词卡", wordCard), "");
      dictionary.senses.forEach((sense, index) => {
        const partOfSpeech = sense.partOfSpeech
          ? ` · ${sense.partOfSpeech}`
          : "";
        lines.push(`### Sense ${index + 1}${partOfSpeech}`, "");
        if (sense.definitionEn) {
          lines.push(`**English definition:** ${sense.definitionEn}`, "");
        }
        if (sense.definitionZh) {
          lines.push(`**中文释义：** ${sense.definitionZh}`, "");
        }
        if (sense.examples.length) {
          lines.push("#### Examples / 例句", "");
          sense.examples.forEach((example, exampleIndex) => {
            const exampleBody = [
              example.sentence,
              example.translationZh
                ? `\n**中文：** ${example.translationZh}`
                : "",
            ]
              .filter(Boolean)
              .join("\n");
            lines.push(
              markdownCallout(
                "example",
                `Example ${exampleIndex + 1}`,
                exampleBody,
              ),
              "",
            );
          });
        }
        lines.push("");
      });
    } else {
      lines.push(
        entry.meaning || "Dictionary details have not been generated yet.",
        "",
      );
    }

    lines.push(`## 2. Video contexts / 视频语境（${occurrences.length}）`, "");
    if (!occurrences.length) {
      lines.push("No video context has been saved yet.", "");
    }
    occurrences.forEach((occurrence, index) => {
      const analysis = occurrence.contextAnalysis;
      const context =
        analysis?.sentenceOriginal ||
        occurrence.context ||
        "No transcript context saved.";
      const sourceLink = occurrence.timestampedUrl
        ? `[Watch at ${occurrence.timestamp}](${occurrence.timestampedUrl})`
        : "No source link saved.";
      const contextDate = new Date(occurrence.createdAt)
        .toISOString()
        .slice(0, 10);
      lines.push(
        `### Context ${index + 1} · ${occurrence.videoTitle} · ${occurrence.timestamp}`,
        "",
      );
      const sourceDetails = [
        `**Video / 视频：** ${occurrence.videoTitle}`,
        occurrence.channelName
          ? `**Channel / 频道：** ${occurrence.channelName}`
          : "",
        `**Timestamp / 时间戳：** ${sourceLink}`,
        `**Collected / 收集日期：** ${contextDate}`,
      ]
        .filter(Boolean)
        .join("\n");
      lines.push(
        markdownCallout("info", "Source / 来源", sourceDetails),
        "",
        markdownCallout("quote", "Original sentence / 视频原句", context),
        "",
      );
      if (analysis?.sentenceZh) {
        lines.push(
          markdownCallout(
            "success",
            "Sentence translation / 整句翻译",
            analysis.sentenceZh,
          ),
          "",
        );
      }
      if (analysis?.meaningInContextZh) {
        lines.push(
          markdownCallout(
            "tip",
            "Meaning in this sentence / 本句含义",
            analysis.meaningInContextZh,
          ),
          "",
        );
      }
      if (analysis?.grammarNoteZh) {
        lines.push(
          markdownCallout(
            "note",
            "Language note / 用法说明",
            analysis.grammarNoteZh,
          ),
          "",
        );
      }
    });
    if (entry.meaning && !dictionary) {
      lines.push("### Personal note", "", entry.meaning, "");
    }
    return `${lines.join("\n")}\n`;
  }

  function sanitizePathPart(value) {
    const cleaned = normalizeWord(value)
      .replace(/[\\/:*?"<>|#^\[\]]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/\.+$/g, "")
      .trim()
      .slice(0, 80);
    return cleaned || "word";
  }

  function stableShortHash(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).slice(0, 6);
  }

  function buildObsidianFilePath(entryInput, settingsInput) {
    const entry = createEntry(entryInput);
    const settings = normalizeObsidianSettings(settingsInput);
    const safeWord = sanitizePathPart(entry.word);
    const needsHash = safeWord.toLocaleLowerCase("en-US") !== entry.normalizedWord;
    const suffix = needsHash ? ` - ${stableShortHash(entry.normalizedWord)}` : "";
    const filename = `${safeWord}${suffix}.md`;
    return settings.folder ? `${settings.folder}/${filename}` : filename;
  }

  function buildObsidianUri(entryInput, settingsInput, options = {}) {
    const settings = normalizeObsidianSettings(settingsInput);
    if (!settings.vault) {
      throw new Error("Add your Obsidian vault name in Settings first.");
    }

    const params = new URLSearchParams();
    params.set("vault", settings.vault);
    params.set("file", buildObsidianFilePath(entryInput, settings));
    if (options.useClipboard) {
      params.set("clipboard", "true");
    } else {
      params.set("content", buildMarkdown(entryInput));
    }
    params.set("overwrite", "true");
    // URLSearchParams uses application/x-www-form-urlencoded semantics and
    // serializes spaces as "+". Obsidian URI parameters require percent
    // encoding, where a space is "%20" rather than a literal plus sign.
    return `obsidian://new?${params.toString().replace(/\+/g, "%20")}`;
  }

  function buildCollectionMarkdown(entriesInput) {
    const entries = mergeEntryList(entriesInput);
    const occurrenceCount = entries.reduce(
      (total, entry) => total + entry.occurrences.length,
      0,
    );
    const lines = [
      "---",
      "type: vocabulary-collection",
      "source: youtube-digest",
      `exported: ${yamlString(new Date().toISOString())}`,
      "tags:",
      "  - vocabulary",
      "  - youtube-digest",
      "---",
      "",
      "# YouTube Digest Vocabulary",
      "",
      `- Saved words: ${entries.length}`,
      `- Video contexts: ${occurrenceCount}`,
      "",
      "| Word | Dictionary meaning | Contexts | Videos | Latest sentence | Latest source | Added | Status |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ];

    for (const entry of entries) {
      const escapeCell = (value) =>
        String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
      const source = entry.timestampedUrl
        ? `[${entry.timestamp}](${entry.timestampedUrl})`
        : entry.timestamp;
      const dictionaryMeaning =
        entry.dictionary?.senses
          .map(
            (sense) =>
              sense.definitionZh || sense.definitionEn,
          )
          .filter(Boolean)
          .join("；") || entry.meaning;
      const videoCount = new Set(
        entry.occurrences
          .map((occurrence) => occurrence.videoId)
          .filter(Boolean),
      ).size;
      lines.push(
        `| ${escapeCell(entry.word)} | ${escapeCell(dictionaryMeaning)} | ${entry.occurrences.length} | ${videoCount} | ${escapeCell(entry.contextAnalysis?.sentenceOriginal || entry.context)} | ${source} | ${new Date(entry.createdAt).toISOString().slice(0, 10)} | ${entry.status} |`,
      );
    }

    return `${lines.join("\n")}\n`;
  }

  return {
    STORAGE_KEY,
    OBSIDIAN_SETTINGS_KEY,
    DEFAULT_OBSIDIAN_FOLDER,
    normalizeWord,
    normalizeDictionary,
    normalizeContextAnalysis,
    createOccurrence,
    occurrenceKey,
    mergeOccurrences,
    mergeEntries,
    mergeEntryList,
    normalizeObsidianSettings,
    formatTimestamp,
    createEntry,
    buildMarkdown,
    buildObsidianFilePath,
    buildObsidianUri,
    buildCollectionMarkdown,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = YTD_VOCABULARY;
}
