"""
Report Generation Service
"""
import os
import json
from datetime import datetime

from ..config import RESULTS_FOLDER
from ..utils.api_client import send_data_to_api


class ReportGenerator:
    """Service for generating medical reports"""
    
    @staticmethod
    def generate_report_text(patient_name, timestamp, frame_count, detections, tumor_count):
        """
        Generate human-readable report text
        
        Args:
            patient_name: Patient name
            timestamp: Report timestamp
            frame_count: Number of frames processed
            detections: List of detection details
            tumor_count: Total tumor count
            
        Returns:
            Formatted report string
        """
        lines = [
            'BÁO CÁO Y KHOA',
            '',
            f'Bệnh nhân: {patient_name}',
            f'Thời gian tạo báo cáo: {timestamp}',
            f'Tổng số khung hình đã xử lý: {frame_count}',
            ''
        ]
        
        if tumor_count > 0:
            lines.append(f'KẾT LUẬN TẮT: Phát hiện {tumor_count} khối u nghi ngờ.')
            lines.append('Mô tả: Hệ thống phát hiện vùng nghi ngờ khối u trên hình ảnh CT/ảnh y tế.')
            lines.append('')
            lines.append('Chi tiết phát hiện:')
            
            for det in detections:
                for box in det.get('boxes', []):
                    size_info = f"{box['width_px']}x{box['height_px']} px"
                    if 'width_mm' in box:
                        size_info += f" ({box['width_mm']}x{box['height_mm']} mm)"
                    lines.append(f"- Frame {det['frame_index']}: {size_info}")
        else:
            lines.append('KẾT LUẬN TẮT: Không phát hiện bất thường rõ ràng.')
            lines.append('Nếu có triệu chứng lâm sàng đáng ngại, đề nghị kiểm tra bổ sung.')
        
        lines.extend([
            '',
            'Khuyến nghị lâm sàng:',
            '- Đối với tổn thương nghi ngờ: thực hiện MRI/CT tái khám;',
            '- Thảo luận tại hội chẩn đa chuyên khoa nếu cần thiết;',
            '- Kết hợp lâm sàng và tiền sử bệnh nhân để chẩn đoán chính xác.'
        ])
        
        return '\n'.join(lines)
    
    @staticmethod
    def create_report(video_result, video_url=None, detected_frame_urls=None):
        """
        Create and save a full report
        
        Args:
            video_result: Result from VideoProcessor
            video_url: Remote video URL (optional)
            detected_frame_urls: List of remote frame URLs (optional)
            
        Returns:
            Report dictionary and file path
        """
        patient_name = video_result['patient_name']
        safe_patient = video_result['safe_patient_name']
        timestamp = video_result['timestamp']
        frame_count = video_result['frame_count']
        detections = video_result['detections']
        tumor_count = video_result['tumor_count']
        
        # Generate report text
        report_text = ReportGenerator.generate_report_text(
            patient_name, timestamp, frame_count, detections, tumor_count
        )
        
        # Determine patient status
        if tumor_count > 0:
            patient_status = 'Phát hiện dấu hiệu khối u. Cần đánh giá thêm bởi bác sĩ chuyên khoa.'
        else:
            patient_status = 'Không phát hiện khối u rõ ràng. Nếu có triệu chứng, nên kiểm tra thêm.'
        
        # Build report object
        report = {
            'patient_name': patient_name,
            'safe_patient_name': safe_patient,
            'timestamp': timestamp,
            'video_url': video_url or f'/results/{video_result["video_name"]}',
            'video_name': video_result['video_name'],
            'frame_count': frame_count,
            'detected_frames': detected_frame_urls or [],
            'detections': detections,
            'tumor_count': tumor_count,
            'patient_status': patient_status,
            'report_text': report_text,
            'summary': f'Phát hiện {tumor_count} khối u trên {frame_count} khung hình.' if tumor_count > 0 else 'Không phát hiện bất thường.'
        }
        
        # Save report
        report_filename = f"{safe_patient}_{timestamp}_report.json"
        report_path = os.path.join(RESULTS_FOLDER, report_filename)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Đã lưu báo cáo: {report_path}")
        
        # Send to API
        send_data_to_api(report)
        
        return report, report_path
    
    @staticmethod
    def get_report(patient_name):
        """
        Find and load report for a patient
        
        Args:
            patient_name: Patient name to search
            
        Returns:
            Report dictionary or None
        """
        import glob
        from werkzeug.utils import secure_filename
        
        safe_patient = secure_filename(patient_name).lower()
        report_files = glob.glob(os.path.join(RESULTS_FOLDER, '*_report.json'))
        
        matched = []
        
        # Try filename match
        for rf in report_files:
            base = os.path.basename(rf).lower()
            if safe_patient in base:
                matched.append(rf)
        
        # Try content match if no filename match
        if not matched:
            for rf in report_files:
                try:
                    with open(rf, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    pname = (data.get('patient_name') or '').lower()
                    if safe_patient in pname or pname in safe_patient:
                        matched.append(rf)
                except:
                    continue
        
        if not matched:
            return None
        
        # Return latest
        latest = max(matched, key=os.path.getctime)
        with open(latest, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def search_reports(query=''):
        """
        Search reports by query
        
        Args:
            query: Search query string
            
        Returns:
            List of matching reports
        """
        import glob
        
        report_files = glob.glob(os.path.join(RESULTS_FOLDER, '*_report.json'))
        query = query.lower().strip()
        is_latest = not query or query in ('latest', 'báo cáo mới nhất')
        
        matches = []
        
        for rf in report_files:
            try:
                with open(rf, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                if is_latest:
                    matches.append({
                        'file': os.path.basename(rf),
                        'report': data,
                        'ctime': os.path.getctime(rf)
                    })
                else:
                    base = os.path.basename(rf).lower()
                    pname = (data.get('patient_name') or '').lower()
                    rtext = (data.get('report_text') or '').lower()
                    
                    if query in base or query in pname or query in rtext:
                        matches.append({
                            'file': os.path.basename(rf),
                            'report': data,
                            'ctime': os.path.getctime(rf)
                        })
            except:
                continue
        
        # Sort by creation time (newest first)
        matches.sort(key=lambda x: x.get('ctime', 0), reverse=True)
        
        return matches[:10]  # Return max 10
    
    @staticmethod
    def get_all_patients():
        """
        Get list of all patients with reports
        
        Returns:
            List of patient summaries
        """
        import glob
        
        report_files = glob.glob(os.path.join(RESULTS_FOLDER, '*_report.json'))
        patients = {}
        
        for rf in report_files:
            try:
                with open(rf, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                pname = data.get('patient_name') or data.get('safe_patient_name') or 'Unknown'
                
                if pname not in patients:
                    patients[pname] = []
                
                patients[pname].append({
                    'file': os.path.basename(rf),
                    'timestamp': data.get('timestamp'),
                    'tumor_count': data.get('tumor_count', 0)
                })
            except:
                continue
        
        # Convert to list
        result = []
        for name, reports in patients.items():
            reports.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            result.append({
                'name': name,
                'report_count': len(reports),
                'latest_report': reports[0]
            })
        
        return result
