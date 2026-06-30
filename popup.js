let latestText = "";

chrome.runtime.sendMessage({ type: "gross-net-get-latest-result" }, (result) => {
  const status = document.getElementById("status");
  const output = document.getElementById("result");
  if (chrome.runtime.lastError || !result || !result.ok) {
    status.textContent = result && result.detail ? result.detail : "Noch keine Berechnung.";
    output.style.display = "none";
    return;
  }

  latestText = result.copyText || result.detail || "";
  status.textContent = result.title;
  output.textContent = latestText;
  output.style.display = "block";
});

document.getElementById("copy").addEventListener("click", () => {
  if (!latestText) {
    return;
  }
  navigator.clipboard.writeText(latestText).catch(() => {});
});

document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
