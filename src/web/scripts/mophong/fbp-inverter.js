/**
 * FBP Inverter - Convert Sinogram to CT Image
 * 
 * FLOW: Sinogram (scrambled FBP image) → FBP Algorithm → Viewable CT Image
 * 
 * This is the INVERSE of traditional CT scanning:
 * - Traditional: Object → X-ray projections → Sinogram → FBP → CT Image
 * - This tool: Sinogram → FBP → CT Image (reconstructs from existing sinogram)
 */

class FBPInverter {
  constructor(options = {}) {
    this.config = {
      maxSize: options.maxSize || 512,
      filterType: options.filterType || 'ram-lak',  // ram-lak, shepp-logan, cosine, hamming, hann
      interpolation: options.interpolation || 'linear',
      outputSize: options.outputSize || null  // null = auto (square from sinogram width)
    };
    
    // Filter presets
    this.filters = {
      'ram-lak': this._createRamLakFilter.bind(this),
      'shepp-logan': this._createSheppLoganFilter.bind(this),
      'cosine': this._createCosineFilter.bind(this),
      'hamming': this._createHammingFilter.bind(this),
      'hann': this._createHannFilter.bind(this)
    };
  }

  /**
   * Main entry point: Convert sinogram image to CT image
   * @param {HTMLImageElement|ImageData} sinogramInput - Input sinogram
   * @param {Function} progressCallback - Progress callback (percent, message)
   * @returns {Object} - { image: ImageData, canvas: HTMLCanvasElement, metrics: Object }
   */
  async reconstruct(sinogramInput, progressCallback = null) {
    const progress = (p, msg) => progressCallback && progressCallback(p, msg);
    
    try {
      // Step 1: Load and validate sinogram
      progress(0, 'Đang tải sinogram...');
      const sinogram = await this._loadSinogram(sinogramInput);
      
      // Step 2: Preprocess sinogram
      progress(10, 'Đang tiền xử lý...');
      const preprocessed = this._preprocessSinogram(sinogram);
      
      // Step 3: Apply frequency filter
      progress(30, `Đang áp dụng bộ lọc ${this.config.filterType}...`);
      const filtered = this._applyFilter(preprocessed);
      
      // Create filtered sinogram visualization
      const filteredSinogramCanvas = this._createFilteredSinogramVisualization(filtered);
      
      // Step 4: Back-projection
      progress(50, 'Đang chiếu ngược (back-projection)...');
      const reconstructed = await this._backProject(filtered, progress);
      
      // Step 5: Post-process
      progress(90, 'Đang xử lý hậu kỳ...');
      const final = this._postProcess(reconstructed);
      
      // Step 6: Create output
      progress(95, 'Đang tạo ảnh đầu ra...');
      const output = this._createOutput(final);
      
      progress(100, 'Hoàn thành!');
      
      return {
        image: output.imageData,
        canvas: output.canvas,
        filteredSinogram: filteredSinogramCanvas,
        width: final.width,
        height: final.height,
        sinogramInfo: {
          width: sinogram.width,
          height: sinogram.height,
          numAngles: sinogram.height,
          numDetectors: sinogram.width
        }
      };
      
    } catch (error) {
      console.error('FBP Reconstruction error:', error);
      throw error;
    }
  }

