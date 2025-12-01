<?php
// check_db.php
header("Content-Type: text/plain");
require_once 'config.php';

echo "=== DATABASE DEBUG INFO ===\n";
echo "Connected to Database: " . $dbname . "\n";
echo "Host: " . $servername . "\n";
echo "User: " . $username . "\n\n";

// List Tables
echo "=== TABLES ===\n";
$result = $conn->query("SHOW TABLES");
if ($result) {
    while ($row = $result->fetch_array()) {
        echo "- " . $row[0] . "\n";
    }
} else {
    echo "Error listing tables: " . $conn->error . "\n";
}

// Check medical_reports
echo "\n=== DATA IN 'medical_reports' ===\n";
$sql = "SELECT id, patient_name, timestamp, created_at FROM medical_reports ORDER BY id DESC LIMIT 5";
$result = $conn->query($sql);

if ($result) {
    if ($result->num_rows > 0) {
        echo "Found " . $result->num_rows . " recent records:\n";
        echo str_pad("ID", 5) . str_pad("PATIENT", 20) . str_pad("TIMESTAMP", 20) . "CREATED_AT\n";
        echo str_repeat("-", 60) . "\n";
        while ($row = $result->fetch_assoc()) {
            echo str_pad($row['id'], 5) . str_pad(substr($row['patient_name'], 0, 18), 20) . str_pad($row['timestamp'], 20) . $row['created_at'] . "\n";
        }
    } else {
        echo "Table 'medical_reports' exists but is EMPTY.\n";
    }
} else {
    echo "Error querying table: " . $conn->error . "\n";
    echo "(Maybe the table does not exist?)\n";
}

$conn->close();
?>
