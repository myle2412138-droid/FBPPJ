# FBP Medical Imaging Project

Hệ thống phân tích hình ảnh y tế sử dụng thuật toán Filtered Back-Projection (FBP) và AI.

## 📁 Cấu trúc thư mục

```
FBPPJ/
├── app.py                 # Flask entry point (NEW - replaces server.py)
├── requirements.txt       # Python dependencies
│
├── backend/               # Backend modules (NEW)
│   ├── __init__.py
│   ├── config.py         # Configuration
│   ├── utils/            # Utility functions
│   │   ├── file_utils.py
│   │   └── api_client.py
│   ├── services/         # Business logic
│   │   ├── detector.py      # YOLO tumor detection
│   │   ├── video_processor.py
│   │   └── report_generator.py
│   └── routes/           # API routes
│       └── api_routes.py
│
├── model/
│   └── best.pt           # YOLO model weights
│
├── pages/                # Frontend pages
│   ├── home/             # Landing page
│   ├── theory/           # FBP theory explanation
│   ├── mophong/          # FBP simulation (refactored)
│   │   ├── index.html
│   │   ├── mophong.css
│   │   ├── mophong-new.js      # New main controller
│   │   ├── fbp_processor.js    # FBP algorithm
│   │   └── modules/            # JS modules (NEW)
│   │       ├── ui-controller.js
│   │       ├── canvas-manager.js
│   │       ├── file-upload.js
│   │       ├── phantom-generator.js
│   │       ├── metrics.js
│   │       ├── fbp-core.js
│   │       └── fbp-utils.js
│   ├── analysis/         # Video analysis
│   └── chatbot/          # AI chatbot (refactored)
│       ├── index.html
│       ├── chatbot.css
│       ├── chatbot-new.js      # New main controller
│       └── modules/            # JS modules (NEW)
│           ├── api-client.js
│           ├── chat-ui.js
│           ├── report-renderer.js
│           ├── suggestions.js
│           └── conversation.js
│
├── components/           # Shared CSS components
├── assets/               # Global assets
├── results/              # Analysis results (JSON reports)
├── uploads/              # Uploaded files
├── data/                 # Sample DICOM data
├── php/                  # PHP API (legacy)
├── scripts/              # Python utility scripts
├── fbp-chat/             # Expo React Native app
│
└── _archive/             # Archived old files
    ├── old_main/         # Original server.py, mophong.js, chatbot.js
    ├── test/             # Test scripts
    └── homepage/         # Old homepage
```

## 🚀 Chạy ứng dụng

### Backend (Flask)
```bash
pip install -r requirements.txt
python app.py
```

### Truy cập
- Trang chủ: http://localhost:5000
- Mô phỏng FBP: http://localhost:5000/pages/mophong/
- Chatbot AI: http://localhost:5000/pages/chatbot/
- Phân tích video: http://localhost:5000/pages/analysis/

## 🔧 Các module mới

### Backend Modules
- `backend/services/detector.py` - YOLO tumor detection
- `backend/services/video_processor.py` - Video frame extraction
- `backend/services/report_generator.py` - Medical report generation
- `backend/routes/api_routes.py` - Flask API endpoints

### Frontend Modules (mophong)
- `modules/ui-controller.js` - UI components (header, tabs, notifications)
- `modules/canvas-manager.js` - Canvas rendering
- `modules/file-upload.js` - File upload & webcam
- `modules/phantom-generator.js` - Test phantom generation
- `modules/metrics.js` - PSNR, SSIM calculations
- `modules/fbp-core.js` - FBP reconstruction algorithm
- `modules/fbp-utils.js` - Image preprocessing

### Frontend Modules (chatbot)
- `modules/api-client.js` - Groq API client
- `modules/chat-ui.js` - Chat message rendering
- `modules/report-renderer.js` - Medical report display
- `modules/suggestions.js` - Quick action suggestions
- `modules/conversation.js` - Chat history management

## 📝 Migration Notes

Các file cũ đã được archive:
- `server.py` → `_archive/old_main/server.py` (thay bằng `app.py` + `backend/`)
- `mophong.js` → `_archive/old_main/mophong.js` (thay bằng `mophong-new.js` + `modules/`)
- `chatbot.js` → `_archive/old_main/chatbot.js` (thay bằng `chatbot-new.js` + `modules/`)

## 🎯 TODO

- [ ] Cập nhật HTML files để sử dụng module mới
- [ ] Fix FBP flow (sinogram → CT image)
- [ ] Thêm unit tests
- [ ] Docker support
5. **Typography** - Font chữ đẹp và dễ đọc

## Browser Support
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License
© 2025 FBP. All rights reserved.
"# FBP" 
"# FBP" 
"# FBP---Filter-Back-Projection-Platform" 
"# FBP---Filter-Back-Projection-Platform" 
"# FBPPJ" 
"# FBPPJ" 
