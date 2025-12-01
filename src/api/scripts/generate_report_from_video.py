#!/usr/bin/env python3
"""
Generate detailed JSON report from an existing result video by running YOLO detection on frames.
Saves report to results/<safe_patient>_<timestamp>_report.json

Usage:
  python scripts/generate_report_from_video.py --video results/Phung_Gia_Tho_20251124_112947.webm --patient "Phùng Gia Thọ"

Requirements: OpenCV, numpy, ultralytics (if you want to use the same model)
"""
import os
import sys
import argparse
import json
from datetime import datetime
import cv2
from werkzeug.utils import secure_filename

try:
    from ultralytics import YOLO
    has_ultralytics = True
except Exception:
    has_ultralytics = False


def read_video_frames(video_path, max_frames=None, skip=1):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")
    frames = []
    idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % skip == 0:
            frames.append((idx, frame))
            if max_frames and len(frames) >= max_frames:
                break
        idx += 1
    cap.release()
    return frames


def run_detection_on_frames(model, frames):
    results_list = []
    for idx, frame in frames:
        # ultralytics YOLO expects ndarray BGR
        res = model(frame)
        boxes = []
        for r in res:
            if hasattr(r, 'boxes'):
                arr = r.boxes.xyxy.cpu().numpy() if hasattr(r.boxes, 'xyxy') else []
                for box in arr:
                    x1, y1, x2, y2 = map(int, box)
                    boxes.append([x1, y1, x2, y2])
        if boxes:
            results_list.append({'frame_index': idx, 'boxes': boxes})
    return results_list


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--video', required=True)
    p.add_argument('--patient', required=True)
    p.add_argument('--max-frames', type=int, default=None)
    p.add_argument('--skip', type=int, default=1, help='Process every N-th frame')
    p.add_argument('--pixel-spacing', type=float, default=None, help='Pixel spacing in mm/pixel to convert sizes to mm')
    args = p.parse_args()

    video = args.video
    patient = args.patient
    if not os.path.exists(video):
        print('Video not found:', video)
        sys.exit(1)

    print('Reading frames from', video)
    frames = read_video_frames(video, max_frames=args.max_frames, skip=args.skip)
    print(f'Loaded {len(frames)} frames (sampled every {args.skip} frames)')

    detected_objects = []
    if has_ultralytics and os.path.exists('model/best.pt'):
        print('Loading YOLO model...')
        model = YOLO('model/best.pt')
        detected_objects = run_detection_on_frames(model, frames)
        print('Detections on frames:', len(detected_objects))
    else:
        print('Ultralytics or model not available; skipping model detection.')

    # Compute detection sizes
    detections_details = []
    tumor_count = 0
    for det in detected_objects:
        fi = det['frame_index']
        boxes = det['boxes']
        bl = []
        for (x1, y1, x2, y2) in boxes:
            w = int(x2) - int(x1)
            h = int(y2) - int(y1)
            area = w * h
            entry = {'x1': int(x1), 'y1': int(y1), 'x2': int(x2), 'y2': int(y2), 'width_px': w, 'height_px': h, 'area_px': area}
            if args.pixel_spacing and args.pixel_spacing > 0:
                width_mm = round(w * args.pixel_spacing, 2)
                height_mm = round(h * args.pixel_spacing, 2)
                area_mm2 = round(width_mm * height_mm, 2)
                entry.update({'width_mm': width_mm, 'height_mm': height_mm, 'area_mm2': area_mm2})
            bl.append(entry)
            tumor_count += 1
        detections_details.append({'frame_index': fi, 'boxes': bl})

    # Build report_text
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_patient = secure_filename(patient)
    video_name = os.path.basename(video)
    report_lines = [
        'BÁO CÁO Y KHOA', '',
        f'Bệnh nhân: {patient}',
        f'Thời gian tạo báo cáo: {timestamp}',
        f'Video nguồn: {video}',
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

    report = {
        'patient_name': patient,
        'safe_patient_name': safe_patient,
        'timestamp': timestamp,
        'video_url': f'/results/{video_name}',
        'video_name': video_name,
        'frame_count': len(frames),
        'detected_frames': [],
        'detections': detections_details,
        'tumor_count': tumor_count,
        'patient_status': 'Phát hiện dựa trên phân tích video' if tumor_count>0 else 'Không phát hiện',
        'report_text': report_text
    }

    report_filename = f"{safe_patient}_{timestamp}_report.json"
    os.makedirs('results', exist_ok=True)
    report_path = os.path.join('results', report_filename)
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print('Saved report to', report_path)

if __name__ == '__main__':
    main()
