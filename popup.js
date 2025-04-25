document.addEventListener("DOMContentLoaded", async () => {
    const canvas = document.getElementById("canvas");
    canvas.width = 240;
    canvas.height = 240;
    canvas.style.transform = "scale(-1,1)";
  
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const video = document.getElementById("video");
  
    const FRAMERATE = 12;
    let lastFrame = 0;
    let isProcessing = false;
    let scanPaused = false;
  
    const icon = new Image(240, 240);
    icon.src = "icon.png";
  
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 240, height: 240 }
        });
        video.srcObject = stream;
        await video.play();
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
  
    function runDetection() {
      const detect = ts => {
        requestAnimationFrame(detect);
        if (scanPaused || isProcessing) return;
        if (ts - lastFrame < 1000 / FRAMERATE) return;
        lastFrame = ts;
        isProcessing = true;
  
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
        isProcessing = false;
      };
      requestAnimationFrame(detect);
    }
  
    await startCamera();
    if (video.readyState >= video.HAVE_ENOUGH_DATA) runDetection();
    else video.addEventListener("loadeddata", runDetection, { once: true });
  });
  