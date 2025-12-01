"""
Video Processing Service
"""
import os
import cv2
from datetime import datetime

from ..config import RESULTS_FOLDER, VIDEO_FPS, VIDEO_CODEC
from ..utils.file_utils import read_image_unicode, secure_patient_name, convert_grayscale_to_bgr
from .detector import get_detector


class VideoProcessor:
    """Service for processing images into video with tumor detection"""
    
    def __init__(self, detector=None):
        """
        Initialize video processor
        
        Args:
            detector: YOLODetector instance (optional)
        """
        self.detector = detector
    
    def process_images_to_video(self, image_files, patient_name, pixel_spacing=None):
        """
        Process a list of images into a video with tumor detection
        
        Args:
            image_files: List of image file paths
            patient_name: Patient name
            pixel_spacing: Optional pixel spacing in mm
            
        Returns:
            Dictionary with processing results
        """
        if not image_files:
            return {'success': False, 'error': 'No images provided'}
        
        # Sort files
        image_files = sorted(image_files)
        
        # Safe patient name
        safe_patient = secure_patient_name(patient_name)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Read first frame to get dimensions
        first_frame = read_image_unicode(image_files[0])
        if first_frame is None:
            return {'success': False, 'error': 'Cannot read first image'}
        
        first_frame = convert_grayscale_to_bgr(first_frame)
        height, width = first_frame.shape[:2]
        
        # Setup video writer
        output_name = f'{safe_patient}_{timestamp}.webm'
        output_path = os.path.join(RESULTS_FOLDER, output_name)
        
        fourcc = cv2.VideoWriter_fourcc(*VIDEO_CODEC)
        video = cv2.VideoWriter(output_path, fourcc, VIDEO_FPS, (width, height))
        
        if not video.isOpened():
            return {'success': False, 'error': 'Cannot initialize video writer'}
        
        # Process frames
        detected_frames = []
        all_detections = []
        tumor_count = 0
        
        for idx, image_path in enumerate(image_files):
            frame = read_image_unicode(image_path)
            if frame is None:
                continue
            
            frame = convert_grayscale_to_bgr(frame)
            
            # Detect tumors if detector available
            frame_detections = []
            if self.detector and self.detector.is_loaded():
                frame, frame_detections = self.detector.detect_and_draw(frame)
                
                if frame_detections:
                    # Add pixel spacing info if available
                    for det in frame_detections:
                        if pixel_spacing and pixel_spacing > 0:
                            det['width_mm'] = round(det['width_px'] * pixel_spacing, 2)
                            det['height_mm'] = round(det['height_px'] * pixel_spacing, 2)
                            det['area_mm2'] = round(det['width_mm'] * det['height_mm'], 2)
                    
                    all_detections.append({
                        'frame_index': idx,
                        'boxes': frame_detections
                    })
                    tumor_count += len(frame_detections)
                    
                    # Save detected frame (limit to 5)
                    if len(detected_frames) < 5:
                        tumor_img_name = f'{safe_patient}_{timestamp}_tumor_{idx}.jpg'
                        tumor_img_path = os.path.join(RESULTS_FOLDER, tumor_img_name)
                        try:
                            cv2.imwrite(tumor_img_path, frame)
                            detected_frames.append(tumor_img_path)
                        except Exception as e:
                            print(f"⚠️ Error saving tumor image: {e}")
            
            video.write(frame)
            
            if (idx + 1) % 10 == 0:
                print(f"✅ Processed {idx + 1} frames")
        
        video.release()
        
        return {
            'success': True,
            'video_path': output_path,
            'video_name': output_name,
            'frame_count': len(image_files),
            'detected_frames': detected_frames,
            'detections': all_detections,
            'tumor_count': tumor_count,
            'patient_name': patient_name,
            'safe_patient_name': safe_patient,
            'timestamp': timestamp
        }


def get_video_processor(detector=None):
    """Get video processor instance"""
    return VideoProcessor(detector)
