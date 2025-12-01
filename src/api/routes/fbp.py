"""
FBP Reconstruction API using scikit-image
"""
from flask import Blueprint, request, jsonify
import numpy as np
from PIL import Image
import io
import base64

# Try to import skimage, if not available use our own implementation
try:
    from skimage.transform import iradon, radon
    from skimage.data import shepp_logan_phantom
    HAS_SKIMAGE = True
except ImportError:
    HAS_SKIMAGE = False

fbp_bp = Blueprint('fbp', __name__)


def create_filtered_sinogram(sinogram, filter_name):
    """
    Apply the same filter that iradon uses to create filtered sinogram for visualization
    sinogram shape: (n_detectors, n_angles)
    """
    from scipy.fft import fft, ifft, fftfreq
    
    if filter_name is None:
        return sinogram
    
    n_detectors, n_angles = sinogram.shape
    
    # Pad to next power of 2 for efficient FFT
    projection_size_padded = max(64, int(2 ** np.ceil(np.log2(2 * n_detectors))))
    
    # Create frequency array
    freq = fftfreq(projection_size_padded).reshape(-1, 1)
    omega = 2 * np.pi * freq
    
    # Ramp filter |omega|
    fourier_filter = 2 * np.abs(freq)
    
    # Apply window
    if filter_name == 'ramp':
        pass  # Already set
    elif filter_name == 'shepp-logan':
        fourier_filter[1:] *= np.sinc(freq[1:] / 2)
    elif filter_name == 'cosine':
        fourier_filter *= np.cos(freq * np.pi / 2)
    elif filter_name == 'hamming':
        fourier_filter *= (0.54 + 0.46 * np.cos(freq * np.pi))
    elif filter_name == 'hann':
        fourier_filter *= (0.5 + 0.5 * np.cos(freq * np.pi))
    
    # Apply filter to each projection
    filtered = np.zeros_like(sinogram)
    
    for i in range(n_angles):
        projection = sinogram[:, i]
        
        # Pad projection
        padded = np.zeros(projection_size_padded)
        padded[:n_detectors] = projection
        
        # Filter in frequency domain
        projection_fft = fft(padded)
        filtered_fft = projection_fft * fourier_filter.flatten()
        filtered_proj = np.real(ifft(filtered_fft))
        
        filtered[:, i] = filtered_proj[:n_detectors]
    
    return filtered


def iradon_custom(sinogram, theta=None, filter_name='ramp'):
    """
    Custom implementation of inverse radon transform (FBP)
    
    Parameters:
    - sinogram: 2D array, rows = detector positions, columns = angles
    - theta: array of angles in degrees
    - filter_name: filter type
    """
    sinogram = np.array(sinogram, dtype=np.float64)
    
    # sinogram shape: (num_detectors, num_angles)
    num_detectors, num_angles = sinogram.shape
    
    if theta is None:
        theta = np.linspace(0, 180, num_angles, endpoint=False)
    
    # Output image size
    output_size = num_detectors
    
    # Create filter
    filter_len = max(64, int(2 ** np.ceil(np.log2(2 * num_detectors))))
    freq = np.fft.fftfreq(filter_len)
    
    # Ramp filter |omega|
    omega = 2 * np.pi * freq
    ramp = np.abs(omega)
    
    # Apply window
    if filter_name == 'ramp' or filter_name == 'ram-lak':
        filt = ramp
    elif filter_name == 'shepp-logan':
        # sinc filter
        filt = ramp * np.sinc(omega / (2 * np.pi))
    elif filter_name == 'cosine':
        filt = ramp * np.cos(omega / 2)
    elif filter_name == 'hamming':
        filt = ramp * (0.54 + 0.46 * np.cos(omega))
    elif filter_name == 'hann':
        filt = ramp * (0.5 + 0.5 * np.cos(omega))
    else:
        filt = ramp
    
    filt[0] = 0  # DC component
    
    # Filter each projection
    filtered_sinogram = np.zeros_like(sinogram)
    
    for i in range(num_angles):
        projection = sinogram[:, i]
        
        # Zero-pad
        padded = np.zeros(filter_len)
        padded[:num_detectors] = projection
        
        # Apply filter in frequency domain
        projection_fft = np.fft.fft(padded)
        filtered_fft = projection_fft * filt
        filtered = np.real(np.fft.ifft(filtered_fft))
        
        filtered_sinogram[:, i] = filtered[:num_detectors]
    
    # Back-projection
    reconstructed = np.zeros((output_size, output_size), dtype=np.float64)
    
    # Coordinate grids
    center = output_size // 2
    x = np.arange(output_size) - center
    y = np.arange(output_size) - center
    X, Y = np.meshgrid(x, y)
    
    for i, angle in enumerate(theta):
        angle_rad = np.deg2rad(angle)
        
        # Compute projection of each point onto detector
        t = X * np.cos(angle_rad) + Y * np.sin(angle_rad)
        
        # Convert to detector index
        t_idx = t + num_detectors // 2
        
        # Interpolate
        t_floor = np.floor(t_idx).astype(int)
        t_frac = t_idx - t_floor
        
        # Valid indices
        valid = (t_floor >= 0) & (t_floor < num_detectors - 1)
        
        # Linear interpolation
        proj = filtered_sinogram[:, i]
        contribution = np.zeros_like(reconstructed)
        contribution[valid] = (
            proj[t_floor[valid]] * (1 - t_frac[valid]) +
            proj[t_floor[valid] + 1] * t_frac[valid]
        )
        
        reconstructed += contribution
    
    # Normalize
    reconstructed *= np.pi / (2 * num_angles)
    
    return reconstructed


