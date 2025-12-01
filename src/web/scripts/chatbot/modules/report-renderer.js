/**
 * Report Renderer Module
 * Renders medical reports in chat
 */

const $ = (selector) => document.querySelector(selector);

/**
 * Resize image blob to data URL
 */
async function blobToResizedDataUrl(blob, maxDim = 640, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        const scale = Math.max(width, height) > maxDim 
          ? maxDim / Math.max(width, height) 
          : 1;
        
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        URL.revokeObjectURL(img.src);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        URL.revokeObjectURL(img.src);
        reject(err);
      }
    };
    img.onerror = () => {
      try { URL.revokeObjectURL(img.src); } catch (e) {}
      reject(new Error('Image load error'));
    };
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Fetch and convert images to data URLs
 */
async function fetchImages(urls) {
  const images = [];
  const base = window.location.origin;
  
  for (const url of urls) {
    const fullUrl = url.startsWith('http') ? url : `${base}${url}`;
    try {
      const response = await fetch(fullUrl);
      if (response.ok) {
        const blob = await response.blob();
        const dataUrl = await blobToResizedDataUrl(blob);
        images.push(dataUrl);
        continue;
      }
    } catch (e) {
      console.warn('Could not fetch image', fullUrl, e);
    }
    images.push(fullUrl); // Fallback
  }
  
  return images;
}

/**
 * Get value from object with multiple possible keys
 */
function getValue(obj, keys, defaultVal = undefined) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return defaultVal;
}

/**
 * Render report to bot message element
 */
export async function renderReport(report, element) {
  const patientName = getValue(report, ['patient_name', 'safe_patient_name'], 'Không rõ');
  const timestamp = report.timestamp || 'Không rõ';
  const frameCount = getValue(report, ['frame_count', 'frameCount'], 'Không rõ');
  const summary = getValue(report, ['summary', 'report_text', 'reportText'], 'Không có tóm tắt.');
  
  // Collect image URLs
  const imageUrls = [];
  
  if (Array.isArray(report.detected_frames)) {
    imageUrls.push(...report.detected_frames);
  }
  
  if (Array.isArray(report.detections)) {
    report.detections.forEach(d => {
      if (d.image_path) imageUrls.push(d.image_path);
    });
  }
  
  // Fallback: try to construct URLs
  if (imageUrls.length === 0 && report.safe_patient_name && report.timestamp) {
    for (let i = 0; i < 6; i++) {
      imageUrls.push(`/results/${report.safe_patient_name}_${report.timestamp}_tumor_${i}.jpg`);
    }
  }
  
  // Fetch and convert images
  const images = await fetchImages(imageUrls);
  
  // Build markdown content
  let md = `# BÁO CÁO Y KHOA

**Bệnh nhân:** ${patientName}

**Thời gian báo cáo:** ${timestamp}

**Số khung hình:** ${frameCount}

**Tóm tắt:** ${summary}
`;
  
  // Build HTML
  let html = `
    <div class="message-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="message-content">
  `;
  
  // Parse markdown (without images)
  if (typeof marked !== 'undefined') {
    html += `<div class="markdown-body">${marked.parse(md)}</div>`;
  } else {
    html += `<div class="markdown-body"><pre>${md}</pre></div>`;
  }
  
  // Add images
  if (images.length > 0) {
    html += '<div class="report-images">';
    images.forEach(src => {
      html += `<img src="${src}" alt="Tumor" onclick="window.openImageModal && window.openImageModal(this.src)" onerror="this.style.display='none'"/>`;
    });
    html += '</div>';
  }
  
  html += '</div>';
  element.innerHTML = html;
  
  return report;
}

/**
 * Setup image modal functionality
 */
export function setupImageModal() {
  window.openImageModal = (src) => {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close-modal">&times;</span>
        <img src="${src}" alt="Full size image">
      </div>
    `;
    
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
    
    document.body.appendChild(modal);
  };
}
