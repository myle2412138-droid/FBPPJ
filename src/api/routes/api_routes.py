"""
Flask API Routes
"""
import os
import shutil
import glob
from datetime import datetime
from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

from ..config import UPLOAD_FOLDER, RESULTS_FOLDER, MODEL_PATH, allowed_file
from ..services import get_detector, get_video_processor, ReportGenerator
from ..utils.api_client import upload_file_to_php


# Create blueprint
api = Blueprint('api', __name__)

# Initialize detector
detector = get_detector(MODEL_PATH)


@api.route('/api/create_video', methods=['POST'])
def create_video():
    """Create video from uploaded images with tumor detection"""
    print("📥 Nhận request tạo video")
    
    try:
        # Get patient info
        patient_name = request.form.get('patient_name', 'Unknown')
        pixel_spacing = None
        try:
            ps = request.form.get('pixel_spacing')
            if ps:
                pixel_spacing = float(ps)
        except:
            pass
        
        print(f"👤 Bệnh nhân: {patient_name}")
        
        # Check files
        if 'images' not in request.files:
            return jsonify({'error': 'Không có file ảnh'}), 400
        
        files = request.files.getlist('images')
        
        if not files:
            return jsonify({'error': 'Vui lòng chọn ít nhất một ảnh'}), 400
        
        # Create temp folder
        safe_patient = secure_filename(patient_name) or 'unknown_patient'
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        patient_folder = os.path.join(UPLOAD_FOLDER, f'{safe_patient}_{timestamp}')
        os.makedirs(patient_folder, exist_ok=True)
        
        # Save images
        image_files = []
        for i, file in enumerate(files):
            if file and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = f"image_{i:04d}.{ext}"
                filepath = os.path.join(patient_folder, filename)
                file.save(filepath)
                image_files.append(filepath)
        
        if not image_files:
            return jsonify({'error': 'Không có ảnh hợp lệ'}), 400
        
        print(f"💾 Đã lưu {len(image_files)} ảnh")
        
        # Process video
        processor = get_video_processor(detector)
        result = processor.process_images_to_video(
            image_files, patient_name, pixel_spacing
        )
        
        if not result['success']:
            return jsonify({'error': result.get('error', 'Unknown error')}), 500
        
        # Cleanup temp folder
        shutil.rmtree(patient_folder)
        
        # Upload to PHP server
        remote_video_url = upload_file_to_php(result['video_path'])
        
        remote_frames = []
        for local_path in result['detected_frames']:
            remote_url = upload_file_to_php(local_path)
            if remote_url:
                remote_frames.append(remote_url)
            else:
                remote_frames.append(f'/results/{os.path.basename(local_path)}')
        
        final_video_url = remote_video_url or f'/results/{result["video_name"]}'
        
        # Generate report
        report, report_path = ReportGenerator.create_report(
            result, final_video_url, remote_frames
        )
        
        return jsonify({
            'success': True,
            'video_url': final_video_url,
            'patient_name': patient_name,
            'frame_count': result['frame_count'],
            'detected_frames': remote_frames,
            'report_url': f'/results/{os.path.basename(report_path)}'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/api/get_report', methods=['GET'])
def get_report():
    """Get report for a patient"""
    try:
        patient_name = request.args.get('patient_name', '').strip()
        
        if not patient_name:
            return jsonify({'error': 'Thiếu patient_name'}), 400
        
        report = ReportGenerator.get_report(patient_name)
        
        if not report:
            return jsonify({
                'success': False, 
                'message': 'Không tìm thấy báo cáo cho bệnh nhân này.'
            }), 404
        
        return jsonify({'success': True, 'report': report})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/api/search_reports', methods=['GET'])
def search_reports():
    """Search reports by query"""
    try:
        query = request.args.get('query', '').strip()
        matches = ReportGenerator.search_reports(query)
        
        results = [{
            'file': m['file'],
            'patient_name': m['report'].get('patient_name'),
            'timestamp': m['report'].get('timestamp'),
            'report': m['report']
        } for m in matches]
        
        return jsonify({'success': True, 'matches': results})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@api.route('/api/get_patients', methods=['GET'])
def get_patients():
    """Get list of all patients"""
    try:
        patients = ReportGenerator.get_all_patients()
        return jsonify({'success': True, 'patients': patients})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@api.route('/api/get_latest_video', methods=['GET'])
def get_latest_video():
    """Get the most recent video"""
    try:
        video_files = glob.glob(os.path.join(RESULTS_FOLDER, '*.webm'))
        video_files += glob.glob(os.path.join(RESULTS_FOLDER, '*.mp4'))
        
        if not video_files:
            return jsonify({'error': 'Không tìm thấy video nào'}), 404
        
        latest = max(video_files, key=os.path.getctime)
        video_name = os.path.basename(latest)
        
        return jsonify({
            'success': True,
            'video_url': f'/results/{video_name}',
            'video_name': video_name,
            'file_size': os.path.getsize(latest),
            'created_time': datetime.fromtimestamp(
                os.path.getctime(latest)
            ).strftime('%Y-%m-%d %H:%M:%S')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/api/save_report', methods=['POST'])
def save_report():
    """Save a report from chatbot"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No JSON provided'}), 400
        
        patient_name = (data.get('patient_name') or '').strip()
        report_text = data.get('report_text', '')
        detected_frames = data.get('detected_frames', [])
        patient_status = (data.get('patient_status') or '').strip()
        
        if not patient_name or not report_text:
            return jsonify({
                'success': False, 
                'message': 'Missing patient_name or report_text'
            }), 400
        
        safe_patient = secure_filename(patient_name) or 'unknown_patient'
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if not patient_status:
            if detected_frames:
                patient_status = 'Phát hiện dấu hiệu khối u. Cần đánh giá thêm.'
            else:
                patient_status = 'Không phát hiện khối u rõ ràng.'
        
        import json
        report = {
            'patient_name': patient_name,
            'safe_patient_name': safe_patient,
            'timestamp': timestamp,
            'report_text': report_text,
            'detected_frames': detected_frames,
            'patient_status': patient_status
        }
        
        report_filename = f"{safe_patient}_{timestamp}_report.json"
        report_path = os.path.join(RESULTS_FOLDER, report_filename)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Báo cáo chatbot: {report_path}")
        
        return jsonify({
            'success': True, 
            'report_url': f'/results/{report_filename}'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@api.route('/results/<filename>')
def serve_result(filename):
    """Serve files from results folder"""
    return send_from_directory(RESULTS_FOLDER, filename)
