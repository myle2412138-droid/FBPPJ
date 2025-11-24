// Groq API Configuration
const GROQ_API_KEY = ''; // Thay bằng API key thực tế
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Flag to prevent duplicate event listeners
let formListenerAdded = false;

// Conversation history
let conversationHistory = [
  {
    role: "system",
    content: "Bạn là Trợ lý AI Y tế thông minh, chuyên về chẩn đoán hình ảnh và thuật toán Filter Back-Projection (FBP). Nhiệm vụ của bạn là hỗ trợ bác sĩ phân tích dữ liệu, tư vấn chuyên môn và lập báo cáo khi được yêu cầu. Hãy giữ thái độ chuyên nghiệp, khách quan.\n\nQUY TẮC TOÁN HỌC (LATEX):\n- Luôn sử dụng định dạng LaTeX cho các công thức toán học.\n- Sử dụng $...$ hoặc \\(...\\) cho công thức trong dòng (inline).\n- Sử dụng $$...$$ hoặc \\[...\\] cho công thức khối (block).\n\nKIẾN THỨC CHUYÊN SÂU VỀ FBP:\nFilter Back-Projection (FBP) là thuật toán tái tạo ảnh CT dựa trên biến đổi Radon và phép lọc tần số.\n1. Biến đổi Radon: $$p_\\theta(s)=\\int_{-\\infty}^{\\infty} f(s\\cos\\theta - t\\sin\\theta, s\\sin\\theta + t\\cos\\theta) dt$$\n2. Lọc (Filtering): Dùng bộ lọc Ram-Lak $H(\\omega)=|\\omega|$ để khôi phục tần số cao.\n   Chiếu đã lọc: $$\\tilde{p}_\\theta(s)=\\mathcal{F}^{-1}\\{ H(\\omega) \\cdot \\mathcal{F}\\{p_\\theta(s)\\} \\}$$\n3. Back-projection: $$f_{FBP}(x,y)=\\int_{0}^{\\pi} \\tilde{p}_\\theta(x\\cos\\theta + y\\sin\\theta) d\\theta$$\n4. Quy trình: Thu thập dữ liệu -> Fourier -> Lọc -> Inverse Fourier -> Back-projection.\n5. Đặc điểm:\n   - Ưu điểm: Đơn giản, nhanh, chính xác về mặt toán học.\n   - Nhược điểm: Nhạy với nhiễu, cần nhiều góc chiếu."
  }
];

// Load context from analysis
const latestAnalysis = localStorage.getItem('latestAnalysis');
if (latestAnalysis) {
  try {
    const data = JSON.parse(latestAnalysis);
    let imageContext = "";
    if (data.detectedFrames && data.detectedFrames.length > 0) {
      imageContext = `\n\nẢNH KHỐI U ĐƯỢC PHÁT HIỆN (Hãy chèn vào báo cáo bằng cú pháp Markdown ![Tumor](url)):\n`;
      data.detectedFrames.forEach((url, index) => {
        imageContext += `- Ảnh ${index + 1}: http://localhost:5000${url}\n`;
      });
    }

    conversationHistory[0].content += `\n\nDỮ LIỆU PHÂN TÍCH (Tham khảo):\n- Bệnh nhân: ${data.patientName}\n- Số khung hình: ${data.frameCount}\n- Thời gian: ${data.timestamp}${imageContext}\n\nHƯỚNG DẪN ỨNG XỬ (QUAN TRỌNG):\n1. GIAO TIẾP: Nếu người dùng chào hỏi hoặc hỏi chung chung, hãy trả lời ngắn gọn, thân thiện như một trợ lý ảo. KHÔNG tự ý đưa ra báo cáo y khoa ngay lập tức.\n2. LẬP BÁO CÁO: CHỈ KHI người dùng hỏi về "kết quả", "bệnh nhân", "tình trạng", hoặc yêu cầu "báo cáo", hãy đóng vai chuyên gia và tạo "BÁO CÁO Y KHOA" chi tiết (dùng Markdown, chèn ảnh khối u nếu có, đưa ra kiến nghị lâm sàng).\n3. TƯ VẤN: Luôn sẵn sàng giải thích các thuật ngữ, nguyên lý FBP hoặc đưa ra lời khuyên dựa trên dữ liệu.\n- Ngôn ngữ: Tiếng Việt chuẩn y khoa.`;
    console.log('✅ Loaded analysis context with images');
  } catch (e) {
    console.error('Error parsing analysis context:', e);
  }
}

  // Fetch a stored JSON report from the server and display it in the chat UI.
  // Returns true if a stored report was found and displayed, false otherwise.
  // Helper: resize an image Blob to a data URL with max dimension and quality
  async function blobToResizedDataUrl(blob, maxDim = 640, quality = 0.8) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            const maxSide = Math.max(width, height);
            const scale = maxSide > maxDim ? (maxDim / maxSide) : 1;
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(width * scale));
            canvas.height = Math.max(1, Math.round(height * scale));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            URL.revokeObjectURL(img.src);
            resolve(dataUrl);
          } catch (err) {
            URL.revokeObjectURL(img.src);
            reject(err);
          }
        };
        img.onerror = (e) => {
          try { URL.revokeObjectURL(img.src); } catch (e) {}
          reject(new Error('Image load error'));
        };
        img.src = URL.createObjectURL(blob);
      } catch (err) {
        reject(err);
      }
    });
  }

