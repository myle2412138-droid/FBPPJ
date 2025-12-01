"""
File utilities for handling images and file operations
"""
import cv2
import numpy as np
from werkzeug.utils import secure_filename


def read_image_unicode(path):
    """
    Read image file with unicode path support
    
    Args:
        path: Path to image file (supports unicode characters)
        
    Returns:
        numpy array of image or None if error
    """
    try:
        with open(path, "rb") as stream:
            bytes_data = bytearray(stream.read())
            numpyarray = np.asarray(bytes_data, dtype=np.uint8)
            return cv2.imdecode(numpyarray, cv2.IMREAD_UNCHANGED)
    except Exception as e:
        print(f"Error reading file {path}: {e}")
        return None


def secure_patient_name(patient_name):
    """
    Sanitize patient name for filesystem use
    
    Args:
        patient_name: Raw patient name string
        
    Returns:
        Safe filename string
    """
    safe_name = secure_filename(patient_name)
    if not safe_name:
        safe_name = 'unknown_patient'
    return safe_name


def convert_grayscale_to_bgr(frame):
    """
    Convert grayscale image to BGR if needed
    
    Args:
        frame: Input image array
        
    Returns:
        BGR image array
    """
    if frame is None:
        return None
    if len(frame.shape) == 2:
        return cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
    return frame
