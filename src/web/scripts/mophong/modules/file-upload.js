/**
 * File Upload Module
 * Handles file upload, drag-drop, and webcam capture
 */

const $ = (selector) => document.querySelector(selector);

// Callbacks that will be set by main module
let onImageLoaded = null;
let showNotificationFn = null;

/**
 * Set callbacks for file upload events
 */
export function setCallbacks(callbacks) {
  onImageLoaded = callbacks.onImageLoaded;
  showNotificationFn = callbacks.showNotification;
}

/**
 * Initialize file upload zone
 */
export function initFileUpload() {
  const uploadZone = $('#uploadZone');
  const fileInput = $('#fileInput');
  
  if (!uploadZone || !fileInput) return;
  
  // Click to upload
  uploadZone.addEventListener('click', () => fileInput.click());
  
  // File input change
  fileInput.addEventListener('change', (e) => {
    handleFileSelect(e.target.files[0]);
  });
  
  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });
  
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFileSelect(e.dataTransfer.files[0]);
  });
}

/**
 * Handle file selection
 */
function handleFileSelect(file) {
  if (!file) return;
  
  // Validate file type
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'];
  if (!validTypes.includes(file.type)) {
    if (showNotificationFn) showNotificationFn('Chỉ hỗ trợ file PNG, JPG, BMP', 'error');
    return;
  }
  
  // Validate file size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    if (showNotificationFn) showNotificationFn('File quá lớn (max 10MB)', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      if (onImageLoaded) onImageLoaded(img, file.name);
      if (showNotificationFn) showNotificationFn('Tải file thành công!', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Display image preview
 */
export function displayImagePreview(img, filename) {
  const filePreview = $('#filePreview');
  if (!filePreview) return;
  
  filePreview.innerHTML = `
    <div style="padding: 16px; background: var(--bg-dark); border-radius: 12px; border: 2px solid var(--border-color);">
      <img src="${img.src}" style="width: 100%; border-radius: 8px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p style="margin: 0; font-size: 14px; font-weight: 600;">${filename}</p>
          <small style="color: var(--text-secondary);">${img.width}×${img.height}px</small>
        </div>
        <button class="btn-icon" onclick="window.clearImage && window.clearImage()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Clear image preview
 */
export function clearImagePreview() {
  const filePreview = $('#filePreview');
  if (filePreview) filePreview.innerHTML = '';
  
  const fileInput = $('#fileInput');
  if (fileInput) fileInput.value = '';
}

/**
 * Initialize webcam functionality
 */
export function initWebcam() {
  const startCameraBtn = $('#startCameraBtn');
  const captureBtn = $('#captureBtn');
  const video = $('#webcamVideo');
  const canvas = $('#webcamCanvas');
  
  let webcamStream = null;
  
  if (!startCameraBtn || !video) return;
  
  startCameraBtn.addEventListener('click', async () => {
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = webcamStream;
      video.style.display = 'block';
      startCameraBtn.style.display = 'none';
      captureBtn.style.display = 'block';
      if (showNotificationFn) showNotificationFn('Camera đã bật', 'success');
    } catch (err) {
      if (showNotificationFn) showNotificationFn('Không thể truy cập camera: ' + err.message, 'error');
    }
  });
  
  if (captureBtn) {
    captureBtn.addEventListener('click', () => {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      
      // Stop webcam
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
      
      // Convert to image
      canvas.toBlob(blob => {
        const img = new Image();
        img.onload = () => {
          if (onImageLoaded) onImageLoaded(img, 'webcam_capture.jpg');
          if (showNotificationFn) showNotificationFn('Chụp ảnh thành công!', 'success');
        };
        img.src = URL.createObjectURL(blob);
      });
      
      video.style.display = 'none';
      captureBtn.style.display = 'none';
      startCameraBtn.style.display = 'block';
    });
  }
}
