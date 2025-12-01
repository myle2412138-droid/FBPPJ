"""
Configuration settings for FBP Backend Server
"""
import os

# Directories - PROJECT_ROOT is the main project folder (FBPPJ)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads')
RESULTS_FOLDER = os.path.join(PROJECT_ROOT, 'results')
MODEL_PATH = os.path.join(PROJECT_ROOT, 'model', 'best.pt')

# Allowed file extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp'}

# Video settings
VIDEO_FPS = 10
VIDEO_CODEC = 'vp80'  # WebM format

# API settings
PHP_API_URL = "https://viegrand.site/phpfpb/api.php"
PHP_UPLOAD_URL = "https://viegrand.site/phpfpb/upload.php"

# Server settings
HOST = '0.0.0.0'
PORT = 5000
DEBUG = True

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
