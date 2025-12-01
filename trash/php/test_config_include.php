<?php
// test_config_include.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "Loading config.php...<br>";
require_once 'config.php';
echo "✅ Config loaded successfully.<br>";

if (isset($conn)) {
    echo "✅ Connection object exists.<br>";
    echo "Host info: " . $conn->host_info . "<br>";
} else {
    echo "❌ Connection object missing.<br>";
}
?>
