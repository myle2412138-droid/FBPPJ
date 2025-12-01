/**
 * FBP Reconstruction - Main Application
 * 
 * FLOW: Sinogram Input → Filter → Back-Projection → CT Image Output
 * 
 * This tool reconstructs CT images from sinograms using Filter Back-Projection algorithm
 */

// ============================================
// GLOBAL STATE
// ============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let state = {
  sinogramImage: null,           // Input sinogram
  filteredSinogram: null,        // After filtering
  reconstructedImage: null,      // Output CT image
  originalPhantom: null,         // For demo mode - original phantom for comparison
  isProcessing: false,
  fbpInverter: null,
  currentFilter: 'ramp'
};

// Canvas IDs mapping to HTML
const CANVAS_IDS = {
  inputSinogram: 'inputSinogramCanvas',
  filteredSinogram: 'filteredSinogramCanvas',
  reconstructedCT: 'reconstructedCTCanvas'
};

// ============================================
// INITIALIZATION
// ============================================
function init() {
  console.log('🚀 FBP Reconstruction - Sinogram to CT Image');
  
  // Initialize FBP Inverter
  if (typeof FBPInverter !== 'undefined') {
    state.fbpInverter = new FBPInverter();
    console.log('✅ FBPInverter loaded');
  } else {
    console.error('❌ FBPInverter not loaded! Make sure fbp-inverter.js is included.');
  }
  
  initUI();
  initCanvases();
  initFileUpload();
  initControls();
  initTabSystem();
  initPhantomGenerator();
  initWebcam();
  
  console.log('✅ Initialization complete');
}

// ============================================
// UI INITIALIZATION
// ============================================
function initUI() {
  // Dynamic header scroll effect
  const header = $('#header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.pageYOffset > 100);
    });
  }
  
  // Mobile menu
  const menuToggle = $('#menuToggle');
  const mainNav = $('#mainNav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      mainNav.classList.toggle('mobile-open');
    });
  }
  
  // Start simulation button - scroll to main section
  $('#startSimBtn')?.addEventListener('click', () => {
    const mainSection = document.querySelector('.main-section');
    if (mainSection) {
      window.scrollTo({
        top: mainSection.offsetTop - 80,
        behavior: 'smooth'
      });
    }
  });
  
  // Tutorial button
  $('#tutorialBtn')?.addEventListener('click', () => {
    showTutorial();
  });
}

function initCanvases() {
  // Initialize all canvases with default size
  Object.values(CANVAS_IDS).forEach(id => {
    const canvas = $('#' + id);
    if (canvas) {
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, 256, 256);
    }
  });
}

function initTabSystem() {
  const tabs = $$('.input-tab');
  const contents = $$('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      
      // Deactivate all tabs
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      // Activate selected tab
      tab.classList.add('active');
      const content = $(`#${tabId}-tab`);
      if (content) content.classList.add('active');
    });
  });
}

// ============================================
// FILE UPLOAD (Sinogram Input)
// ============================================
function initFileUpload() {
  const uploadZone = $('#uploadZone');
  const fileInput = $('#fileInput');
  
  if (!uploadZone || !fileInput) return;
  
  // Click to upload
  uploadZone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') {
      fileInput.click();
    }
  });
  
  // File input change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadSinogramFile(e.target.files[0]);
    }
  });
  
  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });
  
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length > 0) {
      loadSinogramFile(e.dataTransfer.files[0]);
    }
  });
}

