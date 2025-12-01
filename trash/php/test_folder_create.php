<?php
// test_folder_create.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

$dir = 'test_folder_' . time();
echo "Attempting to create folder: $dir<br>";

if (mkdir($dir)) {
    echo "✅ Folder created successfully.<br>";
    rmdir($dir); // Clean up
    echo "✅ Folder removed.<br>";
} else {
    echo "❌ Failed to create folder. Last error: ";
    print_r(error_get_last());
}
?>
