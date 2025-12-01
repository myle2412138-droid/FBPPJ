/**
 * Chat UI Module
 * Handles rendering chat messages
 */

const $ = (selector) => document.querySelector(selector);

/**
 * Create user message element
 */
export function createUserMessage(content) {
  const el = document.createElement('div');
  el.classList.add('message', 'user-message');
  el.innerHTML = `
    <div class="message-content">
      <p>${escapeHtml(content)}</p>
    </div>
    <div class="message-avatar">
      <i class="fas fa-user"></i>
    </div>
  `;
  return el;
}

/**
 * Create bot message with loading state
 */
export function createLoadingBotMessage() {
  const el = document.createElement('div');
  el.classList.add('message', 'bot-message');
  el.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="message-content loading-bubble">
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  return el;
}

/**
 * Render bot response
 */
export function renderBotResponse(element, content, reasoning = null) {
  let html = `
    <div class="message-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="message-content">
  `;
  
  // Add reasoning if available
  if (reasoning) {
    html += `
      <details class="reasoning-details">
        <summary><i class="fas fa-brain"></i> Quá trình suy luận</summary>
        <div class="reasoning-content">${reasoning.replace(/\n/g, '<br>')}</div>
      </details>
    `;
  }
  
  // Parse markdown
  const htmlContent = parseMarkdown(content);
  html += `<div class="markdown-body">${htmlContent}</div></div>`;
  
  element.innerHTML = html;
  
  // Render MathJax
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([element]).catch(console.error);
  }
}

/**
 * Render error message
 */
export function renderErrorMessage(element, error) {
  element.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="message-content">
      <p>❌ ${escapeHtml(error)}</p>
    </div>
  `;
}

/**
 * Render API key missing message
 */
export function renderAPIKeyMissing(element) {
  element.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="message-content">
      <p>⚠️ Chưa có API Key. Vui lòng cập nhật GROQ_API_KEY trong file cấu hình.</p>
    </div>
  `;
}

/**
 * Parse markdown to HTML
 */
function parseMarkdown(text) {
  if (typeof marked === 'undefined') {
    return `<pre>${escapeHtml(text)}</pre>`;
  }
  
  // Protect math expressions
  const mathBlocks = [];
  const protectMath = (str) => {
    return str.replace(/(\$\$[\s\S]*?\$\$)|(\$[^$\n]+\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g, (match) => {
      mathBlocks.push(match);
      return `MATHBLOCK${mathBlocks.length - 1}ENDMATHBLOCK`;
    });
  };
  
  const restoreMath = (str) => {
    return str.replace(/MATHBLOCK(\d+)ENDMATHBLOCK/g, (_, index) => mathBlocks[parseInt(index)]);
  };
  
  const protectedText = protectMath(text);
  let html = marked.parse(protectedText);
  return restoreMath(html);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Scroll chat to bottom
 */
export function scrollToBottom() {
  const chatMessages = $('#chatMessages');
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

/**
 * Append message to chat
 */
export function appendMessage(element) {
  const chatMessages = $('#chatMessages');
  if (chatMessages) {
    chatMessages.appendChild(element);
    scrollToBottom();
  }
}
