// Debug function - now just logs to console
function debugLog(message) {
    console.log(message);
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
                            
                            // Use postMessage to communicate with the parent
                            window.parent.postMessage({ 
                                type: "qrCodeDetected", 
                                qrLink: code.data 
                            }, "*");
                            
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
}