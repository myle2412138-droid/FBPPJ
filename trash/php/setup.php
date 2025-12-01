<?php
// setup.php
// Run this file once to setup Database and Folders
ini_set('display_errors', 1);
error_reporting(E_ALL);

$servername = "localhost";
$username = "root";
$password = "123456";

// 1. Connect to MySQL (with DB selected, assuming it exists)
$dbname = "fbp_db";
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
echo "✅ Connected to database '$dbname' successfully<br>";

// Skip CREATE DATABASE as we are using existing one


// 3. Select Database
$conn->select_db($dbname);

// 4. Create Table
$table_sql = "CREATE TABLE IF NOT EXISTS medical_reports (
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

if ($conn->query($table_sql) === TRUE) {
    echo "✅ Table 'medical_reports' checked/created<br>";
} else {
    echo "❌ Error creating table: " . $conn->error . "<br>";
}

// 5. Check Upload Folder (Do not create)
$upload_dir = 'uploadfpb';
if (file_exists($upload_dir)) {
    echo "✅ Folder '$upload_dir' exists.<br>";
    if (is_writable($upload_dir)) {
        echo "✅ Folder is writable.<br>";
    } else {
        echo "⚠️ Folder exists but might not be writable. Check permissions (777).<br>";
    }
} else {
    echo "⚠️ Folder '$upload_dir' is MISSING. Please create it manually via FTP/File Manager.<br>";
}

$conn->close();
echo "<hr><b>Setup Finished.</b>";
?>
