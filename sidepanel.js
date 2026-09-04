/**
 * SIDE PANEL LOGIC
 *
 * Handles the UI for YouTube Digest: video detection, transcript analysis,
 * rendering results, and export features.
 */

const DEBUG = false;
const debugLog = (...args) => {
  if (DEBUG) console.log(...args);
};

// ============================================================
// STATE
// ============================================================

let currentVideoId = null;
let currentVideoUrl = null;
let currentAnalysis = null;
let currentTranscript = null;
let currentTranscriptText = null; // Plain text (for display/export)
let currentTranscriptTimestamped = null; // With timestamps for AI analysis
let currentTranscriptLanguage = null;
let currentVideoTitle = "";
let currentChannelName = "";
let currentVideoDescription = "";
let currentVideoDuration = 0;
let isAnalysisLoading = false; // Track if analysis is in progress
let youtubeTabId = null; // Store the YouTube tab ID for reliable messaging
let errorAction = null;

// --- Translation state ---
// The public transcript control intentionally supports only the original
// subtitles, Chinese, and an aligned source + Chinese view.
let currentTranscriptMode = "original";
let translationGeneration = 0; // Invalidates responses from older UI modes/videos.
let translationWorkCount = 0;
let transcriptScrollObserver = null;
// Stable keys include the video, source mode, language, and semantic segment ID.
let transcriptParagraphCache = new Map();
const TRANSLATION_MESSAGE_TIMEOUT_MS = 130_000;

// --- In-player bilingual subtitle state ---
// This stays independent from currentTranscriptMode: the right-side transcript
// keeps its current view while the player overlay is controlled separately.
const PLAYER_SUBTITLES_SETTING_KEY = "ytd_player_subtitles_enabled";
const SHARED_TRANSLATION_SEGMENT_LIMITS = Object.freeze({
  minChars: 28,
  idealChars: 72,
  maxChars: 130,
  maxSeconds: 7,
});
let playerSubtitlesEnabled = false;
let playerSubtitleGeneration = 0;
// Both the side-panel bilingual view and the in-player overlay use these same
// cue translations. In-flight promises prevent two consumers from sending the
// same cue to DeepSeek at the same time.
const sharedTranslationInFlight = new Map();

/**
 * Prevent a stopped service worker or dead message channel from leaving the
 * transcript queue stuck forever. The underlying Chrome message cannot be
 * cancelled, so settled guards deliberately ignore any late response.
 */
function sendTranslationMessage(message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      callback(value);
    };

    timeoutId = setTimeout(() => {
      finish(
        reject,
        new Error(
          "Translation request timed out after 130 seconds. Please Retry.",
        ),
      );
    }, TRANSLATION_MESSAGE_TIMEOUT_MS);

    let messagePromise;
    try {
      messagePromise = chrome.runtime.sendMessage(message);
    } catch (error) {
      finish(reject, error);
      return;
    }

    Promise.resolve(messagePromise).then(
      (result) => finish(resolve, result),
      (error) => finish(reject, error),
    );
  });
}

// --- Auto-scroll state (follow video playback in transcript) ---
let autoScrollEnabled = true; // True = scroll transcript to follow video playback
let autoScrollInterval = null; // setInterval ID for polling video time
let lastAutoScrollTime = 0; // Timestamp of last programmatic scroll (ignores scroll events within 1s)

// ============================================================
// TRANSCRIPT GROUPING
// ============================================================

const TRANSCRIPT_SEGMENT_LIMITS = Object.freeze({
  minChars: 60,
  idealChars: 180,
  maxChars: 320,
  maxSeconds: 20,
});

function normalizeCaptionText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, "$1$2")
    .replace(/([，。；：！？])\s+(?=[\u3400-\u9fff])/g, "$1")
    .replace(/\s+([,.;:!?，。；：！？])/g, "$1")
    .trim();
}

/**
 * Splits a single oversized thought at the strongest nearby punctuation.
 * Word boundaries are the final safety valve for captions with no punctuation.
 */
function splitOversizedThought(text, maxChars) {
  const parts = [];
  let rest = normalizeCaptionText(text);

  while (rest.length > maxChars) {
    const windowText = rest.slice(0, maxChars + 1);
    const lowerBound = Math.floor(maxChars * 0.55);
    let cut = -1;

    for (const pattern of [/[;:；：]\s*/g, /[,，]\s*/g, /\s/g]) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(windowText))) {
        if (match.index >= lowerBound) cut = match.index + match[0].length;
      }
      if (cut > 0) break;
    }

    if (cut <= 0) cut = maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) parts.push(rest);
  return parts;
}

/**
 * Reconstructs complete sentences across raw caption boundaries. Each segment
 * keeps the timestamp of the first caption that contributed text. Character
 * and time limits prevent a malformed Supadata entry from becoming one giant
 * row while punctuation remains the preferred boundary.
 */
function groupTranscriptEntries(entries, limits = TRANSCRIPT_SEGMENT_LIMITS) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const pieces = [];
  entries.forEach((entry, entryIndex) => {
    const text = normalizeCaptionText(entry?.text);
    if (!text) return;
    const start = Number.isFinite(Number(entry.start)) ? Number(entry.start) : 0;
    const duration = Math.max(0, Number(entry.duration) || 0);
    const sentenceParts =
      text.match(/[^.!?;:,。！？；：，]+(?:[.!?;:,。！？；：，]+["')\]”’）】」』]*|$)/g) ||
      [text];
    let consumedChars = 0;

    sentenceParts.forEach((sentencePart) => {
      const cleanPart = normalizeCaptionText(sentencePart);
      if (!cleanPart) return;
      const oversizedParts = splitOversizedThought(cleanPart, limits.maxChars);
      oversizedParts.forEach((part, partIndex) => {
        const ratio = text.length ? Math.min(1, consumedChars / text.length) : 0;
        pieces.push({
          text: part,
          start: start + duration * ratio,
          semanticEnd:
            /[.!?。！？]["')\]”’）】」』]*$/.test(part) ||
            oversizedParts.length > 1,
          clauseEnd: /[;:,；：，]["')\]”’）】」』]*$/.test(part),
          sourceOrder: `${entryIndex}:${partIndex}`,
        });
        consumedChars += part.length + 1;
      });
    });
  });

  const grouped = [];
  let current = null;

  const flush = () => {
    if (!current || !current.text.trim()) return;
    const index = grouped.length;
    const text = normalizeCaptionText(current.text);
    grouped.push({
      id: `segment-${index}-${Math.round(current.start * 1000)}`,
      start: current.start,
      text,
      texts: [text],
    });
    current = null;
  };

  pieces.forEach((piece) => {
    if (!current) current = { start: piece.start, text: "" };
    current.text = normalizeCaptionText(`${current.text} ${piece.text}`);
    const elapsed = Math.max(0, piece.start - current.start);
    const comfortablySized = current.text.length >= limits.minChars;
    const reachedIdeal = current.text.length >= limits.idealChars;
    const atNaturalBoundary =
      piece.semanticEnd ||
      (piece.clauseEnd &&
        (reachedIdeal ||
          current.text.length >= limits.maxChars ||
          elapsed >= limits.maxSeconds));
    const reachedGuardrail =
      atNaturalBoundary &&
      (current.text.length >= limits.maxChars || elapsed >= limits.maxSeconds);
    const reachedHardGuardrail =
      current.text.length >= Math.round(limits.maxChars * 1.2) ||
      elapsed >= limits.maxSeconds + 5;

    if (
      (atNaturalBoundary && (comfortablySized || elapsed >= 8)) ||
      (atNaturalBoundary && reachedIdeal) ||
      reachedGuardrail ||
      reachedHardGuardrail
    ) {
      flush();
    }
  });
  flush();

  return grouped;
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  await loadPlayerSubtitlesSetting();
  await evictOldCacheEntries(20);

  const configStatus = await chrome.runtime.sendMessage({
    action: "checkConfig",
  });

  if (!configStatus.hasSupadataKey || !configStatus.hasAiKey) {
    showConfigError(configStatus);
    return;
  }

  await checkCurrentTab();
});

// Listen for messages from the Digest button on YouTube page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startDigestFromButton") {
    // Load the digest for the current video. Served from cache when we've
    // seen this video before (no API calls); fetched fresh otherwise.
    // (This used to force-clear the cache on every click, which silently
    // burned a transcript credit + analysis tokens per click.)
    checkCurrentTab();
    sendResponse({ success: true });
  }
  if (message.action === "transcriptProgress") {
    // Background is telling us the transcript fetch status changed
    updateLoading(message.title, message.subtitle);
    sendResponse({ success: true });
  }
  if (message.action === "noteSaved") {
    // Refresh notes list when a new note is saved
    const filterAll = document
      .getElementById("notesFilterAll")
      ?.classList.contains("active");
    loadNotes(filterAll ? null : currentVideoId);
    sendResponse({ success: true });
  }
  if (message.action === "vocabularySaved") {
    if (
      document
        .querySelector('.tab[data-tab="vocabulary"]')
        ?.classList.contains("active")
    ) {
      loadVocabulary();
    }
    sendResponse({ success: true });
  }
  return false;
});

// ============================================================
// FOLLOW THE ACTIVE TAB
// ============================================================
// The panel watches which tab is in front of it and reacts:
//   - Front tab is NOT YouTube  -> the panel closes itself (window.close()).
//     We do this OURSELVES rather than relying only on the background
//     script's per-tab enable/disable, because Chrome doesn't reliably
//     apply per-tab panel state to tabs spawned in unusual ways (e.g. a
//     link opened from another app) — which let the panel linger on
//     non-YouTube pages.
//   - Front tab IS YouTube but on a different video -> refresh the digest.
//     YouTube is a single-page app (clicking a video swaps content without
//     a reload), so we track URL changes; startDigest() caches per video,
//     making re-checks instant and free for already-digested videos.
//
// Everything is scoped to the window this panel lives in: tab switches in
// OTHER browser windows must not close this panel or hijack its content.

let navigationRefreshTimer = null;
let panelWindowId = null;
chrome.windows.getCurrent().then((w) => {
  panelWindowId = w.id;
});

function scheduleDigestRefresh() {
  // Small delay lets YouTube finish rendering the new video's title and
  // description before we read them. Also collapses rapid-fire URL events
  // into a single refresh.
  clearTimeout(navigationRefreshTimer);
  navigationRefreshTimer = setTimeout(() => {
    checkCurrentTab();
  }, 600);
}

function panelIsShowingResults() {
  const results = document.getElementById("resultsState");
  return results && results.style.display !== "none";
}

/**
 * Reacts to the URL now in front of the panel: close on non-YouTube,
 * refresh the digest when the video changed.
 */
function handleFrontTabUrl(url) {
  if (!(url || "").startsWith("https://www.youtube.com")) {
    // Panel is a YouTube-only tool — remove itself from non-YouTube tabs.
    window.close();
    return;
  }

  const newVideoId = extractVideoId(url);
  // Refresh when the video changed, or when we're not currently showing
  // results (e.g. user went home, then clicked back into the same video).
  if (newVideoId !== currentVideoId || !panelIsShowingResults()) {
    scheduleDigestRefresh();
  }
}

// Fires when a tab's URL changes — including YouTube's no-reload navigation.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url || !tab.active) return;
  if (panelWindowId !== null && tab.windowId !== panelWindowId) return;
  handleFrontTabUrl(changeInfo.url);
});

