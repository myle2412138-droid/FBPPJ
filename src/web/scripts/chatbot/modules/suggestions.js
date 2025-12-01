/**
 * Suggestions Module
 * Quick action suggestions for chatbot
 */

const $ = (selector) => document.querySelector(selector);

const DEFAULT_SUGGESTIONS = [
  { text: 'Danh sách bệnh nhân', icon: 'fa-list', action: 'list_patients' },
  { text: 'Báo cáo mới nhất', icon: 'fa-clock', action: 'latest_report' },
  { text: 'Nguyên lý FBP là gì?', icon: 'fa-question-circle', action: 'ask_theory' }
];

/**
 * Load and display suggestions
 */
export function loadSuggestions(customSuggestions = null) {
  const area = $('#suggestionsArea');
  if (!area) return;
  
  const suggestions = customSuggestions || DEFAULT_SUGGESTIONS;
  
  area.innerHTML = '';
  suggestions.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'suggestion-chip';
    chip.innerHTML = `<i class="fas ${s.icon}"></i> ${s.text}`;
    chip.onclick = () => handleSuggestionClick(s);
    area.appendChild(chip);
  });
}

/**
 * Handle suggestion click
 */
function handleSuggestionClick(suggestion) {
  const input = $('#messageInput');
  if (!input) return;
  
  switch (suggestion.action) {
    case 'list_patients':
      input.value = 'Cho tôi xem danh sách bệnh nhân';
      break;
    case 'latest_report':
      input.value = 'Báo cáo mới nhất';
      break;
    case 'ask_theory':
      input.value = 'Giải thích nguyên lý FBP';
      break;
    default:
      input.value = suggestion.text;
  }
  
  // Trigger form submit
  const form = $('#chatForm');
  if (form) {
    form.dispatchEvent(new Event('submit'));
  }
}

/**
 * Generate suggestions from LLM
 */
export async function fetchSuggestionsFromLLM(chatMessages, conversationHistory, callAPI) {
  try {
    const suggestRequest = [
      ...conversationHistory,
      {
        role: 'user',
        content: 'Dựa trên cuộc hội thoại, hãy đề xuất 3 câu hỏi tiếp theo mà người dùng có thể muốn hỏi. Trả về JSON array với format: [{"text": "câu hỏi", "icon": "fa-icon-name"}]. Chỉ trả về JSON, không giải thích.'
      }
    ];
    
    const data = await callAPI(suggestRequest, { maxTokens: 256, temperature: 0.7 });
    const content = data.choices[0].message.content;
    
    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const suggestions = JSON.parse(jsonMatch[0]);
      loadSuggestions(suggestions.map(s => ({
        text: s.text,
        icon: s.icon || 'fa-question',
        action: 'custom'
      })));
    }
  } catch (e) {
    console.warn('Could not generate suggestions:', e);
    loadSuggestions();
  }
}
