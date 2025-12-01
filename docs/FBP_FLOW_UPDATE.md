# FBP Reconstruction - Cập nhật Flow

## Thay đổi chính

### Flow mới: Sinogram → CT Image

**Trước:**
```
Original Image → Radon Transform → Sinogram → FBP Filter → Back-projection → Reconstructed Image
```

**Sau:**
```
Input Sinogram → FBP Filter → Back-projection → CT Image
```

## Files đã tạo/cập nhật

### Core Files
1. **`src/web/scripts/mophong/fbp-inverter.js`** (~500 lines)
   - Class `FBPInverter` để chuyển đổi sinogram → CT
   - Hỗ trợ nhiều loại filter: Ram-Lak, Shepp-Logan, Cosine, Hamming, Hann
   - Back-projection algorithm với linear interpolation
   - Progress callback cho UI updates

2. **`src/web/scripts/mophong/app.js`** (~800 lines)
   - Main application với flow mới
   - Tab system: File upload, Demo (phantom), Webcam
   - Phantom generator với Radon transform để tạo demo sinogram
   - Metrics calculation: PSNR, SSIM, SNR
   - Timeline visualization

3. **`src/web/pages/mophong/index.html`** (new)
   - UI mới với 3 panels: Input Sinogram, Filtered Sinogram, Reconstructed CT
   - Updated timeline: Input → Filter → Back-projection → Post-process → Result

### CSS Updates
4. **`src/web/styles/mophong.css`**
   - Thêm `.highlight-panel` cho result panel
   - Thêm `.badge-result` label
   - Thêm `.timeline-step.completed` state
   - Thêm các utility classes

## Cách sử dụng

### 1. Upload Sinogram
- Kéo thả file ảnh sinogram vào drop zone
- Hoặc click để chọn file

### 2. Tạo Demo Sinogram
- Chọn tab "Demo"
- Chọn loại phantom (Shepp-Logan, Circle, Square, Custom)
- Click "Tạo Sinogram Demo"
- Phantom → Radon transform → Sinogram

### 3. Chụp từ Camera
- Chọn tab "Camera"
- Bật camera và chụp ảnh
- Ảnh chụp sẽ được coi như sinogram đầu vào

### 4. Cấu hình tham số
- **Số projections**: 30-360 (cho demo mode)
- **Filter type**: Ramp, Shepp-Logan, Hamming, Hann, Cosine, None
- **Output size**: 128-512 px

### 5. Chạy tái tạo
- Click "Tái tạo ảnh CT"
- Xem progress trên timeline
- Kết quả hiển thị ở panel "Reconstructed CT Image"

### 6. Xem metrics
- **PSNR**: Peak Signal-to-Noise Ratio (dB)
- **SSIM**: Structural Similarity Index
- **SNR**: Signal-to-Noise Ratio (dB)
- **Time**: Thời gian xử lý (s)

## Cấu trúc project

```
src/web/
├── pages/
│   └── mophong/
│       ├── index.html (NEW - flow mới)
│       └── index-old.html (backup)
├── scripts/
│   └── mophong/
│       ├── fbp_processor.js (core algorithm - giữ nguyên)
│       ├── fbp-inverter.js (NEW - sinogram to CT)
│       └── app.js (NEW - main application)
└── styles/
    └── mophong.css (updated)
```

## Chạy thử

1. Mở file `src/web/pages/mophong/index.html` trong trình duyệt
2. Chọn tab "Demo" và click "Tạo Sinogram Demo"
3. Click "Tái tạo ảnh CT"
4. Xem kết quả và metrics

## Notes

- Thuật toán FBP chạy hoàn toàn trên client-side (JavaScript)
- Không cần server backend cho chức năng tái tạo CT
- Performance phụ thuộc vào kích thước ảnh và số projections