@fbp_bp.route('/api/fbp/reconstruct', methods=['POST'])
def reconstruct():
    """
    Reconstruct CT image from sinogram
    Auto-detects sinogram orientation and tries to produce best result
    """
    try:
        data = request.json
        
        # Decode base64 image
        sinogram_b64 = data.get('sinogram', '')
        if ',' in sinogram_b64:
            sinogram_b64 = sinogram_b64.split(',')[1]
        
        sinogram_bytes = base64.b64decode(sinogram_b64)
        sinogram_img = Image.open(io.BytesIO(sinogram_bytes)).convert('L')
        
        # Convert to numpy array (values 0-255)
        sinogram_array = np.array(sinogram_img, dtype=np.float64)
        
        # Get parameters
        filter_name = data.get('filter', 'ramp')
        if filter_name == 'ram-lak':
            filter_name = 'ramp'
        elif filter_name == 'none':
            filter_name = None
        output_size = data.get('output_size', 256)
        angle_range = data.get('angle_range', 180)
        
        h, w = sinogram_array.shape
        print(f"\n{'='*50}")
        print(f"[FBP] Input sinogram: {h} rows x {w} cols")
        print(f"[FBP] Angle range setting: 0-{angle_range}°, Filter: {filter_name}")
        print(f"[FBP] Input value range: {sinogram_array.min():.1f} to {sinogram_array.max():.1f}")
        
        # IMPORTANT: Normalize sinogram to [0, 1] range for iradon
        sinogram_normalized = sinogram_array / 255.0
        
        # Determine sinogram orientation:
        # Standard convention: horizontal axis = detector position, vertical axis = angle
        # So for a sinogram image: rows = angles, cols = detectors
        # iradon expects: (n_detectors, n_angles) - so we DON'T transpose
        
        # Actually, looking at typical sinogram images:
        # - Width (cols) typically represents detector positions  
        # - Height (rows) typically represents projection angles
        # iradon wants shape (n_detectors, n_angles)
        # So if sinogram is (h=angles, w=detectors), we need to transpose
        
        # For this sinogram (375x363), let's try:
        # Option 1: rows=detectors, cols=angles (no transpose needed)
        # This seems more likely based on the sinogram appearance
        
        # Use the image directly - rows=detectors, cols=angles
        sinogram_for_iradon = sinogram_normalized  # (h=detectors, w=angles)
        
        num_detectors, num_angles = sinogram_for_iradon.shape
        print(f"[FBP] Using: {num_detectors} detectors x {num_angles} angles (no transpose)")
        
        # Create theta array - angles in degrees
        theta = np.linspace(0, angle_range, num_angles, endpoint=False)
        print(f"[FBP] Theta: {theta[0]:.1f}° to {theta[-1]:.1f}° ({len(theta)} angles)")
        
        # Perform FBP reconstruction using scikit-image
        if HAS_SKIMAGE:
            # iradon expects sinogram as (n_detectors, n_angles)
            reconstructed = iradon(sinogram_for_iradon, theta=theta, filter_name=filter_name, circle=True)
            print(f"[FBP] Reconstruction done: {reconstructed.shape}")
            print(f"[FBP] Raw result range: {reconstructed.min():.6f} to {reconstructed.max():.6f}")
            
            # Create filtered sinogram for visualization
            # Apply the same filter that iradon uses
            filtered_sinogram = create_filtered_sinogram(sinogram_for_iradon, filter_name)
        else:
            reconstructed = iradon_custom(sinogram_for_iradon, theta=theta, filter_name=filter_name or 'ramp')
            filtered_sinogram = sinogram_for_iradon  # Fallback
        
        # Rotate if needed (sometimes the reconstruction is rotated)
        # reconstructed = np.rot90(reconstructed, k=1)  # Uncomment if needed
        
        # Apply contrast enhancement using percentile-based windowing
        p_low = np.percentile(reconstructed, 0.5)
        p_high = np.percentile(reconstructed, 99.5)
        print(f"[FBP] Percentile 0.5-99.5: {p_low:.6f} to {p_high:.6f}")
        
        # Clip to percentile range and normalize
        reconstructed_clipped = np.clip(reconstructed, p_low, p_high)
        
        if p_high > p_low:
            reconstructed_norm = (reconstructed_clipped - p_low) / (p_high - p_low)
        else:
            reconstructed_norm = np.zeros_like(reconstructed)
        
        # Apply gamma correction for better visualization
        gamma = 0.7  # < 1 brightens mid-tones
        reconstructed_norm = np.power(reconstructed_norm, gamma)
        
        # Convert to uint8
        reconstructed_uint8 = (reconstructed_norm * 255).astype(np.uint8)
        print(f"[FBP] Final uint8 range: {reconstructed_uint8.min()} to {reconstructed_uint8.max()}")
        
        # Resize to requested output size
        recon_img = Image.fromarray(reconstructed_uint8, mode='L')
        if output_size != reconstructed_uint8.shape[0]:
            recon_img = recon_img.resize((output_size, output_size), Image.LANCZOS)
        
        # Convert reconstructed image to base64
        buffer = io.BytesIO()
        recon_img.save(buffer, format='PNG')
        recon_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        # Convert filtered sinogram to base64
        # Normalize filtered sinogram for display
        fs_min, fs_max = filtered_sinogram.min(), filtered_sinogram.max()
        if fs_max > fs_min:
            filtered_norm = (filtered_sinogram - fs_min) / (fs_max - fs_min) * 255
        else:
            filtered_norm = np.zeros_like(filtered_sinogram)
        filtered_uint8 = filtered_norm.astype(np.uint8)
        filtered_img = Image.fromarray(filtered_uint8, mode='L')
        
        buffer2 = io.BytesIO()
        filtered_img.save(buffer2, format='PNG')
        filtered_b64 = base64.b64encode(buffer2.getvalue()).decode('utf-8')
        
        print(f"[FBP] ✅ Success! Output size: {output_size}x{output_size}")
        print(f"{'='*50}\n")
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{recon_b64}',
            'filtered_sinogram': f'data:image/png;base64,{filtered_b64}',
            'size': output_size,
            'filter': filter_name,
            'num_angles': num_angles,
            'num_detectors': num_detectors,
            'original_shape': f'{h}x{w}'
        })
        
    except Exception as e:
        import traceback
        print(f"[FBP] ❌ Error: {e}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500
