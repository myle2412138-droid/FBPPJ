<?php
// get_patients.php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once 'config.php';

// Get all patients grouped by name
$sql = "SELECT patient_name, COUNT(*) as report_count, MAX(timestamp) as latest_timestamp FROM medical_reports GROUP BY patient_name ORDER BY latest_timestamp DESC";
$result = $conn->query($sql);

$patients = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $patients[] = [
            'name' => $row['patient_name'],
            'report_count' => $row['report_count'],
            'latest_report' => ['timestamp' => $row['latest_timestamp']]
        ];
    }
}

echo json_encode(['success' => true, 'patients' => $patients]);

$conn->close();
?>
