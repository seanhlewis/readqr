const HOMEPAGE = "https://utdesigncapstone25.com";

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg.qrLink || !sender.tab) return;

  let target = HOMEPAGE;
  try {
    const url = new URL(msg.qrLink);
    target = url.hostname.endsWith("utdesigncapstone25.com") ? url.href : HOMEPAGE;
  } catch {
    target = HOMEPAGE;
  }

  chrome.tabs.update(sender.tab.id, { url: target });
});

function mustRedirect(url) {
  const extURL = chrome.runtime.getURL("");
  return !(
    url.startsWith("chrome://")           ||
    url.startsWith("devtools://")         ||
    url.startsWith("chrome-extension://") ||
    url.startsWith(extURL)                ||
    url.startsWith(HOMEPAGE)
  );
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  if (mustRedirect(changeInfo.url)) {
    chrome.tabs.update(tabId, { url: HOMEPAGE });
  }
});
