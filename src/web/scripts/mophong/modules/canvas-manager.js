/**
 * Canvas Manager Module
 * Handles canvas operations for image display
 */

const $ = (selector) => document.querySelector(selector);

/**
 * Initialize canvas and fullscreen functionality
 */
export function initCanvas() {
  const fullscreenBtn = $('#fullscreenBtn');
  const resultsDisplay = document.querySelector('.results-display-area');
  
  if (fullscreenBtn && resultsDisplay) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        resultsDisplay.requestFullscreen();
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
      } else {
        document.exitFullscreen();
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
      }
    });
  }
}

/**
 * Draw image to canvas
 */
export function drawImageToCanvas(img, canvasId) {
  const canvas = $('#' + canvasId);
  if (!canvas) return;
  
  canvas.width = img.width;
  canvas.height = img.height;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  
  canvas.classList.add('active');
}

/**
 * Clear canvas content
 */
export function clearCanvas(canvasId) {
  const canvas = $('#' + canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  canvas.classList.remove('active');
}

/**
 * Hide image placeholder
 */
export function hideImagePlaceholder(placeholderId) {
  const placeholder = $('#' + placeholderId);
  if (placeholder) {
    placeholder.classList.add('hidden');
  }
}

/**
 * Show image placeholder
 */
export function showImagePlaceholder(placeholderId) {
  const placeholder = $('#' + placeholderId);
  if (placeholder) {
    placeholder.classList.remove('hidden');
  }
}

/**
 * Hide canvas overlay
 */
export function hideCanvasOverlay() {
  const overlay = $('#canvasOverlay');
  if (overlay) overlay.classList.add('hidden');
}

/**
 * Show canvas overlay
 */
export function showCanvasOverlay() {
  const overlay = $('#canvasOverlay');
  if (overlay) overlay.classList.remove('hidden');
}

/**
 * Get ImageData from image element
 */
export function getImageData(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Convert grayscale data to ImageData and draw to canvas
 */
export function drawGrayscaleToCanvas(data, width, height, canvasId) {
  const canvas = $('#' + canvasId);
  if (!canvas) return;
  
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const idx = i * 4;
    imageData.data[idx] = value;     // R
    imageData.data[idx + 1] = value; // G
    imageData.data[idx + 2] = value; // B
    imageData.data[idx + 3] = 255;   // A
  }
  
  ctx.putImageData(imageData, 0, 0);
  canvas.classList.add('active');
}

/**
 * Convert grayscale array to Image object
 */
export function grayscaleToImage(data, width, height) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const idx = i * 4;
      imageData.data[idx] = value;
      imageData.data[idx + 1] = value;
      imageData.data[idx + 2] = value;
      imageData.data[idx + 3] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL();
  });
}
