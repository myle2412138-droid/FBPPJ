<?php
// config.php
$servername = "localhost";
$username = "root";
$password = "123456";
$dbname = "fbp_db";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Set charset to utf8mb4 for proper unicode support
$conn->set_charset("utf8mb4");
?>
