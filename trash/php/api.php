<?php
// api.php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once 'config.php';

// Get raw POST data
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "Invalid JSON data"]);
    exit;
}

// Extract fields
$patient_name = $data['patient_name'] ?? 'Unknown';
$timestamp = $data['timestamp'] ?? date('Ymd_His');
$report_text = $data['report_text'] ?? '';
$tumor_count = $data['tumor_count'] ?? 0;
$patient_status = $data['patient_status'] ?? '';
$video_url = $data['video_url'] ?? '';
$detected_frames = $data['detected_frames'] ?? [];
$image_urls = is_array($detected_frames) ? implode(',', $detected_frames) : '';

// Prepare SQL statement
$stmt = $conn->prepare("INSERT INTO medical_reports (patient_name, timestamp, report_text, tumor_count, patient_status, video_url, image_urls, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

if (!$stmt) {
    echo json_encode(["success" => false, "message" => "Prepare failed: " . $conn->error]);
    exit;
}

$stmt->bind_param("sssissss", $patient_name, $timestamp, $report_text, $tumor_count, $patient_status, $video_url, $image_urls, $json);

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Report saved successfully", "id" => $stmt->insert_id]);
} else {
    echo json_encode(["success" => false, "message" => "Execute failed: " . $stmt->error]);
}

$stmt->close();
$conn->close();
?>
