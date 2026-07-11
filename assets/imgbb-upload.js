"use strict";

(() => {
  const MAX_DIMENSION = 1600;
  const JPEG_QUALITY = 0.86;

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read the selected image."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The selected image could not be opened."));
      image.src = dataUrl;
    });
  }

  async function prepareImage(file) {
    const originalDataUrl = await readFile(file);
    const image = await loadImage(originalDataUrl);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));

    if (scale === 1 && file.size < 2_500_000) return originalDataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", {alpha: false});
    if (!context) return originalDataUrl;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  }

  function setStatus(message) {
    const status = document.getElementById("uploadStatus");
    if (status) status.textContent = message;
  }

  function setPreview(url) {
    const input = document.getElementById("fImage");
    const image = document.getElementById("previewImg");
    const empty = document.getElementById("previewEmpty");
    if (input) input.value = url;
    if (image) {
      image.src = url;
      image.style.display = "block";
    }
    if (empty) empty.style.display = "none";
  }

  window.addEventListener("DOMContentLoaded", () => {
    const panel = document.getElementById("imgbbKeyPanel");
    if (panel) {
      panel.classList.add("hidden");
      panel.style.display = "none";
      panel.setAttribute("aria-hidden", "true");
    }

    const button = document.getElementById("uploadBtn");
    const fileInput = document.getElementById("fImageFile");
    if (!button || !fileInput) return;

    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const file = fileInput.files?.[0];
      if (!file) {
        setStatus("Choose an image first.");
        return;
      }
      if (!file.type.startsWith("image/")) {
        setStatus("Choose a valid image file.");
        return;
      }

      button.disabled = true;
      try {
        setStatus("Preparing image…");
        const image = await prepareImage(file);
        setStatus("Uploading image…");

        const response = await fetch("/api/upload-image", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({image, name: file.name})
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success || !data.data?.url) {
          throw new Error(data.message || data.error?.message || "Image upload failed.");
        }

        const url = data.data.display_url || data.data.url;
        setPreview(url);
        setStatus("Image uploaded successfully.");
      } catch (error) {
        setStatus(`Upload failed: ${error.message}`);
      } finally {
        button.disabled = false;
      }
    }, true);
  });
})();
