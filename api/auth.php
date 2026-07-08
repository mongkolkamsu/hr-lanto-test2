<?php
require_once '../config.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin();
        break;
    case 'logout':
        handleLogout();
        break;
    case 'check':
        checkLoginStatus();
        break;
    case 'register':
        handleRegister();
        break;
    case 'change_password':
        changePassword();
        break;
    case 'forgot_password':
        handleForgotPassword();
        break;
    case 'get_departments':
        getDepartments();
        break;
    case 'get_shifts':
        getShifts();
        break;
    case 'get_employee_types':
        getEmployeeTypes();
        break;
    default:
        jsonResponse(false, 'Invalid action');
}

function handleLogin()
{
    global $pdo;

    $employee_code = $_POST['employee_code'] ?? '';
    $password = $_POST['password'] ?? '';

    if (empty($employee_code) || empty($password)) {
        jsonResponse(false, 'กรุณากรอกข้อมูลให้ครบถ้วน');
    }

    try {
        $stmt = $pdo->prepare("
            SELECT e.*, d.name as department_name 
            FROM employees e 
            LEFT JOIN departments d ON e.department_id = d.id 
            WHERE e.employee_code = ? AND e.is_active = 1
        ");
        $stmt->execute([$employee_code]);
        $employee = $stmt->fetch();

        if (!$employee) {
            jsonResponse(false, 'ไม่พบรหัสพนักงานนี้ในระบบ');
        }

        if (!password_verify($password, $employee['password'])) {
            jsonResponse(false, 'รหัสผ่านไม่ถูกต้อง');
        }

        // Check if force_password_change is required
        if (!empty($employee['force_password_change'])) {
            // Set temporary session for password change
            $_SESSION['temp_pwd_change_id'] = $employee['id'];
            
            // Return specific response to force password change
            echo json_encode([
                'success' => true, 
                'message' => 'กรุณาเปลี่ยนรหัสผ่าน',
                'require_change_password' => true,
                'employee_id' => $employee['id']
            ]);
            exit;
        }

        // Set session
        $_SESSION['employee_id'] = $employee['id'];
        $_SESSION['employee_code'] = $employee['employee_code'];
        $_SESSION['role'] = $employee['role'];
        $_SESSION['full_name'] = $employee['first_name'] . ' ' . $employee['last_name'];
        $_SESSION['department_id'] = $employee['department_id']; // Added for convenience

        // Remove sensitive data
        unset($employee['password']);

        // Add profile photo URL
        if ($employee['profile_photo']) {
            $employee['profile_photo'] = UPLOAD_URL . 'profiles/' . $employee['profile_photo'];
        }

        jsonResponse(true, 'เข้าสู่ระบบสำเร็จ', $employee);

    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function handleLogout()
{
    session_destroy();
    jsonResponse(true, 'ออกจากระบบสำเร็จ');
}

function checkLoginStatus()
{
    if (isset($_SESSION['employee_id'])) {
        global $pdo;
        // Optional: Refresh user data from DB to ensure role/status is up to date
        try {
             $stmt = $pdo->prepare("SELECT id, employee_code, first_name, last_name, role, profile_photo FROM employees WHERE id = ? AND is_active = 1");
             $stmt->execute([$_SESSION['employee_id']]);
             $user = $stmt->fetch();
             
             if ($user) {
                 if ($user['profile_photo']) {
                     $user['profile_photo'] = UPLOAD_URL . 'profiles/' . $user['profile_photo'];
                 }
                 jsonResponse(true, 'Logged in', $user);
             } else {
                 session_destroy();
                 jsonResponse(false, 'User not found or inactive');
             }
        } catch (PDOException $e) {
             jsonResponse(false, 'Database error');
        }
    } else {
        jsonResponse(false, 'Not logged in');
    }
}

function handleRegister()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    $required = ['registration_code', 'employee_code', 'password', 'first_name', 'last_name', 'email', 'department_id'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            jsonResponse(false, "กรุณากรอกข้อมูลให้ครบถ้วน ($field)");
        }
    }

    // Check registration code
    // Prioritize checking from company_settings table as shown in the user's screenshot
    $stmt = $pdo->prepare("SELECT registration_code FROM company_settings LIMIT 1");
    $stmt->execute();
    $reg_code = $stmt->fetchColumn();

    // Fallback: If not found in company_settings, try system_settings
    if ($reg_code === false) {
        $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'registration_code'");
        $stmt->execute();
        $reg_code = $stmt->fetchColumn();
    }
    
    // Final fallback if absolutely nothing found
    if ($reg_code === false) {
        jsonResponse(false, 'ไม่พบการตั้งค่ารหัสแนะนำในระบบ กรุณาติดต่อผู้ดูแลระบบ');
    }

    // Compare with trim to avoid whitespace issues
    if (trim($data['registration_code']) !== trim($reg_code)) {
        jsonResponse(false, 'รหัสแนะนำไม่ถูกต้อง');
    }

    // Validate Thai characters
    if (!preg_match('/^[\x{0E00}-\x{0E7F}\s]+$/u', $data['first_name'])) {
        jsonResponse(false, 'กรุณากรอกชื่อเป็นภาษาไทยเท่านั้น');
    }
    if (!preg_match('/^[\x{0E00}-\x{0E7F}\s]+$/u', $data['last_name'])) {
        jsonResponse(false, 'กรุณากรอกนามสกุลเป็นภาษาไทยเท่านั้น');
    }

    // Validate password length
    if (strlen($data['password']) < 8) {
        jsonResponse(false, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    }

    // Validate email
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        jsonResponse(false, 'รูปแบบ Email ไม่ถูกต้อง');
    }

    try {
        // Check duplicates
        $stmt = $pdo->prepare("SELECT id FROM employees WHERE employee_code = ? OR email = ?");
        $stmt->execute([$data['employee_code'], $data['email']]);
        if ($stmt->fetch()) {
            jsonResponse(false, 'รหัสพนักงานหรือ Email นี้มีในระบบแล้ว');
        }

        // Upload photos
        $profile_photo = null;
        if (!empty($data['profile_photo'])) {
            $profile_photo = uploadBase64Image($data['profile_photo'], 'profiles');
            if (!$profile_photo) {
                jsonResponse(false, 'ไม่สามารถอัพโหลดรูปโปรไฟล์ได้');
            }
        } else {
             jsonResponse(false, 'กรุณาถ่ายรูปโปรไฟล์');
        }

        $id_card_photo = null;
        if (!empty($data['id_card_photo'])) {
            $id_card_photo = uploadBase64Image($data['id_card_photo'], 'id_cards');
        }

        // Hash password
        $hashed_password = password_hash($data['password'], PASSWORD_DEFAULT);

        // Insert
        $stmt = $pdo->prepare("
            INSERT INTO employees (
                employee_code, password, first_name, last_name, email, 
                birth_date, address, province, district, sub_district,
                department_id, shift_id, employee_type, role, start_date, is_active,
                profile_photo, id_card_photo
            ) VALUES (
                ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?,
                ?, ?, ?, 'พนักงาน', ?, 1,
                ?, ?
            )
        ");

        $stmt->execute([
            $data['employee_code'],
            $hashed_password,
            $data['first_name'],
            $data['last_name'],
            $data['email'],
            $data['birth_date'] ?? null,
            $data['address'] ?? null,
            $data['province'] ?? null,
            $data['district'] ?? null,
            $data['sub_district'] ?? null,
            $data['department_id'],
            !empty($data['shift_id']) ? $data['shift_id'] : null,
            $data['employee_type'] ?? null,
            $data['start_date'] ?? date('Y-m-d'),
            $profile_photo,
            $id_card_photo
        ]);

        jsonResponse(true, 'สมัครสมาชิกสำเร็จ');

    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function changePassword() {
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $employee_id = $data['employee_id'] ?? 0;
    $new_password = $data['new_password'] ?? '';
    
    if (empty($employee_id) || empty($new_password)) {
        jsonResponse(false, 'ข้อมูลไม่ครบถ้วน');
    }

    // Validate password rules
    if (strlen($new_password) < 8) {
        jsonResponse(false, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    }
    if (!preg_match('/[A-Z]/', $new_password) || !preg_match('/[a-z]/', $new_password)) {
        jsonResponse(false, 'รหัสผ่านต้องประกอบด้วยตัวพิมพ์ใหญ่และตัวพิมพ์เล็ก');
    }

    try {
        $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
        
        $stmt = $pdo->prepare("UPDATE employees SET password = ?, force_password_change = 0 WHERE id = ?");
        $stmt->execute([$hashed_password, $employee_id]);

        jsonResponse(true, 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่');

    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function handleForgotPassword()
{
    global $pdo;
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    $employee_code = $data['employee_code'] ?? '';
    $email = $data['email'] ?? '';

    if (empty($employee_code) || empty($email)) {
        jsonResponse(false, 'กรุณากรอกข้อมูลให้ครบถ้วน');
    }

    try {
        // Verify user
        $stmt = $pdo->prepare("SELECT id, first_name, last_name, employee_code, email, password FROM employees WHERE employee_code = ? AND email = ?");
        $stmt->execute([$employee_code, $email]);
        $employee = $stmt->fetch();

        if (!$employee) {
            jsonResponse(false, 'ไม่พบข้อมูลพนักงานหรืออีเมลไม่ถูกต้อง');
        }

        // Generate Token
        // Token = MD5(id + password + secret)
        $secret = "HR_LANTO_RESET_SECRET_KEY"; 
        $token = md5($employee['id'] . $employee['password'] . $secret);

        // Reset URL
        $reset_url = BASE_URL . "reset_password.php?id=" . $employee['id'] . "&token=" . $token;

        // Load Email Helper
        require_once '../includes/email_helper.php';
        
        // Get Config
        $config = getEmailConfig($pdo);
        if (!$config) {
            jsonResponse(false, 'ระบบส่งอีเมลยังไม่ได้ตั้งค่า กรุณาติดต่อ Admin');
        }

        $subject = "รีเซ็ทรหัสผ่าน - HR Lanto";
        $body = "
            <!DOCTYPE html>
            <html>
            <body style='font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;'>
                <div style='max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);'>
                    <h2 style='color: #FF6B35; margin-bottom: 20px;'>รีเซ็ทรหัสผ่าน</h2>
                    <p>เรียน คุณ {$employee['first_name']} {$employee['last_name']}</p>
                    <p>มีการร้องขอให้รีเซ็ทรหัสผ่านสำหรับบัญชี: <strong>{$employee['employee_code']}</strong></p>
                    <p>กรุณากดปุ่มด้านล่างเพื่อรีเซ็ทรหัสผ่านเป็น <strong>1234</strong></p>
                    
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='{$reset_url}' style='display: inline-block; padding: 12px 24px; background: #FF6B35; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;'>
                            รีเซ็ทรหัสผ่านเป็น 1234
                        </a>
                    </div>
                    
                    <p style='color: #666; font-size: 12px; margin-top: 30px;'>
                        หากคุณไม่ได้เป็นผู้ร้องขอ กรุณาเพิกเฉยต่ออีเมลฉบับนี้
                    </p>
                    <div style='border-top: 1px solid #eee; margin-top: 20px; padding-top: 10px; font-size: 12px; color: #999; text-align: center;'>
                        HR Lanto System
                    </div>
                </div>
            </body>
            </html>
        ";

        $result = sendEmailWithSMTP($config, $email, $subject, $body);

        if ($result['success']) {
            jsonResponse(true, 'ส่ง Email สำเร็จ ให้ตรวจสอบ Email ที่ลงทะเบียนไว้');
        } else {
            jsonResponse(false, 'ส่ง Email ไม่สำเร็จ: ' . $result['message']);
        }

    } catch (Exception $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getDepartments()
{
    global $pdo;

    try {
        $stmt = $pdo->query("SELECT id, name FROM departments ORDER BY name ASC");
        $departments = $stmt->fetchAll();
        jsonResponse(true, 'สำเร็จ', $departments);
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getShifts()
{
    global $pdo;

    try {
        $stmt = $pdo->query("
            SELECT id, name, start_time, end_time 
            FROM shifts 
            ORDER BY id ASC
        ");
        $shifts = $stmt->fetchAll();

        jsonResponse(true, 'สำเร็จ', $shifts);

    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function uploadBase64Image($base64_string, $folder, $prefix = '')
{
    // Remove base64 header if present
    if (preg_match('/^data:image\/(\w+);base64,/', $base64_string, $type)) {
        $base64_string = substr($base64_string, strpos($base64_string, ',') + 1);
        $type = strtolower($type[1]); // jpg, png, gif

        if (!in_array($type, ['jpg', 'jpeg', 'png', 'gif'])) {
            return false;
        }

        $base64_string = str_replace(' ', '+', $base64_string);
        $data = base64_decode($base64_string);

        if ($data === false) {
            return false;
        }

        // Create directory if not exists
        $target_dir = UPLOAD_DIR . $folder . '/';
        if (!file_exists($target_dir)) {
            mkdir($target_dir, 0777, true);
        }

        $filename = $prefix . uniqid() . '.' . $type;
        $filepath = $target_dir . $filename;

        if (file_put_contents($filepath, $data)) {
            return $filename;
        }

        return false;
    }

    return false;
}

function getEmployeeTypes()
{
    global $pdo;
    try {
        $stmt = $pdo->query("SELECT * FROM employee_types ORDER BY id ASC");
        $types = $stmt->fetchAll();
        jsonResponse(true, 'สำเร็จ', $types);
    } catch (PDOException $e) {
        // Fallback if table doesn't exist yet
        jsonResponse(true, 'สำเร็จ', [
            ['id' => 1, 'name' => 'พนักงานประจำ'],
            ['id' => 2, 'name' => 'พนักงานทดลองงาน'],
            ['id' => 3, 'name' => 'นักศึกษาฝึกงาน'],
            ['id' => 4, 'name' => 'พนักงานสัญญาจ้าง']
        ]);
    }
}

function jsonResponse($success, $message, $data = null)
{
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}
