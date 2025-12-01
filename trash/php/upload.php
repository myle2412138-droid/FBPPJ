<?php
// upload.php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

// Configuration
$upload_dir = 'uploadfpb/';
$base_url = 'https://viegrand.site/phpfpb/uploadfpb/';

// Create directory if not exists
// Note: On some Windows servers, is_writable() returns false even if we can write.
// We will try to upload anyway and catch the error.
if (!file_exists($upload_dir)) {
     // Try to create it one last time, suppressing errors
    @mkdir($upload_dir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['file'])) {
    echo json_encode(['success' => false, 'message' => 'No file uploaded']);
    exit;
}

$file = $_FILES['file'];
$filename = basename($file['name']);
// Sanitize filename
$filename = preg_replace("/[^a-zA-Z0-9._-]/", "_", $filename);
$target_path = $upload_dir . $filename;

// Check for errors
if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'Upload error code: ' . $file['error']]);
    exit;
}

// Move file
if (move_uploaded_file($file['tmp_name'], $target_path)) {
    $url = $base_url . $filename;
    echo json_encode([
        'success' => true, 
        'message' => 'File uploaded successfully',
        'url' => $url,
        'filename' => $filename
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to move uploaded file']);
}
?>