// Helper: Render a report object into the chat UI
async function renderReportToBotMessage(report, botMessageEl, chatMessages) {
  const base = window.location.origin;
  const read = (obj, keys) => { for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k]; return undefined; };
  const frameCountVal = read(report, ['frame_count', 'frameCount']) || 'Không rõ';
  const summaryVal = read(report, ['summary', 'report_text', 'reportText']) || 'Không có tóm tắt.';

  let md = `# BÁO CÁO Y KHOA\n\n**Bệnh nhân:** ${report.patient_name || report.safe_patient_name || 'Không rõ'}\n\n**Thời gian báo cáo:** ${report.timestamp || 'Không rõ'}\n\n**Số khung hình:** ${frameCountVal}\n\n**Tóm tắt:** ${summaryVal}\n\n`;

  // Collect image URLs (as full URLs)
  const imageUrls = [];
  if (Array.isArray(report.detected_frames) && report.detected_frames.length > 0) {
    report.detected_frames.forEach((p) => { const full = p.startsWith('http') ? p : `${base}${p}`; imageUrls.push(full); });
  }
  if (Array.isArray(report.detections) && report.detections.length > 0) {
    report.detections.forEach(d => { if (d.image_path) { const full = d.image_path.startsWith('http') ? d.image_path : `${base}${d.image_path}`; imageUrls.push(full); } });
  }
  if (imageUrls.length === 0 && report.safe_patient_name && report.timestamp) {
    for (let i = 0; i < 6; i++) imageUrls.push(`${base}/results/${report.safe_patient_name}_${report.timestamp}_tumor_${i}.jpg`);
  }

  // Try to fetch each image and convert to a data URL for reliable embedding.
  const images = [];
  for (const u of imageUrls) {
    try {
      const r = await fetch(u);
      if (r.ok) {
        const blob = await r.blob();
        // convert blob to resized data URL
        const dataUrl = await blobToResizedDataUrl(blob);
        images.push(dataUrl);
        continue;
      }
    } catch (e) {
      console.warn('Could not fetch image', u, e);
    }
    // fallback to original URL if fetch fails
    images.push(u);
  }

  if (images.length > 0) {
    md += `**ẢNH KHỐI U:**\n`;
    images.forEach((full) => { md += `<div style="margin:6px 0;"><img src="${full}" alt="Tumor" style="max-width:240px;border-radius:6px;" onerror="this.style.display='none'"/></div>`; });
  }

  // Render into chat
  let responseHTML = `
    <div class="message-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="message-content">
  `;
  const mdWithoutImgs = md.replace(/<img[^>]*>/g, '');
  if (typeof marked !== 'undefined') {
    responseHTML += `<div class="markdown-body">${marked.parse(mdWithoutImgs)}</div>`;
  } else {
    responseHTML += `<div class="markdown-body"><pre>${mdWithoutImgs}</pre></div>`;
  }
  if (images.length > 0) {
    let imagesHtml = '<div class="report-images">';
    images.forEach((full) => { 
      // Add onclick to open modal
      imagesHtml += `<img src="${full}" alt="Tumor" onclick="window.openImageModal(this.src)" onerror="this.style.display='none'"/>`; 
    });
    imagesHtml += '</div>';
    responseHTML += imagesHtml;
  }
  responseHTML += '</div>';

  botMessageEl.innerHTML = responseHTML;
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Add report into conversation history so future model calls can reference it
  conversationHistory.push({ role: 'system', content: `DỮ LIỆU BÁO CÁO (JSON):\n${JSON.stringify(report)}` });
}

  async function fetchAndDisplayReport(queryName, botMessageEl, chatMessages) {
    try {
      console.log('🔎 Fetching report for:', queryName);
      const resp = await fetch(`/api/get_report?patient_name=${encodeURIComponent(queryName)}`);
      console.log('📥 Report fetch status:', resp.status);
      if (resp.ok) {
        const respJson = await resp.json();
        console.log('📄 Report fetch json:', respJson);
        if (respJson.success && respJson.report) {
          await renderReportToBotMessage(respJson.report, botMessageEl, chatMessages);
          return true;
        }
      } else if (resp.status === 404) {
        console.log(`ℹ️ No stored report for ${queryName} (404). Falling back to LLM.`);
        return false;
      } else {
        const text = await resp.text().catch(() => '');
        console.warn('Unexpected response when fetching report:', resp.status, text);
        return false;
      }
    } catch (fetchErr) {
      console.warn('Lỗi khi lấy báo cáo từ server:', fetchErr);
      return false;
    }
  }

