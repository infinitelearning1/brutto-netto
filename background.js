importScripts("payroll-at-2026.js", "core.js");

const CORE = self.GrossNetAT;
const PAYROLL = self.ATPayroll2026;
const MENU_ID = "gross-net-at-selection";
const DEFAULT_MENU_TITLE = "Netto schätzen";
const resultByTab = new Map();
const currentSignatureByTab = new Map();
let latestResult = null;

chrome.runtime.onInstalled.addListener(() => {
  installContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  installContextMenu();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "gross-net-selection-changed") {
    handleSelectionChanged(message, sender);
    return false;
  }

  if (message.type === "gross-net-get-latest-result") {
    sendResponse(latestResult || CORE.noSalaryResult());
    return false;
  }

  if (message.type === "gross-net-recalculate") {
    calculateForPayload(message.payload || {}, sender)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse(errorResult(error)));
    return true;
  }

  return false;
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || !tab.id) {
    return;
  }

  getLiveSelectionPayload(tab)
    .then((livePayload) => {
      const cached = resultByTab.get(tab.id);
      const payload = {
        selectionText: (livePayload && livePayload.selectionText) || info.selectionText || (cached && cached.payload && cached.payload.selectionText) || "",
        contextText: (livePayload && livePayload.contextText) || (cached && cached.payload && cached.payload.contextText) || ""
      };
      const signature = payloadSignature(payload);
      currentSignatureByTab.set(tab.id, signature);
      updateMenu({ ok: true, title: "Netto wird geschätzt..." });
      return calculateForPayload(payload, { tab }).then((result) => ({ payload, result, signature }));
    })
    .then(({ payload, result, signature }) => {
      resultByTab.set(tab.id, { payload, result });
      latestResult = result;
      if (currentSignatureByTab.get(tab.id) === signature) {
        updateMenu(result);
      }
      chrome.tabs.sendMessage(tab.id, { type: "gross-net-show-result", result }, () => {
        void chrome.runtime.lastError;
      });
    })
    .catch((error) => {
      const result = errorResult(error);
      latestResult = result;
      updateMenu(result);
      chrome.tabs.sendMessage(tab.id, { type: "gross-net-show-result", result }, () => {
        void chrome.runtime.lastError;
      });
    });
});

function installContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: DEFAULT_MENU_TITLE,
      contexts: ["selection"]
    });
  });
}

function handleSelectionChanged(message, sender) {
  if (!sender || !sender.tab || !sender.tab.id) {
    return;
  }

  const tabId = sender.tab.id;
  const payload = {
    selectionText: message.selectionText || "",
    contextText: message.contextText || ""
  };
  const signature = payloadSignature(payload);
  currentSignatureByTab.set(tabId, signature);

  if (!payload.selectionText.trim()) {
    const result = CORE.noSalaryResult();
    resultByTab.set(tabId, { payload, result });
    latestResult = result;
    updateMenu(result);
    return;
  }

  const immediateDetection = CORE.detectSalary(payload.selectionText, payload.contextText);
  if (!immediateDetection) {
    const result = CORE.noSalaryResult();
    resultByTab.set(tabId, { payload, result });
    latestResult = result;
    updateMenu(result);
    return;
  }

  updateMenu({
    ok: true,
    title: "Netto wird geschätzt..."
  });

  calculateForPayload(payload, sender)
    .then((result) => {
      resultByTab.set(tabId, { payload, result });
      latestResult = result;
      if (currentSignatureByTab.get(tabId) === signature) {
        updateMenu(result);
      }
    })
    .catch((error) => {
      const result = errorResult(error);
      resultByTab.set(tabId, { payload, result });
      latestResult = result;
      if (currentSignatureByTab.get(tabId) === signature) {
        updateMenu(result);
      }
    });
}

async function calculateForPayload(payload, sender) {
  const settings = await getSettings();
  const detection = CORE.detectSalary(payload.selectionText || "", payload.contextText || "", settings);
  if (!detection) {
    return CORE.noSalaryResult();
  }

  return CORE.buildDisplayModel(detection, PAYROLL.calculate(detection, settings));
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(CORE.DEFAULT_SETTINGS, (items) => {
      resolve(CORE.mergeSettings(items));
    });
  });
}

function updateMenu(result) {
  const title = shortenMenuTitle((result && result.title) || DEFAULT_MENU_TITLE);
  chrome.contextMenus.update(MENU_ID, {
    title,
    enabled: true
  }, () => {
    void chrome.runtime.lastError;
  });
}

function getLiveSelectionPayload(tab) {
  return new Promise((resolve) => {
    if (!tab || !tab.id) {
      resolve(null);
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 500);

    chrome.tabs.sendMessage(tab.id, { type: "gross-net-get-selection-payload" }, (payload) => {
      void chrome.runtime.lastError;
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(payload || null);
    });
  });
}

function payloadSignature(payload) {
  return String((payload && payload.selectionText) || "") + "\n---\n" + String((payload && payload.contextText) || "");
}

function shortenMenuTitle(title) {
  const text = String(title || DEFAULT_MENU_TITLE);
  if (text.length <= 120) {
    return text;
  }
  return text.slice(0, 117) + "...";
}

function errorResult(error) {
  const message = error && error.message ? error.message : "Unbekannter Fehler";
  return {
    ok: false,
    title: "Netto: Berechnung fehlgeschlagen",
    detail: "Die lokale Formel konnte gerade nicht ausgewertet werden.\n\n" + message
  };
}
