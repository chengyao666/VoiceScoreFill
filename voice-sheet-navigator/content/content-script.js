const MESSAGE_TYPES = {
  VOICE_RESULT: "voice-result",
};

let config = { nameColumn: 2, debug: false };
let currentColumn = null;

init();

function init() {
  chrome.storage.local.get({ config }, ({ config: stored }) => {
    config = { ...config, ...stored };
    logDebug("Loaded config", config);
  });

  document.addEventListener("click", handleSelectionChange, { capture: true });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === MESSAGE_TYPES.VOICE_RESULT && message.payload) {
      handleVoiceResult(message.payload);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.config?.newValue) {
      config = { ...config, ...changes.config.newValue };
      logDebug("Config updated", config);
    }
  });
}

function handleSelectionChange(event) {
  const cell = event.target.closest("[data-row][data-col], [aria-rowindex][aria-colindex]");
  if (!cell) return;
  const colValue = cell.getAttribute("data-col") || cell.getAttribute("aria-colindex");
  if (colValue) {
    currentColumn = parseInt(colValue, 10);
    logDebug("Current column set", currentColumn);
  }
}

function handleVoiceResult(payload) {
  const { name, score } = payload;
  logDebug("Voice result", payload);

  if (!name || typeof score !== "number" || Number.isNaN(score)) {
    console.warn("VoiceSheet Navigator: invalid payload", payload);
    return;
  }

  const row = findRowByName(name);
  if (!row) {
    console.warn(`VoiceSheet Navigator: could not locate row for ${name}`);
    return;
  }

  if (!currentColumn) {
    console.warn("VoiceSheet Navigator: select a target column before speaking.");
    return;
  }

  fillScore(row, currentColumn, score);
  logDebug(`Filled score ${score} for ${name} at row ${row}, column ${currentColumn}`);
}

function findRowByName(name) {
  const nameCells = getCellsInColumn(config.nameColumn);
  let bestMatch = { row: null, score: 0 };

  nameCells.forEach((cell) => {
    const cellText = normalizeText(cell.textContent);
    const similarity = computeSimilarity(name, cellText);
    if (similarity > bestMatch.score) {
      const rowValue = cell.getAttribute("data-row") || cell.getAttribute("aria-rowindex");
      if (rowValue) {
        bestMatch = { row: parseInt(rowValue, 10), score: similarity };
      }
    }
  });

  if (bestMatch.score >= 0.5) return bestMatch.row;
  return null;
}

function getCellsInColumn(columnIndex) {
  const selectors = [
    `[data-col="${columnIndex}"]`,
    `[aria-colindex="${columnIndex}"]`,
  ];
  return Array.from(document.querySelectorAll(selectors.join(",")));
}

function fillScore(rowIndex, colIndex, score) {
  const cell = getCell(rowIndex, colIndex);
  if (!cell) {
    console.warn(`VoiceSheet Navigator: cell not found for row ${rowIndex}, column ${colIndex}`);
    return;
  }

  cell.click();

  const text = String(score);
  const active = document.activeElement;
  if (active) {
    insertText(active, text);
  } else {
    document.execCommand("insertText", false, text);
  }

  cell.dispatchEvent(new Event("input", { bubbles: true }));
  cell.dispatchEvent(new Event("change", { bubbles: true }));
}

function getCell(rowIndex, colIndex) {
  const selectors = [
    `[data-row="${rowIndex}"][data-col="${colIndex}"]`,
    `[aria-rowindex="${rowIndex}"][aria-colindex="${colIndex}"]`,
  ];
  return document.querySelector(selectors.join(","));
}

function insertText(element, text) {
  const tag = element.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea") {
    element.value = text;
  } else {
    element.focus({ preventScroll: true });
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
  }
}

function normalizeText(value) {
  return (value || "").trim().replace(/\s+/g, "");
}

function computeSimilarity(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = levenshtein(left, right);
  const maxLen = Math.max(left.length, right.length);
  return 1 - distance / maxLen;
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function logDebug(...args) {
  if (config.debug) {
    console.debug("VoiceSheet Navigator:", ...args);
  }
}
