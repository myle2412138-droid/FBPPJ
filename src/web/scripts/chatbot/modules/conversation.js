/**
 * Conversation Manager Module
 * Manages chat history and context
 */

// System prompt with FBP knowledge
const SYSTEM_PROMPT = `Bạn là Trợ lý AI Y tế thông minh, chuyên về chẩn đoán hình ảnh và thuật toán Filter Back-Projection (FBP). Nhiệm vụ của bạn là hỗ trợ bác sĩ phân tích dữ liệu, tư vấn chuyên môn và lập báo cáo khi được yêu cầu.

QUY TẮC TOÁN HỌC (LATEX):
- Sử dụng $...$ cho công thức inline
- Sử dụng $$...$$ cho công thức block

KIẾN THỨC VỀ FBP:
Filter Back-Projection là thuật toán tái tạo ảnh CT dựa trên biến đổi Radon.
1. Biến đổi Radon: $$p_\\theta(s)=\\int f(s\\cos\\theta - t\\sin\\theta, s\\sin\\theta + t\\cos\\theta) dt$$
2. Lọc: Dùng bộ lọc Ram-Lak $H(\\omega)=|\\omega|$
3. Back-projection: $$f_{FBP}(x,y)=\\int_{0}^{\\pi} \\tilde{p}_\\theta(x\\cos\\theta + y\\sin\\theta) d\\theta$$

HƯỚNG DẪN:
1. Nếu người dùng chào hỏi, trả lời thân thiện ngắn gọn
2. Nếu hỏi về bệnh nhân/báo cáo, tạo báo cáo y khoa chi tiết
3. Luôn sử dụng tiếng Việt chuẩn y khoa`;

// Maximum history length
const MAX_HISTORY = 10;

/**
 * Create conversation manager
 */
export function createConversationManager() {
  let history = [{ role: 'system', content: SYSTEM_PROMPT }];
  
  return {
    /**
     * Add analysis context to system prompt
     */
    addAnalysisContext(analysisData) {
      let contextText = `\n\nDỮ LIỆU PHÂN TÍCH:
- Bệnh nhân: ${analysisData.patientName}
- Số khung hình: ${analysisData.frameCount}
- Thời gian: ${analysisData.timestamp}`;
      
      if (analysisData.detectedFrames?.length > 0) {
        contextText += '\n\nẢNH KHỐI U:\n';
        analysisData.detectedFrames.forEach((url, i) => {
          contextText += `- Ảnh ${i + 1}: ${url}\n`;
        });
      }
      
      history[0].content += contextText;
    },
    
    /**
     * Add user message
     */
    addUserMessage(content) {
      history.push({ role: 'user', content });
      this.pruneHistory();
    },
    
    /**
     * Add assistant message
     */
    addAssistantMessage(content) {
      history.push({ role: 'assistant', content });
      this.pruneHistory();
    },
    
    /**
     * Add system context (e.g., report data)
     */
    addSystemContext(content) {
      history.push({ role: 'system', content });
      this.pruneHistory();
    },
    
    /**
     * Prune history to prevent token overflow
     */
    pruneHistory() {
      if (history.length > MAX_HISTORY + 1) {
        history = [history[0], ...history.slice(-(MAX_HISTORY))];
      }
    },
    
    /**
     * Get current history
     */
    getHistory() {
      return [...history];
    },
    
    /**
     * Clear history (keep system prompt)
     */
    clear() {
      history = [history[0]];
    }
  };
}

/**
 * Load analysis context from localStorage
 */
export function loadAnalysisContext() {
  try {
    const stored = localStorage.getItem('latestAnalysis');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading analysis context:', e);
  }
  return null;
}
