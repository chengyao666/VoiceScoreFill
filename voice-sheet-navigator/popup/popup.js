const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const statusEl = document.getElementById("status");
const nameColumnInput = document.getElementById("name-column");
const debugInput = document.getElementById("debug-mode");
const saveConfigBtn = document.getElementById("save-config");
const manualNameInput = document.getElementById("manual-name");
const manualScoreInput = document.getElementById("manual-score");
const manualSendBtn = document.getElementById("send-manual");

const MESSAGE_TYPES = {
  VOICE_RESULT: "voice-result",
  REQUEST_CONFIG: "request-config",
  SAVE_CONFIG: "save-config",
};

let recognition;
let listening = false;
let currentConfig = { nameColumn: 2, debug: false };

init();

function init() {
  loadConfig();
  setupSpeech();
  startBtn.addEventListener("click", startListening);
  stopBtn.addEventListener("click", stopListening);
  saveConfigBtn.addEventListener("click", persistConfig);
  manualSendBtn.addEventListener("click", sendManualResult);
}

function loadConfig() {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REQUEST_CONFIG }, (response) => {
    if (response?.config) {
      currentConfig = { ...currentConfig, ...response.config };
      applyConfigToUI();
    }
  });
}

function applyConfigToUI() {
  nameColumnInput.value = currentConfig.nameColumn;
  debugInput.checked = Boolean(currentConfig.debug);
}

function persistConfig() {
  const parsed = parseInt(nameColumnInput.value, 10);
  currentConfig.nameColumn = Number.isNaN(parsed) ? 2 : parsed;
  currentConfig.debug = debugInput.checked;
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SAVE_CONFIG, payload: currentConfig });
  setStatus("配置已保存，录音时会使用更新的姓名列。");
}

function setupSpeech() {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) {
    setStatus("当前浏览器不支持 Web Speech API。", true);
    startBtn.disabled = true;
    return;
  }

  recognition = new Speech();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join("")
      .trim();
    if (!transcript) return;
    const parsed = parseTranscript(transcript);
    if (parsed) {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.VOICE_RESULT,
        payload: { ...parsed, transcript },
      });
      setStatus(`识别：${parsed.name} ${parsed.score}`);
    } else {
      setStatus(`未能解析 “${transcript}” ，请重试。`, true);
    }
  };

  recognition.onerror = (event) => {
    setStatus(`识别错误：${event.error}` || "语音识别出现问题", true);
    listening = false;
    updateButtons();
  };

  recognition.onend = () => {
    if (listening) {
      recognition.start();
    }
  };
}

function startListening() {
  if (!recognition) return;
  listening = true;
  recognition.start();
  setStatus("正在监听，请说出学生姓名和分数……");
  updateButtons();
}

function stopListening() {
  if (!recognition) return;
  listening = false;
  recognition.stop();
  setStatus("已停止监听");
  updateButtons();
}

function parseTranscript(text) {
  const normalized = text.replace(/分/g, " ").replace(/点/g, ".");
  const match = normalized.match(/([\u4e00-\u9fa5A-Za-z]{1,30})\s*(\d{1,3}(?:\.\d)?)/);
  if (!match) return null;
  return {
    name: match[1].trim(),
    score: parseFloat(match[2]),
  };
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#dc2626" : "#0ea5e9";
}

function updateButtons() {
  startBtn.disabled = listening;
  stopBtn.disabled = !listening;
}

function sendManualResult() {
  const name = manualNameInput.value.trim();
  const score = parseFloat(manualScoreInput.value);

  if (!name) {
    setStatus("请输入学生姓名。", true);
    manualNameInput.focus();
    return;
  }

  if (Number.isNaN(score)) {
    setStatus("请输入有效的分数。", true);
    manualScoreInput.focus();
    return;
  }

  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.VOICE_RESULT,
    payload: { name, score },
  });
  setStatus(`手动发送：${name} ${score}`);
}
