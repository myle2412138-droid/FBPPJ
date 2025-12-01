<?php
// search_reports.php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once 'config.php';

$query = isset($_GET['query']) ? trim($_GET['query']) : '';
$limit = 10;

if (empty($query) || strtolower($query) === 'latest' || strtolower($query) === 'báo cáo mới nhất') {
    // Get latest reports
    $sql = "SELECT * FROM medical_reports ORDER BY id DESC LIMIT ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $limit);
} else {
    // Search by patient name or report text
    $search = "%$query%";
    $sql = "SELECT * FROM medical_reports WHERE patient_name LIKE ? OR report_text LIKE ? ORDER BY id DESC LIMIT ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssi", $search, $search, $limit);
}

$stmt->execute();
$result = $stmt->get_result();
$matches = [];

while ($row = $result->fetch_assoc()) {
    // Decode raw_json if needed
    if (isset($row['raw_json']) && is_string($row['raw_json'])) {
        $row['raw_json'] = json_decode($row['raw_json'], true);
    }
    
    // Format output to match what the app expects
    $matches[] = [
        'id' => $row['id'],
        'patient_name' => $row['patient_name'],
        'timestamp' => $row['timestamp'],
        'report' => $row['raw_json'] ? $row['raw_json'] : $row // Fallback to row data if raw_json is missing
    ];
}

echo json_encode(['success' => true, 'matches' => $matches]);

$stmt->close();
$conn->close();
?>
