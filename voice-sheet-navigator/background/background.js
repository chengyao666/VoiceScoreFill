const MESSAGE_TYPES = {
  VOICE_RESULT: "voice-result",
  REQUEST_CONFIG: "request-config",
  SAVE_CONFIG: "save-config",
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ config: { nameColumn: 2, debug: false } }, ({ config }) => {
    chrome.storage.local.set({ config });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.SAVE_CONFIG) {
    chrome.storage.local.set({ config: message.payload }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === MESSAGE_TYPES.REQUEST_CONFIG) {
    chrome.storage.local.get({ config: { nameColumn: 2, debug: false } }, ({ config }) => {
      sendResponse({ config });
    });
    return true;
  }

  if (message?.type === MESSAGE_TYPES.VOICE_RESULT && message.payload) {
    forwardToActiveTab(message).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

async function forwardToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    console.warn("VoiceSheet Navigator: unable to send message to tab", error);
  }
}