function loadSinogramFile(file) {
  if (!file.type.startsWith('image/')) {
    showNotification('Vui lòng chọn file ảnh!', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.sinogramImage = img;
      state.originalPhantom = null; // Clear phantom since this is user upload
      displaySinogram(img);
      showNotification('Đã tải sinogram: ' + file.name, 'success');
      enableRunButton();
      setTimelineStep(1);
    };
    img.onerror = () => {
      showNotification('Không thể đọc ảnh!', 'error');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function displaySinogram(img) {
  const canvas = $('#' + CANVAS_IDS.inputSinogram);
  if (!canvas) return;
  
  // Set canvas size to match image
  canvas.width = img.width;
  canvas.height = img.height;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  
  // Hide placeholder
  $('#sinogramPlaceholder')?.classList.add('hidden');
  canvas.classList.add('active');
  
  // Update info
  updateInputInfo(img);
}

function updateInputInfo(img) {
  // Update info panel
  const infoInputSize = $('#infoInputSize');
  const infoProjections = $('#infoProjections');
  
  if (infoInputSize) infoInputSize.textContent = `${img.width} × ${img.height}`;
  if (infoProjections) infoProjections.textContent = img.height; // rows = angles
}

// ============================================
// PHANTOM GENERATOR (Demo Mode)
// ============================================
function initPhantomGenerator() {
  $('#generatePhantomBtn')?.addEventListener('click', () => {
    const type = $('#phantomSelect')?.value || 'shepp-logan';
    generateDemoSinogram(type);
  });
}

function generateDemoSinogram(type) {
  const size = parseInt($('#imageSize')?.value) || 256;
  const numAngles = parseInt($('#numProjections')?.value) || 180;
  
  showNotification(`Đang tạo sinogram demo từ ${type}...`, 'info');
  updateStatus('processing', 'Đang tạo phantom...');
  setTimelineStep(1);
  
  // Generate phantom image first
  const phantomCanvas = generatePhantom(type, size);
  state.originalPhantom = phantomCanvas; // Save for comparison
  
  // Create sinogram from phantom using Radon transform
  setTimeout(() => {
    updateStatus('processing', 'Đang tạo sinogram (Radon transform)...');
    
    const sinogramImg = createSinogramFromPhantom(phantomCanvas, numAngles);
    
    // Wait for image to load
    sinogramImg.onload = () => {
      state.sinogramImage = sinogramImg;
      displaySinogram(sinogramImg);
      updateStatus('ready', 'Sẵn sàng tái tạo');
      showNotification(`Đã tạo sinogram từ ${type} phantom`, 'success');
      enableRunButton();
    };
  }, 100);
}

function generatePhantom(type, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  
  // White shapes
  ctx.fillStyle = '#fff';
  
  switch (type) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'square':
      ctx.fillRect(size / 4, size / 4, size / 2, size / 2);
      break;
      
    case 'shepp-logan':
      drawSheppLogan(ctx, size);
      break;
      
    case 'custom':
      // Multiple shapes
      ctx.beginPath();
      ctx.arc(size * 0.3, size * 0.3, size / 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(size * 0.7, size * 0.3, size / 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(size * 0.2, size * 0.6, size * 0.3, size * 0.2);
      ctx.beginPath();
      ctx.arc(size * 0.7, size * 0.7, size / 5, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    default:
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2);
      ctx.fill();
  }
  
  return canvas;
}

function drawSheppLogan(ctx, size) {
  const cx = size / 2;
  const cy = size / 2;
  
  // Outer ellipse (skull)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.69, 0.92);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  
  // Inner dark ellipse (brain matter)
  ctx.fillStyle = '#333';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.6, 0.8);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  
  // Small bright ellipses (ventricles)
  ctx.fillStyle = '#fff';
  const ellipses = [
    { x: 0.22, y: 0, rx: 0.11, ry: 0.2 },
    { x: -0.22, y: 0, rx: 0.13, ry: 0.22 },
    { x: 0, y: 0.35, rx: 0.15, ry: 0.08 }
  ];
  
  ellipses.forEach(e => {
    ctx.save();
    ctx.translate(cx + e.x * size, cy + e.y * size);
    ctx.scale(e.rx, e.ry);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function createSinogramFromPhantom(phantomCanvas, numAngles) {
  // Get phantom data
  const size = phantomCanvas.width;
  const ctx = phantomCanvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, size, size);
  const imgFloat = new Float32Array(size * size);
  
  for (let i = 0; i < size * size; i++) {
    imgFloat[i] = imageData.data[i * 4] / 255.0;
  }
  
  // Radon transform parameters
  const diagonal = Math.ceil(Math.sqrt(2) * size);
  const sinogram = new Float32Array(diagonal * numAngles);
  
  const centerX = size / 2;
  const centerY = size / 2;
  
  // Compute Radon transform
  for (let a = 0; a < numAngles; a++) {
    const theta = (a / numAngles) * Math.PI;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    
    for (let t = 0; t < diagonal; t++) {
      const rho = t - diagonal / 2;
      let sum = 0;
      let count = 0;
      
      for (let s = -size / 2; s < size / 2; s++) {
        const x = Math.round(centerX + rho * cosT - s * sinT);
        const y = Math.round(centerY + rho * sinT + s * cosT);
        
        if (x >= 0 && x < size && y >= 0 && y < size) {
          sum += imgFloat[y * size + x];
          count++;
        }
      }
      
      sinogram[a * diagonal + t] = count > 0 ? sum / count * size : 0;
    }
  }
  
  // Normalize sinogram
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < sinogram.length; i++) {
    if (sinogram[i] < min) min = sinogram[i];
    if (sinogram[i] > max) max = sinogram[i];
  }
  
  // Create sinogram image
  const sinoCanvas = document.createElement('canvas');
  sinoCanvas.width = diagonal;
  sinoCanvas.height = numAngles;
  const sinoCtx = sinoCanvas.getContext('2d');
  const sinoImageData = sinoCtx.createImageData(diagonal, numAngles);
  
  const range = max - min || 1;
  for (let i = 0; i < sinogram.length; i++) {
    const v = Math.round(((sinogram[i] - min) / range) * 255);
    const idx = i * 4;
    sinoImageData.data[idx] = v;
    sinoImageData.data[idx + 1] = v;
    sinoImageData.data[idx + 2] = v;
    sinoImageData.data[idx + 3] = 255;
  }
  
  sinoCtx.putImageData(sinoImageData, 0, 0);
  
  const img = new Image();
  img.src = sinoCanvas.toDataURL();
  return img;
}

// ============================================
// WEBCAM
// ============================================
function initWebcam() {
  const startCameraBtn = $('#startCameraBtn');
  const captureBtn = $('#captureBtn');
  const video = $('#webcamVideo');
  const canvas = $('#webcamCanvas');
  
  if (!startCameraBtn || !video) return;
  
  let stream = null;
  
  startCameraBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      startCameraBtn.style.display = 'none';
      captureBtn.style.display = 'block';
    } catch (err) {
      showNotification('Không thể truy cập camera: ' + err.message, 'error');
    }
  });
  
  captureBtn?.addEventListener('click', () => {
    if (!video || !canvas) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Use captured image as sinogram
    const img = new Image();
    img.onload = () => {
      state.sinogramImage = img;
      displaySinogram(img);
      showNotification('Đã chụp ảnh làm sinogram', 'success');
      enableRunButton();
    };
    img.src = canvas.toDataURL();
    
    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      startCameraBtn.style.display = 'block';
      captureBtn.style.display = 'none';
    }
  });
}

