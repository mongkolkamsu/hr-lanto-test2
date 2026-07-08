<?php
/**
 * Asset Versioning with File Hash
 * ใช้สำหรับสร้าง version จาก file hash แทนการใส่ version number แบบ manual
 */

function getVersionedAsset($path) {
    $file = __DIR__ . '/../' . $path;
    if (file_exists($file)) {
        $hash = md5_file($file);
        return $path . '?v=' . substr($hash, 0, 8); // ใช้ 8 ตัวอักษรแรกของ hash
    }
    return $path . '?v=' . time(); // fallback ถ้าไม่พบไฟล์
}

function getVersionedAssetWithFullHash($path) {
    $file = __DIR__ . '/../' . $path;
    if (file_exists($file)) {
        $hash = md5_file($file);
        return $path . '?v=' . $hash; // ใช้ hash เต็ม
    }
    return $path . '?v=' . time(); // fallback ถ้าไม่พบไฟล์
}

function getAssetVersion($path) {
    $file = __DIR__ . '/../' . $path;
    if (file_exists($file)) {
        return md5_file($file);
    }
    return time();
}

// สำหรับใช้กับ CSS ด้วย
function getVersionedCSS($path) {
    return getVersionedAsset($path);
}

// สำหรับใช้กับ JS
function getVersionedJS($path) {
    return getVersionedAsset($path);
}
?>
