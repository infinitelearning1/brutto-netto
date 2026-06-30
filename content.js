(function initContentScript() {
  "use strict";

  var selectionTimer = null;
  var lastSignature = "";
  var OVERLAY_ID = "gross-net-at-overlay";
  var STYLE_ID = "gross-net-at-style";
  var NORMAL_SELECTION_DELAY_MS = 90;
  var FAST_SELECTION_DELAY_MS = 20;

  document.addEventListener("selectionchange", scheduleSelectionUpdate, true);
  document.addEventListener("mouseup", scheduleFastSelectionUpdate, true);
  document.addEventListener("keyup", scheduleFastSelectionUpdate, true);
  document.addEventListener("contextmenu", sendSelectionUpdateNow, true);

  chrome.runtime.onMessage.addListener(function onMessage(message, sender, sendResponse) {
    if (!message || !message.type) {
      return false;
    }

    if (message.type === "gross-net-get-selection-payload") {
      sendResponse(collectSelectionPayload());
      return false;
    }

    if (message.type !== "gross-net-show-result") {
      return false;
    }

    showOverlay(message.result);
    return false;
  });

  function scheduleSelectionUpdate() {
    window.clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(sendSelectionUpdateNow, NORMAL_SELECTION_DELAY_MS);
  }

  function scheduleFastSelectionUpdate() {
    window.clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(sendSelectionUpdateNow, FAST_SELECTION_DELAY_MS);
  }

  function sendSelectionUpdateNow() {
    window.clearTimeout(selectionTimer);
    var payload = collectSelectionPayload();
    var signature = payload.selectionText + "\n---\n" + payload.contextText;
    if (signature === lastSignature) {
      return;
    }
    lastSignature = signature;
    chrome.runtime.sendMessage({
      type: "gross-net-selection-changed",
      selectionText: payload.selectionText,
      contextText: payload.contextText
    }, function ignoreResponse() {
      void chrome.runtime.lastError;
    });
  }

  function collectSelectionPayload() {
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return { selectionText: "", contextText: "" };
    }

    var selectionText = GrossNetAT.normalizeWhitespace(selection.toString()).slice(0, 500);
    if (!selectionText) {
      return { selectionText: "", contextText: "" };
    }

    var contextText = "";
    try {
      contextText = extractContextText(selection, selectionText);
    } catch (error) {
      contextText = selectionText;
    }

    return {
      selectionText: selectionText,
      contextText: contextText
    };
  }

  function extractContextText(selection, selectionText) {
    var range = selection.getRangeAt(0);
    var node = range.commonAncestorContainer;
    var element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    var steps = 0;
    var bestText = "";

    while (element && element !== document.body && steps < 6) {
      var text = GrossNetAT.normalizeWhitespace(element.innerText || element.textContent || "");
      if (text.length >= selectionText.length && text.length <= 1400) {
        bestText = text;
        if (isUsefulContext(text, selectionText)) {
          return text;
        }
      }
      element = element.parentElement;
      steps += 1;
    }

    var fallback = GrossNetAT.normalizeWhitespace((element && (element.innerText || element.textContent)) || document.body.innerText || "");
    var index = fallback.indexOf(selectionText);
    if (index >= 0) {
      var start = Math.max(0, index - 450);
      var end = Math.min(fallback.length, index + selectionText.length + 450);
      return fallback.slice(start, end);
    }
    return bestText || fallback.slice(0, 1000);
  }

  function isUsefulContext(text, selectionText) {
    var normalized = GrossNetAT.normalizeWhitespace(text);
    if (normalized.length >= selectionText.length + 35 && GrossNetAT.hasSalaryCue(normalized)) {
      return true;
    }
    if (normalized.length >= 180 && normalized.indexOf(selectionText) >= 0) {
      return true;
    }
    return false;
  }

  function showOverlay(result) {
    ensureStyle();
    var existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      existing.remove();
    }

    var panel = document.createElement("div");
    panel.id = OVERLAY_ID;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-live", "polite");

    var header = document.createElement("div");
    header.className = "gross-net-header";

    var title = document.createElement("strong");
    title.textContent = "Brutto-Netto AT";
    header.appendChild(title);

    var close = document.createElement("button");
    close.type = "button";
    close.className = "gross-net-close";
    close.textContent = "x";
    close.title = "Schließen";
    close.addEventListener("click", function closeOverlay() {
      panel.remove();
    });
    header.appendChild(close);

    var pre = document.createElement("pre");
    pre.textContent = (result && result.detail) || "Keine Berechnung vorhanden.";

    var actions = document.createElement("div");
    actions.className = "gross-net-actions";

    var copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Kopieren";
    copy.addEventListener("click", function copyResult() {
      var text = (result && (result.copyText || result.detail)) || "";
      navigator.clipboard.writeText(text).catch(function noop() {});
    });
    actions.appendChild(copy);

    panel.appendChild(header);
    panel.appendChild(pre);
    panel.appendChild(actions);
    document.documentElement.appendChild(panel);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#" + OVERLAY_ID + " {",
      "  position: fixed;",
      "  z-index: 2147483647;",
      "  top: 18px;",
      "  right: 18px;",
      "  width: min(390px, calc(100vw - 36px));",
      "  max-height: min(560px, calc(100vh - 36px));",
      "  overflow: auto;",
      "  background: #ffffff;",
      "  color: #151515;",
      "  border: 1px solid #d2d6dc;",
      "  border-radius: 8px;",
      "  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.22);",
      "  font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
      "}",
      "#" + OVERLAY_ID + " .gross-net-header {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: space-between;",
      "  gap: 12px;",
      "  padding: 12px 14px;",
      "  border-bottom: 1px solid #e5e7eb;",
      "  background: #f8fafc;",
      "}",
      "#" + OVERLAY_ID + " .gross-net-close {",
      "  width: 28px;",
      "  height: 28px;",
      "  border: 1px solid #cbd5e1;",
      "  border-radius: 6px;",
      "  background: #ffffff;",
      "  color: #111827;",
      "  cursor: pointer;",
      "  font: inherit;",
      "}",
      "#" + OVERLAY_ID + " pre {",
      "  margin: 0;",
      "  padding: 14px;",
      "  white-space: pre-wrap;",
      "  word-break: break-word;",
      "  color: #111827;",
      "  font: inherit;",
      "}",
      "#" + OVERLAY_ID + " .gross-net-actions {",
      "  display: flex;",
      "  gap: 8px;",
      "  padding: 0 14px 14px;",
      "}",
      "#" + OVERLAY_ID + " .gross-net-actions button {",
      "  border: 1px solid #cbd5e1;",
      "  border-radius: 6px;",
      "  background: #ffffff;",
      "  color: #111827;",
      "  cursor: pointer;",
      "  padding: 7px 10px;",
      "  font: inherit;",
      "}",
      "#" + OVERLAY_ID + " .gross-net-actions button:hover,",
      "#" + OVERLAY_ID + " .gross-net-close:hover {",
      "  background: #eef2f7;",
      "}"
    ].join("\n");
    document.documentElement.appendChild(style);
  }
})();
