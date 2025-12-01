/**
 * Phantom Generator Module
 * Creates test images for FBP simulation
 */

const $ = (selector) => document.querySelector(selector);

// Callback for when phantom is generated
let onPhantomGenerated = null;
let showNotificationFn = null;

/**
 * Set callbacks
 */
export function setCallbacks(callbacks) {
  onPhantomGenerated = callbacks.onPhantomGenerated;
  showNotificationFn = callbacks.showNotification;
}

/**
 * Initialize phantom generator UI
 */
export function initPhantom() {
  const generateBtn = $('#generatePhantomBtn');
  
  if (!generateBtn) return;
  
  generateBtn.addEventListener('click', () => {
    const phantomType = $('#phantomSelect').value;
    const size = parseInt($('#imageSize').value) || 256;
    
    const phantom = generatePhantom(phantomType, size);
    
    if (onPhantomGenerated) onPhantomGenerated(phantom);
    if (showNotificationFn) showNotificationFn(`Phantom ${phantomType} đã được tạo`, 'success');
  });
}

/**
 * Generate phantom image
 */
export function generatePhantom(type, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  
  ctx.fillStyle = '#fff';
  
  switch(type) {
    case 'circle':
      drawCircle(ctx, size);
      break;
    case 'square':
      drawSquare(ctx, size);
      break;
    case 'shepp-logan':
      drawSheppLogan(ctx, size);
      break;
    case 'custom':
      drawCustom(ctx, size);
      break;
  }
  
  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

function drawCircle(ctx, size) {
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/3, 0, Math.PI * 2);
  ctx.fill();
}

function drawSquare(ctx, size) {
  ctx.fillRect(size/4, size/4, size/2, size/2);
}

function drawSheppLogan(ctx, size) {
  const cx = size / 2;
  const cy = size / 2;
  
  // Large ellipse
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.69, 0.92);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  
  // Smaller ellipses
  const ellipses = [
    {x: 0, y: -0.0184, a: 0.6624, b: 0.874, angle: 0},
    {x: 0.22, y: 0, a: 0.11, b: 0.31, angle: -18},
    {x: -0.22, y: 0, a: 0.16, b: 0.41, angle: 18},
  ];
  
  ellipses.forEach(e => {
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

function drawCustom(ctx, size) {
  // Random circles
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * size / 6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