// Xử lý gửi message
async function handleChatSubmit(e) {
  e.preventDefault();

  const messageInput = document.getElementById('messageInput');
  const chatMessages = document.getElementById('chatMessages');
  const message = messageInput.value.trim();

  if (!message) return;

  // Thêm user message
  const userMessageEl = document.createElement('div');
  userMessageEl.classList.add('message', 'user-message');
  userMessageEl.innerHTML = `
    <div class="message-content">
      <p>${message}</p>
    </div>
    <div class="message-avatar">
      <i class="fas fa-user"></i>
    </div>
  `;
  chatMessages.appendChild(userMessageEl);

  // Clear input
  messageInput.value = '';

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Hiển thị loading (Typing indicator)
  const botMessageEl = document.createElement('div');
  botMessageEl.classList.add('message', 'bot-message');
  botMessageEl.innerHTML = `
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
  chatMessages.appendChild(botMessageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Add user message to history
  conversationHistory.push({
    role: "user",
    content: message
  });

  // If user types an explicit command `/report <name>`, fetch that report immediately.
    if (message.toLowerCase().startsWith('/report ')) {
      const requested = message.substring(8).trim();
      if (requested) {
        const found = await fetchAndDisplayReport(requested, botMessageEl, chatMessages);
        if (found) return; // displayed report, skip LLM
        // if not found, continue to normal chat fallback
      }
    }

    // Try a general search: if the raw message matches a saved report (filename, patient_name or report text), display it.
    try {
      // Special handling for "latest report" intent
      let query = message;
      if (message.toLowerCase().includes('báo cáo mới nhất') || message.toLowerCase().includes('latest report')) {
        query = 'latest';
      }

      const respSearch = await fetch(`/api/search_reports?query=${encodeURIComponent(query)}`);
      if (respSearch.ok) {
        const js = await respSearch.json();
        if (js.success && Array.isArray(js.matches) && js.matches.length > 0) {
          // display the first match
          const first = js.matches[0];
          await renderReportToBotMessage(first.report, botMessageEl, chatMessages);
          
          // Generate suggestions after showing report
          await fetchSuggestionsFromLLM(chatMessages);
          return;
        }
      }
    } catch (e) {
      console.warn('Search reports error:', e);
    }

    // Try fetching a stored report when the user mentions a patient name or provides a name-like message.
  try {
    const patientMentionRegex = /\bbệnh nhân\b/i;
    const isPatientMention = patientMentionRegex.test(message);
    const nameOnlyRegex = /^[\p{L}\s\.\-']{2,60}$/u;
    const greetingRegex = /\b(hi|hello|xin chào|chào|cảm ơn|thanks|tks|ok|okie)\b/i;
    const isNameOnly = !isPatientMention && nameOnlyRegex.test(message) && !greetingRegex.test(message);

    if (isPatientMention || isNameOnly) {
      const namePart = message.replace(/\bbệnh nhân\b[:\s]*/i, '').trim();
      const queryName = namePart || (isNameOnly ? message.trim() : '');
      if (queryName) {
        const found = await fetchAndDisplayReport(queryName, botMessageEl, chatMessages);
        if (found) return; // report displayed, skip LLM call
      }
    }
  } catch (err) {
    console.warn('Auto-report trigger error:', err);
  }

  // Check for API key
  if (!GROQ_API_KEY) {
    const botMessageEl = document.createElement('div');
    botMessageEl.classList.add('message', 'bot-message');
    botMessageEl.innerHTML = `
      <div class="message-avatar">
        <i class="fas fa-robot"></i>
      </div>
      <div class="message-content">
        <p>⚠️ Chưa có API Key. Vui lòng cập nhật GROQ_API_KEY trong file chatbot.js hoặc liên hệ quản trị viên.</p>
      </div>
    `;
    chatMessages.appendChild(botMessageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return;
  }

  try {
    // Prune history to manage token limit
    const MAX_HISTORY = 10; // Keep last 10 messages + system prompt
    if (conversationHistory.length > MAX_HISTORY + 1) {
      // Keep system prompt (index 0) and the last MAX_HISTORY messages
      conversationHistory = [
        conversationHistory[0],
        ...conversationHistory.slice(-(MAX_HISTORY))
      ];
    }

    // Check Thinking Mode toggle
    const thinkingMode = document.getElementById('thinkingModeToggle')?.checked || false;

    // Call Groq API with reasoning
    const requestBody = {
      model: "openai/gpt-oss-120b",
      messages: conversationHistory,
      temperature: 0.6,
      max_completion_tokens: 1024,
      top_p: 0.95,
      include_reasoning: thinkingMode
    };
    console.log('📤 Sending request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Groq API Error:', errText);
      throw new Error(`API request failed: ${errText}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;
    // GPT-OSS models return reasoning in message.reasoning
    const reasoning = data.choices[0].message.reasoning;

    // Add assistant response to history
    conversationHistory.push({
      role: "assistant",
      content: assistantMessage
    });

    // Display response with reasoning
    let responseHTML = `
      <div class="message-avatar">
        <i class="fas fa-robot"></i>
      </div>
      <div class="message-content">
    `;

    if (reasoning) {
      responseHTML += `
        <details class="reasoning-details">
          <summary><i class="fas fa-brain"></i> Quá trình suy luận</summary>
          <div class="reasoning-content">${reasoning.replace(/\n/g, '<br>')}</div>
        </details>
      `;
    }

    // Parse Markdown to HTML using marked.js
    let htmlContent = assistantMessage;
    if (typeof marked !== 'undefined') {
      // Pre-process to protect LaTeX delimiters from markdown parsing
      // We replace $...$, $$...$$, \(...\), and \[...\] with placeholders
      const mathBlocks = [];
      const protectMath = (str) => {
        // Regex for:
        // 1. $$...$$ (Block)
        // 2. $...$ (Inline)
        // 3. \[...\] (Block)
        // 4. \(...\) (Inline)
        return str.replace(/(\$\$[\s\S]*?\$\$)|(\$[^$\n]+\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g, (match) => {
          mathBlocks.push(match);
          return `MATHBLOCK${mathBlocks.length - 1}ENDMATHBLOCK`;
        });
      };
      const restoreMath = (str) => {
        return str.replace(/MATHBLOCK(\d+)ENDMATHBLOCK/g, (match, index) => {
          return mathBlocks[parseInt(index)];
        });
      };

      const protectedText = protectMath(assistantMessage);
      htmlContent = marked.parse(protectedText);
      htmlContent = restoreMath(htmlContent);
    }

    responseHTML += `<div class="markdown-body">${htmlContent}</div></div>`;

    botMessageEl.innerHTML = responseHTML;

    // Render MathJax if present
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([botMessageEl]).catch((err) => console.log(err));
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Generate dynamic suggestions
    await fetchSuggestionsFromLLM(chatMessages);

  } catch (error) {
    console.error('Error calling Groq API:', error);
    botMessageEl.innerHTML = `
      <div class="message-avatar">
        <i class="fas fa-robot"></i>
      </div>
      <div class="message-content">
        <p>❌ Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng kiểm tra API key hoặc thử lại sau.</p>
      </div>
    `;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Initialize chatbot
function initChatbot() {
  // Hide preloader
  const preloader = document.getElementById('pagePreloader');
  if (preloader) {
    setTimeout(() => {
      preloader.classList.add('hidden');
    }, 800); // Slight delay for smooth effect
  }

  const chatForm = document.getElementById('chatForm');

  // Only add event listener once
  if (!formListenerAdded && chatForm) {
    chatForm.addEventListener('submit', handleChatSubmit);
    formListenerAdded = true;
    console.log('✅ Chatbot initialized');
  }

  // Wire the explicit report button (prompts for patient name and fetches report)
  const reportBtn = document.getElementById('reportBtn');
  if (reportBtn) {
    reportBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const name = prompt('Nhập tên bệnh nhân để lấy báo cáo (ví dụ: Bay):');
      if (!name) return;
      // Show a temporary loading bot message
      const chatMessages = document.getElementById('chatMessages');
      const botMessageEl = document.createElement('div');
      botMessageEl.classList.add('message', 'bot-message');
      botMessageEl.innerHTML = `
        <div class="message-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
          <p><i class="fas fa-spinner fa-spin"></i> Đang tải báo cáo...</p>
        </div>
      `;
      chatMessages.appendChild(botMessageEl);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      const found = await fetchAndDisplayReport(name.trim(), botMessageEl, chatMessages);
      if (!found) {
        // Remove loading message and let normal chat handle fallback
        chatMessages.removeChild(botMessageEl);
        alert('Không tìm thấy báo cáo cho tên đã nhập.');
      }
    });
  }

  // Auto-focus vào input
  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    messageInput.focus();
  }

  // Initialize new features
  loadSuggestions();
  setupImageModal();
}

