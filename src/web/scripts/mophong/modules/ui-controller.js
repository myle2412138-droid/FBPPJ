/**
 * UI Controller Module
 * Handles header, navigation, menus
 */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

/**
 * Initialize dynamic header scroll behavior
 */
export function initDynamicHeader() {
  const header = $('#header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 100) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

/**
 * Initialize mobile menu toggle
 */
export function initMobileMenu() {
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

/**
 * Initialize input tabs switching
 */
export function initInputTabs() {
  const tabs = $$('.input-tab');
  const contents = $$('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab + '-tab';
      
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const targetContent = $('#' + targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

/**
 * Initialize auth buttons
 */
export function initAuthButtons() {
  const loginBtn = $('.btn-login');
  const registerBtn = $('.btn-register');
  
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      if (loginBtn.tagName.toLowerCase() !== 'a') {
        e.preventDefault();
        window.location.href = '../auth/index.html#login';
      }
    });
  }
  
  if (registerBtn) {
    registerBtn.addEventListener('click', (e) => {
      if (registerBtn.tagName.toLowerCase() !== 'a') {
        e.preventDefault();
        window.location.href = '../auth/index.html#register';
      }
    });
  }
}

/**
 * Show notification message
 */
export function showNotification(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  alert(message);
}

/**
 * Update status display
 */
export function updateStatus(type, text) {
  const statusIcon = $('#statusIcon');
  const statusText = $('#statusText');
  const spinner = $('#statusSpinner');
  
  if (statusIcon) {
    statusIcon.className = 'fas fa-circle';
    const colors = {
      'processing': 'var(--warning-color)',
      'success': 'var(--success-color)',
      'error': 'var(--error-color)',
      'default': 'var(--primary-color)'
    };
    statusIcon.style.color = colors[type] || colors.default;
    
    if (spinner) {
      spinner.style.display = type === 'processing' ? 'inline-block' : 'none';
    }
  }
  
  if (statusText) statusText.textContent = text;
}

/**
 * Update progress display
 */
export function updateProgress(percent) {
  const progressDisplay = $('#progressDisplay');
  if (progressDisplay) {
    progressDisplay.textContent = Math.round(percent) + '%';
  }
}

/**
 * Update time display
 */
export function updateTime(seconds) {
  const timeDisplay = $('#timeDisplay');
  const timeValue = $('#timeValue');
  if (timeDisplay) timeDisplay.textContent = seconds + 's';
  if (timeValue) timeValue.textContent = seconds;
}