  /**
   * Create visualization canvas for filtered sinogram
   */
  _createFilteredSinogramVisualization(sinogram) {
    const { data, width, height } = sinogram;
    
    // Find min/max for normalization
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    
    const range = max - min || 1;
    for (let i = 0; i < data.length; i++) {
      const value = Math.round(((data[i] - min) / range) * 255);
      const idx = i * 4;
      imageData.data[idx] = value;
      imageData.data[idx + 1] = value;
      imageData.data[idx + 2] = value;
      imageData.data[idx + 3] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Load sinogram from various input types
   */
  async _loadSinogram(input) {
    let imageData;
    
    if (input instanceof HTMLImageElement) {
      const canvas = document.createElement('canvas');
      canvas.width = input.naturalWidth || input.width;
      canvas.height = input.naturalHeight || input.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(input, 0, 0);
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else if (input instanceof ImageData) {
      imageData = input;
    } else if (input instanceof HTMLCanvasElement) {
      const ctx = input.getContext('2d');
      imageData = ctx.getImageData(0, 0, input.width, input.height);
    } else {
      throw new Error('Input không hợp lệ. Cần HTMLImageElement, ImageData hoặc Canvas');
    }
    
    // Convert to grayscale float array
    const { width, height, data } = imageData;
    const grayscale = new Float32Array(width * height);
    
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      // Luminance formula
      grayscale[i] = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255.0;
    }
    
    return {
      data: grayscale,
      width,
      height,
      numAngles: height,      // Rows = projection angles
      numDetectors: width     // Columns = detector positions
    };
  }

  /**
   * Preprocess sinogram (normalize, remove artifacts)
   */
  _preprocessSinogram(sinogram) {
    const { data, width, height } = sinogram;
    const processed = new Float32Array(data.length);
    
    // Find min/max for normalization
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    
    // Normalize to [0, 1]
    const range = max - min || 1;
    for (let i = 0; i < data.length; i++) {
      processed[i] = (data[i] - min) / range;
    }
    
    return {
      data: processed,
      width,
      height,
      numAngles: height,
      numDetectors: width
    };
  }

  /**
   * Apply frequency domain filter to each projection
   */
  _applyFilter(sinogram) {
    const { data, width, height } = sinogram;
    const filtered = new Float32Array(data.length);
    
    // Create filter
    const filterFunc = this.filters[this.config.filterType] || this.filters['ram-lak'];
    const filter = filterFunc(width);
    
    // Apply filter to each row (each projection angle)
    for (let row = 0; row < height; row++) {
      const rowStart = row * width;
      const projection = data.slice(rowStart, rowStart + width);
      
      // Convolve with filter
      const filteredProjection = this._convolve(projection, filter);
      
      for (let col = 0; col < width; col++) {
        filtered[rowStart + col] = filteredProjection[col];
      }
    }
    
    return {
      data: filtered,
      width,
      height,
      numAngles: height,
      numDetectors: width
    };
  }

  /**
   * Back-projection: Reconstruct image from filtered projections
   */
  async _backProject(sinogram, progressCallback) {
    const { data, width, height, numAngles, numDetectors } = sinogram;
    
    // Determine output size
    const outputSize = this.config.outputSize || numDetectors;
    const image = new Float32Array(outputSize * outputSize).fill(0);
    
    const centerX = outputSize / 2;
    const centerY = outputSize / 2;
    const detectorCenter = numDetectors / 2;
    
    // Calculate angle step
    const angleStep = Math.PI / numAngles;
    
    for (let angleIdx = 0; angleIdx < numAngles; angleIdx++) {
      const theta = angleIdx * angleStep;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      
      // Update progress every 10%
      if (angleIdx % Math.floor(numAngles / 10) === 0) {
        const percent = 50 + (angleIdx / numAngles) * 40;
        progressCallback && progressCallback(percent, `Back-projection: ${Math.round(angleIdx / numAngles * 100)}%`);
        await this._yield();  // Allow UI to update
      }
      
      for (let y = 0; y < outputSize; y++) {
        for (let x = 0; x < outputSize; x++) {
          // Calculate detector position for this pixel
          const dx = x - centerX;
          const dy = y - centerY;
          const t = dx * cosTheta + dy * sinTheta + detectorCenter;
          
          // Interpolate sinogram value
          if (t >= 0 && t < numDetectors - 1) {
            const t0 = Math.floor(t);
            const t1 = t0 + 1;
            const w = t - t0;
            
            const v0 = data[angleIdx * numDetectors + t0];
            const v1 = data[angleIdx * numDetectors + t1];
            const value = v0 * (1 - w) + v1 * w;
            
            image[y * outputSize + x] += value;
          }
        }
      }
    }
    
    // Normalize
    const normFactor = Math.PI / (2 * numAngles);
    for (let i = 0; i < image.length; i++) {
      image[i] *= normFactor;
    }
    
    return {
      data: image,
      width: outputSize,
      height: outputSize
    };
  }

  /**
   * Post-process reconstructed image
   */
  _postProcess(image) {
    const { data, width, height } = image;
    const processed = new Float32Array(data.length);
    
    // Find min/max
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    
    // Normalize to [0, 1]
    const range = max - min || 1;
    for (let i = 0; i < data.length; i++) {
      processed[i] = Math.max(0, Math.min(1, (data[i] - min) / range));
    }
    
    // Optional: Apply gamma correction for better visualization
    const gamma = 1.0;
    if (gamma !== 1.0) {
      for (let i = 0; i < processed.length; i++) {
        processed[i] = Math.pow(processed[i], 1 / gamma);
      }
    }
    
    return {
      data: processed,
      width,
      height
    };
  }

  /**
   * Create output canvas and ImageData
   */
  _createOutput(image) {
    const { data, width, height } = image;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(width, height);
    
    for (let i = 0; i < data.length; i++) {
      const value = Math.round(data[i] * 255);
      const idx = i * 4;
      imageData.data[idx] = value;      // R
      imageData.data[idx + 1] = value;  // G
      imageData.data[idx + 2] = value;  // B
      imageData.data[idx + 3] = 255;    // A
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    return { canvas, imageData };
  }

  // ==================== FILTER FUNCTIONS ====================

  /**
   * Ram-Lak (ramp) filter - standard CT reconstruction filter
   */
  _createRamLakFilter(size) {
    const filter = new Float32Array(size);
    const center = Math.floor(size / 2);
    
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
    
    return filter;
  }

  /**
   * Shepp-Logan filter (smoother than Ram-Lak)
   */
  _createSheppLoganFilter(size) {
    const ramLak = this._createRamLakFilter(size);
    const filter = new Float32Array(size);
    const center = Math.floor(size / 2);
    
    for (let i = 0; i < size; i++) {
      const n = i - center;
      if (n === 0) {
        filter[i] = ramLak[i];
      } else {
        const x = Math.PI * n / size;
        filter[i] = ramLak[i] * Math.sin(x) / x;
      }
    }
    
    return filter;
  }

  /**
   * Cosine filter
   */
  _createCosineFilter(size) {
    const ramLak = this._createRamLakFilter(size);
    const filter = new Float32Array(size);
    const center = Math.floor(size / 2);
    
    for (let i = 0; i < size; i++) {
      const n = i - center;
      const x = Math.PI * n / size;
      filter[i] = ramLak[i] * Math.cos(x);
    }
    
    return filter;
  }

  /**
   * Hamming window filter
   */
  _createHammingFilter(size) {
    const ramLak = this._createRamLakFilter(size);
    const filter = new Float32Array(size);
    
    for (let i = 0; i < size; i++) {
      const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1));
      filter[i] = ramLak[i] * w;
    }
    
    return filter;
  }

  /**
   * Hann window filter
   */
  _createHannFilter(size) {
    const ramLak = this._createRamLakFilter(size);
    const filter = new Float32Array(size);
    
    for (let i = 0; i < size; i++) {
      const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
      filter[i] = ramLak[i] * w;
    }
    
    return filter;
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * 1D convolution
   */
  _convolve(signal, kernel) {
    const result = new Float32Array(signal.length);
    const kCenter = Math.floor(kernel.length / 2);
    
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      for (let j = 0; j < kernel.length; j++) {
        const signalIdx = i + j - kCenter;
        if (signalIdx >= 0 && signalIdx < signal.length) {
          sum += signal[signalIdx] * kernel[j];
        }
      }
      result[i] = sum;
    }
    
    return result;
  }

  /**
   * Yield to allow UI updates
   */
  _yield() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Set filter type
   */
  setFilter(filterType) {
    if (this.filters[filterType]) {
      this.config.filterType = filterType;
    }
  }

  /**
   * Set output size
   */
  setOutputSize(size) {
    this.config.outputSize = size;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FBPInverter;
}
