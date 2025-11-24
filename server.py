from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import cv2
import os
import glob
from datetime import datetime
from werkzeug.utils import secure_filename
import shutil
import torch
import json

# Monkeypatch torch.load to disable weights_only=True default in PyTorch 2.6+
# This is needed because the YOLO model contains custom classes
try:
    _original_load = torch.load
    def _safe_load(*args, **kwargs):
        if 'weights_only' not in kwargs:
            kwargs['weights_only'] = False
        return _original_load(*args, **kwargs)
    torch.load = _safe_load
    print("✅ Đã áp dụng bản vá cho torch.load (weights_only=False)")
except Exception as e:
    print(f"⚠️ Không thể vá torch.load: {e}")

app = Flask(__name__, static_folder='.')
CORS(app)

# Cấu hình thư mục upload và kết quả
UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'results'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# Load YOLO model globally
print("⏳ Đang load YOLO model...")
model = None
model_path = 'model/best.pt'
if os.path.exists(model_path):
    try:
        from ultralytics import YOLO
        model = YOLO(model_path)
        print('✅ Đã load YOLO model thành công')
    except Exception as e:
        print(f'⚠️ Không thể load YOLO model: {e}')
else:
    print(f'⚠️ Không tìm thấy file model tại {model_path}')

@app.route('/api/create_video', methods=['POST'])
def create_video():
    print("📥 Nhận request tạo video")
    try:
        # Lấy thông tin bệnh nhân
        patient_name = request.form.get('patient_name', 'Unknown')
        # Optional pixel spacing in mm per pixel (e.g. from DICOM: pixel spacing or spacing between slices)
        pixel_spacing_raw = request.form.get('pixel_spacing')
        pixel_spacing = None
        try:
            if pixel_spacing_raw:
                pixel_spacing = float(pixel_spacing_raw)
        except Exception:
            pixel_spacing = None
        print(f"👤 Bệnh nhân: {patient_name}")
        
        # Kiểm tra file upload
        if 'images' not in request.files:
            return jsonify({'error': 'Không có file ảnh'}), 400
        
        files = request.files.getlist('images')
        print(f"📸 Số lượng ảnh nhận được: {len(files)}")
        
        if len(files) == 0:
            return jsonify({'error': 'Vui lòng chọn ít nhất một ảnh'}), 400
        
        # Sanitize patient name to avoid filesystem issues
        safe_patient_name = secure_filename(patient_name)
        if not safe_patient_name:
            safe_patient_name = 'unknown_patient'
            
        # Tạo thư mục cho bệnh nhân
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        patient_folder = os.path.join(UPLOAD_FOLDER, f'{safe_patient_name}_{timestamp}')
        os.makedirs(patient_folder, exist_ok=True)
        
        # Lưu các file ảnh
        image_files = []
        for i, file in enumerate(files):
            if file and allowed_file(file.filename):
                # Generate safe filename using counter
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = f"image_{i:04d}.{ext}"
                filepath = os.path.join(patient_folder, filename)
                file.save(filepath)
                image_files.append(filepath)
        
        if not image_files:
            return jsonify({'error': 'Không có ảnh hợp lệ'}), 400
        
        print(f"💾 Đã lưu {len(image_files)} ảnh vào {patient_folder}")

        # Sắp xếp file theo tên
        image_files.sort()
        
        # Tạo video từ ảnh
        output_video_name = f'{safe_patient_name}_{timestamp}.webm'
        output_video_path = os.path.join(RESULTS_FOLDER, output_video_name)
        
        # Helper function to read image with unicode path support
        import numpy as np
        def read_image_unicode(path):
            try:
                stream = open(path, "rb")
                bytes = bytearray(stream.read())
                numpyarray = np.asarray(bytes, dtype=np.uint8)
                return cv2.imdecode(numpyarray, cv2.IMREAD_UNCHANGED)
            except Exception as e:
                print(f"Error reading file {path}: {e}")
                return None

        # Đọc kích thước ảnh đầu tiên
        frame = read_image_unicode(image_files[0])
        if frame is None:
             return jsonify({'error': 'Không thể đọc file ảnh (lỗi encoding hoặc file hỏng)'}), 400

        # Handle grayscale images
        if len(frame.shape) == 2:
            height, width = frame.shape
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        else:
            height, width, layers = frame.shape
        
        print(f"📐 Kích thước video: {width}x{height}")

        # Thiết lập video writer
        fps = 10  # Frames per second
        # Sử dụng codec VP8 (vp80) cho định dạng WebM - tương thích tốt với trình duyệt
        fourcc = cv2.VideoWriter_fourcc(*'vp80')
        video = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
        
        if not video.isOpened():
            print("❌ Không thể mở VideoWriter")
            return jsonify({'error': 'Không thể khởi tạo VideoWriter'}), 500

        print("🎥 Bắt đầu tạo video...")
        
        detected_frames = []
        detected_objects = []  # collect detections with boxes per frame
        # Xử lý từng ảnh
        count = 0
        for image_path in image_files:
            frame = read_image_unicode(image_path)
            if frame is None:
                continue
            
            # Convert grayscale to BGR if needed
            # Convert grayscale to BGR if needed
            if len(frame.shape) == 2:
                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
            
            # Phát hiện khối u bằng YOLO (nếu có model)
            if model:
                try:
                    results = model(frame, verbose=False) # verbose=False để giảm log
                    # Vẽ bounding box lên ảnh và ghi nhận boxes
                    has_tumor = False
                    frame_boxes = []
                    for r in results:
                        boxes = r.boxes.xyxy.cpu().numpy() if hasattr(r.boxes, 'xyxy') else []
                        if len(boxes) > 0:
                            has_tumor = True
                        for box in boxes:
                            x1, y1, x2, y2 = map(int, box)
                            # store box
                            frame_boxes.append([int(x1), int(y1), int(x2), int(y2)])
                            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                            cv2.putText(frame, 'Tumor', (x1, y1-10), 
                                      cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)

                    # Nếu phát hiện, lưu thông tin box cho báo cáo
                    if has_tumor:
                        detected_objects.append({
                            'frame_index': count,
                            'image_path': image_path,
                            'boxes': frame_boxes
                        })

                    # Lưu ảnh nếu có khối u (giới hạn số lượng để tránh quá tải)
                    if has_tumor and len(detected_frames) < 5:
                        tumor_img_name = f'{safe_patient_name}_{timestamp}_tumor_{count}.jpg'
                        tumor_img_path = os.path.join(RESULTS_FOLDER, tumor_img_name)
                        cv2.imwrite(tumor_img_path, frame)
                        detected_frames.append(f'/results/{tumor_img_name}')
                        
                except Exception as e:
                    print(f'⚠️ Lỗi khi phát hiện (ảnh {count}): {e}')
            
            video.write(frame)
            count += 1
            if count % 10 == 0:
                print(f"✅ Đã xử lý {count} frames")
        
        video.release()
        print(f"✅ Đã tạo video xong: {output_video_path}")
        
        # Xóa thư mục upload tạm
        shutil.rmtree(patient_folder)
        # Tạo report JSON và lưu vào thư mục results
        try:
            # Build a human-readable medical report text in Vietnamese using analysis results
            num_detected = len(detected_frames)
            report_lines = []
            report_lines.append('BÁO CÁO Y KHOA')
            report_lines.append('')
            report_lines.append(f'Bệnh nhân: {patient_name}')
            report_lines.append(f'Thời gian tạo báo cáo: {timestamp}')
            report_lines.append(f'Tổng số khung hình đã xử lý: {len(image_files)}')
            report_lines.append('')
            if num_detected > 0:
                report_lines.append(f'KẾT LUẬN TẮT: Phát hiện dấu hiệu khối u trên {num_detected} khung hình (một số ảnh đính kèm).')
                report_lines.append('Mô tả: Hệ thống phát hiện vùng nghi ngờ khối u (bounding box) trên hình ảnh CT/ảnh y tế. Kích thước và vị trí chi tiết cần đánh giá thêm bởi bác sĩ chuyên khoa dựa trên ảnh gốc và video.')
            else:
                report_lines.append('KẾT LUẬN TẮT: Không phát hiện bất thường rõ ràng trên các khung hình đã xử lý. Nếu có triệu chứng lâm sàng đáng ngại, đề nghị kiểm tra bổ sung.')

            report_lines.append('')
            report_lines.append('Tài liệu kèm theo:')
            report_lines.append(f'- Video kết quả: /results/{output_video_name}')
            for p in detected_frames:
                report_lines.append(f'- Ảnh khối u: {p}')

            report_lines.append('')
            report_lines.append('Khuyến nghị lâm sàng:')
            report_lines.append('- Đối với tổn thương nghi ngờ: thực hiện MRI/CT tái khám với cắt lớp mỏng hoặc sinh thiết nếu phù hợp;')
            report_lines.append('- Thảo luận tại hội chẩn đa chuyên khoa nếu cần thiết;')
            report_lines.append('- Kết hợp lâm sàng và tiền sử bệnh nhân để đưa ra chẩn đoán chính xác hơn.')

            report_text = '\n'.join(report_lines)

            # Build detection details (sizes) from detected_objects
            detections_details = []
            tumor_count = 0
            for det in detected_objects:
                fr_idx = det.get('frame_index')
                boxes = det.get('boxes', [])
                box_list = []
                for (x1, y1, x2, y2) in boxes:
                        width_px = int(x2) - int(x1)
                        height_px = int(y2) - int(y1)
                        area_px = width_px * height_px
                        box_entry = {
                            'x1': int(x1), 'y1': int(y1), 'x2': int(x2), 'y2': int(y2),
                            'width_px': width_px, 'height_px': height_px, 'area_px': area_px
                        }
                        # If pixel spacing provided, convert to mm
                        if pixel_spacing and pixel_spacing > 0:
                            width_mm = round(width_px * pixel_spacing, 2)
                            height_mm = round(height_px * pixel_spacing, 2)
                            area_mm2 = round(width_mm * height_mm, 2)
                            box_entry.update({'width_mm': width_mm, 'height_mm': height_mm, 'area_mm2': area_mm2})

                        box_list.append(box_entry)
                        tumor_count += 1
                detections_details.append({
                    'frame_index': fr_idx,
                    'boxes': box_list
                })

            # Append detection size summary into report_text
            report_text += '\n\nPhát hiện chi tiết (số lượng khối u và kích thước từng khối):\n'
            report_text += f'- Tổng khối u phát hiện: {tumor_count}\n'
            for d in detections_details:
                for b in d['boxes']:
                    report_text += f"- Frame {d['frame_index']}: box (x1={b['x1']}, y1={b['y1']}, x2={b['x2']}, y2={b['y2']}) -> {b['width_px']}x{b['height_px']} px, area={b['area_px']} px^2\n"

            # Determine patient status based on detection results (from video/images)
            if num_detected > 0:
                patient_status = 'Phát hiện dấu hiệu khối u trên video/ảnh kết quả. Cần đánh giá thêm bởi bác sĩ chuyên khoa.'
            else:
                patient_status = 'Không phát hiện khối u rõ ràng trên video/ảnh đã xử lý. Nếu có triệu chứng, nên kiểm tra thêm.'

            report = {
                'patient_name': patient_name,
                'safe_patient_name': safe_patient_name,
                'timestamp': timestamp,
                'video_url': f'/results/{output_video_name}',
                'video_name': output_video_name,
                'frame_count': len(image_files),
                'detected_frames': detected_frames,
                'detections': detections_details,
                'tumor_count': tumor_count,
                'summary': 'Kết quả tự động: phát hiện khối u trên một số khung hình. Vui lòng tham khảo ảnh và video để đánh giá thêm.',
                'patient_status': patient_status,
                'report_text': report_text
            }
            report_filename = f"{safe_patient_name}_{timestamp}_report.json"
            report_path = os.path.join(RESULTS_FOLDER, report_filename)
            import json
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            print(f"💾 Đã lưu báo cáo JSON: {report_path}")
        except Exception as e:
            print(f"⚠️ Lỗi khi lưu báo cáo JSON: {e}")

        return jsonify({
            'success': True,
            'video_url': f'/results/{output_video_name}',
            'patient_name': patient_name,
            'frame_count': len(image_files),
            'detected_frames': detected_frames,
            'report_url': f'/results/{report_filename}'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/results/<filename>')
def serve_result(filename):
    return send_from_directory(RESULTS_FOLDER, filename)


@app.route('/api/get_report', methods=['GET'])
def get_report():
    try:
        patient_name = request.args.get('patient_name', '').strip()
        debug_mode = request.args.get('debug', '') == '1'
        if not patient_name:
            return jsonify({'error': 'Thiếu patient_name'}), 400

        # Sanitize for filename matching
        safe_patient = secure_filename(patient_name)

        # Tìm tất cả file *_report.json trong thư mục results
        report_files = glob.glob(os.path.join(RESULTS_FOLDER, '*_report.json'))
        matched = []
        checked = []
        for rf in report_files:
            base = os.path.basename(rf)
            checked.append(base)
            if base.lower().startswith(safe_patient.lower()):
                matched.append(rf)

        # If no exact startswith match, try substring match in filename (case-insensitive)
        if not matched:
            for rf in report_files:
                base = os.path.basename(rf)
                if safe_patient.lower() in base.lower():
                    matched.append(rf)

        # If still not matched, try loading each report and matching the patient_name field
        if not matched:
            for rf in report_files:
                try:
                    with open(rf, 'r', encoding='utf-8') as f:
                        rj = json.load(f)
                    pname = (rj.get('patient_name') or '').strip().lower()
                    if pname and (safe_patient.lower() in pname or pname in safe_patient.lower()):
                        matched.append(rf)
                except Exception:
                    continue

        if not matched:
            if debug_mode:
                return jsonify({'success': False, 'message': 'Không tìm thấy báo cáo cho bệnh nhân này.', 'checked_files': checked}), 404
            return jsonify({'success': False, 'message': 'Không tìm thấy báo cáo cho bệnh nhân này.'}), 404

        # Chọn file mới nhất
        latest = max(matched, key=os.path.getctime)
        import json
        with open(latest, 'r', encoding='utf-8') as f:
            report = json.load(f)

        resp = {'success': True, 'report': report}
        if debug_mode:
            resp['matched_file'] = os.path.basename(latest)
            resp['checked_files'] = checked
        return jsonify(resp)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/save_report', methods=['POST'])
def save_report():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No JSON provided'}), 400

        patient_name = (data.get('patient_name') or '').strip()
        report_text = data.get('report_text', '')
        detected_frames = data.get('detected_frames', [])
        # Optional explicit status from client
        patient_status = (data.get('patient_status') or '').strip()

        if not patient_name or not report_text:
            return jsonify({'success': False, 'message': 'Missing patient_name or report_text'}), 400

        safe_patient = secure_filename(patient_name) or 'unknown_patient'
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # If client didn't provide a patient_status, infer from detected_frames
        if not patient_status:
            if isinstance(detected_frames, list) and len(detected_frames) > 0:
                patient_status = 'Phát hiện dấu hiệu khối u trên video/ảnh kết quả. Cần đánh giá thêm bởi bác sĩ chuyên khoa.'
            else:
                patient_status = 'Không phát hiện khối u rõ ràng trên video/ảnh đã xử lý. Nếu có triệu chứng, nên kiểm tra thêm.'

        report = {
            'patient_name': patient_name,
            'safe_patient_name': safe_patient,
            'timestamp': timestamp,
            'report_text': report_text,
            'detected_frames': detected_frames,
            'patient_status': patient_status
        }

        import json
        report_filename = f"{safe_patient}_{timestamp}_report.json"
        report_path = os.path.join(RESULTS_FOLDER, report_filename)
        import json
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        print(f"💾 Báo cáo được lưu bởi chatbot: {report_path}")

        return jsonify({'success': True, 'report_url': f'/results/{report_filename}'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/get_latest_video', methods=['GET'])
def get_latest_video():
    try:
        # Lấy danh sách tất cả video trong thư mục results (ưu tiên webm, sau đó mp4)
        video_files = glob.glob(os.path.join(RESULTS_FOLDER, '*.webm')) + glob.glob(os.path.join(RESULTS_FOLDER, '*.mp4'))
        
        if not video_files:
            return jsonify({'error': 'Không tìm thấy video nào'}), 404
        
        # Sắp xếp theo thời gian tạo (mới nhất)
        latest_video = max(video_files, key=os.path.getctime)
        video_name = os.path.basename(latest_video)
        
        # Lấy thông tin file
        file_size = os.path.getsize(latest_video)
        created_time = datetime.fromtimestamp(os.path.getctime(latest_video)).strftime('%Y-%m-%d %H:%M:%S')
        
        return jsonify({
            'success': True,
            'video_url': f'/results/{video_name}',
            'video_name': video_name,
            'file_size': file_size,
            'created_time': created_time
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/search_reports', methods=['GET'])
def search_reports():
    """Search report JSON files in results/ by query string. Returns list of matching reports (full report JSONs).
    Query param: query. If query is empty or 'latest', returns the most recent reports.
    """
    try:
        q = (request.args.get('query') or '').strip().lower()
        # If query is empty or 'latest', we return all reports sorted by time (limit 10)
        is_latest = (not q) or (q == 'latest') or (q == 'báo cáo mới nhất')

        report_files = glob.glob(os.path.join(RESULTS_FOLDER, '*_report.json'))
        matches = []
        for rf in report_files:
            try:
                with open(rf, 'r', encoding='utf-8') as f:
                    rj = json.load(f)
                
                if is_latest:
                    matches.append({'file': os.path.basename(rf), 'report': rj, 'ctime': os.path.getctime(rf)})
                else:
                    # check filename and patient_name and report_text for query
                    base = os.path.basename(rf).lower()
                    pname = (rj.get('patient_name') or '').lower()
                    rtext = (rj.get('report_text') or rj.get('summary') or '').lower()
                    if q in base or q in pname or q in rtext:
                        matches.append({'file': os.path.basename(rf), 'report': rj, 'ctime': os.path.getctime(rf)})
            except Exception:
                continue

        if not matches:
            return jsonify({'success': True, 'matches': []}), 200

        # sort by creation time desc
        matches.sort(key=lambda x: x.get('ctime', 0), reverse=True)
        # return up to 10 matches without ctime
        out = []
        for m in matches[:10]:
            rep = m.get('report')
            out.append({'file': m.get('file'), 'patient_name': rep.get('patient_name'), 'timestamp': rep.get('timestamp'), 'report': rep})

        return jsonify({'success': True, 'matches': out})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/get_patients', methods=['GET'])
def get_patients():
    """Get a list of all patients with stored reports."""
    try:
        report_files = glob.glob(os.path.join(RESULTS_FOLDER, '*_report.json'))
        patients = {}
        for rf in report_files:
            try:
                with open(rf, 'r', encoding='utf-8') as f:
                    rj = json.load(f)
                pname = rj.get('patient_name') or rj.get('safe_patient_name') or 'Unknown'
                timestamp = rj.get('timestamp')
                
                if pname not in patients:
                    patients[pname] = []
                
                patients[pname].append({
                    'file': os.path.basename(rf),
                    'timestamp': timestamp,
                    'tumor_count': rj.get('tumor_count', 0)
                })
            except Exception:
                continue
        
        # Convert to list
        result = []
        for name, reports in patients.items():
            # Sort reports by timestamp desc
            reports.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            result.append({
                'name': name,
                'report_count': len(reports),
                'latest_report': reports[0]
            })
            
        return jsonify({'success': True, 'patients': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/analyze_video', methods=['POST'])
def analyze_video():
    """Analyze an existing video in results/ and produce a JSON report.
    Request JSON: { "video_name": "Phung_Gia_Tho_20251124_112947.webm", "patient_name": "Phùng Gia Thọ", "skip": 1, "max_frames": null }
    """
    try:
        req = request.get_json() or {}
        video_name = req.get('video_name')
        patient_name = req.get('patient_name', 'Unknown')
        skip = int(req.get('skip', 1) or 1)
        # optional pixel spacing (mm per pixel)
        pixel_spacing = None
        try:
            ps = req.get('pixel_spacing')
            if ps is not None:
                pixel_spacing = float(ps)
        except Exception:
            pixel_spacing = None
        max_frames = req.get('max_frames')
        if max_frames is not None:
            try:
                max_frames = int(max_frames)
            except:
                max_frames = None

        if not video_name:
            return jsonify({'success': False, 'message': 'Missing video_name'}), 400

        # Normalize path
        if video_name.startswith('/results/'):
            video_name = video_name.split('/results/')[-1]

        video_path = os.path.join(RESULTS_FOLDER, video_name)
        if not os.path.exists(video_path):
            return jsonify({'success': False, 'message': f'Video not found: {video_name}'}), 404

        # Require model for automatic detection
        if model is None:
            return jsonify({'success': False, 'message': 'YOLO model not loaded on server. Cannot analyze video.'}), 500

        # Read frames
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return jsonify({'success': False, 'message': 'Cannot open video file.'}), 500

        frames = []
        idx = 0
        sampled = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if idx % skip == 0:
                frames.append((idx, frame.copy()))
                sampled += 1
                if max_frames and sampled >= max_frames:
                    break
            idx += 1
        cap.release()

        # Run detection on sampled frames
        detected_objects_local = []
        for fi, frame in frames:
            try:
                results = model(frame, verbose=False)
            except Exception as e:
                print('Detection error on frame', fi, e)
                continue
            boxes = []
            for r in results:
                arr = r.boxes.xyxy.cpu().numpy() if hasattr(r.boxes, 'xyxy') else []
                for box in arr:
                    x1, y1, x2, y2 = map(int, box)
                    boxes.append([int(x1), int(y1), int(x2), int(y2)])
            if boxes:
                detected_objects_local.append({'frame_index': fi, 'boxes': boxes})

        # Build detection details
        detections_details = []
        tumor_count = 0
        for det in detected_objects_local:
            fr_idx = det.get('frame_index')
            boxes = det.get('boxes', [])
            box_list = []
            for (x1, y1, x2, y2) in boxes:
                width_px = int(x2) - int(x1)
                height_px = int(y2) - int(y1)
                area_px = width_px * height_px
                box_entry = {
                    'x1': int(x1), 'y1': int(y1), 'x2': int(x2), 'y2': int(y2),
                    'width_px': width_px, 'height_px': height_px, 'area_px': area_px
                }
                if pixel_spacing and pixel_spacing > 0:
                    width_mm = round(width_px * pixel_spacing, 2)
                    height_mm = round(height_px * pixel_spacing, 2)
                    area_mm2 = round(width_mm * height_mm, 2)
                    box_entry.update({'width_mm': width_mm, 'height_mm': height_mm, 'area_mm2': area_mm2})
                box_list.append(box_entry)
                tumor_count += 1
            detections_details.append({'frame_index': fr_idx, 'boxes': box_list})

        # Build report text
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        safe_patient = secure_filename(patient_name) or 'unknown_patient'
        report_lines = [
            'BÁO CÁO Y KHOA', '',
            f'Bệnh nhân: {patient_name}',
            f'Thời gian tạo báo cáo: {timestamp}',
            f'Video nguồn: /results/{video_name}',
            f'Tổng số frames được phân tích: {len(frames)}',
            ''
        ]
        if tumor_count > 0:
            report_lines.append(f'KẾT LUẬN TẮT: Phát hiện {tumor_count} khối u nghi ngờ trên video.')
            report_lines.append('Danh sách khối u và kích thước (px):')
            for d in detections_details:
                for b in d['boxes']:
                    report_lines.append(f"- Frame {d['frame_index']}: {b['width_px']}x{b['height_px']} px (area {b['area_px']} px^2)")
        else:
            report_lines.append('KẾT LUẬN TẮT: Không phát hiện khối u rõ ràng trên video.')

        report_text = '\n'.join(report_lines)

        patient_status = 'Phát hiện dấu hiệu khối u trên video/ảnh kết quả. Cần đánh giá thêm bởi bác sĩ chuyên khoa.' if tumor_count>0 else 'Không phát hiện khối u rõ ràng trên video/ảnh đã xử lý.'

        report = {
            'patient_name': patient_name,
            'safe_patient_name': safe_patient,
            'timestamp': timestamp,
            'video_url': f'/results/{video_name}',
            'video_name': video_name,
            'frame_count': len(frames),
            'detected_frames': [],
            'detections': detections_details,
            'tumor_count': tumor_count,
            'patient_status': patient_status,
            'report_text': report_text
        }

        report_filename = f"{safe_patient}_{timestamp}_report.json"
        report_path = os.path.join(RESULTS_FOLDER, report_filename)
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return jsonify({'success': True, 'report_url': f'/results/{report_filename}', 'tumor_count': tumor_count})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    print('🚀 Server đang chạy tại http://localhost:5000')
    print('📁 Upload folder:', UPLOAD_FOLDER)
    print('📁 Results folder:', RESULTS_FOLDER)
    # Disable reloader to prevent restarts during heavy processing or library file access
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
