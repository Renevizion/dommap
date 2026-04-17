(async () => {
  const toggle     = document.getElementById("enableToggle");
  const statusText = document.getElementById("statusText");
  const xrayBtn    = document.getElementById("xrayBtn");

  // Restore persisted enabled state
  const { enabled = true } = await chrome.storage.local.get("enabled");
  toggle.checked = enabled;
  applyStatus(enabled);

  toggle.addEventListener("change", async () => {
    const isEnabled = toggle.checked;
    applyStatus(isEnabled);
    await chrome.storage.local.set({ enabled: isEnabled });
    await sendToContent({ type: "TOGGLE_ENABLED", enabled: isEnabled });
  });

  xrayBtn.addEventListener("click", async () => {
    window.close();
    await sendToContent({ type: "OPEN_XRAY" });
  });

  function applyStatus(isEnabled) {
    statusText.textContent = isEnabled ? "ON" : "OFF";
    statusText.className   = "status-text" + (isEnabled ? " on" : "");
  }

  async function sendToContent(msg) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id != null) {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      }
    } catch (_) {}
  }
})();
