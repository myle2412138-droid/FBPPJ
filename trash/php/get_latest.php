<?php
// get_latest.php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once 'config.php';

// Fetch the latest report
$sql = "SELECT * FROM medical_reports ORDER BY id DESC LIMIT 1";
$result = $conn->query($sql);

if ($result && $result->num_rows > 0) {
    $row = $result->fetch_assoc();
    // Decode raw_json if it's a string, just in case
    if (isset($row['raw_json']) && is_string($row['raw_json'])) {
        $row['raw_json'] = json_decode($row['raw_json'], true);
    }
    echo json_encode(["success" => true, "data" => $row]);
} else {
    echo json_encode(["success" => false, "message" => "No reports found"]);
}

$conn->close();
?>