// --- New Features Implementation --

// 1. Suggestions System
function loadSuggestions() {
  const suggestionsArea = document.getElementById('suggestionsArea');
  if (!suggestionsArea) return;

  const suggestions = [
    { text: 'Danh sách bệnh nhân', icon: 'fa-list', action: 'list_patients' },
    { text: 'Báo cáo mới nhất', icon: 'fa-clock', action: 'latest_report' },
    { text: 'Phân tích ca bệnh Null', icon: 'fa-search', action: 'analyze_null' },
    { text: 'Nguyên lý FBP là gì?', icon: 'fa-question-circle', action: 'ask_theory' }
  ];

  suggestionsArea.innerHTML = '';
  suggestions.forEach(s => {
    const chip = document.createElement('div');
    chip.classList.add('suggestion-chip');
    chip.innerHTML = `<i class="fas ${s.icon}"></i> ${s.text}`;
    chip.onclick = () => handleSuggestionClick(s);
    suggestionsArea.appendChild(chip);
  });
}

async function handleSuggestionClick(suggestion) {
  const messageInput = document.getElementById('messageInput');
  const chatMessages = document.getElementById('chatMessages');

  if (suggestion.action === 'list_patients') {
    // Fetch and display patient list directly
    await fetchAndDisplayPatientList(chatMessages);
  } else if (suggestion.action === 'latest_report') {
    // Ask for latest report
    messageInput.value = 'Báo cáo mới nhất';
    document.getElementById('chatForm').dispatchEvent(new Event('submit'));
  } else if (suggestion.action === 'analyze_null') {
    messageInput.value = 'Báo cáo bệnh nhân Null';
    document.getElementById('chatForm').dispatchEvent(new Event('submit'));
  } else {
    // Just fill input and submit
    messageInput.value = suggestion.text;
    document.getElementById('chatForm').dispatchEvent(new Event('submit'));
  }
}

