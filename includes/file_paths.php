<?php
/**
 * File Paths Configuration
 * กำหนดค่าคงที่สำหรับเส้นทางไฟล์ต่างๆ ในระบบ
 */

// ตั้งค่าพาธสำหรับไฟล์สลิปเงินเดือนและล็อกgit
// ใช้ relative path แทนการใช้ absolute path (d:/) เพื่อให้ทำงานได้ทั้งใน dev และ production
$root_path = dirname(dirname(__FILE__)); // Path ของโฟลเดอร์หลัก (htdocs/HR Lanto)

// กำหนดค่าคงที่สำหรับเส้นทางไฟล์
define('SECURE_FILES_PATH', dirname($root_path) . '/secure_files');
define('PAYSLIP_PATH', SECURE_FILES_PATH . '/payslips');
define('LOGS_PATH', SECURE_FILES_PATH . '/logs');

// สร้างโฟลเดอร์อัตโนมัติถ้ายังไม่มี
if (!is_dir(SECURE_FILES_PATH)) {
    mkdir(SECURE_FILES_PATH, 0755, true);
}
if (!is_dir(PAYSLIP_PATH)) {
    mkdir(PAYSLIP_PATH, 0755, true);
}
if (!is_dir(LOGS_PATH)) {
    mkdir(LOGS_PATH, 0755, true);
}
