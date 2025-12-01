<?php
// debug_files.php
header("Content-Type: text/plain");
echo "Current Directory: " . getcwd() . "\n";
echo "Listing files/folders:\n";
echo "----------------------\n";

$files = scandir('.');
foreach ($files as $file) {
    if ($file == '.' || $file == '..') continue;
    
    $type = is_dir($file) ? "[DIR] " : "[FILE]";
    $perms = substr(sprintf('%o', fileperms($file)), -4);
    
    echo "$type $file (Perms: $perms)\n";
}

echo "----------------------\n";
echo "Checking specific folder 'uploadfpb':\n";
if (file_exists('uploadfpb')) {
    echo "✅ FOUND! Is dir? " . (is_dir('uploadfpb') ? "Yes" : "No") . "\n";
    echo "Writable? " . (is_writable('uploadfpb') ? "Yes" : "No") . "\n";
} else {
    echo "❌ NOT FOUND. Please check spelling carefully.\n";
}
?>
