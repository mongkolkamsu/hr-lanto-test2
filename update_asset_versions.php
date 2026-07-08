<?php
/**
 * Script สำหรับอัพเดทเวอร์ชั่นของ JS/CSS ไฟล์อัตโนมัติ
 * ใช้ file hash แทนการใส่ version number แบบ manual
 */

require_once 'includes/asset_versioning.php';

// รายการไฟล์ที่ต้องการอัพเดท
$assets = [
    'assets/js/thai-address-data.js',
    'assets/js/thai-address.js', 
    'assets/js/app.js',
    'assets/js/forgot-password.js',
    'assets/js/admin.js',
    'assets/js/admin-payslip.js'
];

echo "=== อัพเดทเวอร์ชั่นไฟล์ JS ด้วย File Hash ===\n\n";

// อ่านไฟล์ index.html
$indexFile = 'index.html';
$content = file_get_contents($indexFile);

if (!$content) {
    die("ไม่สามารถอ่านไฟล์ $indexFile ได้\n");
}

// อัพเดทแต่ละไฟล์
foreach ($assets as $asset) {
    $versionedAsset = getVersionedAsset($asset);
    echo "$asset -> $versionedAsset\n";
    
    // หา script tag ที่เกี่ยวข้องและอัพเดท
    $pattern = '/<script\s+src="' . preg_quote($asset, '/') . '\?v=[^"]+"[^>]*>/';
    $replacement = '<script src="' . $versionedAsset . '">';
    
    if (preg_match($pattern, $content)) {
        $content = preg_replace($pattern, $replacement, $content);
        echo "  ✓ อัพเดทแล้ว\n";
    } else {
        echo "  ⚠ ไม่พบ script tag ใน index.html\n";
    }
}

// บันทึกการเปลี่ยนแปลง
if (file_put_contents($indexFile, $content)) {
    echo "\n✅ บันทึกการเปลี่ยนแปลงลง $indexFile เรียบร้อยแล้ว\n";
} else {
    echo "\n❌ ไม่สามารถบันทึกการเปลี่ยนแปลงได้\n";
}

echo "\n=== ตรวจสอบผลลัพธ์ ===\n";
echo "เปิดไฟล์ index.html เพื่อตรวจสอบ script tags ที่อัพเดทแล้ว\n";
echo "พนักงานจะได้รับ JS เวอร์ชั่นล่าสุดโดยอัตโนมัติเมื่อเข้าใช้งานครั้งถัดไป\n";
?>