// Fires when a different tab comes to the front — switching tabs, or a new
// tab being opened (including ones opened by clicking links in other apps).
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  if (panelWindowId !== null && windowId !== panelWindowId) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    // Brand-new tabs may not have committed their URL yet — fall back to
    // the pending one so we judge where the tab is actually going.
    handleFrontTabUrl(tab.url || tab.pendingUrl || "");
  } catch (e) {
    // Tab closed before we could read it — nothing to do.
  }
});

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Error retry
  document.getElementById("errorBtn").addEventListener("click", () => {
    if (errorAction) {
      errorAction();
      return;
    }
    if (currentVideoId) {
      startDigest(currentVideoId, currentVideoUrl);
    }
  });

  document.getElementById("settingsBtn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openOptions" });
  });

  // Transcript actions
  document
    .getElementById("copyTranscriptBtn")
    ?.addEventListener("click", copyTranscript);
  document
    .getElementById("exportTranscriptBtn")
    ?.addEventListener("click", exportTranscript);
  document
    .getElementById("playerSubtitlesBtn")
    ?.addEventListener("click", togglePlayerSubtitles);
  document.querySelectorAll(".transcript-mode-btn").forEach((button) => {
    button.addEventListener("click", () => {
      handleTranscriptModeChange(button.dataset.transcriptMode);
    });
  });

  // Follow playback button — re-enables auto-scroll after user scrolled away
  document
    .getElementById("followPlaybackBtn")
    ?.addEventListener("click", () => {
      autoScrollEnabled = true;
      document.getElementById("followPlaybackBtn").style.display = "none";
      // Jump straight back to the line currently being spoken. We scroll
      // directly (not via playbackTrackingTick) because the tick skips
      // entries that are already highlighted — and the current line almost
      // always IS highlighted, which made this button appear to do nothing.
      if (!scrollToActiveEntry()) {
        playbackTrackingTick(); // No highlight yet — let a tick establish one
      }
    });

  // Notes filter buttons
  document.getElementById("notesFilterThis")?.addEventListener("click", () => {
    setNotesFilter(false);
    loadNotes(currentVideoId);
  });
  document.getElementById("notesFilterAll")?.addEventListener("click", () => {
    setNotesFilter(true);
    loadNotes(null); // Load all notes
  });

  document
    .getElementById("exportVocabularyBtn")
    ?.addEventListener("click", exportVocabularyMarkdown);
}

function setNotesFilter(showAll) {
  const thisVideoButton = document.getElementById("notesFilterThis");
  const allNotesButton = document.getElementById("notesFilterAll");
  thisVideoButton?.classList.toggle("active", !showAll);
  thisVideoButton?.setAttribute("aria-pressed", String(!showAll));
  allNotesButton?.classList.toggle("active", showAll);
  allNotesButton?.setAttribute("aria-pressed", String(showAll));
}

// ============================================================
// VIDEO DETECTION
// ============================================================

async function checkCurrentTab() {
  try {
    // Try multiple strategies to find the YouTube tab
    let tab = null;

    // Strategy 1: Active tab in last focused window
    let tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (tabs[0]?.url?.includes("youtube.com")) {
      tab = tabs[0];
    }

    // Strategy 2: Any active YouTube tab
    if (!tab) {
      tabs = await chrome.tabs.query({
        url: "https://www.youtube.com/*",
        active: true,
      });
      if (tabs[0]) tab = tabs[0];
    }

    // Strategy 3: Any YouTube tab (last resort)
    if (!tab) {
      tabs = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
      if (tabs[0]) tab = tabs[0];
    }

    debugLog("[YouTube Digest Panel] Found tab:", tab?.id, tab?.url);

    if (!tab?.url) {
      showState("welcome");
      return;
    }

    // Store the tab ID for reliable messaging later
    youtubeTabId = tab.id;

    const videoId = extractVideoId(tab.url);

    if (videoId) {
      currentVideoUrl = tab.url;

      try {
        // Route through background script for reliable message passing
        const result = await chrome.runtime.sendMessage({
          action: "relayToContent",
          payload: { action: "getVideoInfo" },
        });
        debugLog("[YouTube Digest Panel] getVideoInfo result:", result);
        if (result.success && result.response) {
          currentVideoTitle = result.response.title || "";
          currentChannelName = result.response.channelName || "";
          currentVideoDescription = result.response.description || "";
          currentVideoDuration = result.response.duration || 0;
        }
      } catch (e) {
        console.error("[YouTube Digest Panel] getVideoInfo error:", e);
        currentVideoTitle = "";
        currentChannelName = "";
        currentVideoDescription = "";
        currentVideoDuration = 0;
      }

      startDigest(videoId, tab.url);
    } else {
      showState("welcome");
    }
  } catch (error) {
    console.error("Tab check error:", error);
    showState("welcome");
  }
}

function extractVideoId(url) {
  try {
    const urlObj = new URL(url);

    if (
      urlObj.hostname.includes("youtube.com") &&
      urlObj.searchParams.has("v")
    ) {
      return urlObj.searchParams.get("v");
    }

    if (urlObj.hostname === "youtu.be") {
      return urlObj.pathname.slice(1);
    }

    if (urlObj.pathname.startsWith("/embed/")) {
      return urlObj.pathname.split("/")[2];
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================
// DIGEST PIPELINE
// ============================================================

async function startDigest(videoId, videoUrl) {
  // Check if we already have this video loaded in memory
  if (videoId === currentVideoId && currentAnalysis) {
    showState("results");
    if (playerSubtitlesEnabled) syncPlayerSubtitleOverlay();
    return;
  }

  // Every video change invalidates observer work and in-flight translations.
  if (videoId !== currentVideoId) {
    translationGeneration += 1;
    playerSubtitleGeneration += 1;
    if (transcriptScrollObserver) transcriptScrollObserver.disconnect();
    transcriptScrollObserver = null;
  }

  // Check cache for this video
  const cached = await loadFromCache(videoId);
  if (cached) {
    debugLog("Loading from cache:", videoId);
    currentVideoId = videoId;
    currentVideoUrl = videoUrl;
    currentAnalysis = cached.analysis || null;
    currentTranscript = cached.transcript;
    currentTranscriptText = cached.transcriptText;
    currentTranscriptTimestamped = cached.transcriptTimestamped;
    currentTranscriptLanguage = cached.transcriptLanguage || null;
    isAnalysisLoading = false;

    // Restore semantic-segment translations from persistent storage.
    if (cached.paragraphCache) {
      for (const [key, value] of Object.entries(cached.paragraphCache)) {
        transcriptParagraphCache.set(key, value);
      }
    }

    if (currentVideoTitle || currentChannelName) {
      const videoInfo = document.getElementById("videoInfo");
      document.getElementById("videoTitle").textContent = currentVideoTitle;
      document.getElementById("videoChannel").textContent = currentChannelName;
      videoInfo.style.display = "block";
    }

    // Always render transcript first
    renderTranscript();

    // Render analysis if we have it cached
    if (currentAnalysis) {
      renderAnalysisResults(currentAnalysis);
      highlightMomentsOnPage(currentAnalysis.keyMoments);
    }

    showState("results");
    document.getElementById("tabsNav").style.display = "flex";

    // Load notes for this video
    loadNotes(videoId);

    // Setup explain feature
    setupExplainFeature();
    if (currentTranscriptMode !== "original") translateTranscript();
    if (playerSubtitlesEnabled) syncPlayerSubtitleOverlay();
    return;
  }

  currentVideoId = videoId;
  currentVideoUrl = videoUrl;
  currentAnalysis = null;
  currentTranscript = null;
  currentTranscriptText = null;
  currentTranscriptTimestamped = null;
  currentTranscriptLanguage = null;
  isAnalysisLoading = false;

  if (currentVideoTitle || currentChannelName) {
    const videoInfo = document.getElementById("videoInfo");
    document.getElementById("videoTitle").textContent = currentVideoTitle;
    document.getElementById("videoChannel").textContent = currentChannelName;
    videoInfo.style.display = "block";
  }

  showState("loading");
  updateLoading("Fetching transcript", "");

  const transcriptResult = await chrome.runtime.sendMessage({
    action: "fetchTranscript",
    videoId: videoId,
  });

  if (!transcriptResult.success) {
    if (transcriptResult.error === "NO_SUPADATA_KEY") {
      showError(
        "API key missing",
        "Add your Supadata API key in YouTube Digest Settings.",
      );
      return;
    }
    showError(
      "No transcript found",
      transcriptResult.message || transcriptResult.error,
    );
    return;
  }

  currentTranscript = transcriptResult.transcript;
  currentTranscriptText = transcriptResult.transcriptText;
  currentTranscriptTimestamped = transcriptResult.transcriptTextTimestamped;
  currentTranscriptLanguage = transcriptResult.language || null;

  // Render transcript immediately (no LLM needed)
  renderTranscript();
  showState("results");
  document.getElementById("tabsNav").style.display = "flex";

  // Load notes for this video
  loadNotes(videoId);

  // Setup explain feature for text selection
  setupExplainFeature();
  if (currentTranscriptMode !== "original") translateTranscript();
  if (playerSubtitlesEnabled) syncPlayerSubtitleOverlay();

  // Save transcript to cache (without analysis)
  await saveToCache(videoId);

  // DON'T run LLM analysis automatically - wait for user to click Overview tab
  // This saves tokens when user just wants to see the transcript
}

// ============================================================
// RENDERING
// ============================================================

/**
 * Renders the analysis results into the Overview tab.
 * Shows chapters and key quotes only.
 */
function renderAnalysisResults(analysis) {
  // Chapters
  const chapterList = document.getElementById("chapterList");
  chapterList.innerHTML = "";
  (analysis.chapters || []).forEach((chapter) => {
    const li = document.createElement("li");
    li.className = "chapter-item";
    li.dataset.seconds = chapter.timestampSeconds;
    li.innerHTML = `
      <span class="chapter-timestamp">${escapeHtml(chapter.timestamp)}</span>
      <div class="chapter-content">
        <span class="chapter-title">${escapeHtml(chapter.title)}</span>
        <span class="chapter-summary">${escapeHtml(chapter.summary || "")}</span>
      </div>
    `;
    li.addEventListener("click", () => {
      debugLog(
        "[YouTube Digest Panel] Chapter clicked:",
        chapter.timestamp,
        chapter.timestampSeconds,
      );
      seekTo(chapter.timestampSeconds);
    });
    chapterList.appendChild(li);
  });

  // Quotes - sort by timestamp (chronological order)
  const quotesList = document.getElementById("quotesList");
  quotesList.innerHTML = "";
  const sortedQuotes = [...(analysis.keyQuotes || [])].sort(
    (a, b) => (a.timestampSeconds || 0) - (b.timestampSeconds || 0),
  );
  sortedQuotes.forEach((quote) => {
    const div = document.createElement("div");
    div.className = "quote-item";
    div.dataset.seconds = quote.timestampSeconds;
    div.innerHTML = `
      <div class="quote-text">${escapeHtml(quote.quote)}</div>
      <div class="quote-meta">
        <span class="quote-timestamp">${escapeHtml(quote.timestamp)}</span>
        <div class="quote-actions">
          <button class="quote-save-note-btn" title="Save this quote as a note">📝 Note</button>
          <button class="quote-copy-btn" title="Copy this quote">⧉ Copy</button>
        </div>
      </div>
    `;
    div.addEventListener("click", () => {
      debugLog(
        "[YouTube Digest Panel] Quote clicked:",
        quote.timestamp,
        quote.timestampSeconds,
      );
      seekTo(quote.timestampSeconds);
    });

    const quoteCopyBtn = div.querySelector(".quote-copy-btn");
    quoteCopyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(quote.quote);
        quoteCopyBtn.textContent = "✓ Copied";
        setTimeout(() => {
          quoteCopyBtn.textContent = "⧉ Copy";
        }, 1500);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    });

    const quoteSaveNoteBtn = div.querySelector(".quote-save-note-btn");
    quoteSaveNoteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await saveQuoteAsNote(quote, quoteSaveNoteBtn);
    });

    quotesList.appendChild(div);
  });
}

