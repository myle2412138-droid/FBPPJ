"""
API client utilities for external services
"""
import requests
from ..config import PHP_API_URL, PHP_UPLOAD_URL


def send_data_to_api(report_data):
    """
    Send report data to PHP API
    
    Args:
        report_data: Dictionary containing report information
    """
    try:
        print(f"🚀 Đang gửi dữ liệu lên {PHP_API_URL}...")
        response = requests.post(PHP_API_URL, json=report_data, timeout=5)
        if response.status_code == 200:
            print(f"✅ Gửi dữ liệu thành công: {response.text}")
        else:
            print(f"⚠️ Lỗi khi gửi dữ liệu (Status {response.status_code}): {response.text}")
    except Exception as e:
        print(f"⚠️ Exception khi gửi API: {e}")


def upload_file_to_php(file_path):
    """
    Upload file to PHP server
    
    Args:
        file_path: Local path to file
        
    Returns:
        Remote URL if successful, None otherwise
    """
    try:
        print(f"🚀 Đang upload file: {file_path}...")
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(PHP_UPLOAD_URL, files=files, timeout=30)
            
        if response.status_code == 200:
            try:
                res_json = response.json()
                if res_json.get('success'):
                    print(f"✅ Upload thành công: {res_json.get('url')}")
                    return res_json.get('url')
                else:
                    print(f"⚠️ Upload thất bại (Server): {res_json.get('message')}")
            except:
                print(f"⚠️ Upload thất bại (Invalid JSON): {response.text}")
        else:
            print(f"⚠️ Upload thất bại (Status {response.status_code}): {response.text}")
    except Exception as e:
        print(f"⚠️ Exception khi upload: {e}")
    return None
