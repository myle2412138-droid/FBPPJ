"""
YOLO Tumor Detection Service
"""
import os
import cv2

# Monkeypatch torch.load for PyTorch 2.6+ compatibility
try:
    import torch
    _original_load = torch.load
    def _safe_load(*args, **kwargs):
        if 'weights_only' not in kwargs:
            kwargs['weights_only'] = False
        return _original_load(*args, **kwargs)
    torch.load = _safe_load
    print("✅ Đã áp dụng bản vá cho torch.load (weights_only=False)")
except Exception as e:
    print(f"⚠️ Không thể vá torch.load: {e}")


class YOLODetector:
    """YOLO-based tumor detection service"""
    
    def __init__(self, model_path):
        """
        Initialize YOLO detector
        
        Args:
            model_path: Path to YOLO model file (.pt)
        """
        self.model = None
        self.model_path = model_path
        self._load_model()
    
    def _load_model(self):
        """Load YOLO model from file"""
        print("⏳ Đang load YOLO model...")
        
        if not os.path.exists(self.model_path):
            print(f'⚠️ Không tìm thấy file model tại {self.model_path}')
            return
            
        try:
            from ultralytics import YOLO
            self.model = YOLO(self.model_path)
            print('✅ Đã load YOLO model thành công')
        except Exception as e:
            print(f'⚠️ Không thể load YOLO model: {e}')
    
    def is_loaded(self):
        """Check if model is loaded"""
        return self.model is not None
    
    def detect(self, frame, verbose=False):
        """
        Detect tumors in a single frame
        
        Args:
            frame: Image array (BGR)
            verbose: Whether to show detection logs
            
        Returns:
            List of detection results with boxes
        """
        if not self.is_loaded():
            return []
            
        try:
            results = self.model(frame, verbose=verbose)
            detections = []
            
            for r in results:
                boxes = r.boxes.xyxy.cpu().numpy() if hasattr(r.boxes, 'xyxy') else []
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box)
                    detections.append({
                        'x1': x1, 'y1': y1, 
                        'x2': x2, 'y2': y2,
                        'width_px': x2 - x1,
                        'height_px': y2 - y1,
                        'area_px': (x2 - x1) * (y2 - y1)
                    })
            
            return detections
        except Exception as e:
            print(f'⚠️ Detection error: {e}')
            return []
    
    def detect_and_draw(self, frame, verbose=False):
        """
        Detect tumors and draw bounding boxes on frame
        
        Args:
            frame: Image array (BGR)
            verbose: Whether to show detection logs
            
        Returns:
            Tuple of (annotated_frame, detections_list)
        """
        if not self.is_loaded():
            return frame, []
            
        try:
            results = self.model(frame, verbose=verbose)
            detections = []
            annotated = frame.copy()
            
            for r in results:
                boxes = r.boxes.xyxy.cpu().numpy() if hasattr(r.boxes, 'xyxy') else []
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box)
                    
                    # Draw bounding box
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(annotated, 'Tumor', (x1, y1-10), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                    
                    detections.append({
                        'x1': x1, 'y1': y1,
                        'x2': x2, 'y2': y2,
                        'width_px': x2 - x1,
                        'height_px': y2 - y1,
                        'area_px': (x2 - x1) * (y2 - y1)
                    })
            
            return annotated, detections
        except Exception as e:
            print(f'⚠️ Detection error: {e}')
            return frame, []


# Global detector instance (lazy initialization)
_detector = None


def get_detector(model_path=None):
    """Get or create global detector instance"""
    global _detector
    
    if _detector is None and model_path:
        _detector = YOLODetector(model_path)
    
    return _detector
