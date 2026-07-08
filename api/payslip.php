<?php
require_once '../config.php';
require_once '../includes/payslip_security.php';
require_once '../includes/file_paths.php';

header('Content-Type: application/json; charset=utf-8');

requireLogin();

// Helper function to check if current user is admin
function isAdminUser()
{
    $adminRoles = ['ผู้ดูแลระบบ', 'HR'];
    $userRole = $_SESSION['role'] ?? '';
    return in_array($userRole, $adminRoles);
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        getPayslips();
        break;
    case 'view':
        viewPayslip();
        break;
    case 'download':
        downloadPayslip();
        break;
    case 'admin_list':
        adminGetAllPayslips();
        break;
    case 'create':
        createPayslip();
        break;
    case 'delete':
        deletePayslip();
        break;
    case 'get_token':
        getPayslipToken();
        break;
    default:
        jsonResponse(false, 'Invalid action');
}

// ==================== EMPLOYEE FUNCTIONS ====================

function getPayslips()
{
    global $pdo;

    $employee_id = $_SESSION['employee_id'];
    $year = $_GET['year'] ?? date('Y');

    try {
        $stmt = $pdo->prepare("
            SELECT p.*, 
                   MONTH(p.payment_date) as month,
                   YEAR(p.payment_date) as year,
                   e.first_name, e.last_name, e.employee_code,
                   d.name as department_name
            FROM payslips p
            LEFT JOIN employees e ON p.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE p.employee_id = ? AND YEAR(p.payment_date) = ?
            ORDER BY p.payment_date DESC
        ");
        $stmt->execute([$employee_id, $year]);
        $payslips = $stmt->fetchAll();

        jsonResponse(true, 'สำเร็จ', $payslips);
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function viewPayslip()
{
    global $pdo;

    $employee_id = $_SESSION['employee_id'];
    $payslip_id = $_GET['id'] ?? 0;

    try {
        $stmt = $pdo->prepare("
            SELECT p.*, 
                   e.first_name, e.last_name, e.employee_code,
                   d.name as department_name
            FROM payslips p
            LEFT JOIN employees e ON p.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE p.id = ? AND p.employee_id = ?
        ");
        $stmt->execute([$payslip_id, $employee_id]);
        $payslip = $stmt->fetch();

        if (!$payslip) {
            jsonResponse(false, 'ไม่พบข้อมูลสลิปเงินเดือน');
            return;
        }

        jsonResponse(true, 'สำเร็จ', $payslip);
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function downloadPayslip()
{
    global $pdo;

    $employee_id = $_SESSION['employee_id'];
    $payslip_id = $_GET['id'] ?? 0;
    $isAdmin = isAdminUser();

    try {
        // Admin can download any payslip, employee only their own
        if ($isAdmin) {
            $stmt = $pdo->prepare("SELECT * FROM payslips WHERE id = ?");
            $stmt->execute([$payslip_id]);
        } else {
            $stmt = $pdo->prepare("SELECT * FROM payslips WHERE id = ? AND employee_id = ?");
            $stmt->execute([$payslip_id, $employee_id]);
        }

        $payslip = $stmt->fetch();

        if (!$payslip || !$payslip['file_path']) {
            header('Content-Type: text/html; charset=utf-8');
            echo '<h3>ไม่พบไฟล์สลิปเงินเดือน</h3>';
            exit;
        }

        $filepath = PAYSLIP_PATH . '/' . $payslip['file_path'];

        if (!file_exists($filepath)) {
            header('Content-Type: text/html; charset=utf-8');
            echo '<h3>ไม่พบไฟล์</h3>';
            exit;
        }

        // Send file for download
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="payslip_' . $payslip['id'] . '.pdf"');
        header('Content-Length: ' . filesize($filepath));
        readfile($filepath);
        exit;

    } catch (PDOException $e) {
        header('Content-Type: text/html; charset=utf-8');
        echo '<h3>เกิดข้อผิดพลาด</h3>';
        exit;
    }
}

// ==================== ADMIN FUNCTIONS ====================

function adminGetAllPayslips()
{
    global $pdo;

    if (!isAdminUser()) {
        jsonResponse(false, 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้');
        return;
    }

    $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
    $month = isset($_GET['month']) && $_GET['month'] !== '' ? intval($_GET['month']) : null;
    $employee_id = isset($_GET['employee_id']) && $_GET['employee_id'] !== '' ? intval($_GET['employee_id']) : null;

    try {
        // Check if payslips table exists
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'payslips'");
        if ($tableCheck->rowCount() == 0) {
            jsonResponse(true, 'ยังไม่มีข้อมูลสลิปเงินเดือน', []);
            return;
        }

        $sql = "
            SELECT 
                p.*,
                e.first_name,
                e.last_name,
                e.employee_code,
                d.name as department_name
            FROM payslips p
            LEFT JOIN employees e ON p.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE YEAR(p.payment_date) = ?
        ";

        $params = [$year];

        if ($month !== null) {
            $sql .= " AND MONTH(p.payment_date) = ?";
            $params[] = $month;
        }

        if ($employee_id !== null) {
            $sql .= " AND p.employee_id = ?";
            $params[] = $employee_id;
        }

        $sql .= " ORDER BY p.payment_date DESC, e.employee_code ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $payslips = $stmt->fetchAll();

        jsonResponse(true, 'สำเร็จ', $payslips);

    } catch (PDOException $e) {
        error_log('adminGetAllPayslips Error: ' . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function createPayslip()
{
    global $pdo;

    if (!isAdminUser()) {
        jsonResponse(false, 'คุณไม่มีสิทธิ์ดำเนินการนี้');
        return;
    }

    try {
        // Check if payslips table exists
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'payslips'");
        if ($tableCheck->rowCount() == 0) {
            jsonResponse(false, 'กรุณาสร้างตาราง payslips ในฐานข้อมูลก่อน');
            return;
        }

        $employee_id = $_POST['employee_id'] ?? 0;
        $payment_date = $_POST['payment_date'] ?? date('Y-m-d');
        $net_salary = $_POST['net_salary'] ?? $_POST['salary_amount'] ?? 0;

        // Validate required fields
        if (empty($employee_id)) {
            jsonResponse(false, 'กรุณาเลือกพนักงาน');
            return;
        }

        if (empty($net_salary) || $net_salary <= 0) {
            jsonResponse(false, 'กรุณากรอกเงินเดือนที่ได้รับ');
            return;
        }

        // Check if PDF file is uploaded
        if (!isset($_FILES['pdf_file']) || $_FILES['pdf_file']['error'] !== UPLOAD_ERR_OK) {
            jsonResponse(false, 'กรุณาอัพโหลดไฟล์สลิปเงินเดือน (PDF)');
            return;
        }

        // Handle PDF file upload
        $file_path = uploadPdfFile($_FILES['pdf_file'], $employee_id, $payment_date);
        if (!$file_path) {
            jsonResponse(false, 'ไม่สามารถอัพโหลดไฟล์ได้');
            return;
        }

        // Insert payslip
        $stmt = $pdo->prepare("
            INSERT INTO payslips 
            (employee_id, payment_date, basic_salary, allowances, overtime_pay, bonus, 
             deductions, tax, social_security, net_salary, status, file_path, notes)
            VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, ?, 'paid', ?, '')
        ");

        $stmt->execute([
            $employee_id,
            $payment_date,
            $net_salary,
            $file_path
        ]);

        $payslip_id = $pdo->lastInsertId();

        // Send notification email
        require_once '../includes/email_helper.php';
        sendPayslipNotification($pdo, $payslip_id);

        jsonResponse(true, 'เพิ่มสลิปเงินเดือนสำเร็จ', ['id' => $payslip_id]);

    } catch (PDOException $e) {
        error_log('createPayslip Error: ' . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function deletePayslip()
{
    global $pdo;

    if (!isAdminUser()) {
        jsonResponse(false, 'คุณไม่มีสิทธิ์ดำเนินการนี้');
        return;
    }

    $payslip_id = $_POST['id'] ?? 0;

    if (empty($payslip_id)) {
        jsonResponse(false, 'ไม่พบรหัสสลิปเงินเดือน');
        return;
    }

    try {
        // Get file path to delete
        $stmt = $pdo->prepare("SELECT file_path FROM payslips WHERE id = ?");
        $stmt->execute([$payslip_id]);
        $payslip = $stmt->fetch();

        if ($payslip && $payslip['file_path']) {
            $filepath = PAYSLIP_PATH . '/' . $payslip['file_path'];
            if (file_exists($filepath)) {
                unlink($filepath);
            }
        }

        // Delete from database
        $stmt = $pdo->prepare("DELETE FROM payslips WHERE id = ?");
        $stmt->execute([$payslip_id]);

        jsonResponse(true, 'ลบสลิปเงินเดือนสำเร็จ');

    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

// ==================== HELPER FUNCTIONS ====================

function uploadPdfFile($file, $employee_id, $payment_date)
{
    // Validate file type
    $allowed_types = ['application/pdf'];
    if (!in_array($file['type'], $allowed_types)) {
        return false;
    }
    
    // ใช้ค่าคงที่ที่กำหนดใน file_paths.php
    $upload_dir = PAYSLIP_PATH;
    
    // ตรวจสอบว่าโฟลเดอร์มีอยู่หรือไม่ (โฟลเดอร์ถูกสร้างใน file_paths.php แล้ว)

    // Generate unique filename with more entropy
    $date_part = str_replace('-', '', $payment_date);
    $random_str = bin2hex(random_bytes(8)); // เพิ่มความสุ่มเพื่อป้องกัน filename guessing
    $filename = "payslip_{$employee_id}_{$date_part}_{$random_str}.pdf";
    $filepath = $upload_dir . '/' . $filename;

    // Move uploaded file
    if (move_uploaded_file($file['tmp_name'], $filepath)) {
        // เก็บเฉพาะชื่อไฟล์เพื่อความปลอดภัย
        return $filename;  // เก็บเฉพาะชื่อไฟล์
    }

    return false;
}

// ฟังก์ชันใหม่สำหรับสร้าง token สำหรับเข้าถึงสลิปผ่าน view_payslip.php
function getPayslipToken()
{
    $payslip_id = $_GET['id'] ?? 0;
    $employee_id = $_SESSION['employee_id'] ?? 0;
    
    // ตรวจสอบสิทธิ์ในการเข้าถึงสลิป
    global $pdo;
    
    if (isAdminUser()) {
        $stmt = $pdo->prepare("SELECT id FROM payslips WHERE id = ?");
        $stmt->execute([$payslip_id]);
    } else {
        $stmt = $pdo->prepare("SELECT id FROM payslips WHERE id = ? AND employee_id = ?");
        $stmt->execute([$payslip_id, $employee_id]);
    }
    
    $payslip = $stmt->fetch();
    if (!$payslip) {
        jsonResponse(false, 'ไม่พบข้อมูลสลิปเงินเดือน หรือคุณไม่มีสิทธิ์เข้าถึง');
        return;
    }
    
    // สร้าง token
    $token_data = generatePayslipToken($payslip_id);
    
    // บันทึกการสร้าง token
    logPayslipAccess($payslip_id, 'generate_token', $_SESSION['user_id'] ?? null);
    
    // ส่งกลับ URL และ token
    $view_url = BASE_URL . 'view_payslip.php?id=' . $payslip_id . '&token=' . $token_data['token'] . '&expires=' . $token_data['expires'];
    
    jsonResponse(true, 'สร้าง token สำเร็จ', [
        'view_url' => $view_url,
        'token' => $token_data['token'],
        'expires' => $token_data['expires']
    ]);
}
