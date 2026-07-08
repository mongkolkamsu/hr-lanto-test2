<?php
/**
 * Payslip Security Functions
 * ฟังก์ชันเพื่อความปลอดภัยของระบบสลิปเงินเดือน
 */

// นำเข้าไฟล์กำหนดเส้นทาง
require_once __DIR__ . '/file_paths.php';

// Secret key for security functions
// ควรเปลี่ยนเป็นค่าซับซ้อนและไม่ซ้ำใคร
define('PAYSLIP_SECRET_KEY', 'your_very_complex_random_string_here');

/**
 * สร้าง token สำหรับเข้าถึงสลิปเงินเดือน
 * 
 * @param int $payslip_id รหัสสลิปเงินเดือน
 * @param int $validity_hours อายุของ token (ชั่วโมง)
 * @return array ข้อมูล token และเวลาหมดอายุ
 */
function generatePayslipToken($payslip_id, $validity_hours = 24) {
    $expires = time() + ($validity_hours * 3600);
    $data = $payslip_id . '|' . $expires;
    $token = hash_hmac('sha256', $data, PAYSLIP_SECRET_KEY);
    return [
        'token' => $token,
        'expires' => $expires
    ];
}

/**
 * ตรวจสอบความถูกต้องของ token สลิปเงินเดือน
 * 
 * @param int $payslip_id รหัสสลิปเงินเดือน
 * @param string $token token ที่ต้องการตรวจสอบ
 * @param int $timestamp เวลาหมดอายุ
 * @return bool true ถ้า token ถูกต้องและยังไม่หมดอายุ
 */
function verifyPayslipToken($payslip_id, $token, $timestamp) {
    if (time() > $timestamp) {
        return false; // Token หมดอายุ
    }
    
    $data = $payslip_id . '|' . $timestamp;
    $expected = hash_hmac('sha256', $data, PAYSLIP_SECRET_KEY);
    
    return hash_equals($expected, $token); // ใช้ hash_equals เพื่อป้องกัน timing attacks
}

/**
 * บันทึกการเข้าถึงสลิปเงินเดือน
 * 
 * @param int $payslip_id รหัสสลิปเงินเดือน
 * @param string $action การกระทำ (view, download)
 * @param int $user_id รหัสผู้ใช้ (ถ้ามี)
 */
function logPayslipAccess($payslip_id, $action, $user_id = null) {
    $log_file = LOGS_PATH . '/payslip_access.log';
    
    // ตรวจสอบว่าโฟลเดอร์มีอยู่แล้วจาก file_paths.php
    
    $timestamp = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'];
    $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
    $user_info = $user_id ? "User ID: $user_id" : "Anonymous";
    
    $log_message = "[$timestamp] IP: $ip | $user_info | Action: $action | Payslip ID: $payslip_id | User Agent: $user_agent\n";
    
    // เขียนบันทึก
    file_put_contents($log_file, $log_message, FILE_APPEND);
}
