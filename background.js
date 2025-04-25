let scannerTabId = null;                           // id of the long-lived scanner tab
const SCANNER_URL = chrome.runtime.getURL("scanner.html");
const FALLBACK_URL = "https://utdesigncapstone25.com";

/* ---------- open (or focus) the permanent scanner tab ------------------- */
async function ensureScannerTab() {
  const tabs = await chrome.tabs.query({ url: SCANNER_URL });
  if (tabs.length) {
    scannerTabId = tabs[0].id;
    return;
  }
  const { id } = await chrome.tabs.create({ url: SCANNER_URL, pinned: true });
  scannerTabId = id;
}

/* ---------- install / startup / tab-removed handling -------------------- */
chrome.runtime.onInstalled.addListener(ensureScannerTab);
chrome.runtime.onStartup.addListener(ensureScannerTab);

chrome.tabs.onRemoved.addListener(closedId => {
  if (closedId === scannerTabId) ensureScannerTab();
});

/* ---------- receive QR-code data from scanner.html ---------------------- */
chrome.runtime.onMessage.addListener(message => {
  if (!message.qrLink) return;

  try {
    const url = new URL(message.qrLink);
    if (url.hostname.endsWith("utdesigncapstone25.com")) {
      chrome.tabs.create({ url: message.qrLink });
    } else {
      chrome.tabs.create({ url: FALLBACK_URL });
    }
  } catch {
    chrome.tabs.create({ url: FALLBACK_URL });
  }
});
