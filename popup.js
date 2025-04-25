document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("canvas");
    canvas.width  = 240;
    canvas.height = 240;
    canvas.style.transform = "scale(-1,1)";
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
  
    const video = document.getElementById("video");
    const icon  = new Image(240, 240);
    icon.src = "icon.png";
  
    const FRAMERATE = 12;
    let lastFrame   = 0;
    let processing  = false;
    let scanPaused  = false;
    let stream      = null;
  
    // Function to start the camera
    async function startCamera() {
      if (stream) return;  // If the camera is already started, do nothing
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 240, height: 240 }
        });
        video.srcObject = stream;
        await video.play();
        console.log("Camera started.");
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
  
    // Function to stop the camera
    function stopCamera() {
      if (!stream) return;
      stream.getTracks().forEach(t => t.stop());
      stream = null;
      console.log("Camera stopped.");
    }
  
    // QR Detection loop
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
  
    // Start the camera after 2-second delay to ensure stability
    setTimeout(async () => {
      await startCamera();
      if (video.readyState >= video.HAVE_ENOUGH_DATA) detectLoop();
      else video.addEventListener("loadeddata", detectLoop, { once: true });
    }, 2000);  // 2-second delay for camera stability
  
    // Listen for stop camera message from the parent
    window.addEventListener("message", e => {
      if (e.data?.type === "stopCamera") stopCamera();
    });
  
    // Stop camera when page is unloading
    window.addEventListener("beforeunload", stopCamera);

    // Listen for messages from parent to start the camera
    window.addEventListener("message", (event) => {
        if (event.data?.type === "startCamera") {
            startCamera();  // Start the camera when a message is received
        }
    });
});
