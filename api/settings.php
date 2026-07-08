<?php
require_once '../config.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';
$key = $_GET['key'] ?? '';

if (empty($key)) {
    jsonResponse(false, 'Invalid request');
}

try {
    // Check if key is company_name, get from company_settings table
    if ($key === 'company_name') {
        $stmt = $pdo->prepare("SELECT company_name FROM company_settings WHERE id = 1");
        $stmt->execute();
        $result = $stmt->fetch();
        
        if ($result) {
            jsonResponse(true, 'สำเร็จ', $result['company_name']);
        } else {
            // Return default if not found
            jsonResponse(true, 'สำเร็จ', 'China Thai Group');
        }
    } else {
        // Get from system_settings table for other keys
        $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $result = $stmt->fetch();
        
        if ($result) {
            jsonResponse(true, 'สำเร็จ', $result['setting_value']);
        } else {
            jsonResponse(false, 'ไม่พบข้อมูล');
        }
    }
    
} catch (PDOException $e) {
    jsonResponse(false, 'เกิดข้อผิดพลาด');
}

