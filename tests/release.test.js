const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("manifest uses minimized install-time permissions", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, "116");
  assert.equal(packageJson.version, manifest.version);
  assert.equal(manifest.options_ui.page, "options.html");
  assert.ok(!manifest.permissions.includes("activeTab"));
  assert.ok(manifest.host_permissions.includes("https://api.deepseek.com/*"));
  assert.equal(Object.hasOwn(manifest, "optional_host_permissions"), false);
  assert.equal(manifest.version, "1.3.0");
});

test("release copy documents current scope without em dashes", () => {
  const readme = read("README.md");
  const chineseReadme = read("README.zh-CN.md");
  const manifest = JSON.parse(read("manifest.json"));
  const packageJson = JSON.parse(read("package.json"));

  assert.doesNotMatch(readme, /—/);
  assert.doesNotMatch(chineseReadme, /—/);
  assert.doesNotMatch(manifest.description, /—/);
  assert.doesNotMatch(packageJson.description, /—/);

  assert.equal(manifest.name, "YouTube Digest");
  assert.equal(packageJson.name, "youtube-digest");
  assert.match(read("scripts/package-extension.sh"), /youtube-digest-v\$version\.zip/);
  assert.doesNotMatch(
    [readme, chineseReadme, read("PRIVACY.md"), read("SECURITY.md")].join("\n"),
    /\bYT Digest\b/,
  );
  assert.match(readme, /^# YouTube Digest Learning Companion$/m);
  assert.match(chineseReadme, /^# YouTube Digest Learning Companion$/m);
  assert.match(readme, /original YouTube Digest codebase created by[\s\S]*@zarazhangrui/);
  assert.match(chineseReadme, /本项目是在[\s\S]*Zara Zhang（@zarazhangrui）/);
  assert.match(readme, /^## What this edition adds$/m);
  assert.match(chineseReadme, /^## 本增强版新增内容$/m);
  assert.match(readme, /^## Original features, briefly$/m);
  assert.match(chineseReadme, /^## 原有功能概述$/m);
  assert.match(readme, /Zara Zhang's upstream README/);
  assert.match(chineseReadme, /Zara Zhang 原项目 README/);
  assert.match(readme, /The sections below focus on this edition's additions/);
  assert.match(chineseReadme, /下面重点介绍本增强版新增功能/);
  assert.match(readme, /^## Use player bilingual subtitles$/m);
  assert.match(chineseReadme, /^## 使用播放器底部双语字幕$/m);
  assert.match(readme, /^## Build the vocabulary notebook$/m);
  assert.match(chineseReadme, /^## 建立单词本$/m);
  assert.match(readme, /^### Repeated words and multiple videos$/m);
  assert.match(chineseReadme, /^### 重复单词与多个视频$/m);
  assert.match(readme, /^## Send vocabulary to Obsidian$/m);
  assert.match(chineseReadme, /^## 把单词发送到 Obsidian$/m);
  assert.match(readme, /Player subtitles and Full Transcript use the same/);
  assert.match(chineseReadme, /不会为同一句向 DeepSeek 调用两次/);
  assert.match(readme, /same word at the same video timestamp is ignored/);
  assert.match(chineseReadme, /同一单词、同一视频时间点的重复添加会被忽略/);
  assert.match(readme, /official `obsidian:\/\/` URI/);
  assert.match(chineseReadme, /Obsidian 官方 `obsidian:\/\/` URI/);
  assert.match(readme, /latest release ZIP/);
  assert.match(chineseReadme, /最新 Release/);
  assert.doesNotMatch(readme, /youtube-digest-enhanced/);
  assert.doesNotMatch(chineseReadme, /youtube-digest-enhanced/);

  const optionsPage = read("options.html");
  const optionsStyles = read("options.css");
  const optionsScript = read("options.js");
  assert.match(optionsPage, /dash\.supadata\.ai\/auth\/sign-up/i);
  assert.match(optionsPage, /platform\.deepseek\.com\/api_keys/i);
  assert.doesNotMatch(optionsPage, /<select\b/i);
  assert.doesNotMatch(optionsPage, /id="(?:provider|aiBaseUrl|aiModel)"/);
  const detailsTag = optionsPage.match(
    /<details\b[^>]*class="card customization-card"[^>]*>/,
  );
  assert.ok(detailsTag, "Expected a native Local remix details disclosure");
  assert.doesNotMatch(detailsTag[0], /\sopen(?:\s|=|>)/i);
  assert.match(
    optionsPage,
    /<summary class="customization-summary">[\s\S]*Want to use another AI model\?[\s\S]*Edit and copy a safe prompt for your coding agent[\s\S]*<\/summary>/,
  );
  assert.match(
    optionsPage,
    /class="customization-steps"[\s\S]*Open the extracted YouTube Digest project folder in your coding[\s\S]*Replace \[PROVIDER\] and \[MODEL\][\s\S]*Never include API keys[\s\S]*<\/ol>/,
  );
  assert.match(
    optionsPage,
    /class="prompt-reminder"[\s\S]*Before copying, replace \[PROVIDER\] and \[MODEL\]/,
  );
  assert.doesNotMatch(optionsPage, /~\/Documents\/youtube-digest/);
  assert.doesNotMatch(optionsPage, /%USERPROFILE%\\Documents\\youtube-digest/);
  assert.match(optionsPage, /id="copyCustomizationPromptBtn"/);
  assert.match(optionsPage, /id="obsidianVault"/);
  assert.match(optionsPage, /id="obsidianFolder"/);
  assert.match(optionsPage, /id="clearVocabularyBtn"/);
  assert.match(optionsStyles, /\.customization-summary:hover\s*\{/);
  assert.match(optionsStyles, /\.customization-summary:focus-visible\s*\{/);
  assert.match(optionsStyles, /\.data-card\s*\{[^}]*margin-top:\s*36px;/);
  assert.match(optionsScript, /clipboard\.writeText/);
  assert.match(optionsScript, /Edited prompt copied\./);
  assert.match(optionsScript, /migration\.migrated[\s\S]*storage\.set/);

  const customizationPrompt = `Customize this local YouTube Digest workspace to use [PROVIDER] with [MODEL]. Work only in the current workspace. Before editing, verify that it contains manifest.json and that the manifest name is YouTube Digest. If verification fails, stop and ask me to open the extracted YouTube Digest project folder in my coding agent. Do not search other folders, edit a guessed copy, assume an installation path, or claim Chrome can reveal the absolute OS source path. Update the provider's API endpoint, request format, and minimum Chrome host permissions. Preserve bring-your-own-key and local Chrome storage. Never put API keys in source code, commits, logs, screenshots, this prompt, or chat; after the code is ready, tell me where to enter the key myself. Keep DeepSeek-only request fields and retry behavior isolated to DeepSeek. Handle provider-specific rules separately so one provider does not affect another. Update README.md, README.zh-CN.md, PRIVACY.md, SECURITY.md, and tests. Run npm test, npm run check, and npm run package. Then explain how to reload the unpacked extension and test it on a real YouTube video.`;
  assert.ok(optionsPage.includes(`>${customizationPrompt}</textarea>`));
  assert.doesNotMatch(customizationPrompt, /Documents|USERPROFILE/);

  const publishedDocs = [
    readme,
    chineseReadme,
    read("PRIVACY.md"),
    read("SECURITY.md"),
  ].join("\n");
  assert.doesNotMatch(publishedDocs, /custom OpenAI-compatible/i);
  assert.doesNotMatch(publishedDocs, /optional custom-origin/i);
  assert.doesNotMatch(publishedDocs, /chosen AI provider/i);
  assert.doesNotMatch(publishedDocs, /configure a different OpenAI-compatible/i);
  assert.match(readme, /published edition supports[\s\S]*DeepSeek V4 Flash/i);
  assert.match(chineseReadme, /发布版本支持[\s\S]*DeepSeek V4 Flash/);
  assert.match(read("sidepanel.html"), /data-tab="vocabulary"/);
  assert.match(read("sidepanel.html"), /id="exportVocabularyBtn"/);
  assert.match(read("background.js"), /action === "saveVocabulary"/);
  assert.match(read("background.js"), /action === "markVocabularySynced"/);
  assert.match(read("background.js"), /action === "enrichVocabulary"/);
  assert.match(read("background.js"), /"vocabulary\.md"/);
  assert.match(read("PRIVACY.md"), /obsidian:\/\/new/);
  assert.match(read("sidepanel.js"), /Generate dictionary meanings/);

  const contributors = read("CONTRIBUTORS.md");
  assert.match(contributors, /Zara Zhang \(@zarazhangrui\)/);
  assert.match(contributors, /guoduan3727-alt/);
  assert.match(contributors, /OpenAI Codex/);
  assert.match(contributors, /youtube-digest\/graphs\/contributors/);
  assert.match(read("LICENSE"), /Copyright \(c\) 2026 Zara Zhang/);
  const notice = read("NOTICE.md");
  assert.match(notice, /continues development directly on the source code/);
  assert.match(notice, /Zara Zhang \(@zarazhangrui\)/);
  assert.match(notice, /OpenAI Codex/);
  assert.match(readme, /^## Development credits$/m);
  assert.match(chineseReadme, /^## 开发贡献$/m);
  assert.match(readme, /Codex has no project-specific GitHub identity/);
  assert.match(chineseReadme, /不创建虚假账号/);
});

test("product UI contains no emoji or emoji-like pictographs", () => {
  const productUi = [
    read("sidepanel.html"),
    read("sidepanel.js"),
    read("content.js"),
    read("options.html"),
    read("options.js"),
  ].join("\n");

  assert.doesNotMatch(
    productUi,
    /\p{Extended_Pictographic}|[✓✕⧉▶]/u,
  );
  assert.doesNotMatch(productUi, /&#(?:9655|9888);/);
});

test("selection actions use three equal edge-to-edge hover areas", () => {
  const css = read("sidepanel.css");

  assert.match(
    css,
    /\.explain-tooltip\s*\{[^}]*padding:\s*0;[^}]*overflow:\s*hidden;/,
  );
  assert.match(
    css,
    /\.explain-btn,\s*\.selection-note-btn,\s*\.add-word-btn\s*\{[^}]*flex:\s*1 1 33\.333%;[^}]*border-radius:\s*0;/,
  );
  assert.match(
    css,
    /\.explain-tooltip\s*\{[^}]*animation:\s*selectionToolbarIn/,
  );
  assert.match(
    css,
    /@keyframes selectionToolbarIn\s*\{[\s\S]*transform:\s*translate\(-50%, 4px\);[\s\S]*transform:\s*translate\(-50%, 0\);/,
  );
});

test("note delete is an accessible SVG action at the end of the action row", () => {
  const js = read("sidepanel.js");
  const css = read("sidepanel.css");

  assert.match(
    js,
    /<div class="note-actions">[\s\S]*class="[^"]*note-play[^"]*"[\s\S]*class="note-delete"[\s\S]*aria-label="Delete note"[\s\S]*<svg viewBox="0 0 24 24" aria-hidden="true">/,
  );
  assert.doesNotMatch(js, /class="note-delete"[^>]*>Delete<\/button>/);
  assert.match(
    css,
    /\.note-delete\s*\{[^}]*place-items:\s*center;[^}]*margin-left:\s*auto;/,
  );
  assert.match(css, /\.note-delete:focus-visible\s*\{[^}]*outline:/);
});

test("notes filters preserve selected contrast and expose pressed state", () => {
  const html = read("sidepanel.html");
  const css = read("sidepanel.css");
  const js = read("sidepanel.js");

  assert.match(
    html,
    /id="notesFilterThis"[\s\S]*?aria-pressed="true"[\s\S]*?>[\s\S]*?This Video/,
  );
  assert.match(
    html,
    /id="notesFilterAll"[\s\S]*?aria-pressed="false"[\s\S]*?>[\s\S]*?All Notes/,
  );
  assert.match(
    css,
    /\.notes-filter \.enhance-btn\.active:hover:not\(:disabled\)\s*\{[^}]*background:\s*var\(--accent-hover\);[^}]*color:\s*white;/,
  );
  assert.match(
    css,
    /\.notes-filter \.enhance-btn:hover:not\(:disabled\)\s*\{[^}]*background:\s*transparent;[^}]*color:\s*var\(--text-secondary\);/,
  );
  assert.match(css, /\.notes-filter \.enhance-btn:focus-visible\s*\{[^}]*outline:/);
  assert.match(js, /setNotesFilter\(false\)/);
  assert.match(js, /setNotesFilter\(true\)/);
  assert.match(js, /setAttribute\("aria-pressed", String\(!showAll\)\)/);
  assert.match(js, /setAttribute\("aria-pressed", String\(showAll\)\)/);
});

test("runtime has no source-file credential dependency or retired model", () => {
  const runtime = [
    "background.js",
    "content.js",
    "sidepanel.js",
    "options.js",
    "settings.js",
  ]
    .map(read)
    .join("\n");

  assert.doesNotMatch(runtime, /\bCONFIG\./);
  assert.doesNotMatch(runtime, /importScripts\(["']config\.js/);
  assert.doesNotMatch(runtime, /\bdeepseek-chat\b/);
  assert.match(runtime, /deepseek-v4-flash/);
});

test("background reconciles side-panel state after navigation commits", () => {
  const background = read("background.js");

  assert.match(
    background,
    /function getNavigationUrl\(changeInfo, tab\)[\s\S]*changeInfo\.status !== "loading"[\s\S]*changeInfo\.status !== "complete"[\s\S]*tab\.pendingUrl \|\| tab\.url/,
  );
  assert.match(
    background,
    /chrome\.tabs\.onUpdated\.addListener\(\(tabId, changeInfo, tab\)[\s\S]*getNavigationUrl\(changeInfo, tab\)[\s\S]*updatePanelForTab\(tabId, url, tab\.windowId\)/,
  );
  assert.match(
    background,
    /function closePanelForTab\(tabId, windowId\)[\s\S]*chrome\.sidePanel\.close\(\{ tabId \}\)[\s\S]*chrome\.sidePanel\.close\(\{ windowId \}\)/,
  );
  assert.match(
    background,
    /await closePanelForTab\(tabId, windowId\);[\s\S]*setOptions\(\{ tabId, enabled: false \}\)/,
  );
});

test("retired Remix and reader files are absent", () => {
  for (const file of [
    "reader.html",
    "reader.js",
    "remix-prompts.js",
    "config.example.js",
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  }
});

test("published prompt files contain runtime sections", () => {
  const expectedSections = {
    "prompts/analysis.md": ["System prompt", "User prompt"],
    "prompts/explain.md": ["System prompt", "User prompt"],
    "prompts/note-cleanup.md": ["System prompt", "User prompt"],
    "prompts/translation.md": [
      "Shared base rules",
      "Chinese rules",
      "Transcript batch translation",
    ],
    "prompts/vocabulary.md": ["System prompt", "User prompt"],
  };

  for (const [file, sections] of Object.entries(expectedSections)) {
    const markdown = read(file);
    for (const section of sections) {
      assert.match(markdown, new RegExp(`^## ${section}$`, "m"));
    }
  }
});
