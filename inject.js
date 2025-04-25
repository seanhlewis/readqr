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

// First, create a new file that will handle our QR scanner logic
function createQRScannerScript() {
  return new Promise((resolve, reject) => {
    // Create a blob with our script content
    const scriptContent = `// Debug function
function debugLog(message) {
    console.log(message);
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        const msgElem = document.createElement('div');
        msgElem.textContent = message;
        debugDiv.appendChild(msgElem);
        // Keep only the last 5 messages
        while (debugDiv.childElementCount > 5) {
            debugDiv.removeChild(debugDiv.firstChild);
        }
    }
}

// Make sure jsQR is loaded before proceeding
function checkJsQR() {
    if (typeof jsQR === 'undefined') {
        debugLog("jsQR not loaded yet, retrying in 100ms");
        setTimeout(checkJsQR, 100);
        return;
    }
    
    debugLog("jsQR loaded successfully");
    initializeApp();
}

function initializeApp() {
    debugLog("Initializing QR scanner app");
    
    const canvas = document.getElementById("canvas");
    canvas.width = 240;
    canvas.height = 240;
    canvas.style.transform = "scale(-1,1)";
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    
    const video = document.getElementById("video");
    const icon = new Image();
    let iconLoaded = false;
    
    // Get the icon URL from the data attribute
    const iconUrl = document.body.getAttribute('data-icon-url');
    
    // Load icon with error handling
    icon.onload = () => {
        iconLoaded = true;
        debugLog("Icon loaded successfully");
    };
    
    icon.onerror = (err) => {
        debugLog("Error loading icon");
    };
    
    // Set the source after defining handlers
    icon.src = iconUrl;
    
    const FRAMERATE = 12;
    let lastFrame = 0;
    let processing = false;
    let scanPaused = false;
    let stream = null;
    
    // Start the camera
    async function startCamera() {
        if (stream) return;
        debugLog("Starting camera...");
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 240 }, 
                    height: { ideal: 240 }
                } 
            });
            video.srcObject = stream;
            await video.play();
            debugLog("Camera started successfully");
        } catch (err) {
            debugLog("Camera error: " + err.message);
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
            
            try {
                ctx.clearRect(0, 0, 240, 240);
                ctx.drawImage(video, 0, 0, 240, 240);
                
                // Only draw the icon if it's loaded
                if (iconLoaded) {
                    ctx.drawImage(icon, 0, 0, 240, 240);
                }
                
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    const img = ctx.getImageData(0, 0, 240, 240);
                    
                    // Check if jsQR is available
                    if (typeof jsQR === 'function') {
                        const code = jsQR(img.data, img.width, img.height);
                        if (code) {
                            debugLog("QR code detected: " + code.data);
                            
                            // Try to use chrome.runtime.sendMessage
                            try {
                                chrome.runtime.sendMessage({ qrLink: code.data });
                            } catch (chromeErr) {
                                debugLog("Chrome message error, trying postMessage");
                                // Fall back to postMessage
                                window.parent.postMessage({ qrLink: code.data }, "*");
                            }
                            
                            scanPaused = true;
                            setTimeout(() => (scanPaused = false), 2000);
                        }
                    } else {
                        debugLog("jsQR is not defined");
                    }
                }
            } catch (err) {
                debugLog("Error in detection loop: " + err.message);
            }
            
            processing = false;
        };
        requestAnimationFrame(detect);
    }
    
    // Start the camera after a short delay
    setTimeout(async () => {
        await startCamera();
        if (video.readyState >= video.HAVE_ENOUGH_DATA) {
            debugLog("Starting detection loop");
            detectLoop();
        } else {
            debugLog("Waiting for video to load");
            video.addEventListener("loadeddata", () => {
                debugLog("Video loaded, starting detection loop");
                detectLoop();
            }, { once: true });
        }
    }, 1000);
    
    // Listen for stop camera message from parent
    window.addEventListener("message", e => {
        if (e.data?.type === "stopCamera") {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
                stream = null;
                debugLog("Camera stopped");
            }
        } else if (e.data?.type === "startCamera") {
            startCamera();
        }
    });
}

// Start when the DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkJsQR);
} else {
    // DOM is already ready
    checkJsQR();
}`;

    // Create a blob from the script content
    const blob = new Blob([scriptContent], { type: 'application/javascript' });
    
    // Create a URL for the blob
    const scriptURL = URL.createObjectURL(blob);
    
    resolve(scriptURL);
  });
}

// Function to open the iframe
async function open() {
    try {
        // Get local extension URLs for resources
        const jsQRUrl = chrome.runtime.getURL('jsQR.js');
        const iconUrl = chrome.runtime.getURL('icon.png');
        
        console.log("Local resource URLs:", {
            jsQRUrl,
            iconUrl
        });
        
        // Create a script URL that will be available to the iframe
        const qrScannerScriptUrl = chrome.runtime.getURL('qrscanner.js');
        
        console.log("Using QR scanner script from:", qrScannerScriptUrl);
        
        // Create the container and iframe elements
        iframecontainer = document.createElement('div');
        iframe = document.createElement('iframe');
        iframegrabber = document.createElement('div');

        iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation";
        iframe.allow = 'camera; microphone';  // Ensure iframe has access to camera and microphone
        iframe.style.width = '240px';
        iframe.style.height = '240px';
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

        // Create HTML content without any inline script
        const iframeHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>QR Scanner</title>
            <style>
              body { margin: 0; padding: 0; overflow: hidden; }
              video { width: 100%; display: none; } /* Hide the video element */
              canvas { display: block; }
              #debug { position: absolute; bottom: 0; left: 0; background: rgba(0,0,0,0.5); color: white; padding: 4px; font-size: 10px; max-height: 60px; overflow-y: auto; }
            </style>
            <script src="${jsQRUrl}"></script>
        </head>
        <body data-icon-url="${iconUrl}">
            <video id="video" autoplay></video>
            <canvas id="canvas"></canvas>
            <div id="debug"></div>
            <script src="${qrScannerScriptUrl}"></script>
        </body>
        </html>`;

        // Inject the HTML content into the iframe
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(iframeHTML);
        iframeDoc.close();
        
    } catch (error) {
        console.error("Error setting up QR scanner:", error);
    }
}

// Event listener for messages from the iframe
window.addEventListener("message", function(event) {
    // Check if it's our QR code message
    if (event.data && event.data.type === "qrCodeDetected") {
        console.log("QR code detected, navigating to:", event.data.qrLink);
        // Navigate to the URL
        window.location.href = event.data.qrLink;
    }
});

// Open iframe with a delay
setTimeout(() => {
    console.log("Opening QR scanner iframe");
    open();
}, 1000);