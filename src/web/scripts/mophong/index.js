/**
 * FBP Simulation - Main Entry Point
 * Modular architecture with clean separation of concerns
 * 
 * FLOW: Sinogram Input → FBP Algorithm → CT Image Output
 */

// ============================================
// IMPORTS (Using script tags for browser compatibility)
// ============================================
// Note: In production, use ES6 modules or bundler

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// ============================================
// GLOBAL STATE
// ============================================
let currentImage = null;
let sinogramData = null;
let reconstructedImage = null;
let isProcessing = false;
let processingStep = 0;

// FBP Processor instance (loaded from fbp_processor.js)
let fbpProcessor = null;

// ============================================
// INITIALIZATION
// ============================================
function init() {
  console.log('🚀 Initializing FBP Simulation...');
  
  // Initialize FBP Processor
  if (typeof FBPProcessor !== 'undefined') {
    fbpProcessor = new FBPProcessor();
  }
  
  // Initialize UI components
  initDynamicHeader();
  initMobileMenu();
  initInputTabs();
  initFileUpload();
  initWebcam();
  initPhantom();
  initControls();
  initCanvas();
  initAuthButtons();
  
  // Expose clearImage for button click
  window.clearImage = clearImage;
  
  console.log('✅ FBP Simulation initialized');
}

// ============================================
// UI CONTROLLER
// ============================================
function initDynamicHeader() {
  const header = $('#header');
  if (!header) return;
  
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.pageYOffset > 100);
  });
}

function initMobileMenu() {
  const menuToggle = $('#menuToggle');
  const headerNav = $('#mainNav');
  
  if (!menuToggle || !headerNav) return;
  
  menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('active');
    headerNav.classList.toggle('mobile-open');
  });
  
  document.addEventListener('click', (e) => {
    if (!headerNav.contains(e.target) && !menuToggle.contains(e.target)) {
      menuToggle.classList.remove('active');
      headerNav.classList.remove('mobile-open');
    }
  });
}

function initInputTabs() {
  const tabs = $$('.input-tab');
  const contents = $$('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab + '-tab';
      
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      $('#' + targetId)?.classList.add('active');
    });
  });
}

function initAuthButtons() {
  const loginBtn = $('.btn-login');
  const registerBtn = $('.btn-register');
  
  [loginBtn, registerBtn].forEach(btn => {
    if (btn && btn.tagName.toLowerCase() !== 'a') {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const hash = btn.classList.contains('btn-login') ? '#login' : '#register';
        window.location.href = '../auth/index.html' + hash;
      });
    }
  });
}

// ============================================
// FILE UPLOAD
// ============================================
function initFileUpload() {
  const uploadZone = $('#uploadZone');
  const fileInput = $('#fileInput');
  
  if (!uploadZone || !fileInput) return;
  
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
  
  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFileSelect(e.dataTransfer.files[0]);
  });
}

