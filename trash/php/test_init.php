<?php
// test_init.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'config.php';

echo "1. Checking Table 'medical_reports'...\n";
$check_table = "SHOW TABLES LIKE 'medical_reports'";
$result = $conn->query($check_table);

if ($result->num_rows > 0) {
    echo "✅ Table 'medical_reports' exists.\n";
} else {
    echo "⚠️ Table missing. Creating...\n";
    $sql = "CREATE TABLE IF NOT EXISTS medical_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_name VARCHAR(255) NOT NULL,
        timestamp VARCHAR(50),
        report_text TEXT,
        tumor_count INT DEFAULT 0,
        patient_status VARCHAR(255),
        video_url VARCHAR(255),
        image_urls TEXT,
        raw_json JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    
    if ($conn->query($sql) === TRUE) {
        echo "✅ Table created successfully.\n";
    } else {
        echo "❌ Error creating table: " . $conn->error . "\n";
    }
}

echo "2. Checking Upload Folder 'uploadfpb'...\n";
$upload_dir = 'uploadfpb';
if (!file_exists($upload_dir)) {
    echo "⚠️ Folder missing. Creating...\n";
    if (mkdir($upload_dir, 0777, true)) {
        echo "✅ Folder created.\n";
    } else {
        echo "❌ Failed to create folder. Check permissions.\n";
    }
} else {
    echo "✅ Folder exists.\n";
}

if (is_writable($upload_dir)) {
    echo "✅ Folder is writable.\n";
} else {
    echo "❌ Folder is NOT writable. Please chmod 777 manually.\n";
}

$conn->close();
?>
