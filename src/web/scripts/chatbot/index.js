/**
 * Chatbot Application - Refactored Main Module
 * AI Medical Assistant for report analysis
 */

import { callGroqAPI, fetchReport, searchReports, getPatients, isAPIConfigured } from './modules/api-client.js';
import { createUserMessage, createLoadingBotMessage, renderBotResponse, renderErrorMessage, renderAPIKeyMissing, appendMessage, scrollToBottom } from './modules/chat-ui.js';
import { renderReport, setupImageModal } from './modules/report-renderer.js';
import { loadSuggestions, fetchSuggestionsFromLLM } from './modules/suggestions.js';
import { createConversationManager, loadAnalysisContext } from './modules/conversation.js';

// DOM Helper
const $ = (selector) => document.querySelector(selector);

// State
let isProcessing = false;
const conversation = createConversationManager();

/**
 * Initialize application
 */
function init() {
  // Hide preloader
  const preloader = document.getElementById('pagePreloader');
  if (preloader) {
    preloader.classList.add('hidden');
    setTimeout(() => preloader.remove(), 500);
  }
  
  // Load analysis context if redirected from analysis page
  const analysisContext = loadAnalysisContext();
  if (analysisContext) {
    conversation.addAnalysisContext(analysisContext);
  }
  
  // Setup image modal
  setupImageModal();
  
  // Load default suggestions
  loadSuggestions();
  
  // Setup event listeners
  setupEventListeners();
  
  console.log('Chatbot initialized');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const form = $('#chatForm');
  const input = $('#messageInput');
  const clearBtn = $('#clearChatBtn');
  
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }
  
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form?.dispatchEvent(new Event('submit'));
      }
    });
    
    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    });
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', clearChat);
  }
}

/**
 * Handle form submit
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  const input = $('#messageInput');
  const text = input?.value.trim();
  
  if (!text || isProcessing) return;
  
  // Clear input
  input.value = '';
  input.style.height = 'auto';
  
  // Add user message
  appendMessage(createUserMessage(text));
  conversation.addUserMessage(text);
  
  // Create loading message
  const botMsg = createLoadingBotMessage();
  appendMessage(botMsg);
  
  isProcessing = true;
  
  try {
    // Check for special commands
    if (await handleSpecialCommands(text, botMsg)) {
      return;
    }
    
    // Check if API is configured
    if (!isAPIConfigured()) {
      renderAPIKeyMissing(botMsg);
      return;
    }
    
    // Call API
    const response = await callGroqAPI(conversation.getHistory());
    
    const choice = response.choices[0];
    const content = choice.message.content;
    const reasoning = choice.message.reasoning;
    
    // Render response
    renderBotResponse(botMsg, content, reasoning);
    conversation.addAssistantMessage(content);
    
    // Try to update suggestions
    fetchSuggestionsFromLLM($('#chatMessages'), conversation.getHistory(), callGroqAPI);
    
  } catch (error) {
    console.error('Chat error:', error);
    renderErrorMessage(botMsg, error.message);
  } finally {
    isProcessing = false;
    scrollToBottom();
  }
}

/**
 * Handle special commands
 */
async function handleSpecialCommands(text, botMsg) {
  const lowerText = text.toLowerCase();
  
  // List patients command
  if (lowerText.includes('danh sách') && lowerText.includes('bệnh nhân')) {
    try {
      const patients = await getPatients();
      if (patients.length > 0) {
        let content = '## Danh sách bệnh nhân\n\n';
        patients.forEach((p, i) => {
          content += `${i + 1}. **${p.name}** - ${p.date || 'Không rõ ngày'}\n`;
        });
        renderBotResponse(botMsg, content);
        conversation.addAssistantMessage(content);
      } else {
        renderBotResponse(botMsg, 'Chưa có bệnh nhân nào trong hệ thống.');
      }
      return true;
    } catch (e) {
      renderErrorMessage(botMsg, 'Không thể tải danh sách bệnh nhân');
      return true;
    }
  }
  
  // Search report command
  if (lowerText.includes('báo cáo') && (lowerText.includes('tìm') || lowerText.includes('xem'))) {
    // Extract patient name
    const nameMatch = text.match(/(?:của|bệnh nhân)\s+([^\s]+)/i);
    if (nameMatch) {
      try {
        const report = await fetchReport(nameMatch[1]);
        if (report) {
          await renderReport(report, botMsg);
          conversation.addSystemContext(`[Đã tải báo cáo của ${nameMatch[1]}]`);
          return true;
        }
      } catch (e) {
        console.warn('Could not fetch report:', e);
      }
    }
  }
  
  // Latest report command
  if (lowerText.includes('báo cáo') && lowerText.includes('mới nhất')) {
    try {
      const patients = await getPatients();
      if (patients.length > 0) {
        const latest = patients[patients.length - 1];
        const report = await fetchReport(latest.name);
        if (report) {
          await renderReport(report, botMsg);
          conversation.addSystemContext(`[Đã tải báo cáo mới nhất của ${latest.name}]`);
          return true;
        }
      }
      renderBotResponse(botMsg, 'Chưa có báo cáo nào trong hệ thống.');
      return true;
    } catch (e) {
      renderErrorMessage(botMsg, 'Không thể tải báo cáo mới nhất');
      return true;
    }
  }
  
  return false;
}

/**
 * Clear chat history
 */
function clearChat() {
  const chatMessages = $('#chatMessages');
  if (chatMessages) {
    chatMessages.innerHTML = '';
  }
  conversation.clear();
  loadSuggestions();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

// Export for external use
export { conversation, clearChat };
