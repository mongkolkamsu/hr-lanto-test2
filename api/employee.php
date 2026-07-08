<?php
require_once '../config.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';

// Allow get_app_settings without login
if ($action !== 'get_app_settings') {
    requireLogin();
}

switch ($action) {
    case 'profile':
        getProfile();
        break;
    case 'update':
        updateProfile();
        break;
    case 'upload_photo':
        uploadProfilePhoto();
        break;
    case 'upload_id_card':
        uploadIdCard();
        break;
    case 'get_branches':
        getEmployeeBranches();
        break;
    case 'get_flexible_shifts':
        getFlexibleShifts();
        break;
    case 'get_app_settings':
        getAppSettings();
        break;
    default:
        jsonResponse(false, 'Invalid action');
}

function getProfile() {
    global $pdo;
    
    $employee_id = $_SESSION['employee_id'];
    
    try {
        $stmt = $pdo->prepare("
            SELECT e.*, d.name as department_name 
            FROM employees e 
            LEFT JOIN departments d ON e.department_id = d.id 
            WHERE e.id = ?
        ");
        $stmt->execute([$employee_id]);
        $employee = $stmt->fetch();
        
        if (!$employee) {
            jsonResponse(false, 'ไม่พบข้อมูลพนักงาน');
        }
        
        unset($employee['password']);
        
        // Keep original filenames and create relative paths
        $profile_photo_file = $employee['profile_photo'];
        $id_card_photo_file = $employee['id_card_photo'];
        
        // Add full URLs for photos (will be reconstructed on client side)
        if ($employee['profile_photo']) {
            $employee['profile_photo'] = BASE_URL . 'uploads/profiles/' . $employee['profile_photo'];
            $employee['profile_photo_path'] = 'uploads/profiles/' . $profile_photo_file;
        }
        
        if ($employee['id_card_photo']) {
            $employee['id_card_photo'] = BASE_URL . 'uploads/id_cards/' . $employee['id_card_photo'];
            $employee['id_card_photo_path'] = 'uploads/id_cards/' . $id_card_photo_file;
        }
        
        jsonResponse(true, 'สำเร็จ', $employee);
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function updateProfile() {
    global $pdo;
    
    $employee_id = $_SESSION['employee_id'];
    $first_name = trim($_POST['account-first-name'] ?? '');
    $last_name = trim($_POST['account-last-name'] ?? '');
    $birth_date = $_POST['account-birth-date'] ?? null;
    $address = $_POST['account-address'] ?? '';
    $sub_district = $_POST['account-sub-district'] ?? '';
    $district = $_POST['account-district'] ?? '';
    $province = $_POST['account-province'] ?? '';
    $email = $_POST['account-email'] ?? '';
    $new_password = $_POST['account-new-password'] ?? '';
    
    // ตรวจสอบว่ามีค่าจริงๆ หลังจาก trim แล้ว
    if (empty($first_name) || empty($last_name)) {
        jsonResponse(false, 'กรุณากรอกชื่อและนามสกุล');
    }
    
    try {
        if (!empty($new_password)) {
            // Update with new password
            $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("
                UPDATE employees SET 
                first_name = ?, last_name = ?, birth_date = ?, address = ?, 
                sub_district = ?, district = ?, province = ?, email = ?, password = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $first_name, $last_name, $birth_date, $address,
                $sub_district, $district, $province, $email, $hashed_password,
                $employee_id
            ]);
        } else {
            // Update without password
            $stmt = $pdo->prepare("
                UPDATE employees SET 
                first_name = ?, last_name = ?, birth_date = ?, address = ?, 
                sub_district = ?, district = ?, province = ?, email = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $first_name, $last_name, $birth_date, $address,
                $sub_district, $district, $province, $email,
                $employee_id
            ]);
        }
        
        jsonResponse(true, 'บันทึกข้อมูลสำเร็จ');
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function uploadProfilePhoto() {
    global $pdo;
    
    if (!isset($_FILES['profile_photo'])) {
        jsonResponse(false, 'ไม่พบไฟล์');
    }
    
    $result = uploadFile($_FILES['profile_photo'], 'profiles');
    
    if (!$result['success']) {
        jsonResponse(false, $result['message']);
    }
    
    try {
        $employee_id = $_SESSION['employee_id'];
        
        // Delete old photo if exists
        $stmt = $pdo->prepare("SELECT profile_photo FROM employees WHERE id = ?");
        $stmt->execute([$employee_id]);
        $employee = $stmt->fetch();
        
        if ($employee && $employee['profile_photo']) {
            $old_file = UPLOAD_DIR . 'profiles/' . $employee['profile_photo'];
            if (file_exists($old_file)) {
                unlink($old_file);
            }
        }
        
        // Update database
        $stmt = $pdo->prepare("UPDATE employees SET profile_photo = ? WHERE id = ?");
        $stmt->execute([$result['filename'], $employee_id]);
        
        // ส่ง URL กลับไปพร้อมข้อมูลอื่นๆ
        jsonResponse(true, 'อัพโหลดรูปภาพสำเร็จ', [
            'url' => $result['url'],
            'filename' => $result['filename']
        ]);
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function uploadIdCard() {
    global $pdo;
    
    if (!isset($_FILES['id_card'])) {
        jsonResponse(false, 'ไม่พบไฟล์');
    }
    
    $result = uploadFile($_FILES['id_card'], 'id_cards');
    
    if (!$result['success']) {
        jsonResponse(false, $result['message']);
    }
    
    try {
        $employee_id = $_SESSION['employee_id'];
        
        // Delete old photo if exists
        $stmt = $pdo->prepare("SELECT id_card_photo FROM employees WHERE id = ?");
        $stmt->execute([$employee_id]);
        $employee = $stmt->fetch();
        
        if ($employee && $employee['id_card_photo']) {
            $old_file = UPLOAD_DIR . 'id_cards/' . $employee['id_card_photo'];
            if (file_exists($old_file)) {
                unlink($old_file);
            }
        }
        
        // Update database
        $stmt = $pdo->prepare("UPDATE employees SET id_card_photo = ? WHERE id = ?");
        $stmt->execute([$result['filename'], $employee_id]);
        
        // ส่ง URL และ path กลับไป
        jsonResponse(true, 'อัพโหลดรูปบัตรประชาชนสำเร็จ', [
            'url' => $result['url'],
            'path' => 'uploads/id_cards/' . $result['filename'],
            'filename' => $result['filename']
        ]);
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function getEmployeeBranches() {
    global $pdo;
    
    $employee_id = $_SESSION['employee_id'];
    
    try {
        // ดึงสาขาที่พนักงานมีสิทธิ์เห็น (ผ่านตาราง employee_branches)
        // และสาขาต้อง active อยู่ด้วย
        $stmt = $pdo->prepare("
            SELECT b.* 
            FROM branches b
            INNER JOIN employee_branches eb ON b.id = eb.branch_id
            WHERE eb.employee_id = ? AND b.is_active = 1
            ORDER BY b.name ASC
        ");
        $stmt->execute([$employee_id]);
        $branches = $stmt->fetchAll();
        
        jsonResponse(true, 'สำเร็จ', $branches);
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getFlexibleShifts() {
    global $pdo;
    
    $employee_id = $_SESSION['employee_id'];
    
    try {
        // ค้นหาว่าพนักงานมีกะการทำงานตายตัวหรือไม่
        $stmt = $pdo->prepare("SELECT shift_id FROM employees WHERE id = ?");
        $stmt->execute([$employee_id]);
        $emp = $stmt->fetch();
        
        // ถ้ามีกะการทำงานตายตัว ส่งกลับเป็น array ว่าง
        if ($emp && $emp['shift_id']) {
            jsonResponse(true, 'ไม่ต้องการเลือกกะ', []);
            return;
        }
        
        // ถ้าไม่ได้กำหนดกะการทำงานไว้ แสดงว่าทำงานเป็นรอบไม่แน่นอน ให้ส่งกะทั้งหมดไปให้เลือก
        $stmt = $pdo->query("SELECT id, name, start_time, end_time FROM shifts ORDER BY start_time ASC");
        $shifts = $stmt->fetchAll();
        
        jsonResponse(true, 'พบกะที่เลือกได้', $shifts);
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getAppSettings() {
    global $pdo;

    try {
        $settings = [];
        
        // Get public settings from system_settings
        $public_keys = ['smile_detection_enabled'];
        
        $placeholders = str_repeat('?,', count($public_keys) - 1) . '?';
        $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ($placeholders)");
        $stmt->execute($public_keys);
        $results = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        
        // Set default values if not found using array_merge for defaults
        $defaults = [
            'smile_detection_enabled' => '0' // Default to disabled if not set
        ];
        
        $settings = array_merge($defaults, $results);

        jsonResponse(true, 'สำเร็จ', $settings);

    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}