/**
 * Saves a key quote as a timestamped note.
 */
async function saveQuoteAsNote(quote, btn) {
  if (!currentVideoId) return;

  const originalText = btn.textContent;
  btn.textContent = "Saving...";
  btn.disabled = true;

  try {
    const result = await chrome.runtime.sendMessage({
      action: "saveNote",
      videoId: currentVideoId,
      timestamp: quote.timestampSeconds,
      videoTitle: currentVideoTitle,
      channelName: currentChannelName,
    });

    if (result.success) {
      btn.textContent = "✓ Saved";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
      // Refresh notes list if on Notes tab
      loadNotes(currentVideoId);
    } else {
      console.error("[YouTube Digest] Save quote as note failed:", result.error);
      btn.textContent = "Error";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    }
  } catch (error) {
    console.error("[YouTube Digest] Save quote as note error:", error);
    btn.textContent = "Error";
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 1500);
  }
}

/**
 * Legacy function for backwards compatibility with cached data.
 * Renders both transcript and analysis.
 */
function renderResults(analysis) {
  renderAnalysisResults(analysis);

  renderTranscript();

  document.getElementById("tabsNav").style.display = "flex";

  // Setup explain feature for text selection
  setupExplainFeature();
}

/**
 * Returns true while the user has a range of text selected.
 * Transcript row clicks must not seek in that state: the click emitted after
 * selection mouseup belongs to the selection/explain interaction, not playback.
 */
function hasNonCollapsedTextSelection() {
  const selection = window.getSelection();
  return Boolean(
    selection && selection.rangeCount > 0 && !selection.isCollapsed,
  );
}

/**
 * Preserves normal row-click seeking while keeping text selection inert.
 */
function seekFromTranscriptEntryClick(event, seconds) {
  if (hasNonCollapsedTextSelection()) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  seekTo(seconds);
}

function renderTranscript() {
  if (!currentTranscript) return;

  const transcriptList = document.getElementById("transcriptList");
  transcriptList.innerHTML = "";

  // Show a small badge indicating the transcript came from the video's
  // existing subtitles. (We no longer AI-transcribe audio, so subtitles
  // are the only source.)
  const existingBadge = document.getElementById("transcriptSourceBadge");
  if (existingBadge) existingBadge.remove();

  const badge = document.createElement("div");
  badge.id = "transcriptSourceBadge";
  badge.className = "transcript-source-badge";
  badge.innerHTML = `<span class="source-dot source-dot--subs"></span> From video subtitles · ${escapeHtml(getOriginalTranscriptLabel())}`;
  transcriptList.parentElement.insertBefore(badge, transcriptList);

  // Group entries using smart sentence-boundary + time-guardrail logic
  const grouped = groupTranscriptEntries(currentTranscript);

  grouped.forEach((group) => {
    const div = document.createElement("div");
    div.className = "transcript-entry";
    div.dataset.seconds = group.start;

    const minutes = Math.floor(group.start / 60);
    const seconds = Math.floor(group.start % 60);
    const timestamp = `${minutes}:${String(seconds).padStart(2, "0")}`;

    div.innerHTML = `
      <span class="transcript-time">${timestamp}</span>
      <span class="transcript-text">${renderSubtitleInlineMarkup(group.text)}</span>
    `;

    div.addEventListener("click", (event) =>
      seekFromTranscriptEntryClick(event, group.start),
    );
    transcriptList.appendChild(div);
  });

  // Start tracking video playback for auto-scroll
  startPlaybackTracking();
}

function copyTranscript() {
  copyToClipboardWithFeedback(currentTranscriptText || "", "copyTranscriptBtn");
}

function exportTranscript() {
  const transcriptContent = currentTranscriptText || "";
  const videoUrl = `https://youtube.com/watch?v=${currentVideoId}`;

  let exportText = "";
  exportText += `TRANSCRIPT\n`;
  exportText += `${"=".repeat(60)}\n\n`;
  exportText += `Title: ${currentVideoTitle || "Unknown"}\n`;
  exportText += `Channel: ${currentChannelName || "Unknown"}\n`;
  exportText += `URL: ${videoUrl}\n`;
  exportText += `\n${"—".repeat(60)}\n\n`;

  if (currentVideoDescription) {
    exportText += `DESCRIPTION:\n${currentVideoDescription}\n`;
    exportText += `\n${"—".repeat(60)}\n\n`;
  }

  exportText += `TRANSCRIPT:\n\n${transcriptContent}\n`;
  exportText += `\n${"—".repeat(60)}\n`;
  exportText += `Exported by YouTube Digest\n`;

  const filename = `${sanitizeFilename(currentVideoTitle)}-transcript.txt`;
  downloadTextFile(exportText, filename);
}

// ============================================================
// UI STATE MANAGEMENT
// ============================================================

function showState(state) {
  document.getElementById("welcomeState").style.display =
    state === "welcome" ? "flex" : "none";
  document.getElementById("loadingState").style.display =
    state === "loading" ? "block" : "none";
  document.getElementById("errorState").style.display =
    state === "error" ? "block" : "none";
  const uploadEl = document.getElementById("uploadState");
  if (uploadEl) uploadEl.style.display = "none"; // Upload state removed — always hidden
  document.getElementById("resultsState").style.display =
    state === "results" ? "block" : "none";

  // The tab bar only belongs on the results view. We toggle it HERE, in one
  // place, so it tracks the view automatically. Previously each caller had to
  // remember to re-show it after showState("results"), and one path forgot —
  // which is why the tabs could vanish when re-opening an already-analyzed video.
  document.getElementById("tabsNav").style.display =
    state === "results" ? "flex" : "none";

  if (state !== "results") {
    stopPlaybackTracking();
  }
}

function updateLoading(title, subtitle) {
  document.getElementById("loadingText").textContent = title;
  document.getElementById("loadingSubtext").textContent = subtitle;
}

function showError(title, message) {
  errorAction = null;
  showState("error");
  document.getElementById("errorTitle").textContent = title;
  document.getElementById("errorMessage").textContent = message;
  document.getElementById("errorBtn").textContent = "Try Again";
}

function showConfigError(configStatus) {
  const missingKeys = [];
  if (!configStatus.hasSupadataKey) missingKeys.push("Supadata");
  if (!configStatus.hasAiKey) missingKeys.push("AI provider");

  showState("error");
  document.getElementById("errorTitle").textContent = "API Keys Missing";
  document.getElementById("errorMessage").textContent =
    `Add your ${missingKeys.join(" and ")} API key${missingKeys.length === 1 ? "" : "s"} in YouTube Digest Settings.`;
  document.getElementById("errorBtn").textContent = "Open Settings";
  errorAction = () => chrome.runtime.sendMessage({ action: "openOptions" });
}

// ============================================================
// TAB SWITCHING
// ============================================================

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });

  // Start/stop playback tracking based on which tab is active
  if (tabName === "transcript") {
    startPlaybackTracking();
  } else {
    stopPlaybackTracking();
  }

  // Lazy-load LLM analysis when user switches to Overview tab
  if (tabName === "overview" && !currentAnalysis && !isAnalysisLoading) {
    triggerAnalysis();
  }

  if (tabName === "vocabulary") {
    loadVocabulary();
  }
}

/**
 * Triggers the LLM analysis (lazy-loaded when user clicks Overview or Quotes tab).
 * This saves tokens by not running analysis until needed.
 */
async function triggerAnalysis() {
  if (!currentTranscriptTimestamped || isAnalysisLoading || currentAnalysis)
    return;

  isAnalysisLoading = true;

  // Show loading indicators in the Overview tab
  const chapterList = document.getElementById("chapterList");
  const quotesList = document.getElementById("quotesList");

  if (chapterList)
    chapterList.innerHTML =
      '<li class="chapter-item" style="color: var(--text-muted); border: none;">Loading chapters...</li>';
  if (quotesList)
    quotesList.innerHTML =
      '<div class="quote-item" style="color: var(--text-muted); border-left-color: var(--border);">Loading quotes...</div>';

  try {
    const analysisResult = await chrome.runtime.sendMessage({
      action: "analyzeTranscript",
      transcriptText: currentTranscriptTimestamped,
      videoTitle: currentVideoTitle,
      channelName: currentChannelName,
      videoDescription: currentVideoDescription,
      videoDuration: currentVideoDuration,
    });

    if (!analysisResult.success) {
      if (chapterList)
        chapterList.innerHTML = `<li class="chapter-item" style="color: var(--accent); border: none;">Analysis failed: ${escapeHtml(analysisResult.error || "Unknown error")}</li>`;
      isAnalysisLoading = false;
      return;
    }

    currentAnalysis = analysisResult.analysis;
    renderAnalysisResults(currentAnalysis);
    highlightMomentsOnPage(currentAnalysis.keyMoments);

    // Save to cache now that we have analysis
    await saveToCache(currentVideoId);
  } catch (error) {
    console.error("[YouTube Digest Panel] Analysis error:", error);
    if (chapterList)
      chapterList.innerHTML = `<li class="chapter-item" style="color: var(--accent); border: none;">Error: ${escapeHtml(error.message)}</li>`;
  }

  isAnalysisLoading = false;
}

// ============================================================
// TIMESTAMP / SEEK
// ============================================================

async function seekTo(seconds) {
  debugLog("[YouTube Digest Panel] seekTo called with:", seconds);
  if (seconds === undefined || seconds === null) {
    debugLog("[YouTube Digest Panel] seekTo aborted - no seconds value");
    return;
  }

  const payload = {
    action: "seekTo",
    seconds: Number(seconds),
  };

  try {
    // Try direct messaging to the stored YouTube tab first (fastest/reliable)
    if (youtubeTabId) {
      try {
        await chrome.tabs.sendMessage(youtubeTabId, payload);
        debugLog("[YouTube Digest Panel] seekTo direct success");
        return;
      } catch (directErr) {
        debugLog(
          "[YouTube Digest Panel] Direct seekTo failed, falling back to relay:",
          directErr.message,
        );
      }
    }

    // Fallback: route through background script
    const result = await chrome.runtime.sendMessage({
      action: "relayToContent",
      payload,
    });
    debugLog("[YouTube Digest Panel] seekTo relay result:", result);
  } catch (error) {
    console.error("[YouTube Digest Panel] seekTo error:", error);
  }
}

/**
 * Plays a saved note at its timestamp.
 * - If the note belongs to the video currently open, we seek the player in place.
 * - If it belongs to a DIFFERENT video (e.g. viewing "All Notes"), seeking the
 *   current player would jump to the wrong content, so we open that video in a
 *   new tab at the right timestamp instead.
 */