// ============================================
// CONTROLS
// ============================================
function initControls() {
  // Filter select
  const filterSelect = $('#filterType');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      state.currentFilter = e.target.value;
      if (state.fbpInverter) {
        state.fbpInverter.setFilter(state.currentFilter);
      }
      $('#infoFilter').textContent = e.target.options[e.target.selectedIndex].text;
    });
  }
  
  // Number of projections slider
  const numProj = $('#numProjections');
  const projVal = $('#projValue');
  if (numProj && projVal) {
    numProj.addEventListener('input', (e) => {
      projVal.textContent = e.target.value;
    });
  }
  
  // Image size slider
  const imgSize = $('#imageSize');
  const sizeVal = $('#sizeValue');
  if (imgSize && sizeVal) {
    imgSize.addEventListener('input', (e) => {
      sizeVal.textContent = e.target.value;
      $('#infoSize').textContent = e.target.value + ' × ' + e.target.value;
    });
  }
  
  // Buttons
  $('#runBtn')?.addEventListener('click', runReconstruction);
  $('#resetAllBtn')?.addEventListener('click', resetAll);
  $('#downloadBtn')?.addEventListener('click', downloadResult);
  $('#pauseBtn')?.addEventListener('click', pauseReconstruction);
  $('#fullscreenBtn')?.addEventListener('click', toggleFullscreen);
}