function handleFileSelect(file) {
  if (!file) return;
  
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'];
  if (!validTypes.includes(file.type)) {
    showNotification('Chỉ hỗ trợ file PNG, JPG, BMP', 'error');
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    showNotification('File quá lớn (max 10MB)', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      currentImage = img;
      displayImagePreview(img, file.name);
      drawImageToCanvas(img, 'largeOriginalCanvas');
      hideImagePlaceholder('originalPlaceholder');
      showNotification('Tải file thành công!', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function displayImagePreview(img, filename) {
  const preview = $('#filePreview');
  if (!preview) return;
  
  preview.innerHTML = `
    <div class="preview-card">
      <img src="${img.src}">
      <div class="preview-info">
        <p class="filename">${filename}</p>
        <small>${img.width}×${img.height}px</small>
      </div>
      <button class="btn-icon" onclick="clearImage()">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
}

function clearImage() {
  currentImage = null;
  sinogramData = null;
  reconstructedImage = null;
  
  const preview = $('#filePreview');
  if (preview) preview.innerHTML = '';
  
  const fileInput = $('#fileInput');
  if (fileInput) fileInput.value = '';
  
  showCanvasOverlay();
}

// ============================================
// WEBCAM
// ============================================
let webcamStream = null;

function initWebcam() {
  const startBtn = $('#startCameraBtn');
  const captureBtn = $('#captureBtn');
  const video = $('#webcamVideo');
  const canvas = $('#webcamCanvas');
  
  if (!startBtn || !video) return;
  
  startBtn.addEventListener('click', async () => {
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = webcamStream;
      video.style.display = 'block';
      startBtn.style.display = 'none';
      captureBtn.style.display = 'block';
      showNotification('Camera đã bật', 'success');
    } catch (err) {
      showNotification('Không thể truy cập camera', 'error');
    }
  });
  
  captureBtn?.addEventListener('click', () => {
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    webcamStream?.getTracks().forEach(t => t.stop());
    
    canvas.toBlob(blob => {
      const img = new Image();
      img.onload = () => {
        currentImage = img;
        drawImageToCanvas(img, 'largeOriginalCanvas');
        hideImagePlaceholder('originalPlaceholder');
        hideCanvasOverlay();
        showNotification('Chụp ảnh thành công!', 'success');
      };
      img.src = URL.createObjectURL(blob);
    });
    
    video.style.display = 'none';
    captureBtn.style.display = 'none';
    startBtn.style.display = 'block';
  });
}

// ============================================
// PHANTOM GENERATOR
// ============================================
function initPhantom() {
  const generateBtn = $('#generatePhantomBtn');
  if (!generateBtn) return;
  
  generateBtn.addEventListener('click', () => {
    const type = $('#phantomSelect').value;
    const size = parseInt($('#imageSize').value) || 256;
    
    const phantom = generatePhantom(type, size);
    currentImage = phantom;
    drawImageToCanvas(phantom, 'largeOriginalCanvas');
    hideImagePlaceholder('originalPlaceholder');
    hideCanvasOverlay();
    showNotification(`Phantom ${type} đã tạo`, 'success');
  });
}

function generatePhantom(type, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  
  switch(type) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'square':
      ctx.fillRect(size/4, size/4, size/2, size/2);
      break;
    case 'shepp-logan':
      drawSheppLogan(ctx, size);
      break;
    case 'custom':
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, Math.random() * size / 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
  
  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

function drawSheppLogan(ctx, size) {
  const cx = size / 2, cy = size / 2;
  
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.69, 0.92);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  
  [{x: 0.22, y: 0, a: 0.11, b: 0.31, angle: -18},
   {x: -0.22, y: 0, a: 0.16, b: 0.41, angle: 18}].forEach(e => {
    ctx.save();
    ctx.translate(cx + e.x * size, cy + e.y * size);
    ctx.rotate(e.angle * Math.PI / 180);
    ctx.scale(e.a, e.b);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ============================================
// CONTROLS
// ============================================
function initControls() {
  // Sliders
  const numProj = $('#numProjections');
  const projVal = $('#projValue');
  if (numProj && projVal) {
    numProj.addEventListener('input', (e) => projVal.textContent = e.target.value);
  }
  
  const imgSize = $('#imageSize');
  const sizeVal = $('#sizeValue');
  if (imgSize && sizeVal) {
    imgSize.addEventListener('input', (e) => sizeVal.textContent = e.target.value);
  }
  
  // Buttons
  $('#runBtn')?.addEventListener('click', runSimulation);
  $('#pauseBtn')?.addEventListener('click', pauseSimulation);
  $('#resetAllBtn')?.addEventListener('click', resetAll);
  $('#downloadBtn')?.addEventListener('click', downloadResults);
  
  $('#startSimBtn')?.addEventListener('click', () => {
    window.scrollTo({
      top: document.querySelector('.main-section')?.offsetTop - 80,
      behavior: 'smooth'
    });
  });
}

// ============================================
// CANVAS
// ============================================
function initCanvas() {
  const fullscreenBtn = $('#fullscreenBtn');
  const resultsDisplay = $('.results-display-area');
  
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

function drawImageToCanvas(img, canvasId) {
  const canvas = $('#' + canvasId);
  if (!canvas) return;
  
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  canvas.classList.add('active');
}

function clearCanvas(canvasId) {
  const canvas = $('#' + canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  canvas.classList.remove('active');
}

function hideImagePlaceholder(id) { $('#' + id)?.classList.add('hidden'); }
function showImagePlaceholder(id) { $('#' + id)?.classList.remove('hidden'); }
function hideCanvasOverlay() { $('#canvasOverlay')?.classList.add('hidden'); }
function showCanvasOverlay() { $('#canvasOverlay')?.classList.remove('hidden'); }

function getImageData(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// ============================================
// SIMULATION
// ============================================
async function runSimulation() {
  if (!currentImage) {
    showNotification('Vui lòng tải ảnh hoặc tạo phantom trước', 'warning');
    return;
  }
  
  if (isProcessing) {
    showNotification('Đang xử lý...', 'warning');
    return;
  }
  
  isProcessing = true;
  updateStatus('processing', 'Đang xử lý...');
  
  $('#runBtn').disabled = true;
  $('#pauseBtn').disabled = false;
  
  const startTime = Date.now();
  
  try {
    // Step 1: Load image
    await processStep(1, 'Loading image...', () => sleep(300));
    
    // Step 2: Create sinogram
    await processStep(2, 'Creating sinogram...', async () => {
      sinogramData = await createSinogram(currentImage);
      drawSinogram(sinogramData);
    });
    
    // Step 3: Apply filter
    await processStep(3, 'Applying filter...', () => sleep(500));
    
    // Step 4: Back-projection
    await processStep(4, 'Reconstructing...', async () => {
      reconstructedImage = await backProject(sinogramData);
      drawImageToCanvas(reconstructedImage, 'largeReconstructedCanvas');
      hideImagePlaceholder('reconstructedPlaceholder');
    });
    
    // Step 5: Complete
    await processStep(5, 'Calculating metrics...', async () => {
      const metrics = calculateMetrics(currentImage, reconstructedImage);
      displayMetrics(metrics);
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    updateTime(elapsed);
    updateStatus('success', 'Hoàn thành');
    showNotification('Mô phỏng hoàn tất!', 'success');
    
  } catch (err) {
    updateStatus('error', 'Lỗi');
    showNotification('Lỗi: ' + err.message, 'error');
    console.error(err);
  } finally {
    isProcessing = false;
    $('#runBtn').disabled = false;
    $('#pauseBtn').disabled = true;
  }
}

async function processStep(step, message, callback) {
  processingStep = step;
  updateProgress((step / 5) * 100);
  updateStatus('processing', message);
  
  // Update timeline
  $$('.timeline-step').forEach((s, i) => {
    s.classList.toggle('completed', i < step - 1);
    s.classList.toggle('active', i === step - 1);
  });
  
  $$('.timeline-connector').forEach((c, i) => {
    c.classList.toggle('active', i < step - 1);
  });
  
  await callback();
}

function pauseSimulation() {
  isProcessing = false;
  updateStatus('paused', 'Tạm dừng');
  showNotification('Đã tạm dừng', 'info');
}

function resetAll() {
  isProcessing = false;
  processingStep = 0;
  currentImage = null;
  sinogramData = null;
  reconstructedImage = null;
  
  clearImage();
  updateStatus('ready', 'Sẵn sàng');
  updateProgress(0);
  updateTime(0);
  
  ['largeOriginalCanvas', 'largeReconstructedCanvas', 'largeSinogramCanvas'].forEach(clearCanvas);
  ['originalPlaceholder', 'sinogramPlaceholder', 'reconstructedPlaceholder'].forEach(showImagePlaceholder);
  
  $$('.timeline-step').forEach(s => s.classList.remove('active', 'completed'));
  $$('.timeline-connector').forEach(c => c.classList.remove('active'));
  
  $('#psnrValue').textContent = '--';
  $('#ssimValue').textContent = '--';
  $('#timeValue').textContent = '--';
  
  showCanvasOverlay();
  showNotification('Đã reset', 'info');
}

// ============================================
// FBP ALGORITHMS
// ============================================
async function createSinogram(img) {
  if (!fbpProcessor) return null;
  
  const imageData = getImageData(img);
  const preprocessed = fbpProcessor.preprocessAndDenoise(imageData);
  return fbpProcessor.createSinogram(preprocessed);
}

function drawSinogram(sino) {
  const canvas = $('#largeSinogramCanvas');
  if (!canvas || !sino) return;
  
  canvas.width = sino.width;
  canvas.height = sino.height;
  
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(sino.width, sino.height);
  
  for (let i = 0; i < sino.display.length; i++) {
    const v = sino.display[i];
    const idx = i * 4;
    imgData.data[idx] = v;
    imgData.data[idx + 1] = v;
    imgData.data[idx + 2] = v;
    imgData.data[idx + 3] = 255;
  }
  
  ctx.putImageData(imgData, 0, 0);
  canvas.classList.add('active');
  hideImagePlaceholder('sinogramPlaceholder');
}

async function backProject(sino) {
  if (!fbpProcessor || !sino) return null;
  
  const recon = fbpProcessor.reconstructImage(sino);
  
  // Convert to Image
  const canvas = document.createElement('canvas');
  canvas.width = recon.width;
  canvas.height = recon.height;
  const ctx = canvas.getContext('2d');
  
  const imgData = ctx.createImageData(recon.width, recon.height);
  for (let i = 0; i < recon.data.length; i++) {
    const v = recon.data[i];
    const idx = i * 4;
    imgData.data[idx] = v;
    imgData.data[idx + 1] = v;
    imgData.data[idx + 2] = v;
    imgData.data[idx + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL();
  });
}

function calculateMetrics(orig, recon) {
  if (!fbpProcessor) return { psnr: '--', ssim: '--' };
  
  try {
    const origData = getImageData(orig);
    const reconData = getImageData(recon);
    const metrics = fbpProcessor.evaluateReconstruction(origData.data, reconData.data);
    return { psnr: metrics.psnr.toFixed(2), ssim: (metrics.ssim || 0).toFixed(3) };
  } catch (e) {
    return { psnr: '--', ssim: '--' };
  }
}

function displayMetrics(metrics) {
  $('#psnrValue').textContent = metrics.psnr;
  $('#ssimValue').textContent = metrics.ssim;
}

// ============================================
// UI HELPERS
// ============================================
function updateStatus(type, text) {
  const icon = $('#statusIcon');
  const statusText = $('#statusText');
  const spinner = $('#statusSpinner');
  
  if (icon) {
    icon.className = 'fas fa-circle';
    icon.style.color = {
      processing: 'var(--warning-color)',
      success: 'var(--success-color)',
      error: 'var(--error-color)'
    }[type] || 'var(--primary-color)';
    
    if (spinner) spinner.style.display = type === 'processing' ? 'inline-block' : 'none';
  }
  
  if (statusText) statusText.textContent = text;
}

function updateProgress(percent) {
  const el = $('#progressDisplay');
  if (el) el.textContent = Math.round(percent) + '%';
}

function updateTime(seconds) {
  $('#timeDisplay').textContent = seconds + 's';
  $('#timeValue').textContent = seconds;
}

function showNotification(msg, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${msg}`);
  alert(msg);
}

function downloadResults() {
  if (!reconstructedImage) {
    showNotification('Chưa có kết quả', 'warning');
    return;
  }
  
  const canvas = $('#largeReconstructedCanvas');
  if (!canvas) return;
  
  const link = document.createElement('a');
  link.download = 'fbp_reconstructed.png';
  link.href = canvas.toDataURL();
  link.click();
  showNotification('Đã tải kết quả', 'success');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// START
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
