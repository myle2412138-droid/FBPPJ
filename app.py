"""
FBP Platform - Flask Backend Server
Clean, modular architecture
"""
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from flask import Flask, send_from_directory
from flask_cors import CORS

from api.config import HOST, PORT, DEBUG
from api.routes import api
from api.routes.fbp import fbp_bp
from api.routes.chat import chat_bp


def create_app():
    """Application factory"""
    app = Flask(__name__, static_folder=None)  # Disable default static
    CORS(app)
    
    # Register blueprints
    app.register_blueprint(api)
    app.register_blueprint(fbp_bp)
    app.register_blueprint(chat_bp)
    
    # Static file routes
    @app.route('/')
    def index():
        return send_from_directory('.', 'index.html')
    
    @app.route('/pages/<path:path>')
    def serve_pages_compat(path):
        """Backward compatibility: /pages/* -> src/web/pages/*"""
        return send_from_directory('src/web/pages', path)
    
    @app.route('/styles/<path:path>')
    def serve_styles_compat(path):
        """Backward compatibility: /styles/* -> src/web/styles/*"""
        return send_from_directory('src/web/styles', path)
    
    @app.route('/scripts/<path:path>')
    def serve_scripts_compat(path):
        """Backward compatibility: /scripts/* -> src/web/scripts/*"""
        return send_from_directory('src/web/scripts', path)
    
    @app.route('/src/web/<path:path>')
    def serve_web(path):
        """Serve files from src/web"""
        return send_from_directory('src/web', path)
    
    @app.route('/public/<path:path>')
    def serve_public(path):
        """Serve public assets"""
        return send_from_directory('public', path)
    
    @app.route('/model/<path:path>')
    def serve_model(path):
        """Serve model files"""
        return send_from_directory('model', path)
    
    @app.route('/uploads/<path:path>')
    def serve_uploads(path):
        """Serve uploaded files"""
        return send_from_directory('uploads', path)
    
    @app.route('/results/<path:path>')
    def serve_results(path):
        """Serve result files"""
        return send_from_directory('results', path)
    
    @app.route('/<path:path>')
    def serve_static(path):
        """Fallback: serve from root (but not /api routes)"""
        # Don't catch API routes
        if path.startswith('api/'):
            from flask import abort
            abort(404)
        return send_from_directory('.', path)
    
    return app


# Create app instance
app = create_app()


if __name__ == '__main__':
    print('🚀 FBP Server đang chạy tại http://localhost:5000')
    print('📁 Upload folder: uploads/')
    print('📁 Results folder: results/')
    app.run(
        debug=DEBUG, 
        host=HOST, 
        port=PORT, 
        use_reloader=False
    )