function playNote(note) {
  if (note.videoId && note.videoId === currentVideoId) {
    seekTo(note.timestampSeconds);
  } else {
    // note.timestampedUrl already includes the &t=<seconds>s anchor
    chrome.tabs.create({ url: note.timestampedUrl });
  }
}

async function highlightMomentsOnPage(moments) {
  if (!moments || !moments.length) return;

  try {
    // Route through background script for reliable message passing
    await chrome.runtime.sendMessage({
      action: "relayToContent",
      payload: {
        action: "highlightMoments",
        moments: moments,
        videoDuration: currentVideoDuration,
      },
    });
  } catch (error) {
    console.error("Highlight error:", error);
  }
}

// ============================================================
// UTILITY
// ============================================================

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

/**
 * Renders the small subset of inline formatting commonly present in subtitle
 * tracks and model translations. Everything is escaped first; only exact,
 * attribute-free allowlisted tags are restored as markup afterwards.
 */
function renderSubtitleInlineMarkup(text) {
  return escapeHtml(text).replace(
    /&lt;(\/?)(i|em|b|strong|u)&gt;|&lt;br(?:\s*\/)?&gt;/gi,
    (_match, closing, tagName) =>
      tagName ? `<${closing}${tagName.toLowerCase()}>` : "<br>",
  );
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Copy failed:", error);
    return false;
  }
}

async function copyToClipboardWithFeedback(text, buttonId) {
  const btn = document.getElementById(buttonId);
  const original = btn.textContent;

  const success = await copyToClipboard(text);
  if (success) {
    btn.textContent = "✓ Copied";
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  }
}

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(str) {
  return (str || "untitled")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50)
    .toLowerCase();
}

// ============================================================
// TEXT SELECTION — EXPLAIN FEATURE
// ============================================================

/**
 * Sets up text selection handling in the transcript.
 * When user selects text, shows Explain and Add word actions.
 */
function setupExplainFeature() {
  const transcriptList = document.getElementById("transcriptList");
  if (!transcriptList) return;

  // Remove existing tooltip if any
  const existingTooltip = document.getElementById("explainTooltip");
  if (existingTooltip) existingTooltip.remove();

  // Create the transcript selection actions.
  const tooltip = document.createElement("div");
  tooltip.id = "explainTooltip";
  tooltip.className = "explain-tooltip";
  tooltip.innerHTML = `
    <button class="explain-btn" type="button">💡 Explain</button>
    <button class="add-word-btn" type="button">＋ Add word</button>
  `;
  tooltip.style.display = "none";
  document.body.appendChild(tooltip);

  let selectedText = "";
  let selectedContext = "";
  let selectedSeconds = 0;

  // Interacting with Explain must preserve the transcript selection and stay
  // isolated from document/row click behavior.
  tooltip.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  tooltip.addEventListener("mouseup", (event) => {
    event.stopPropagation();
  });
  tooltip.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  // Listen for text selection
  document.addEventListener("mouseup", (e) => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    // Only show if selecting within transcript
    const isInTranscript = transcriptList.contains(selection.anchorNode);

    // Allow any selection length (removed 10+ char requirement)
    if (text.length > 0 && isInTranscript) {
      selectedText = text;
      const anchorElement =
        selection.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? selection.anchorNode
          : selection.anchorNode?.parentElement;
      const transcriptEntry = anchorElement?.closest?.(".transcript-entry");
      const contextElement =
        transcriptEntry?.querySelector(".transcript-original") ||
        transcriptEntry?.querySelector(".transcript-text") ||
        transcriptEntry?.querySelector(".transcript-copy");
      selectedContext = (contextElement?.textContent || text)
        .replace(/\s+/g, " ")
        .trim();
      selectedSeconds = Number(transcriptEntry?.dataset.seconds) || 0;

      // Position the tooltip near the selection
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      tooltip.style.display = "block";
      tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
    } else {
      tooltip.style.display = "none";
    }
  });

  // Hide tooltip when clicking elsewhere
  document.addEventListener("mousedown", (e) => {
    if (!tooltip.contains(e.target)) {
      tooltip.style.display = "none";
    }
  });

  // Handle explain button click
  tooltip
    .querySelector(".explain-btn")
    .addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectedText) return;

      tooltip.style.display = "none";
      await showExplanation(selectedText);
    });

  tooltip
    .querySelector(".add-word-btn")
    .addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectedText) return;
      tooltip.style.display = "none";
      showAddWordModal({
        word: selectedText,
        context: selectedContext,
        timestampSeconds: selectedSeconds,
      });
    });
}

function copyTextSynchronously(text) {
  const textarea = document.createElement("textarea");
  textarea.value = String(text || "");
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (_error) {
    copied = false;
  }
  textarea.remove();
  return copied;
}

function showAddWordModal(selection) {
  document.getElementById("addWordModal")?.remove();
  const initialWord = YTD_VOCABULARY.normalizeWord(selection.word);
  const modal = document.createElement("div");
  modal.id = "addWordModal";
  modal.className = "explain-modal-overlay";
  modal.innerHTML = `
    <form class="explain-modal vocabulary-modal" id="addWordForm">
      <div class="explain-modal-header">
        <div class="explain-modal-title">Add to vocabulary</div>
        <button class="explain-modal-close" id="closeAddWord" type="button">✕</button>
      </div>
      <div class="vocabulary-form-content">
        <label for="vocabularyWord">Word or phrase</label>
        <input id="vocabularyWord" maxlength="120" required />
        <label for="vocabularyMeaning">Meaning or translation <span>(optional)</span></label>
        <textarea id="vocabularyMeaning" rows="3" maxlength="1000" placeholder="Add a meaning now, or complete it later in Obsidian"></textarea>
        <label for="vocabularyContext">Sentence context</label>
        <textarea id="vocabularyContext" rows="4" maxlength="3000">${escapeHtml(selection.context)}</textarea>
        <label class="vocabulary-enrich-option">
          <input id="vocabularyEnrich" type="checkbox" checked />
          <span>Generate dictionary meanings, examples, and sentence analysis with DeepSeek</span>
        </label>
        <div class="vocabulary-source-preview">${escapeHtml(currentVideoTitle || "Untitled Video")} · ${escapeHtml(YTD_VOCABULARY.formatTimestamp(selection.timestampSeconds))}</div>
        <div class="vocabulary-form-status" id="addWordStatus" role="status" aria-live="polite"></div>
      </div>
      <div class="vocabulary-form-actions">
        <button class="note-action-btn" id="cancelAddWord" type="button">Cancel</button>
        <button class="explain-btn" type="submit">Save word</button>
      </div>
    </form>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#vocabularyWord").value = initialWord;

  const close = () => modal.remove();
  modal.querySelector("#closeAddWord").addEventListener("click", close);
  modal.querySelector("#cancelAddWord").addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  modal.querySelector("#vocabularyWord").focus();
  modal
    .querySelector("#addWordForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = modal.querySelector("#addWordStatus");
      const submitButton = modal.querySelector('button[type="submit"]');
      status.textContent = "Saving…";
      submitButton.disabled = true;
      try {
        const entry = {
          word: modal.querySelector("#vocabularyWord").value,
          meaning: modal.querySelector("#vocabularyMeaning").value,
          context: modal.querySelector("#vocabularyContext").value,
          videoId: currentVideoId,
          videoTitle: currentVideoTitle,
          channelName: currentChannelName,
          timestampSeconds: selection.timestampSeconds,
        };
        const vocabularyResult = await chrome.runtime.sendMessage({
          action: "getVocabulary",
        });
        const normalizedWord = YTD_VOCABULARY.normalizeWord(
          entry.word,
        ).toLocaleLowerCase("en-US");
        const existingEntry = vocabularyResult?.success
          ? vocabularyResult.entries.find(
              (candidate) => candidate.normalizedWord === normalizedWord,
            )
          : null;
        const occurrenceAlreadyExists = existingEntry?.occurrences?.some(
          (occurrence) =>
            YTD_VOCABULARY.occurrenceKey(occurrence) ===
            YTD_VOCABULARY.occurrenceKey(entry),
        );
        if (
          modal.querySelector("#vocabularyEnrich").checked &&
          !occurrenceAlreadyExists
        ) {
          status.textContent = existingEntry?.dictionary
            ? "Existing word found. Analyzing only this new sentence…"
            : "Generating dictionary details…";
          const enrichment = await chrome.runtime.sendMessage({
            action:
              existingEntry?.dictionary
                ? "analyzeVocabularyContext"
                : "enrichVocabulary",
            entry,
          });
          if (enrichment?.success) {
            if (!existingEntry?.dictionary) {
              entry.dictionary = enrichment.dictionary;
            }
            entry.contextAnalysis = enrichment.contextAnalysis;
          } else {
            entry.enrichmentError =
              enrichment?.error || "Dictionary details could not be generated.";
            status.textContent = "AI details failed. Saving the word and context…";
          }
        }
        const result = await chrome.runtime.sendMessage({
          action: "saveVocabulary",
          entry,
        });
        if (!result?.success) {
          throw new Error(result?.error || "Could not save word.");
        }
        close();
        switchTab("vocabulary");
        await loadVocabulary();
        const vocabularyStatus = document.getElementById("vocabularyStatus");
        if (vocabularyStatus) {
          vocabularyStatus.textContent = result.merged
            ? result.occurrenceAdded
              ? `Added a new video context to “${result.entry.word}”.`
              : `“${result.entry.word}” and this video context were already saved.`
            : `Saved “${result.entry.word}” as a new vocabulary word.`;
        }
      } catch (error) {
        status.textContent = error.message || "Could not save word.";
        submitButton.disabled = false;
      }
    });
}

/**
 * Shows the explanation modal and fetches it from the configured AI provider.
 */
async function showExplanation(selectedText) {
  // Create modal
  const modal = document.createElement("div");
  modal.id = "explainModal";
  modal.className = "explain-modal-overlay";
  modal.innerHTML = `
    <div class="explain-modal">
      <div class="explain-modal-header">
        <div class="explain-modal-title">Explain</div>
        <button class="explain-modal-close" id="closeExplain">✕</button>
      </div>
      <div class="explain-selected-text">"${escapeHtml(selectedText.substring(0, 200))}${selectedText.length > 200 ? "..." : ""}"</div>
      <div class="explain-modal-content" id="explanationContent">
        <div class="explain-loading">
          <div class="loading-bar"></div>
          <span>Analyzing...</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  document
    .getElementById("closeExplain")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  // Get some context around the selection from the transcript
  const transcriptContext = getTranscriptContext(selectedText);

  // Fetch explanation
  try {
    const result = await chrome.runtime.sendMessage({
      action: "explainSelection",
      selectedText: selectedText,
      transcriptContext: transcriptContext,
      videoTitle: currentVideoTitle,
    });

    const contentDiv = document.getElementById("explanationContent");
    if (result.success) {
      contentDiv.innerHTML = `<div class="explain-text">${escapeHtml(result.explanation).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</div>`;
    } else {
      contentDiv.innerHTML = `<div class="explain-error">Failed to get explanation: ${escapeHtml(result.error)}</div>`;
    }
  } catch (error) {
    const contentDiv = document.getElementById("explanationContent");
    contentDiv.innerHTML = `<div class="explain-error">Error: ${escapeHtml(error.message)}</div>`;
  }
}

