/**
 * FBP Core Module - Filtered Back Projection
 * Main algorithm for CT image reconstruction
 * 
 * FLOW: Sinogram (FBP image) → Filter → Back-Projection → Viewable CT Image
 */

export class FBPCore {
  constructor(config = {}) {
    this.config = {
      maxImageSize: config.maxImageSize || 256,
      filterName: config.filterName || 'hann',
      ...config
    };
  }

  /**
   * MAIN METHOD: Reconstruct CT image from sinogram
   * Input: Sinogram/FBP scrambled image
   * Output: Viewable CT image
   */
  reconstructFromSinogram(sinogramImageData, progressCallback = null) {
    if (progressCallback) progressCallback(0.1, "Đang phân tích sinogram...");
    
    const { width, height, data } = sinogramImageData;
    
    // Normalize to [0, 1]
    const sinoFloat = new Float32Array(width * height);
    for (let i = 0; i < sinoFloat.length; i++) {
      sinoFloat[i] = data[i] / 255.0;
    }
    
    if (progressCallback) progressCallback(0.3, "Đang áp dụng filter...");
    
    // Calculate theta (angles)
    const theta = new Float32Array(height);
    for (let i = 0; i < height; i++) {
      theta[i] = (180.0 * i) / height;
    }
    
    // Apply filter
    const filtered = this._applyFilter(sinoFloat, width, height, this.config.filterName);
    
    if (progressCallback) progressCallback(0.6, "Đang thực hiện back-projection...");
    
    // Back-projection to reconstruct image
    const outputSize = width; // Square output
    const reconstruction = this._iradon(
      filtered, width, height, theta, outputSize, outputSize
    );
    
    if (progressCallback) progressCallback(0.9, "Đang chuẩn hóa ảnh...");
    
    // Normalize to [0, 255]
    const reconMin = Math.min(...reconstruction);
    const reconMax = Math.max(...reconstruction);
    const result = new Uint8ClampedArray(reconstruction.length);
    
    if (reconMax > reconMin) {
      for (let i = 0; i < reconstruction.length; i++) {
        result[i] = Math.round(
          ((reconstruction[i] - reconMin) / (reconMax - reconMin)) * 255
        );
      }
    } else {
      result.fill(128);
    }
    
    if (progressCallback) progressCallback(1.0, "Hoàn tất!");
    
    return {
      data: result,
      width: outputSize,
      height: outputSize
    };
  }

  /**
   * Filtered Back Projection - Iradon Transform
   */
  _iradon(sinogram, sinoWidth, sinoHeight, theta, targetHeight, targetWidth) {
    const numAngles = sinoHeight;
    const numDetectors = sinoWidth;
    const image = new Float32Array(targetHeight * targetWidth).fill(0);

    const centerX = targetWidth / 2.0;
    const centerY = targetHeight / 2.0;
    const detectorCenter = numDetectors / 2.0;

    for (let angleIdx = 0; angleIdx < numAngles; angleIdx++) {
      const angle = (theta[angleIdx] * Math.PI) / 180.0;
      const cosTheta = Math.cos(angle);
      const sinTheta = Math.sin(angle);

      for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const t = dx * cosTheta + dy * sinTheta + detectorCenter;

          if (t >= 0 && t < numDetectors - 1) {
            const value = this._linearInterpolate(
              sinogram, angleIdx * numDetectors, t, numDetectors
            );
            image[y * targetWidth + x] += value;
          }
        }
      }
    }

    // Normalize
    const normFactor = Math.PI / (2.0 * numAngles);
    for (let i = 0; i < image.length; i++) {
      image[i] *= normFactor;
    }

    return image;
  }

  /**
   * Apply frequency domain filter
   */
  _applyFilter(sinogram, width, height, filterName) {
    const filtered = new Float32Array(width * height);
    const filter = this._createRamLakFilter(width, filterName);

    for (let row = 0; row < height; row++) {
      const projection = sinogram.slice(row * width, (row + 1) * width);
      const filteredProj = this._convolve1D(projection, filter);

      for (let col = 0; col < width; col++) {
        filtered[row * width + col] = filteredProj[col];
      }
    }

    return filtered;
  }

  /**
   * Create Ram-Lak filter with window
   */
  _createRamLakFilter(size, filterName) {
    const filter = new Float32Array(size);
    const center = Math.floor(size / 2);

    // Base Ram-Lak filter
    for (let i = 0; i < size; i++) {
      const n = i - center;
      if (n === 0) {
        filter[i] = 0.25;
      } else if (n % 2 === 0) {
        filter[i] = 0;
      } else {
        filter[i] = -1.0 / (Math.PI * Math.PI * n * n);
      }
    }

    // Apply window
    switch (filterName.toLowerCase()) {
      case 'hann':
        for (let i = 0; i < size; i++) {
          const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
          filter[i] *= w;
        }
        break;

      case 'hamming':
        for (let i = 0; i < size; i++) {
          const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
          filter[i] *= w;
        }
        break;

      case 'shepp-logan':
      case 'cosine':
        for (let i = 0; i < size; i++) {
          const n = i - center;
          if (n !== 0) {
            const x = (Math.PI * n) / size;
            filter[i] *= Math.sin(x) / x;
          }
        }
        break;
    }

    return filter;
  }

  /**
   * 1D Convolution
   */
  _convolve1D(signal, kernel) {
    const result = new Float32Array(signal.length);
    const halfKernel = Math.floor(kernel.length / 2);

    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      for (let j = 0; j < kernel.length; j++) {
        const idx = i - halfKernel + j;
        if (idx >= 0 && idx < signal.length) {
          sum += signal[idx] * kernel[j];
        }
      }
      result[i] = sum;
    }

    return result;
  }

  /**
   * Linear Interpolation
   */
  _linearInterpolate(array, offset, index, length) {
    const i0 = Math.floor(index);
    const i1 = Math.min(i0 + 1, length - 1);
    const w = index - i0;

    const v0 = array[offset + i0];
    const v1 = array[offset + i1];

    return v0 * (1 - w) + v1 * w;
  }

  /**
   * Get available filter types
   */
  static getFilterTypes() {
    return [
      { value: 'ramp', name: 'Ram-Lak (Ramp)' },
      { value: 'hann', name: 'Hann' },
      { value: 'hamming', name: 'Hamming' },
      { value: 'shepp-logan', name: 'Shepp-Logan' },
      { value: 'cosine', name: 'Cosine' }
    ];
  }
}

// Export singleton instance
export const fbpCore = new FBPCore();