function enableRunButton() {
  const btn = $('#runBtn');
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('disabled');
  }
}

function disableRunButton() {
  const btn = $('#runBtn');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('disabled');
  }
}

// ============================================
// RECONSTRUCTION (Main Function)
// ============================================
async function runReconstruction() {
  if (!state.sinogramImage) {
    showNotification('Vui lòng tải sinogram trước!', 'warning');
    return;
  }
  
  if (!state.fbpInverter) {
    showNotification('FBP Inverter chưa được khởi tạo!', 'error');
    return;
  }
  
  if (state.isProcessing) {
    showNotification('Đang xử lý...', 'warning');
    return;
  }
  
  state.isProcessing = true;
  disableRunButton();
  updateStatus('processing', 'Bắt đầu xử lý...');
  
  const startTime = Date.now();
  
  try {
    // Get filter type
    const filterType = $('#filterType')?.value || 'ramp';
    state.fbpInverter.setFilter(filterType);
    
    // Step 2: Apply filter
    setTimelineStep(2);
    updateStatus('processing', 'Áp dụng filter...');
    await sleep(100);
    
    // Run reconstruction
    const result = await state.fbpInverter.reconstruct(
      state.sinogramImage,
      (percent, message) => {
        updateProgress(percent);
        
        // Update timeline based on progress
        if (percent < 30) {
          setTimelineStep(2);
          updateStatus('processing', 'Filtering sinogram...');
        } else if (percent < 80) {
          setTimelineStep(3);
          updateStatus('processing', 'Back-projection... ' + Math.round(percent) + '%');
        } else {
          setTimelineStep(4);
          updateStatus('processing', 'Post-processing...');
        }
      }
    );
    
    // Display filtered sinogram if available
    if (result.filteredSinogram) {
      displayFilteredSinogram(result.filteredSinogram);
    }
    
    // Display reconstructed CT image
    setTimelineStep(5);
    displayReconstructedCT(result.canvas);
    state.reconstructedImage = result;
    
    // Calculate metrics
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    updateTime(elapsed);
    $('#timeValue').textContent = elapsed;
    
    // Calculate quality metrics if we have original phantom
    if (state.originalPhantom) {
      calculateMetrics(result.canvas, state.originalPhantom);
    }
    
    // Update status
    updateStatus('success', 'Hoàn thành!');
    updateProgress(100);
    showNotification(`Tái tạo CT hoàn tất trong ${elapsed}s`, 'success');
    
    // Enable download
    $('#downloadBtn')?.classList.remove('disabled');
    
  } catch (error) {
    console.error('Reconstruction error:', error);
    updateStatus('error', 'Lỗi: ' + error.message);
    showNotification('Lỗi: ' + error.message, 'error');
  } finally {
    state.isProcessing = false;
    enableRunButton();
  }
}

function displayFilteredSinogram(canvas) {
  const targetCanvas = $('#' + CANVAS_IDS.filteredSinogram);
  if (!targetCanvas) return;
  
  targetCanvas.width = canvas.width;
  targetCanvas.height = canvas.height;
  
  const ctx = targetCanvas.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  
  $('#filteredPlaceholder')?.classList.add('hidden');
  targetCanvas.classList.add('active');
}