/**
 * Gets surrounding context from the transcript for the selected text.
 */
function getTranscriptContext(selectedText) {
  const fullText = currentTranscriptText || "";
  const index = fullText.indexOf(selectedText);

  if (index === -1) return "";

  // Get 200 chars before and after
  const start = Math.max(0, index - 200);
  const end = Math.min(fullText.length, index + selectedText.length + 200);

  return fullText.substring(start, end);
}

// ============================================================
// CACHING
// ============================================================

/**
 * Saves the current digest results to persistent local storage.
 * Results survive browser restarts — reopening the same video loads from cache
 * without consuming API tokens or Supadata calls.
 * Cache expires after 30 days. Oldest entries evicted when > 20 videos cached.
 */
async function saveToCache(videoId) {
  if (!videoId || !currentTranscript) return;

  try {
    // Persist semantic-segment translations for this video.
    const paragraphCacheForVideo = {};
    for (const [key, value] of transcriptParagraphCache.entries()) {
      if (key.startsWith(`${videoId}:`)) {
        paragraphCacheForVideo[key] = value;
      }
    }

    const cacheData = {
      analysis: currentAnalysis, // May be null if not yet analyzed
      transcript: currentTranscript,
      transcriptText: currentTranscriptText,
      transcriptTimestamped: currentTranscriptTimestamped,
      transcriptLanguage: currentTranscriptLanguage,
      videoTitle: currentVideoTitle,
      channelName: currentChannelName,
      paragraphCache: paragraphCacheForVideo,
      timestamp: Date.now(),
    };

    await chrome.storage.local.set({ [`digest_${videoId}`]: cacheData });
    debugLog(
      "Saved to cache:",
      videoId,
      currentAnalysis ? "(with analysis)" : "(transcript only)",
    );

    // Evict old entries if we have more than 20 videos cached
    await evictOldCacheEntries(20);
  } catch (error) {
    console.error("Cache save error:", error);
  }
}

/**
 * Keeps the cache from growing unbounded.
 * Removes the oldest entries when we exceed maxEntries videos.
 *
 * @param {number} maxEntries - Maximum number of cached videos to keep
 */
async function evictOldCacheEntries(maxEntries) {
  try {
    const allData = await chrome.storage.local.get(null);
    let digestKeys = Object.keys(allData).filter((k) =>
      k.startsWith("digest_"),
    );
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const expired = digestKeys.filter((key) => {
      const timestamp = Number(allData[key]?.timestamp) || 0;
      return Date.now() - timestamp > THIRTY_DAYS;
    });
    if (expired.length) {
      await chrome.storage.local.remove(expired);
      const expiredSet = new Set(expired);
      digestKeys = digestKeys.filter((key) => !expiredSet.has(key));
    }

    if (digestKeys.length <= maxEntries) return;

    // Sort by timestamp (oldest first) and remove excess
    const sorted = digestKeys
      .map((k) => ({ key: k, ts: allData[k]?.timestamp || 0 }))
      .sort((a, b) => a.ts - b.ts);

    const toRemove = sorted
      .slice(0, sorted.length - maxEntries)
      .map((e) => e.key);
    if (toRemove.length > 0) {
      await chrome.storage.local.remove(toRemove);
      debugLog(`[YouTube Digest] Evicted ${toRemove.length} old cache entries`);
    }
  } catch (error) {
    console.error("Cache eviction error:", error);
  }
}

/**
 * Loads digest results from persistent local storage.
 * Returns null if not cached or expired (30-day expiry).
 */
async function loadFromCache(videoId) {
  if (!videoId) return null;

  try {
    const result = await chrome.storage.local.get(`digest_${videoId}`);
    const cached = result[`digest_${videoId}`];

    if (!cached) return null;

    // Cache expires after 30 days
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - cached.timestamp > THIRTY_DAYS) {
      await chrome.storage.local.remove(`digest_${videoId}`);
      return null;
    }

    return cached;
  } catch (error) {
    console.error("Cache load error:", error);
    return null;
  }
}

/**
 * Updates the cache after enhance or translation operations.
 */
async function updateCache() {
  if (currentVideoId) {
    await saveToCache(currentVideoId);
  }
}

// ============================================================
// VOCABULARY
// ============================================================

async function loadVocabulary() {
  const status = document.getElementById("vocabularyStatus");
  try {
    const [result, stored] = await Promise.all([
      chrome.runtime.sendMessage({ action: "getVocabulary" }),
      chrome.storage.local.get(YTD_VOCABULARY.OBSIDIAN_SETTINGS_KEY),
    ]);
    if (!result?.success) {
      throw new Error(result?.error || "Could not load vocabulary.");
    }
    renderVocabulary(
      result.entries || [],
      YTD_VOCABULARY.normalizeObsidianSettings(
        stored[YTD_VOCABULARY.OBSIDIAN_SETTINGS_KEY],
      ),
    );
    if (status) status.textContent = "";
  } catch (error) {
    if (status) {
      status.textContent = error.message || "Could not load vocabulary.";
    }
  }
}

function renderVocabulary(entries, obsidianSettings) {
  const list = document.getElementById("vocabularyList");
  const intro = document.getElementById("vocabularyIntro");
  const stats = document.getElementById("vocabularyStats");
  if (!list) return;

  list.innerHTML = "";
  const uniqueCount = new Set(
    entries.map((entry) =>
      String(entry.normalizedWord || entry.word).toLocaleLowerCase("en-US"),
    ),
  ).size;
  const occurrenceCount = entries.reduce(
    (total, entry) =>
      total + YTD_VOCABULARY.createEntry(entry).occurrences.length,
    0,
  );
  const syncedCount = entries.filter((entry) => entry.obsidianSyncedAt).length;
  if (stats) {
    stats.textContent = `${uniqueCount} words · ${occurrenceCount} video contexts · ${syncedCount} sent to Obsidian`;
  }

  if (!entries.length) {
    if (intro) intro.style.display = "block";
    return;
  }
  if (intro) intro.style.display = "none";

  entries.forEach((storedEntry) => {
    const entry = YTD_VOCABULARY.createEntry(storedEntry);
    const dictionary = entry.dictionary;
    const analysis = entry.contextAnalysis;
    const videoCount = new Set(
      entry.occurrences
        .map((occurrence) => occurrence.videoId)
        .filter(Boolean),
    ).size;
    const contextsHtml = entry.occurrences.length
      ? `
        <details class="vocabulary-dictionary-preview vocabulary-contexts-preview">
          <summary>Video contexts · ${entry.occurrences.length} ${entry.occurrences.length === 1 ? "sentence" : "sentences"} · ${videoCount} ${videoCount === 1 ? "video" : "videos"}</summary>
          <div class="vocabulary-dictionary-body">
            ${[...entry.occurrences]
              .sort((a, b) => b.createdAt - a.createdAt)
              .map(
                (occurrence, index) => `
                  <div class="vocabulary-sense vocabulary-saved-context">
                    <div class="vocabulary-sense-title">${index + 1}. ${escapeHtml(occurrence.videoTitle)} · ${escapeHtml(occurrence.timestamp)}</div>
                    <div>“${escapeHtml(occurrence.context || "No context saved.")}”</div>
                    ${occurrence.contextAnalysis?.sentenceZh ? `<div class="vocabulary-sense-zh">${escapeHtml(occurrence.contextAnalysis.sentenceZh)}</div>` : ""}
                  </div>
                `,
              )
              .join("")}
          </div>
        </details>
      `
      : "";
    const dictionaryHtml = dictionary
      ? `
        <details class="vocabulary-dictionary-preview">
          <summary>Dictionary · ${dictionary.senses.length} ${dictionary.senses.length === 1 ? "sense" : "senses"}${dictionary.phonetic ? ` · ${escapeHtml(dictionary.phonetic)}` : ""}</summary>
          <div class="vocabulary-dictionary-body">
            ${dictionary.senses
              .map(
                (sense, index) => `
                  <div class="vocabulary-sense">
                    <div class="vocabulary-sense-title">${index + 1}. ${escapeHtml(sense.partOfSpeech || "Meaning")}</div>
                    ${sense.definitionEn ? `<div>${escapeHtml(sense.definitionEn)}</div>` : ""}
                    ${sense.definitionZh ? `<div class="vocabulary-sense-zh">${escapeHtml(sense.definitionZh)}</div>` : ""}
                    ${sense.examples
                      .map(
                        (example) => `
                          <div class="vocabulary-example">${escapeHtml(example.sentence)}${example.translationZh ? `<span>${escapeHtml(example.translationZh)}</span>` : ""}</div>
                        `,
                      )
                      .join("")}
                  </div>
                `,
              )
              .join("")}
          </div>
        </details>
      `
      : `<div class="vocabulary-enrichment-missing">Dictionary details have not been generated yet.</div>`;
    const item = document.createElement("article");
    item.className = "vocabulary-item";
    item.innerHTML = `
      <div class="vocabulary-item-header">
        <div>
          <div class="vocabulary-word">${escapeHtml(entry.word)}</div>
          <div class="vocabulary-meta">${entry.occurrences.length} contexts · ${videoCount} videos · latest: ${escapeHtml(entry.videoTitle)} · ${escapeHtml(entry.timestamp)}</div>
        </div>
        <button class="note-delete vocabulary-delete" type="button" title="Delete word and all video contexts">✕</button>
      </div>
      ${entry.meaning ? `<div class="vocabulary-meaning">${escapeHtml(entry.meaning)}</div>` : ""}
      <div class="vocabulary-context">“${escapeHtml(entry.context || "No context saved.")}”</div>
      ${analysis?.sentenceZh ? `<div class="vocabulary-context-translation">${escapeHtml(analysis.sentenceZh)}</div>` : ""}
      ${analysis?.meaningInContextZh ? `<div class="vocabulary-context-meaning"><strong>In this sentence:</strong> ${escapeHtml(analysis.meaningInContextZh)}</div>` : ""}
      ${contextsHtml}
      ${dictionaryHtml}
      ${entry.enrichmentError ? `<div class="vocabulary-enrichment-error">${escapeHtml(entry.enrichmentError)}</div>` : ""}
      <div class="note-actions vocabulary-item-actions">
        <button class="note-action-btn vocabulary-play" type="button">▶ Play</button>
        <button class="note-action-btn vocabulary-copy" type="button">⧉ Copy Markdown</button>
        <button class="note-action-btn vocabulary-enrich" type="button">${dictionary ? "↻ Refresh details" : "✨ Generate details"}</button>
        <button class="note-action-btn vocabulary-obsidian" type="button">${entry.obsidianSyncedAt ? "↻ Send again" : "◆ Send to Obsidian"}</button>
      </div>
    `;

    item
      .querySelector(".vocabulary-delete")
      .addEventListener("click", async () => {
        await chrome.runtime.sendMessage({
          action: "deleteVocabulary",
          entryId: entry.id,
        });
        await loadVocabulary();
      });
    item.querySelector(".vocabulary-play").addEventListener("click", () => {
      playVocabularyEntry(entry);
    });
    item
      .querySelector(".vocabulary-copy")
      .addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const copied = await copyToClipboard(
          YTD_VOCABULARY.buildMarkdown(entry),
        );
        button.textContent = copied ? "✓ Copied" : "Copy failed";
        setTimeout(() => {
          button.textContent = "⧉ Copy Markdown";
        }, 1800);
      });
    item.querySelector(".vocabulary-obsidian").addEventListener("click", (event) => {
      sendVocabularyToObsidian(
        entry,
        obsidianSettings,
        event.currentTarget,
      );
    });
    item
      .querySelector(".vocabulary-enrich")
      .addEventListener("click", async (event) => {
        await enrichVocabularyEntry(entry, event.currentTarget);
      });
    list.appendChild(item);
  });
}

