if (!document.getElementById("readqr-iframe-container")) {
  const container = document.createElement("div");
  container.id = "readqr-iframe-container";
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.right = "300px";
  container.style.zIndex = "2147483647";

  const grabber = document.createElement("div");
  grabber.style.position = "absolute";
  grabber.style.top = "0";
  grabber.style.left = "48px";
  grabber.style.width = "180px";
  grabber.style.height = "48px";
  grabber.style.cursor = "move";

  const iframe = document.createElement("iframe");
  iframe.id = "readqr-iframe";
  iframe.src = chrome.runtime.getURL("scanner.html");
  iframe.allow = "camera; microphone";
  iframe.sandbox =
    "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation";
  iframe.style.width = "256px";
  iframe.style.height = "360px";
  iframe.style.border = "none";
  iframe.style.background = "rgb(137,211,180)";
  iframe.style.pointerEvents = "auto";

  container.appendChild(grabber);
  container.appendChild(iframe);
  document.body.appendChild(container);

  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;

  grabber.addEventListener("pointerdown", e => {
    dragging = true;
    offsetX = e.clientX - container.getBoundingClientRect().left;
    offsetY = e.clientY - container.getBoundingClientRect().top;
    grabber.setPointerCapture(e.pointerId);
  });

  grabber.addEventListener("pointermove", e => {
    if (!dragging) return;
    container.style.left = `${e.clientX - offsetX}px`;
    container.style.top = `${e.clientY - offsetY}px`;
  });

  grabber.addEventListener("pointerup", () => (dragging = false));

  window.addEventListener("message", ({ data }) => {
    if (data?.type !== "collapse") return;
    iframe.style.height = data.collapsed ? "60px" : "360px";
  });
}