// 2. Patient List Feature
async function fetchAndDisplayPatientList(chatMessages) {
  // Show loading
  const botMessageEl = document.createElement('div');
  botMessageEl.classList.add('message', 'bot-message');
  botMessageEl.innerHTML = `
    <div class="message-avatar"><i class="fas fa-robot"></i></div>
    <div class="message-content"><p><i class="fas fa-spinner fa-spin"></i> Đang tải danh sách...</p></div>
  `;
  chatMessages.appendChild(botMessageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const resp = await fetch('/api/get_patients');
    const data = await resp.json();
    
    if (data.success && data.patients.length > 0) {
      let html = '<h3>📋 Danh sách bệnh nhân có báo cáo</h3><ul>';
      data.patients.forEach(p => {
        html += `<li><strong>${p.name}</strong> (${p.report_count} báo cáo) - Mới nhất: ${p.latest_report.timestamp}</li>`;
      });
      html += '</ul><p><em>Gõ tên bệnh nhân hoặc "/report [tên]" để xem chi tiết.</em></p>';
      
      botMessageEl.querySelector('.message-content').innerHTML = `<div class="markdown-body">${html}</div>`;
    } else {
      botMessageEl.querySelector('.message-content').innerHTML = '<p>Chưa có dữ liệu bệnh nhân nào.</p>';
    }
  } catch (e) {
    botMessageEl.querySelector('.message-content').innerHTML = '<p>❌ Lỗi khi tải danh sách bệnh nhân.</p>';
  }
}

