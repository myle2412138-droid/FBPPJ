<?php
// test_connection.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

$servername = "localhost";
$username = "root";
$password = "123456";
$dbname = "fbp_db";

echo "1. Connecting to MySQL...<br>";
$conn = new mysqli($servername, $username, $password);

if ($conn->connect_error) {
    die("❌ Connection failed: " . $conn->connect_error);
}
echo "✅ Connected to MySQL server.<br>";

echo "2. Checking database '$dbname'...<br>";
if ($conn->select_db($dbname)) {
    echo "✅ Database '$dbname' exists and selected.<br>";
} else {
    echo "⚠️ Database '$dbname' does not exist. Trying to create...<br>";
    $sql = "CREATE DATABASE $dbname";
    if ($conn->query($sql) === TRUE) {
        echo "✅ Database created successfully.<br>";
    } else {
        echo "❌ Error creating database: " . $conn->error . "<br>";
    }
}

$conn->close();
?>