async function enrichVocabularyEntry(entry, button) {
  const status = document.getElementById("vocabularyStatus");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Generating…";
  if (status) status.textContent = `Generating dictionary details for “${entry.word}”…`;
  try {
    const enrichment = await chrome.runtime.sendMessage({
      action: "enrichVocabulary",
      entry,
    });
    if (!enrichment?.success) {
      throw new Error(
        enrichment?.error || "Could not generate dictionary details.",
      );
    }
    const updated = await chrome.runtime.sendMessage({
      action: "updateVocabularyEnrichment",
      entryId: entry.id,
      enrichment,
    });
    if (!updated?.success) {
      throw new Error(updated?.error || "Could not update the saved word.");
    }
    await loadVocabulary();
    if (status) status.textContent = "Dictionary details generated.";
  } catch (error) {
    button.disabled = false;
    button.textContent = originalLabel;
    if (status) {
      status.textContent = error.message || "Could not generate dictionary details.";
    }
  }
}

function playVocabularyEntry(entry) {
  if (entry.videoId && entry.videoId === currentVideoId) {
    seekTo(entry.timestampSeconds);
  } else if (entry.timestampedUrl) {
    chrome.tabs.create({ url: entry.timestampedUrl });
  }
}

async function sendVocabularyToObsidian(entry, settings, button) {
  const status = document.getElementById("vocabularyStatus");
  try {
    if (!settings.vault) {
      if (status) {
        status.innerHTML =
          'Add your Obsidian vault name in <button class="inline-settings-link" type="button">Settings</button> first.';
        status
          .querySelector(".inline-settings-link")
          ?.addEventListener("click", () =>
            chrome.runtime.sendMessage({ action: "openOptions" }),
          );
      }
      return;
    }

    const markdown = YTD_VOCABULARY.buildMarkdown(entry);
    let copied = false;
    try {
      await navigator.clipboard.writeText(markdown);
      copied = true;
    } catch (_error) {
      copied = copyTextSynchronously(markdown);
    }
    const uri = YTD_VOCABULARY.buildObsidianUri(entry, settings, {
      useClipboard: copied,
    });
    button.disabled = true;
    button.textContent = "Opening Obsidian…";

    // A side panel is an extension page, so use the Tabs API to dispatch the
    // custom protocol as a top-level navigation instead of navigating the
    // embedded side-panel document.
    await chrome.tabs.create({ url: uri, active: true });
    await chrome.runtime.sendMessage({
      action: "markVocabularySynced",
      entryId: entry.id,
    });
    if (status) {
      status.textContent = copied
        ? "Sent to Obsidian. Allow Chrome to open Obsidian if prompted."
        : "Sent using an inline note. Allow Chrome to open Obsidian if prompted.";
    }
    await loadVocabulary();
  } catch (error) {
    if (status) {
      status.textContent = `Could not open Obsidian: ${error.message || "Chrome rejected the URI."}`;
    }
    button.disabled = false;
    button.textContent = "◆ Send to Obsidian";
  }
}

async function exportVocabularyMarkdown() {
  const status = document.getElementById("vocabularyStatus");
  try {
    const result = await chrome.runtime.sendMessage({ action: "getVocabulary" });
    if (!result?.success) {
      throw new Error(result?.error || "Could not load vocabulary.");
    }
    if (!result.entries?.length) {
      if (status) status.textContent = "Save at least one word before exporting.";
      return;
    }
    const markdown = YTD_VOCABULARY.buildCollectionMarkdown(result.entries);
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(markdown, `youtube-digest-vocabulary-${date}.md`);
    if (status) status.textContent = "Vocabulary Markdown exported.";
  } catch (error) {
    if (status) {
      status.textContent = error.message || "Could not export vocabulary.";
    }
  }
}

// ============================================================
// NOTES
// ============================================================

/**
 * Loads and renders notes from storage.
 * @param {string|null} videoId - Filter by video ID, or null for all notes
 */
async function loadNotes(videoId) {
  try {
    const result = await chrome.runtime.sendMessage({
      action: "getNotes",
      videoId: videoId,
    });

    if (result.success) {
      renderNotes(result.notes, videoId);
    }
  } catch (error) {
    console.error("[YouTube Digest Panel] Load notes error:", error);
  }
}

/**
 * Renders the notes list in the Notes tab.
 */
function renderNotes(notes, filteredVideoId) {
  const notesList = document.getElementById("notesList");
  const notesIntro = document.getElementById("notesIntro");

  if (!notesList) return;

  notesList.innerHTML = "";

  if (!notes || notes.length === 0) {
    notesIntro.style.display = "block";
    notesIntro.textContent = filteredVideoId
      ? "No notes for this video yet. Hover over the video and click 📝 Note to save."
      : "No notes saved yet. Hover over a video and click 📝 Note to save.";
    return;
  }

  notesIntro.style.display = "none";

  notes.forEach((note) => {
    const noteEl = document.createElement("div");
    noteEl.className = "note-item";
    noteEl.innerHTML = `
      <div class="note-header">
        <span class="note-timestamp" data-url="${escapeHtml(note.timestampedUrl)}" data-seconds="${Number(note.timestampSeconds) || 0}">${escapeHtml(note.timestamp)}</span>
        ${!filteredVideoId ? `<span class="note-video-title">${escapeHtml(note.videoTitle)}</span>` : ""}
        <button class="note-delete" data-id="${escapeHtml(note.id)}" title="Delete note">✕</button>
      </div>
      <div class="note-text">"${escapeHtml(note.text)}"</div>
      <div class="note-actions">
        <button class="note-action-btn note-copy-text">⧉ Copy text</button>
        <button class="note-action-btn note-copy-link" data-url="${escapeHtml(note.timestampedUrl)}">🔗 Copy timestamp</button>
        <button class="note-action-btn note-play" data-seconds="${Number(note.timestampSeconds) || 0}">▶ Play</button>
      </div>
    `;

    // Timestamp click - play from this point (in this tab or a new one)
    noteEl.querySelector(".note-timestamp").addEventListener("click", () => {
      playNote(note);
    });

    // Delete button
    noteEl
      .querySelector(".note-delete")
      .addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteNote(note.id);
        loadNotes(filteredVideoId);
      });

    // Copy text button — copies just the note's text
    noteEl
      .querySelector(".note-copy-text")
      .addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(note.text);
          const btn = noteEl.querySelector(".note-copy-text");
          btn.textContent = "✓ Copied!";
          setTimeout(() => {
            btn.textContent = "⧉ Copy text";
          }, 2000);
        } catch (err) {
          console.error("Copy failed:", err);
        }
      });

    // Copy timestamp button — copies the timestamped YouTube link
    noteEl
      .querySelector(".note-copy-link")
      .addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(note.timestampedUrl);
          const btn = noteEl.querySelector(".note-copy-link");
          btn.textContent = "✓ Copied!";
          setTimeout(() => {
            btn.textContent = "🔗 Copy timestamp";
          }, 2000);
        } catch (err) {
          console.error("Copy failed:", err);
        }
      });

    // Play button (in this tab if it's the current video, else a new tab)
    noteEl.querySelector(".note-play").addEventListener("click", () => {
      playNote(note);
    });

    notesList.appendChild(noteEl);
  });
}

/**
 * Deletes a note by ID.
 */
async function deleteNote(noteId) {
  try {
    await chrome.runtime.sendMessage({
      action: "deleteNote",
      noteId: noteId,
    });
  } catch (error) {
    console.error("[YouTube Digest Panel] Delete note error:", error);
  }
}

// ============================================================
// AUTO-SCROLL — Follow video playback in transcript
// ============================================================
// While a video plays, the transcript automatically scrolls to show which
// 30-second chunk is currently being spoken. If the user manually scrolls
// (e.g., to read ahead), auto-scroll pauses and a "Follow playback" button
// appears so they can resume it. Highlight always stays active regardless.

/**
 * Starts polling the video's current time and highlighting/scrolling
 * to the matching transcript entry.
 */
function startPlaybackTracking() {
  if (!currentTranscript || !currentTranscript.length) return;

  // Don't restart if already tracking (preserves user's auto-scroll state)
  if (autoScrollInterval) return;

  autoScrollEnabled = true;
  document.getElementById("followPlaybackBtn").style.display = "none";

  // Poll video time every 500ms
  autoScrollInterval = setInterval(() => playbackTrackingTick(), 500);

  // Listen for manual scrolls on the content area
  const contentArea = document.getElementById("contentArea");
  contentArea.removeEventListener("scroll", onContentAreaScroll);
  contentArea.addEventListener("scroll", onContentAreaScroll);
}

/**
 * Stops playback tracking entirely. Called when leaving transcript tab,
 * starting a new digest, or leaving results state.
 */
function stopPlaybackTracking() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
  autoScrollEnabled = true; // Reset for next time
  lastAutoScrollTime = 0;
  document.getElementById("followPlaybackBtn").style.display = "none";

  // Remove active highlights
  document
    .querySelectorAll(".transcript-entry.active-playback")
    .forEach((el) => {
      el.classList.remove("active-playback");
    });
}

/**
 * One tick of the playback tracker. Gets current video time from the
 * YouTube tab and highlights + scrolls to the matching transcript entry.
 */
async function playbackTrackingTick() {
  try {
    const result = await chrome.runtime.sendMessage({
      action: "relayToContent",
      payload: { action: "getCurrentTime" },
    });

    if (!result.success || !result.response) return;

    const currentTime = result.response.currentTime || 0;
    highlightActiveEntry(currentTime);
  } catch (error) {
    // Silently ignore — YouTube tab might be closed or navigated away
  }
}

/**
 * Scrolls the transcript to the entry currently being spoken (the one
 * carrying the active-playback highlight). Returns false if nothing is
 * highlighted yet. Stamps lastAutoScrollTime BEFORE scrolling so the scroll
 * events from our own smooth animation aren't mistaken for the user
 * scrolling away (which would re-disable auto-scroll immediately).
 */
