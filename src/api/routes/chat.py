"""
Chat API Routes - Proxy for Groq API
Keeps API key secure on server side
"""
import os
import requests
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv

# Load .env file
load_dotenv()

chat_bp = Blueprint('chat', __name__)

GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'


@chat_bp.route('/api/chat', methods=['POST'])
def chat():
    """
    Proxy endpoint for Groq API
    Keeps API key secure on server
    """
    if not GROQ_API_KEY:
        return jsonify({
            'success': False,
            'error': 'API key not configured. Please set GROQ_API_KEY in .env file'
        }), 500
    
    try:
        data = request.json
        messages = data.get('messages', [])
        options = data.get('options', {})
        
        # Build request body
        request_body = {
            'model': options.get('model', 'llama-3.3-70b-versatile'),
            'messages': messages,
            'temperature': options.get('temperature', 0.6),
            'max_tokens': options.get('maxTokens', 2048),
            'top_p': options.get('topP', 0.95),
        }
        
        # Call Groq API
        response = requests.post(
            GROQ_API_URL,
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            json=request_body,
            timeout=60
        )
        
        if not response.ok:
            error_text = response.text
            print(f"[Chat API] Error: {error_text}")
            return jsonify({
                'success': False,
                'error': f'Groq API error: {response.status_code}'
            }), response.status_code
        
        result = response.json()
        
        return jsonify({
            'success': True,
            'response': result
        })
        
    except requests.Timeout:
        return jsonify({
            'success': False,
            'error': 'Request timeout'
        }), 504
    except Exception as e:
        print(f"[Chat API] Exception: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@chat_bp.route('/api/chat/status', methods=['GET'])
def chat_status():
    """Check if chat API is configured"""
    return jsonify({
        'configured': bool(GROQ_API_KEY),
        'model': 'llama-3.3-70b-versatile'
    })
