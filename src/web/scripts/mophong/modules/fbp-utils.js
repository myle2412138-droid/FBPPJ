/**
 * FBP Utils Module
 * Utility functions for image processing
 */

/**
 * Preprocess and denoise grayscale image
 */
export function preprocessAndDenoise(imageData, progressCallback = null) {
  if (progressCallback) progressCallback(0.1, "Đang chuẩn bị ảnh...");

  const { width, height, data } = imageData;
  const imgFloat = new Float32Array(width * height);

  // Convert to grayscale and normalize to [0, 1]
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const gray = (
      0.299 * data[idx] +
      0.587 * data[idx + 1] +
      0.114 * data[idx + 2]
    ) / 255.0;
    imgFloat[i] = gray;
  }

  if (progressCallback) progressCallback(0.4, "Đang cân bằng histogram...");

  // Histogram equalization
  const equalized = adaptiveHistogramEqualization(imgFloat, width, height);

  if (progressCallback) progressCallback(0.7, "Đang khử nhiễu...");

  // Denoise
  const denoised = nonLocalMeansDenoise(equalized, width, height);

  // Convert back to uint8
  const result = new Uint8ClampedArray(width * height);
  for (let i = 0; i < denoised.length; i++) {
    result[i] = Math.round(denoised[i] * 255);
  }

  if (progressCallback) progressCallback(1.0, "Hoàn tất xử lý!");

  return { data: result, width, height };
}

/**
 * Adaptive Histogram Equalization
 */
export function adaptiveHistogramEqualization(image, width, height) {
  const hist = new Array(256).fill(0);
  
  // Calculate histogram
  for (let i = 0; i < image.length; i++) {
    const bin = Math.floor(image[i] * 255);
    hist[bin]++;
  }

  // Cumulative distribution
  const cdf = new Array(256);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + hist[i];
  }

  // Normalize
  const cdfMin = cdf.find(v => v > 0);
  const total = width * height;
  const equalized = new Float32Array(image.length);

  for (let i = 0; i < image.length; i++) {
    const bin = Math.floor(image[i] * 255);
    equalized[i] = (cdf[bin] - cdfMin) / (total - cdfMin);
  }

  return equalized;
}

/**
 * Non-local Means Denoising (simplified)
 */
export function nonLocalMeansDenoise(image, width, height, patchSize = 3, h = 0.05) {
  const denoised = new Float32Array(image.length);
  const halfPatch = Math.floor(patchSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumWeights = 0;
      let sumValues = 0;

      for (let dy = -halfPatch; dy <= halfPatch; dy++) {
        for (let dx = -halfPatch; dx <= halfPatch; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const dist = Math.sqrt(dx * dx + dy * dy) / patchSize;
            const weight = Math.exp(-(dist * dist) / (h * h));

            sumWeights += weight;
            sumValues += weight * image[ny * width + nx];
          }
        }
      }

      denoised[y * width + x] = sumWeights > 0 ? sumValues / sumWeights : image[y * width + x];
    }
  }

  return denoised;
}

/**
 * Resize image
 */
export function resizeImage(data, oldWidth, oldHeight, newWidth, newHeight) {
  const resized = new Uint8ClampedArray(newWidth * newHeight);
  const scaleX = oldWidth / newWidth;
  const scaleY = oldHeight / newHeight;

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.min(Math.floor(x * scaleX), oldWidth - 1);
      const srcY = Math.min(Math.floor(y * scaleY), oldHeight - 1);
      resized[y * newWidth + x] = data[srcY * oldWidth + srcX];
    }
  }

  return resized;
}

/**
 * Bilinear Interpolation
 */
export function bilinearInterpolate(image, x, y, width, height) {
  const x0 = Math.floor(x);
  const x1 = Math.min(x0 + 1, width - 1);
  const y0 = Math.floor(y);
  const y1 = Math.min(y0 + 1, height - 1);

  const wx = x - x0;
  const wy = y - y0;

  const v00 = image[y0 * width + x0];
  const v10 = image[y0 * width + x1];
  const v01 = image[y1 * width + x0];
  const v11 = image[y1 * width + x1];

  const top = v00 * (1 - wx) + v10 * wx;
  const bottom = v01 * (1 - wx) + v11 * wx;

  return top * (1 - wy) + bottom * wy;
}

/**
 * Get image info
 */
export function getImageInfo(imageData) {
  const { width, height, data } = imageData;
  let min = 255, max = 0;

  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }

  return {
    "Kích thước": `${width} x ${height} pixels`,
    "Độ sâu": data instanceof Uint8ClampedArray ? "uint8" : "float32",
    "Kênh màu": "Grayscale",
    "Min/Max": `${min} / ${max}`
  };
}
