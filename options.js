const settingsForm = document.getElementById("settings");
const saved = document.getElementById("saved");

fillSelect(document.getElementById("arbeitsverhaeltnis"), GrossNetAT.WORK_RELATION_OPTIONS);
fillSelect(document.getElementById("bundesland"), GrossNetAT.BUNDESLAND_OPTIONS);

chrome.storage.sync.get(GrossNetAT.DEFAULT_SETTINGS, (items) => {
  const settings = GrossNetAT.mergeSettings(items);
  Object.keys(GrossNetAT.DEFAULT_SETTINGS).forEach((key) => {
    const field = settingsForm.elements[key];
    if (field) {
      field.value = settings[key];
    }
  });
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(settingsForm);
  const settings = GrossNetAT.mergeSettings({
    arbeitsverhaeltnis: data.get("arbeitsverhaeltnis"),
    bundesland: data.get("bundesland"),
    annualThreshold: Number(data.get("annualThreshold")),
    monthlyThreshold: Number(data.get("monthlyThreshold"))
  });

  chrome.storage.sync.set(settings, () => {
    saved.textContent = "Gespeichert.";
    window.setTimeout(() => {
      saved.textContent = "";
    }, 1800);
  });
});

function fillSelect(select, options) {
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
}
