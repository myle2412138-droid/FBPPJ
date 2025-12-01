/**
 * Metrics Calculator Module
 * Calculate image quality metrics (PSNR, SSIM)
 */

const $ = (selector) => document.querySelector(selector);

/**
 * Calculate PSNR between two images
 */
export function calculatePSNR(original, reconstructed) {
  const n = Math.min(original.length, reconstructed.length);
  let mse = 0;
  
  for (let i = 0; i < n; i++) {
    const diff = original[i] - reconstructed[i];
    mse += diff * diff;
  }
  
  mse /= n;
  
  if (mse === 0) return 100;
  return 10 * Math.log10((255 * 255) / mse);
}

/**
 * Calculate simplified SSIM
 * Note: This is a simplified version, not full SSIM
 */
export function calculateSSIM(original, reconstructed) {
  const n = Math.min(original.length, reconstructed.length);
  
  // Calculate means
  let meanX = 0, meanY = 0;
  for (let i = 0; i < n; i++) {
    meanX += original[i];
    meanY += reconstructed[i];
  }
  meanX /= n;
  meanY /= n;
  
  // Calculate variances and covariance
  let varX = 0, varY = 0, covar = 0;
  for (let i = 0; i < n; i++) {
    const dx = original[i] - meanX;
    const dy = reconstructed[i] - meanY;
    varX += dx * dx;
    varY += dy * dy;
    covar += dx * dy;
  }
  varX /= n;
  varY /= n;
  covar /= n;
  
  // SSIM constants
  const c1 = 6.5025;  // (0.01 * 255)^2
  const c2 = 58.5225; // (0.03 * 255)^2
  
  const ssim = ((2 * meanX * meanY + c1) * (2 * covar + c2)) / 
               ((meanX * meanX + meanY * meanY + c1) * (varX + varY + c2));
  
  return ssim;
}

/**
 * Calculate metrics from two Image objects
 */
export function calculateMetrics(originalImg, reconstructedImg, getImageData) {
  try {
    const origData = getImageData(originalImg);
    const recData = getImageData(reconstructedImg);
    
    // Extract grayscale values (R channel)
    const origGray = new Uint8Array(origData.width * origData.height);
    const recGray = new Uint8Array(recData.width * recData.height);
    
    for (let i = 0; i < origGray.length; i++) {
      origGray[i] = origData.data[i * 4];
    }
    
    for (let i = 0; i < recGray.length; i++) {
      recGray[i] = recData.data[i * 4];
    }
    
    const psnr = calculatePSNR(origGray, recGray);
    const ssim = calculateSSIM(origGray, recGray);
    
    return {
      psnr: psnr.toFixed(2),
      ssim: ssim.toFixed(3)
    };
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return { psnr: '--', ssim: '--' };
  }
}

/**
 * Display metrics in UI
 */
export function displayMetrics(metrics) {
  const psnrEl = $('#psnrValue');
  const ssimEl = $('#ssimValue');
  
  if (psnrEl) psnrEl.textContent = metrics.psnr;
  if (ssimEl) ssimEl.textContent = metrics.ssim;
}

/**
 * Update processing info display
 */
export function updateProcessingInfo(currentImage) {
  const numProjections = $('#numProjections');
  const filterType = $('#filterType');
  const imageSize = $('#imageSize');
  
  if (numProjections) {
    const infoProj = $('#infoProjections');
    if (infoProj) infoProj.textContent = numProjections.value;
  }
  
  if (filterType) {
    const infoFilter = $('#infoFilter');
    if (infoFilter) infoFilter.textContent = filterType.options[filterType.selectedIndex].text;
  }
  
  if (imageSize && currentImage) {
    const infoSize = $('#infoSize');
    if (infoSize) infoSize.textContent = imageSize.value + '×' + imageSize.value + 'px';
  }
}