function displayReconstructedCT(canvas) {
  const targetCanvas = $('#' + CANVAS_IDS.reconstructedCT);
  if (!targetCanvas) return;
  
  targetCanvas.width = canvas.width;
  targetCanvas.height = canvas.height;
  
  const ctx = targetCanvas.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  
  $('#reconstructedPlaceholder')?.classList.add('hidden');
  targetCanvas.classList.add('active');
  
  // Update output info
  $('#infoSize').textContent = `${canvas.width} × ${canvas.height}`;
}

function calculateMetrics(reconstructed, original) {
  // Get image data
  const recCtx = reconstructed.getContext('2d');
  const origCtx = original.getContext('2d');
  
  const size = Math.min(reconstructed.width, original.width);
  const recData = recCtx.getImageData(0, 0, size, size).data;
  const origData = origCtx.getImageData(0, 0, size, size).data;
  
  // Calculate MSE
  let mse = 0;
  let signalSum = 0;
  const n = size * size;
  
  for (let i = 0; i < n; i++) {
    const recVal = recData[i * 4] / 255;
    const origVal = origData[i * 4] / 255;
    const diff = recVal - origVal;
    mse += diff * diff;
    signalSum += origVal * origVal;
  }
  mse /= n;
  
  // PSNR
  const psnr = mse > 0 ? 10 * Math.log10(1 / mse) : Infinity;
  $('#psnrValue').textContent = psnr.toFixed(2);
  
  // SNR
  const snr = signalSum > 0 ? 10 * Math.log10(signalSum / (mse * n)) : 0;
  $('#snrValue').textContent = snr.toFixed(2);
  
  // SSIM (simplified)
  const ssim = calculateSSIM(recData, origData, size);
  $('#ssimValue').textContent = ssim.toFixed(4);
}

function calculateSSIM(img1, img2, size) {
  // Simplified SSIM calculation
  let mean1 = 0, mean2 = 0;
  const n = size * size;
  
  for (let i = 0; i < n; i++) {
    mean1 += img1[i * 4];
    mean2 += img2[i * 4];
  }
  mean1 /= n;
  mean2 /= n;
  
  let var1 = 0, var2 = 0, covar = 0;
  for (let i = 0; i < n; i++) {
    const d1 = img1[i * 4] - mean1;
    const d2 = img2[i * 4] - mean2;
    var1 += d1 * d1;
    var2 += d2 * d2;
    covar += d1 * d2;
  }
  var1 /= n;
  var2 /= n;
  covar /= n;
  
  const c1 = 6.5025;
  const c2 = 58.5225;
  
  const ssim = ((2 * mean1 * mean2 + c1) * (2 * covar + c2)) /
               ((mean1 * mean1 + mean2 * mean2 + c1) * (var1 + var2 + c2));
  
  return Math.max(0, Math.min(1, ssim));
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pauseReconstruction() {
  // TODO: Implement pause functionality
  showNotification('Tính năng tạm dừng chưa được hỗ trợ', 'info');
}

function resetAll() {
  state.sinogramImage = null;
  state.filteredSinogram = null;
  state.reconstructedImage = null;
  state.originalPhantom = null;
  state.isProcessing = false;
  
  // Clear all canvases
  Object.values(CANVAS_IDS).forEach(id => {
    const canvas = $('#' + id);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      canvas.classList.remove('active');
    }
  });
  
  // Show placeholders
  $('#sinogramPlaceholder')?.classList.remove('hidden');
  $('#filteredPlaceholder')?.classList.remove('hidden');
  $('#reconstructedPlaceholder')?.classList.remove('hidden');
  
  // Reset info
  ['infoInputSize', 'infoProjections', 'infoFilter', 'infoSize'].forEach(id => {
    const el = $('#' + id);
    if (el) el.textContent = '--';
  });
  
  // Reset metrics
  ['psnrValue', 'ssimValue', 'snrValue', 'timeValue'].forEach(id => {
    const el = $('#' + id);
    if (el) el.textContent = '--';
  });
  
  // Reset file input
  const fileInput = $('#fileInput');
  if (fileInput) fileInput.value = '';
  
  // Reset status and progress
  updateStatus('ready', 'Sẵn sàng');
  updateProgress(0);
  updateTime(0);
  resetTimeline();
  
  // Disable buttons
  disableRunButton();
  $('#downloadBtn')?.classList.add('disabled');
  
  showNotification('Đã reset tất cả', 'info');
}