function scrollToActiveEntry() {
  const activeEntry = document.querySelector(
    "#transcriptList .transcript-entry.active-playback",
  );
  if (!activeEntry) return false;

  lastAutoScrollTime = Date.now();
  activeEntry.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

/**
 * Finds the transcript entry matching the current playback time,
 * highlights it, and scrolls to it (if auto-scroll is enabled).
 *
 * @param {number} currentSeconds - Current video playback time in seconds
 */
function highlightActiveEntry(currentSeconds) {
  const transcriptList = document.getElementById("transcriptList");
  if (!transcriptList) return;

  const entries = transcriptList.querySelectorAll(".transcript-entry");
  if (entries.length === 0) return;

  // Find the entry whose time range contains the current playback time
  let activeEntry = null;
  entries.forEach((entry, index) => {
    const entrySeconds = parseInt(entry.dataset.seconds);
    const nextEntry = entries[index + 1];
    const nextSeconds = nextEntry
      ? parseInt(nextEntry.dataset.seconds)
      : Infinity;

    if (currentSeconds >= entrySeconds && currentSeconds < nextSeconds) {
      activeEntry = entry;
    }
  });

  if (!activeEntry) return;

  // Skip if this entry is already highlighted (no DOM thrashing)
  if (activeEntry.classList.contains("active-playback")) return;

  // Remove old highlight, add new one
  entries.forEach((e) => e.classList.remove("active-playback"));
  activeEntry.classList.add("active-playback");

  // Only scroll if auto-scroll is enabled
  if (autoScrollEnabled) {
    lastAutoScrollTime = Date.now();
    activeEntry.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/**
 * Scroll event handler for the content area.
 * Detects manual scrolling and disables auto-scroll so the user
 * can read at their own pace without being yanked back.
 */
function onContentAreaScroll() {
  // Ignore scroll events within 1 second of a programmatic scroll
  // (smooth scroll animations can last longer than a simple boolean flag)
  if (Date.now() - lastAutoScrollTime < 1000) return;

  // User scrolled manually — disable auto-scroll and show the button
  if (autoScrollEnabled && autoScrollInterval) {
    autoScrollEnabled = false;
    document.getElementById("followPlaybackBtn").style.display = "block";
  }
}

// ============================================================
// TRANSCRIPT MODE UI — Original / Chinese / aligned bilingual
// ============================================================

function updatePlayerSubtitlesButton({ completed = 0, total = 0, error = "" } = {}) {
  const button = document.getElementById("playerSubtitlesBtn");
  if (!button) return;

  const translating =
    playerSubtitlesEnabled && total > 0 && completed >= 0 && completed < total;
  button.classList.toggle("active", playerSubtitlesEnabled);
  button.classList.toggle("is-translating", translating);
  button.setAttribute("aria-pressed", String(playerSubtitlesEnabled));

  if (!playerSubtitlesEnabled) {
    button.textContent = "播放器双语";
    button.title = "在 YouTube 播放器底部显示双语字幕";
  } else if (error) {
    button.textContent = "播放器双语 · 有错误";
    button.title = `${error} 关闭后重新开启可重试。`;
  } else if (translating) {
    button.textContent = `播放器双语 · ${completed}/${total}`;
    button.title = "播放器字幕已开启，正在生成中文译文";
  } else if (!currentTranscript) {
    button.textContent = "播放器双语 · 等待字幕";
    button.title = "获取视频字幕后会自动显示";
  } else {
    button.textContent = "播放器双语 · 已开启";
    button.title = "点击关闭播放器底部的双语字幕";
  }
}

async function loadPlayerSubtitlesSetting() {
  try {
    const stored = await chrome.storage.local.get(PLAYER_SUBTITLES_SETTING_KEY);
    playerSubtitlesEnabled = stored[PLAYER_SUBTITLES_SETTING_KEY] === true;
  } catch (error) {
    console.warn("Could not load player subtitle setting:", error);
    playerSubtitlesEnabled = false;
  }
  updatePlayerSubtitlesButton();
}

async function sendPlayerSubtitleMessage(payload) {
  if (youtubeTabId !== null && typeof chrome.tabs.sendMessage === "function") {
    try {
      const response = await chrome.tabs.sendMessage(youtubeTabId, payload);
      if (response?.success === false) {
        throw new Error(response.error || "The YouTube player rejected the request.");
      }
      return response;
    } catch (error) {
      debugLog("Direct player subtitle message failed; using relay:", error);
    }
  }

  const relayed = await chrome.runtime.sendMessage({
    action: "relayToContent",
    payload,
  });
  if (!relayed?.success) {
    throw new Error(relayed?.error || "Could not reach the YouTube player.");
  }
  if (relayed.response?.success === false) {
    throw new Error(
      relayed.response.error || "The YouTube player rejected the request.",
    );
  }
  return relayed.response;
}

function getSharedTranslationSegments() {
  const grouped = groupTranscriptEntries(
    currentTranscript || [],
    SHARED_TRANSLATION_SEGMENT_LIMITS,
  );

  return grouped.map((segment, index) => {
    const nextStart = Number(grouped[index + 1]?.start);
    const naturalEnd = Number.isFinite(nextStart)
      ? nextStart
      : segment.start + 8;
    return {
      ...segment,
      end: Math.max(segment.start + 1, Math.min(naturalEnd, segment.start + 12)),
    };
  });
}

function sharedTranslationCacheKey(segment, videoId = currentVideoId) {
  return `${videoId}:zh:shared:${segment.id}`;
}

function getSharedTranslation(segment, videoId = currentVideoId) {
  const sharedKey = sharedTranslationCacheKey(segment, videoId);
  const shared = transcriptParagraphCache.get(sharedKey);
  if (shared) return shared;

  // Migrate translations created by v1.1.6. Its player cues use the same
  // segmentation, so they are safe to reuse without another API request.
  const legacyPlayerKey = `${videoId}:zh:player:${segment.id}`;
  const legacyPlayerTranslation = transcriptParagraphCache.get(legacyPlayerKey);
  if (legacyPlayerTranslation) {
    transcriptParagraphCache.set(sharedKey, legacyPlayerTranslation);
    return legacyPlayerTranslation;
  }
  return "";
}

function hasSharedTranslation(segment, videoId = currentVideoId) {
  return !!getSharedTranslation(segment, videoId);
}

function setSharedTranslation(segment, translatedText, videoId = currentVideoId) {
  const text = String(translatedText || "").trim();
  if (text) {
    transcriptParagraphCache.set(sharedTranslationCacheKey(segment, videoId), text);
  }
  return text;
}

async function requestSharedTranslationBatch(
  sourceBatch,
  videoId = currentVideoId,
) {
  const pendingRequests = new Set();
  const newSegments = [];

  sourceBatch.forEach((segment) => {
    if (hasSharedTranslation(segment, videoId)) return;
    const key = sharedTranslationCacheKey(segment, videoId);
    const existingRequest = sharedTranslationInFlight.get(key);
    if (existingRequest) pendingRequests.add(existingRequest);
    else newSegments.push(segment);
  });

  if (newSegments.length) {
    const requestPromise = (async () => {
      const result = await sendTranslationMessage({
        action: "translateContent",
        content: {
          segments: newSegments.map(({ id, text }) => ({ id, text })),
        },
        contentType: "transcriptBatch",
        targetLanguage: "zh",
        videoTitle: currentVideoTitle,
      });
      if (!result?.success) {
        throw new Error(result?.error || "Subtitle translation failed.");
      }

      const aligned = alignTranslatedSegmentBatch(
        newSegments,
        result.translatedContent?.segments,
      );
      aligned.forEach((item, index) => {
        setSharedTranslation(newSegments[index], item.text, videoId);
      });
      return aligned;
    })();

    newSegments.forEach((segment) => {
      sharedTranslationInFlight.set(
        sharedTranslationCacheKey(segment, videoId),
        requestPromise,
      );
    });
    const clearRequest = () => {
      newSegments.forEach((segment) => {
        const key = sharedTranslationCacheKey(segment, videoId);
        if (sharedTranslationInFlight.get(key) === requestPromise) {
          sharedTranslationInFlight.delete(key);
        }
      });
    };
    requestPromise.then(clearRequest, clearRequest);
    pendingRequests.add(requestPromise);
  }

  if (pendingRequests.size) {
    await Promise.all(pendingRequests);
  }

  return sourceBatch.map((segment) => {
    const text = getSharedTranslation(segment, videoId);
    return {
      id: segment.id,
      text,
      error: text ? "" : "Translation unavailable.",
    };
  });
}

function serializePlayerSubtitleSegments(segments) {
  return segments.map((segment) => ({
    id: segment.id,
    start: segment.start,
    end: segment.end,
    text: segment.text,
    translation: getSharedTranslation(segment),
  }));
}

async function togglePlayerSubtitles() {
  playerSubtitlesEnabled = !playerSubtitlesEnabled;
  playerSubtitleGeneration += 1;
  updatePlayerSubtitlesButton();
  await chrome.storage.local.set({
    [PLAYER_SUBTITLES_SETTING_KEY]: playerSubtitlesEnabled,
  });

  if (!playerSubtitlesEnabled) {
    try {
      await sendPlayerSubtitleMessage({
        action: "configurePlayerSubtitles",
        enabled: false,
      });
    } catch (error) {
      debugLog("Player subtitle overlay was already unavailable:", error);
    }
    return;
  }

  await syncPlayerSubtitleOverlay();
}

async function syncPlayerSubtitleOverlay() {
  const generation = ++playerSubtitleGeneration;
  const videoId = currentVideoId;
  if (!playerSubtitlesEnabled || !videoId || !currentTranscript) {
    updatePlayerSubtitlesButton();
    return;
  }

  const segments = getSharedTranslationSegments();
  if (!segments.length) {
    updatePlayerSubtitlesButton({ error: "This video has no usable subtitles." });
    return;
  }

  try {
    await sendPlayerSubtitleMessage({
      action: "configurePlayerSubtitles",
      enabled: true,
      videoId,
      segments: serializePlayerSubtitleSegments(segments),
    });
    if (
      generation !== playerSubtitleGeneration ||
      videoId !== currentVideoId ||
      !playerSubtitlesEnabled
    ) {
      return;
    }
    await translatePlayerSubtitleSegments(segments, generation, videoId);
  } catch (error) {
    if (generation === playerSubtitleGeneration && playerSubtitlesEnabled) {
      updatePlayerSubtitlesButton({
        error: error?.message || "Could not show player subtitles.",
      });
    }
  }
}

async function translatePlayerSubtitleSegments(segments, generation, videoId) {
  const missingIndices = segments
    .map((segment, index) =>
      hasSharedTranslation(segment, videoId) ? -1 : index,
    )
    .filter((index) => index >= 0);
  const total = segments.length;
  let completed = total - missingIndices.length;
  updatePlayerSubtitlesButton({ completed, total });
  if (!missingIndices.length) {
    // Usually these values were included in the configure message. Sending
    // them once more closes a narrow race where Full Transcript populated the
    // shared cache while the player overlay was being attached.
    await sendPlayerSubtitleMessage({
      action: "updatePlayerSubtitleTranslations",
      videoId,
      segments: segments.map((segment) => ({
        id: segment.id,
        text: getSharedTranslation(segment, videoId),
        error: "",
      })),
    });
    return;
  }

  // Start near the currently playing sentence, then work forward before
  // filling earlier captions. The viewer sees a useful translation first.
  let currentTime = 0;
  try {
    const playback = await sendPlayerSubtitleMessage({ action: "getCurrentTime" });
    currentTime = Number(playback?.currentTime) || 0;
  } catch (error) {
    debugLog("Could not prioritize subtitle translation by playback:", error);
  }
  const currentIndex = Math.max(
    0,
    segments.findIndex(
      (segment) => currentTime >= segment.start && currentTime < segment.end,
    ),
  );
  const prioritized = [
    ...missingIndices.filter((index) => index >= currentIndex),
    ...missingIndices.filter((index) => index < currentIndex),
  ];

  for (let offset = 0; offset < prioritized.length; offset += 4) {
    if (
      generation !== playerSubtitleGeneration ||
      videoId !== currentVideoId ||
      !playerSubtitlesEnabled
    ) {
      return;
    }

    const batchIndices = prioritized.slice(offset, offset + 4);
    const sourceBatch = batchIndices.map((index) => segments[index]);
    const aligned = await requestSharedTranslationBatch(sourceBatch, videoId);
    if (
      generation !== playerSubtitleGeneration ||
      videoId !== currentVideoId ||
      !playerSubtitlesEnabled
    ) {
      return;
    }

    updateVisibleSharedTranslationRows(sourceBatch, aligned);
    await sendPlayerSubtitleMessage({
      action: "updatePlayerSubtitleTranslations",
      videoId,
      segments: aligned,
    });
    completed += aligned.filter((item) => item.text).length;
    updatePlayerSubtitlesButton({ completed, total });
  }

  await updateCache();
  if (completed < total) {
    updatePlayerSubtitlesButton({
      error: `${total - completed} subtitle translations were unavailable.`,
    });
  } else {
    updatePlayerSubtitlesButton({ completed: total, total });
  }
}

function getOriginalTranscriptLabel() {
  const language = String(currentTranscriptLanguage || "").trim();
  return /^[A-Za-z0-9-]{1,20}$/.test(language)
    ? `Original (${language})`
    : "Original";
}

function getActiveTranscriptSegments() {
  return getSharedTranslationSegments();
}

function transcriptTranslationCacheKey(segment) {
  return sharedTranslationCacheKey(segment);
}

function setTranscriptModeButtons(mode) {
  document.querySelectorAll(".transcript-mode-btn").forEach((button) => {
    const active = button.dataset.transcriptMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function handleTranscriptModeChange(mode) {
  if (!["original", "zh", "bilingual"].includes(mode)) return;
  if (mode === currentTranscriptMode) return;

  currentTranscriptMode = mode;
  translationGeneration += 1;
  translationWorkCount = 0;
  setTranslatingSpinner(false);
  if (transcriptScrollObserver) transcriptScrollObserver.disconnect();
  transcriptScrollObserver = null;
  setTranscriptModeButtons(mode);

  if (mode === "original") {
    renderTranscript();
    return;
  }

  await translateTranscript();
}

function renderTranscriptSegmentContent(segment, mode, translated, error) {
  const original = renderSubtitleInlineMarkup(segment.text);
  let translationHtml = "";
  if (translated) {
    translationHtml = renderSubtitleInlineMarkup(translated);
  } else if (error) {
    translationHtml = `${escapeHtml(error)}<button class="translation-retry-btn" type="button">Retry</button>`;
  } else {
    translationHtml = "Waiting for translation…";
  }

  if (mode === "bilingual") {
    return `<span class="transcript-copy"><span class="transcript-original">${original}</span><span class="transcript-translation ${translated ? "" : error ? "translation-error" : "translation-pending"}">${translationHtml}</span></span>`;
  }

  return `<span class="transcript-copy"><span class="transcript-translation ${translated ? "" : error ? "translation-error" : "translation-pending"}">${translationHtml}</span></span>`;
}

function renderTranscriptModeRows(segments, mode) {
  const transcriptList = document.getElementById("transcriptList");
  if (!transcriptList) return [];
  transcriptList.innerHTML = "";

  const existingBadge = document.getElementById("transcriptSourceBadge");
  if (existingBadge) existingBadge.remove();
  const badge = document.createElement("div");
  badge.id = "transcriptSourceBadge";
  badge.className = "transcript-source-badge";
  const originalLabel = getOriginalTranscriptLabel();
  const modeLabel =
    mode === "bilingual"
      ? `${originalLabel} + 简体中文`
      : `简体中文 · translated from ${originalLabel}`;
  badge.innerHTML = `<span class="source-dot source-dot--subs"></span> From video subtitles · ${modeLabel}`;
  transcriptList.parentElement.insertBefore(badge, transcriptList);

  const rows = [];
  segments.forEach((segment, index) => {
    const div = document.createElement("div");
    const cached = getSharedTranslation(segment);
    div.className = `transcript-entry ${cached ? "translated" : "translating"}`;
    div.dataset.seconds = segment.start;
    div.dataset.segmentId = segment.id;
    div.dataset.segmentIndex = index;

    const minutes = Math.floor(segment.start / 60);
    const seconds = Math.floor(segment.start % 60);
    const timestamp = `${minutes}:${String(seconds).padStart(2, "0")}`;
    div.innerHTML = `
      <span class="transcript-time">${timestamp}</span>
      ${renderTranscriptSegmentContent(segment, mode, cached, "")}
    `;
    div.addEventListener("click", (event) =>
      seekFromTranscriptEntryClick(event, segment.start),
    );
    transcriptList.appendChild(div);
    rows.push(div);
  });

  startPlaybackTracking();
  return rows;
}

/**
 * Rebuilds a provider response in source order. Unknown IDs are ignored and
 * missing IDs remain explicit errors, never positional guesses.
 */
function alignTranslatedSegmentBatch(sourceSegments, responseSegments) {
  const translatedById = new Map();
  if (Array.isArray(responseSegments)) {
    responseSegments.forEach((item) => {
      if (!item || typeof item.id !== "string" || typeof item.text !== "string")
        return;
      const text = item.text.trim();
      if (text && !translatedById.has(item.id)) {
        translatedById.set(item.id, text);
      }
    });
  }

  return sourceSegments.map((segment) => ({
    id: segment.id,
    text: translatedById.get(segment.id) || "",
    error: translatedById.has(segment.id) ? "" : "Translation unavailable.",
  }));
}

function updateTranslatedRow(segment, index, alignedItem, generation) {
  if (generation !== translationGeneration) return;
  const row = document.querySelector(
    `.transcript-entry[data-segment-id="${CSS.escape(segment.id)}"]`,
  );
  if (!row) return;

  if (alignedItem.text) {
    setSharedTranslation(segment, alignedItem.text);
  }

  const copy = row.querySelector(".transcript-copy");
  if (copy) {
    copy.outerHTML = renderTranscriptSegmentContent(
      segment,
      currentTranscriptMode,
      alignedItem.text,
      alignedItem.error,
    );
  }
  row.classList.toggle("translated", !!alignedItem.text);
  row.classList.toggle("translating", false);
  row.classList.toggle("translation-failed", !alignedItem.text);

  const retry = row.querySelector(".translation-retry-btn");
  if (retry) {
    ["mousedown", "mouseup"].forEach((eventName) => {
      retry.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
    retry.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      retryTranslationSegment(index, generation);
    });
  }
}

function updateVisibleSharedTranslationRows(sourceBatch, alignedItems) {
  if (currentTranscriptMode === "original") return;
  const activeSegments = getActiveTranscriptSegments();
  const indicesById = new Map(
    activeSegments.map((segment, index) => [segment.id, index]),
  );
  alignedItems.forEach((item, batchIndex) => {
    const segment = sourceBatch[batchIndex];
    const index = indicesById.get(segment.id);
    if (Number.isInteger(index)) {
      updateTranslatedRow(
        segment,
        index,
        item,
        translationGeneration,
      );
    }
  });
}

let activeTranslationQueue = null;

async function requestTranscriptTranslationBatch(
  indices,
  segments,
  generation,
  videoId,
  mode,
) {
  const sourceBatch = indices.map((index) => segments[index]);
  setTranslatingSpinner(true);
  try {
    const aligned = await requestSharedTranslationBatch(sourceBatch, videoId);

    const isStale =
      generation !== translationGeneration ||
      videoId !== currentVideoId ||
      mode !== currentTranscriptMode;
    if (isStale) return;

    aligned.forEach((item, batchIndex) => {
      updateTranslatedRow(
        sourceBatch[batchIndex],
        indices[batchIndex],
        item,
        generation,
      );
    });
    await updateCache();
  } catch (error) {
    if (generation !== translationGeneration) return;
    sourceBatch.forEach((segment, batchIndex) => {
      updateTranslatedRow(
        segment,
        indices[batchIndex],
        { id: segment.id, text: "", error: error.message || "Translation failed." },
        generation,
      );
    });
  } finally {
    setTranslatingSpinner(false);
  }
}

function retryTranslationSegment(index, generation) {
  if (generation !== translationGeneration || !activeTranslationQueue) return;
  const row = document.querySelector(
    `.transcript-entry[data-segment-index="${index}"]`,
  );
  if (row) {
    row.classList.add("translating");
    row.classList.remove("translation-failed");
    const translation = row.querySelector(".transcript-translation");
    if (translation) {
      translation.className = "transcript-translation translation-pending";
      translation.textContent = "Retrying…";
    }
  }
  activeTranslationQueue.enqueue(index, true);
}

/**
 * Renders immediately, translates the first small batch, then observes the
 * remaining rows. Batches are sequential so the provider is never flooded.
 */
async function translateTranscript() {
  const segments = getActiveTranscriptSegments();
  if (!segments.length || currentTranscriptMode === "original") return;

  translationGeneration += 1;
  const generation = translationGeneration;
  const videoId = currentVideoId;
  const mode = currentTranscriptMode;
  if (transcriptScrollObserver) transcriptScrollObserver.disconnect();

  const rows = renderTranscriptModeRows(segments, mode);
  const queue = [];
  const queued = new Set();
  let processing = false;

  const processNext = async () => {
    if (processing || queue.length === 0 || generation !== translationGeneration)
      return;
    processing = true;
    const indices = queue.splice(0, 3);
    indices.forEach((index) => queued.delete(index));
    try {
      await requestTranscriptTranslationBatch(
        indices,
        segments,
        generation,
        videoId,
        mode,
      );
    } finally {
      processing = false;
      if (queue.length && generation === translationGeneration) processNext();
    }
  };

  const enqueue = (index, force = false) => {
    if (!Number.isInteger(index) || !segments[index]) return;
    const cached = hasSharedTranslation(segments[index], videoId);
    if ((!force && cached) || queued.has(index)) return;
    queue.push(index);
    queued.add(index);
    // Let all entries reported in the same viewport turn collect before the
    // worker starts, producing one small contextual multi-segment request.
    Promise.resolve().then(processNext);
  };
  activeTranslationQueue = { enqueue };

  transcriptScrollObserver = new IntersectionObserver(
    (observerEntries) => {
      observerEntries
        .filter((entry) => entry.isIntersecting)
        .sort(
          (a, b) =>
            Number(a.target.dataset.segmentIndex) -
            Number(b.target.dataset.segmentIndex),
        )
        .forEach((entry) => enqueue(Number(entry.target.dataset.segmentIndex)));
    },
    {
      root: document.getElementById("contentArea"),
      rootMargin: "320px 0px",
      threshold: 0,
    },
  );

  rows.forEach((row, index) => {
    if (!row.classList.contains("translated")) transcriptScrollObserver.observe(row);
    if (index < 3) enqueue(index);
  });
}

function setTranslatingSpinner(show) {
  if (show) translationWorkCount += 1;
  else translationWorkCount = Math.max(0, translationWorkCount - 1);
  const isTranslating = translationWorkCount > 0;
  const spinner = document.getElementById("langSpinner");
  if (spinner) spinner.classList.toggle("visible", isTranslating);
}

// Pure helpers are exposed for the repository's Node tests. The extension does
// not read this object at runtime.
globalThis.__YTD_TRANSCRIPT_TESTING__ = {
  sendTranslationMessage,
  groupTranscriptEntries,
  splitOversizedThought,
  alignTranslatedSegmentBatch,
  sharedTranslationCacheKey,
  getSharedTranslation,
  requestSharedTranslationBatch,
  renderSubtitleInlineMarkup,
  renderTranscriptSegmentContent,
};