// 3. Image Modal Feature
function setupImageModal() {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById("modalImage");
  const captionText = document.getElementById("caption");
  const span = document.getElementsByClassName("close-modal")[0];

  // Global function to open modal
  window.openImageModal = function(src) {
    modal.style.display = "block";
    modalImg.src = src;
    captionText.innerHTML = "Ảnh chi tiết khối u";
  }

  // Close when clicking (x)
  if (span) {
    span.onclick = function() { 
      modal.style.display = "none";
    }
  }

  // Close when clicking outside image
  window.addEventListener('click', function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  });
}

// 4. Dynamic Suggestions from LLM
async function fetchSuggestionsFromLLM(chatMessages) {
  const suggestionsArea = document.getElementById('suggestionsArea');
  if (!suggestionsArea || !GROQ_API_KEY) return;

  // Show loading state in suggestions area
  suggestionsArea.innerHTML = '<div class="suggestion-chip" style="opacity:0.5"><i class="fas fa-spinner fa-spin"></i> Đang tạo gợi ý...</div>';

  try {
    // Create a lightweight prompt for suggestions
    const lastMsg = conversationHistory[conversationHistory.length - 1].content;
    const prompt = [
      {
        role: "system",
        content: "Bạn là một AI hỗ trợ tạo gợi ý câu trả lời ngắn gọn cho người dùng. Dựa trên tin nhắn cuối cùng của bot, hãy đề xuất 3 câu hỏi hoặc hành động tiếp theo mà người dùng có thể muốn thực hiện. Trả về kết quả dưới dạng JSON array: [{\"text\": \"Gợi ý 1\", \"action\": \"chat\"}, ...]. Chỉ trả về JSON, không giải thích thêm."
      },
      {
        role: "user",
        content: `Tin nhắn cuối của bot: "${lastMsg.substring(0, 500)}..."`
      }
    ];

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Use a faster/lighter model for suggestions if possible
        messages: prompt,
        temperature: 0.5,
        max_completion_tokens: 200,
        response_format: { type: "json_object" }
      })
    });

    if (response.ok) {
      const data = await response.json();
      let suggestions = [];
      try {
        const content = data.choices[0].message.content;
        const parsed = JSON.parse(content);
        // Handle different JSON structures the model might return
        if (Array.isArray(parsed)) suggestions = parsed;
        else if (parsed.suggestions) suggestions = parsed.suggestions;
        else if (parsed.actions) suggestions = parsed.actions;
      } catch (e) {
        console.warn('Failed to parse suggestions JSON', e);
      }

      // Fallback if empty
      if (suggestions.length === 0) {
        suggestions = [
          { text: 'Giải thích chi tiết hơn', action: 'chat' },
          { text: 'Báo cáo liên quan', action: 'chat' },
          { text: 'Cảm ơn', action: 'chat' }
        ];
      }

      // Render suggestions
      suggestionsArea.innerHTML = '';
      suggestions.forEach(s => {
        const chip = document.createElement('div');
        chip.classList.add('suggestion-chip');
        chip.innerHTML = `<i class="fas fa-comment-dots"></i> ${s.text}`;
        chip.onclick = () => {
          const messageInput = document.getElementById('messageInput');
          messageInput.value = s.text;
          document.getElementById('chatForm').dispatchEvent(new Event('submit'));
        };
        suggestionsArea.appendChild(chip);
      });
      
      // Always append the static "Patient List" option
      const listChip = document.createElement('div');
      listChip.classList.add('suggestion-chip');
      listChip.innerHTML = `<i class="fas fa-list"></i> Danh sách bệnh nhân`;
      listChip.onclick = () => handleSuggestionClick({ action: 'list_patients' });
      suggestionsArea.appendChild(listChip);

    }
  } catch (e) {
    console.warn('Error fetching suggestions:', e);
    // Restore static suggestions on error
    loadSuggestions();
  }
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatbot);
} else {
  initChatbot();
}