function downloadResult() {
  if (!state.reconstructedImage) {
    showNotification('Chưa có kết quả để tải!', 'warning');
    return;
  }
  
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.download = `ct_reconstructed_${timestamp}.png`;
  link.href = state.reconstructedImage.canvas.toDataURL('image/png');
  link.click();
  
  showNotification('Đã tải ảnh CT', 'success');
}

function toggleFullscreen() {
  const resultsArea = $('.results-display-area');
  if (!resultsArea) return;
  
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    resultsArea.requestFullscreen();
  }
}

function showTutorial() {
  const message = `
    <h4>Hướng dẫn sử dụng</h4>
    <ol>
      <li><strong>Upload Sinogram:</strong> Chọn file ảnh sinogram hoặc tạo demo từ phantom</li>
      <li><strong>Cấu hình tham số:</strong> Chọn số projections và filter type</li>
      <li><strong>Tái tạo:</strong> Nhấn "Tái tạo ảnh CT" để bắt đầu</li>
      <li><strong>Xem kết quả:</strong> Ảnh CT tái tạo sẽ hiển thị bên phải</li>
      <li><strong>Tải về:</strong> Nhấn "Tải kết quả" để lưu ảnh</li>
    </ol>
  `;
  showNotification(message, 'info', 10000);
}

// ============================================
// STATUS & PROGRESS
// ============================================
function updateStatus(type, text) {
  const statusText = $('#statusText');
  const statusIcon = $('#statusIcon');
  const spinner = $('#statusSpinner');
  
  if (statusText) statusText.textContent = text;
  
  if (statusIcon) {
    const colors = {
      processing: '#ffc107',
      success: '#28a745',
      error: '#dc3545',
      ready: '#667eea'
    };
    statusIcon.style.color = colors[type] || colors.ready;
    statusIcon.style.display = type === 'processing' ? 'none' : 'inline-block';
  }
  
  if (spinner) {
    spinner.style.display = type === 'processing' ? 'inline-block' : 'none';
  }
}

function updateProgress(percent) {
  const el = $('#progressDisplay');
  const bar = $('#progressBar');
  
  if (el) el.textContent = Math.round(percent) + '%';
  if (bar) bar.style.width = percent + '%';
}

function updateTime(seconds) {
  const el = $('#timeDisplay');
  if (el) el.textContent = seconds + 's';
}

function setTimelineStep(step) {
  const steps = $$('.timeline-step');
  steps.forEach((el, idx) => {
    el.classList.remove('active', 'completed');
    if (idx + 1 < step) {
      el.classList.add('completed');
    } else if (idx + 1 === step) {
      el.classList.add('active');
    }
  });
}

function resetTimeline() {
  const steps = $$('.timeline-step');
  steps.forEach(el => {
    el.classList.remove('active', 'completed');
  });
}

// ============================================
// NOTIFICATIONS
// ============================================
function showNotification(message, type = 'info', duration = 4000) {
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Create notification container if not exists
  let container = $('#notificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificationContainer';
    container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
  }
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    padding: 12px 20px;
    border-radius: 8px;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#667eea'};
    color: ${type === 'warning' ? '#000' : '#fff'};
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
    max-width: 350px;
  `;
  
  const icons = {
    success: 'check-circle',
    error: 'exclamation-circle',
    warning: 'exclamation-triangle',
    info: 'info-circle'
  };
  
  notification.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 10px;">
      <i class="fas fa-${icons[type] || icons.info}" style="margin-top: 2px;"></i>
      <div>${message}</div>
    </div>
  `;
  
  container.appendChild(notification);
  
  // Auto remove
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// ============================================
// START APPLICATION
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.fbpApp = {
  state,
  runReconstruction,
  resetAll,
  generateDemoSinogram
};
