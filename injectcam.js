let iframe;
let iframecontainer;
let iframegrabber;

const style = document.createElement('style');
style.textContent = `
  @keyframes bounce {
    0%   { transform: translateY(0); }
    20%  { transform: translateY(-5px); }
    40%  { transform: translateY(3px); }
    60%  { transform: translateY(-2px); }
    80%  { transform: translateY(1px); }
    100% { transform: translateY(0); }
  }
  .bounce-animation {
    animation: bounce 0.6s ease-out;
  }
`;
document.head.appendChild(style);

// Function to open the iframe
function open() {
    iframecontainer = document.createElement('div');
    iframe = document.createElement('iframe');
    iframegrabber = document.createElement('div');

    iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation";
    iframe.allow = 'camera; microphone';
    iframe.style.width = '256px';
    iframe.style.height = '360px';
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.style.pointerEvents = 'auto';
    iframe.style.zIndex = '123456789';
    iframe.style.transform = '(translate3d(0, 0, 1));'
    iframe.style.position = 'absolute';
    iframe.style.backgroundColor = 'rgb(137, 211, 180)';
    iframe.id = 'iframe';

    iframecontainer.style.position = 'fixed';
    iframecontainer.style.top = '0';
    iframecontainer.style.right = '300px';
    iframecontainer.style.zIndex = '2147483647';
    iframecontainer.style.width = '256px';  // Set to a proper width instead of 0
    iframecontainer.id = "iframecontainer";

    iframegrabber.style.position = 'absolute';
    iframegrabber.style.top = '0px';
    iframegrabber.style.left = '48px';
    iframegrabber.style.width = "180px";
    iframegrabber.style.height = "48px";
    iframegrabber.id = "iframecontainergrabber";
    iframegrabber.style.zIndex = '2147483647';

    document.body.appendChild(iframecontainer);
    iframecontainer.appendChild(iframegrabber);
    iframecontainer.appendChild(iframe);

    // Inject HTML content and JS for the camera and QR detection
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    // Create HTML content to be injected
    const iframeHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QR Scanner</title>
        <style>
          video { width: 100%; display: block; }
          canvas { display: block; }
        </style>
        <script src="${chrome.runtime.getURL('jsQR.js')}"></script> <!-- Load local jsQR -->
    </head>
    <body>
        <video id="video" autoplay></video>
        <canvas id="canvas"></canvas>
        <script>
          document.addEventListener("DOMContentLoaded", () => {
            const canvas = document.getElementById("canvas");
            canvas.width  = 240;
            canvas.height = 240;
            canvas.style.transform = "scale(-1,1)";
            const ctx = canvas.getContext("2d", { willReadFrequently: true });

            const video = document.getElementById("video");
            const icon  = new Image(240, 240);
            icon.src = "icon.png";  // Assuming you have this icon in your extension

            const FRAMERATE = 12;
            let lastFrame   = 0;
            let processing  = false;
            let scanPaused  = false;
            let stream      = null;

            // Start the camera
            async function startCamera() {
              if (stream) return;
              try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { width: 240, height: 240 } });
                video.srcObject = stream;
                await video.play();
                console.log("Camera started.");
              } catch (err) {
                console.error("Camera error:", err);
              }
            }

            // QR detection loop
            function detectLoop() {
              const detect = ts => {
                requestAnimationFrame(detect);
                if (scanPaused || processing) return;
                if (ts - lastFrame < 1000 / FRAMERATE) return;
                lastFrame = ts;
                processing = true;

                ctx.clearRect(0, 0, 240, 240);
                ctx.drawImage(video, 0, 0, 240, 240);
                ctx.drawImage(icon, 0, 0, 240, 240);

                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                  const img = ctx.getImageData(0, 0, 240, 240);
                  const code = jsQR(img.data, img.width, img.height);
                  if (code) {
                    chrome.runtime.sendMessage({ qrLink: code.data });
                    scanPaused = true;
                    setTimeout(() => (scanPaused = false), 2000);
                  }
                }
                processing = false;
              };
              requestAnimationFrame(detect);
            }

            // Start the camera after 2-second delay
            setTimeout(async () => {
              await startCamera();
              if (video.readyState >= video.HAVE_ENOUGH_DATA) detectLoop();
              else video.addEventListener("loadeddata", detectLoop, { once: true });
            }, 2000);  // 2-second delay for camera stability

            // Listen for stop camera message from parent
            window.addEventListener("message", e => {
              if (e.data?.type === "stopCamera") {
                if (stream) {
                  stream.getTracks().forEach(t => t.stop());
                  stream = null;
                  console.log("Camera stopped.");
                }
              }
            });

            // Listen for start camera message
            window.addEventListener("message", e => {
              if (e.data?.type === "startCamera") {
                startCamera();  // Start the camera when the message is received
              }
            });
          });
        </script>
    </body>
    </html>`;

    // Inject the HTML content into the iframe's document
    iframeDoc.open();
    iframeDoc.write(iframeHTML);
    iframeDoc.close();
}

// Open iframe with 2-second delay to ensure the camera works
setTimeout(() => {
    open();
}, 2000);
