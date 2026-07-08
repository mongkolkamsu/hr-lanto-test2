<?php
require_once '../config.php';

header('Content-Type: application/json; charset=utf-8');

requireRole(['ผู้ดูแลระบบ', 'HR', 'IT Support', 'HR Admin']);

$action = $_GET['action'] ?? '';

// จำกัดสิทธิ์สำหรับ HR Admin ให้ดูได้แค่ประวัติการลงเวลา, ข้อมูลการลา, และรายชื่อแผนก/สาขา เพื่อการค้นหา
if (hasRole('HR Admin')) {
    $allowed_hr_admin_actions = ['all_timelogs', 'all_leaves', 'departments', 'branches'];
    if (!in_array($action, $allowed_hr_admin_actions)) {
        jsonResponse(false, 'คุณไม่มีสิทธิ์เข้าถึงหรือดำเนินการในส่วนนี้');
    }
}

switch ($action) {
    // Employee Management
    case 'employees':
        getEmployees();
        break;
    case 'employee':
        getEmployee();
        break;
    case 'add_employee':
        addEmployee();
        break;
    case 'update_employee':
        updateEmployee();
        break;
    case 'upload_employee_photo':
        uploadEmployeePhoto();
        break;
    case 'upload_employee_id_card':
        uploadEmployeeIdCard();
        break;
    case 'reset_password':
        resetPassword();
        break;
    case 'set_leave_balance':
        setLeaveBalance();
        break;
    case 'import_employees':
        importEmployees();
        break;
    case 'bulk_delete_employees':
        bulkDeleteEmployees();
        break;
    case 'bulk_update_employees':
        bulkUpdateEmployees();
        break;

    // Time Log Management
    case 'all_timelogs':
        getAllTimeLogs();
        break;

    // Leave Management
    case 'all_leaves':
        getAllLeaves();
        break;
    case 'update_leave':
        updateLeave();
        break;
    case 'delete_leave':
        // Debug: Log before calling deleteLeave
        error_log("[Admin] delete_leave action called with POST: " . json_encode($_POST));
        deleteLeave();
        break;
    case 'send_leave_email':
        sendLeaveEmail();
        break;

    // Department Management
    case 'departments':
        getDepartments();
        break;
    case 'add_department':
        addDepartment();
        break;
    case 'update_department':
        updateDepartment();
        break;
    case 'delete_department':
        deleteDepartment();
        break;

    // Leave Type Management
    case 'leave_types':
        getLeaveTypes();
        break;
    case 'add_leave_type':
        addLeaveType();
        break;
    case 'update_leave_type':
        updateLeaveType();
        break;
    case 'delete_leave_type':
        deleteLeaveType();
        break;

    // User Role Management
    case 'update_role':
        updateUserRole();
        break;

    // Branch Management
    case 'branches':
        getBranches();
        break;
    case 'branch':
        getBranch();
        break;
    case 'add_branch':
        addBranch();
        break;
    case 'update_branch':
        updateBranch();
        break;
    case 'delete_branch':
        deleteBranch();
        break;

    // Employee Branches Management
    case 'get_employee_branches':
        getEmployeeBranches();
        break;
    case 'update_employee_branches':
        updateEmployeeBranches();
        break;

    // Shift Management
    case 'shifts':
        getShifts();
        break;
    case 'shift':
        getShift();
        break;
    case 'add_shift':
        addShift();
        break;
    case 'update_shift':
        updateShift();
        break;
    case 'delete_shift':
        deleteShift();
        break;

    // Employee Leave Balance Management
    case 'get_employee_leave_balance':
        getEmployeeLeaveBalance();
        break;
    case 'initialize_employee_leave_balance':
        initializeEmployeeLeaveBalance();
        break;
    case 'update_employee_leave_balance':
        updateEmployeeLeaveBalance();
        break;

    // Company Settings Management
    case 'get_company_settings':
        getCompanySettings();
        break;
    case 'update_company_settings':
        updateCompanySettings();
        break;
    case 'test_email':
        testEmailSettings();
        break;

    // Employee Types Management
    case 'get_employee_types':
        getEmployeeTypes();
        break;
    case 'add_employee_type':
        addEmployeeType();
        break;
    case 'delete_employee_type':
        deleteEmployeeType();
        break;

    // Telegram Notification Settings
    case 'get_telegram_settings':
        getTelegramSettings();
        break;
    case 'update_telegram_settings':
        updateTelegramSettings();
        break;
    case 'test_telegram':
        testTelegramConnection();
        break;

    default:
        jsonResponse(false, 'Invalid action');
}

// Employee Management Functions
function getEmployees()
{
    global $pdo;

    try {
        // Check if database connection exists
        if (!isset($pdo)) {
            jsonResponse(false, 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
        }

        $stmt = $pdo->query("
            SELECT e.*, d.name as department_name, 
            GROUP_CONCAT(eb.branch_id) as branch_ids,
            GROUP_CONCAT(b.name) as branch_names,
            s.name as shift_name, s.start_time as shift_start_time, s.end_time as shift_end_time
            FROM employees e 
            LEFT JOIN departments d ON e.department_id = d.id 
            LEFT JOIN employee_branches eb ON e.id = eb.employee_id
            LEFT JOIN branches b ON eb.branch_id = b.id
            LEFT JOIN shifts s ON e.shift_id = s.id
            GROUP BY e.id
            ORDER BY e.created_at DESC
        ");
        $employees = $stmt->fetchAll();

        foreach ($employees as &$emp) {
            unset($emp['password']);
        }

        jsonResponse(true, 'สำเร็จ', $employees);

    }
    catch (PDOException $e) {
        error_log('getEmployees error: ' . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getEmployee()
{
    global $pdo;

    $id = $_GET['id'] ?? '';

    try {
        $stmt = $pdo->prepare("
            SELECT e.*, d.name as department_name 
            FROM employees e 
            LEFT JOIN departments d ON e.department_id = d.id 
            WHERE e.id = ?
        ");
        $stmt->execute([$id]);
        $employee = $stmt->fetch();

        if (!$employee) {
            jsonResponse(false, 'ไม่พบข้อมูล');
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

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function addEmployee()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);

    $required = ['employee_code', 'first_name', 'last_name', 'employee_type', 'department_id'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            jsonResponse(false, "กรุณากรอก $field");
        }
    }

    try {
        // Check if employee code exists
        $stmt = $pdo->prepare("SELECT id FROM employees WHERE employee_code = ?");
        $stmt->execute([$data['employee_code']]);

        if ($stmt->fetch()) {
            jsonResponse(false, 'รหัสพนักงานนี้มีอยู่แล้ว');
        }

        // Default password is 1234
        $password = password_hash('1234', PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("
            INSERT INTO employees 
            (employee_code, password, first_name, last_name, email, employee_type, department_id, shift_id, start_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['employee_code'],
            $password,
            $data['first_name'],
            $data['last_name'],
            $data['email'] ?? null,
            $data['employee_type'],
            $data['department_id'],
            $data['shift_id'] ?? null,
            $data['start_date'] ?? date('Y-m-d')
        ]);

        // คืนค่า employee_id ที่สร้างไว้
        $employee_id = $pdo->lastInsertId();

        jsonResponse(true, 'เพิ่มพนักงานสำเร็จ', ['employee_id' => $employee_id]);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function updateEmployee()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';

    try {
        $stmt = $pdo->prepare("
            UPDATE employees SET 
            first_name = ?, last_name = ?, email = ?, employee_type = ?, 
            department_id = ?, shift_id = ?, is_active = ?, start_date = ?,
            address = ?, sub_district = ?, district = ?, province = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $data['first_name'],
            $data['last_name'],
            $data['email'] ?? null,
            $data['employee_type'],
            $data['department_id'],
            $data['shift_id'] ?? null,
            $data['is_active'] ?? 1,
            $data['start_date'] ?? null,
            $data['address'] ?? null,
            $data['sub_district'] ?? null,
            $data['district'] ?? null,
            $data['province'] ?? null,
            $id
        ]);

        jsonResponse(true, 'อัพเดทข้อมูลสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function uploadEmployeePhoto()
{
    global $pdo;

    if (!isset($_FILES['profile_photo'])) {
        jsonResponse(false, 'ไม่พบไฟล์');
    }

    $employee_id = $_POST['employee_id'] ?? '';
    if (empty($employee_id)) {
        jsonResponse(false, 'ไม่พบ ID พนักงาน');
    }

    $result = uploadFile($_FILES['profile_photo'], 'profiles');

    if (!$result['success']) {
        jsonResponse(false, $result['message']);
    }

    try {
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
            'path' => 'uploads/profiles/' . $result['filename'],
            'filename' => $result['filename']
        ]);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function uploadEmployeeIdCard()
{
    global $pdo;

    if (!isset($_FILES['id_card'])) {
        jsonResponse(false, 'ไม่พบไฟล์');
    }

    $employee_id = $_POST['employee_id'] ?? '';
    if (empty($employee_id)) {
        jsonResponse(false, 'ไม่พบ ID พนักงาน');
    }

    $result = uploadFile($_FILES['id_card'], 'id_cards');

    if (!$result['success']) {
        jsonResponse(false, $result['message']);
    }

    try {
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

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function resetPassword()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';

    if (empty($id)) {
        jsonResponse(false, 'ไม่พบรหัสพนักงาน');
    }

    try {
        // Reset to 1234 and force password change
        $hashed = password_hash('1234', PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("UPDATE employees SET password = ?, force_password_change = 1 WHERE id = ?");
        $stmt->execute([$hashed, $id]);

        jsonResponse(true, 'รีเซ็ทรหัสผ่านเป็น 1234 สำเร็จ (พนักงานต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบ)');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function setLeaveBalance()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);

    try {
        $stmt = $pdo->prepare("
            UPDATE employee_leave_balance 
            SET total_days = ?, remaining_days = ? 
            WHERE employee_id = ? AND leave_type_id = ? AND year = ?
        ");
        $stmt->execute([
            $data['total_days'],
            $data['remaining_days'],
            $data['employee_id'],
            $data['leave_type_id'],
            $data['year']
        ]);

        jsonResponse(true, 'อัพเดทวันลาสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

// Time Log Management
function getAllTimeLogs()
{
    global $pdo;

    $startDate = $_GET['start_date'] ?? '';
    $endDate = $_GET['end_date'] ?? '';
    $search = $_GET['search'] ?? '';

    try {
        $sql = "
            SELECT t.*, e.employee_code, e.first_name, e.last_name, d.name as department_name, b.name as branch_name, s.name as shift_name
            FROM time_logs t
            JOIN employees e ON t.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN branches b ON t.branch_id = b.id
            LEFT JOIN shifts s ON e.shift_id = s.id
            WHERE ";

        // Build date filtering conditions
        if (!empty($startDate) && !empty($endDate)) {
            // Use date range if both start and end dates are provided
            $sql .= "t.work_date BETWEEN ? AND ?";
            $params = [$startDate, $endDate];
        }
        elseif (!empty($startDate)) {
            // Use start date only (from start date onwards)
            $sql .= "t.work_date >= ?";
            $params = [$startDate];
        }
        elseif (!empty($endDate)) {
            // Use end date only (up to end date)
            $sql .= "t.work_date <= ?";
            $params = [$endDate];
        }
        else {
            // Show last 30 days if no date range is provided
            $sql .= "t.work_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
            $params = [];
        }

        if (!empty($search)) {
            $sql .= " AND (e.employee_code LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?)";
            $searchTerm = "%$search%";
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        // Filter by Department
        $departmentId = $_GET['department_id'] ?? '';
        if (!empty($departmentId)) {
            $sql .= " AND e.department_id = ?";
            $params[] = $departmentId;
        }

        // Filter by Branch
        $branchId = $_GET['branch_id'] ?? '';
        if (!empty($branchId)) {
            $sql .= " AND t.branch_id = ?";
            $params[] = $branchId;
        }

        $sql .= " ORDER BY t.work_date DESC, t.check_in_time DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $logs = $stmt->fetchAll();

        // Map shift_name to 'กะปกติ' if null
        foreach ($logs as &$log) {
            if (empty($log['shift_name'])) {
                $log['shift_name'] = 'กะปกติ';
            }
        }

        jsonResponse(true, 'สำเร็จ', $logs);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

// Leave Management
function getAllLeaves()
{
    global $pdo;

    try {
        // Get dates from query parameters
        $startDate = $_GET['start_date'] ?? '';
        $endDate = $_GET['end_date'] ?? '';

        // Build WHERE clause for date filtering
        $whereClause = '';
        $params = [];

        if (!empty($startDate) && !empty($endDate)) {
            // Check for any overlap with the selected date range
            $whereClause = "WHERE lr.start_date <= :end_date AND lr.end_date >= :start_date";
            $params[':start_date'] = $startDate;
            $params[':end_date'] = $endDate;
        }
        elseif (!empty($startDate)) {
            $whereClause = "WHERE lr.end_date >= :start_date";
            $params[':start_date'] = $startDate;
        }
        elseif (!empty($endDate)) {
            $whereClause = "WHERE lr.start_date <= :end_date";
            $params[':end_date'] = $endDate;
        }

        $sql = "
            SELECT lr.*, 
                   e.employee_code, e.first_name, e.last_name,
                   lt.name as leave_type_name,
                   mgr.first_name as manager_first_name,
                   mgr.last_name as manager_last_name,
                   mgr.email as manager_email,
                   hr.first_name as hr_first_name,
                   hr.last_name as hr_last_name,
                   hr.email as hr_email,
                   d.name as department_name,
                   d.manager_id as department_manager_id,
                   dept_mgr.first_name as dept_manager_first_name,
                   dept_mgr.last_name as dept_manager_last_name,
                   dept_mgr.email as dept_manager_email
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            LEFT JOIN employees mgr ON lr.manager_approved_by = mgr.id
            LEFT JOIN employees hr ON lr.hr_approved_by = hr.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN employees dept_mgr ON d.manager_id = dept_mgr.id
            {$whereClause}
            ORDER BY lr.created_at DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $leaves = $stmt->fetchAll();

        // Get HR approver info from system_settings
        $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'hr_name'");
        $stmt->execute();
        $hr_name_setting = $stmt->fetch();
        $hr_approver_name = $hr_name_setting ? $hr_name_setting['setting_value'] : null;

        $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'hr_email'");
        $stmt->execute();
        $hr_email_setting = $stmt->fetch();
        $hr_approver_email = $hr_email_setting ? $hr_email_setting['setting_value'] : null;

        // Add HR approver info to each leave record
        foreach ($leaves as &$leave) {
            $leave['hr_approver_name'] = $hr_approver_name;
            $leave['hr_approver_email'] = $hr_approver_email;
        }

        jsonResponse(true, 'สำเร็จ', $leaves);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function updateLeave()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';
    $new_status = $data['status'] ?? '';
    $new_total_days = $data['total_days'] ?? 0;

    try {
        // Get current leave request data before updating
        $stmt = $pdo->prepare("
            SELECT employee_id, leave_type_id, total_days, status 
            FROM leave_requests 
            WHERE id = ?
        ");
        $stmt->execute([$id]);
        $old_request = $stmt->fetch();

        if (!$old_request) {
            jsonResponse(false, 'ไม่พบข้อมูลคำขอลา');
            return;
        }

        $old_status = $old_request['status'];
        $old_total_days = $old_request['total_days'];
        $employee_id = $old_request['employee_id'];
        $leave_type_id = $old_request['leave_type_id'];
        $year = date('Y');

        // Begin transaction
        $pdo->beginTransaction();

        // Update leave request
        $stmt = $pdo->prepare("
            UPDATE leave_requests 
            SET start_date = ?, end_date = ?, total_days = ?, status = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $data['start_date'],
            $data['end_date'],
            $new_total_days,
            $new_status,
            $id
        ]);

        // Handle leave balance adjustment based on status change
        $status_changed_to_approved = ($old_status !== 'อนุมัติ' && $new_status === 'อนุมัติ');
        $status_changed_from_approved = ($old_status === 'อนุมัติ' && $new_status !== 'อนุมัติ');
        $days_changed = ($old_status === 'อนุมัติ' && $new_status === 'อนุมัติ' && $old_total_days != $new_total_days);

        if ($status_changed_to_approved) {
            // Changed TO approved: DEDUCT leave days
            $stmt = $pdo->prepare("
                UPDATE employee_leave_balance 
                SET used_days = used_days + ?, 
                    remaining_days = remaining_days - ? 
                WHERE employee_id = ? AND leave_type_id = ? AND year = ?
            ");
            $stmt->execute([
                $new_total_days,
                $new_total_days,
                $employee_id,
                $leave_type_id,
                $year
            ]);

            error_log("[Admin] Leave balance deducted: Employee $employee_id, Days: $new_total_days");

        }
        elseif ($status_changed_from_approved) {
            // Changed FROM approved: RESTORE leave days
            $stmt = $pdo->prepare("
                UPDATE employee_leave_balance 
                SET used_days = used_days - ?, 
                    remaining_days = remaining_days + ? 
                WHERE employee_id = ? AND leave_type_id = ? AND year = ?
            ");
            $stmt->execute([
                $old_total_days,
                $old_total_days,
                $employee_id,
                $leave_type_id,
                $year
            ]);

            error_log("[Admin] Leave balance restored: Employee $employee_id, Days: $old_total_days");

        }
        elseif ($days_changed) {
            // Still approved but days changed: ADJUST the difference
            $days_difference = $new_total_days - $old_total_days;

            if ($days_difference != 0) {
                $stmt = $pdo->prepare("
                    UPDATE employee_leave_balance 
                    SET used_days = used_days + ?, 
                        remaining_days = remaining_days - ? 
                    WHERE employee_id = ? AND leave_type_id = ? AND year = ?
                ");
                $stmt->execute([
                    $days_difference,
                    $days_difference,
                    $employee_id,
                    $leave_type_id,
                    $year
                ]);

                error_log("[Admin] Leave balance adjusted: Employee $employee_id, Days difference: $days_difference");
            }
        }

        // Commit transaction
        $pdo->commit();

        // Create appropriate success message
        if ($status_changed_to_approved) {
            jsonResponse(true, 'อัพเดทข้อมูลสำเร็จ - วันลาได้ถูกหักแล้ว');
        }
        elseif ($status_changed_from_approved) {
            jsonResponse(true, 'อัพเดทข้อมูลสำเร็จ - วันลาได้ถูกคืนแล้ว');
        }
        elseif ($days_changed) {
            jsonResponse(true, 'อัพเดทข้อมูลสำเร็จ - วันลาได้ถูกปรับแล้ว');
        }
        else {
            jsonResponse(true, 'อัพเดทข้อมูลสำเร็จ');
        }

    }
    catch (PDOException $e) {
        // Rollback on error
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("[Admin] Error updating leave: " . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function deleteLeave()
{
    global $pdo;

    // Debug: Log session and role
    error_log("[Admin] Session data: " . json_encode($_SESSION));
    error_log("[Admin] User role: " . ($_SESSION['role'] ?? 'NOT_SET'));

    $id = $_POST['id'] ?? '';

    try {
        // Debug: Log the ID being deleted
        error_log("[Admin] Attempting to delete leave request ID: $id");

        // Get leave request data before deleting
        $stmt = $pdo->prepare("
            SELECT employee_id, leave_type_id, total_days, status 
            FROM leave_requests 
            WHERE id = ?
        ");
        $stmt->execute([$id]);
        $leave_request = $stmt->fetch();

        if (!$leave_request) {
            error_log("[Admin] Leave request not found for ID: $id");
            jsonResponse(false, 'ไม่พบข้อมูลรายการลา');
            return;
        }

        // Debug: Log the leave request data
        error_log("[Admin] Found leave request: " . json_encode($leave_request));

        // Begin transaction
        // $pdo->beginTransaction(); // Temporarily disable transaction for debugging

        // Delete the leave request - Try direct SQL first
        $direct_sql = "DELETE FROM leave_requests WHERE id = $id";
        error_log("[Admin] Trying direct SQL: $direct_sql");

        try {
            $direct_result = $pdo->exec($direct_sql);
            error_log("[Admin] Direct SQL result: $direct_result");

            if ($direct_result === 0) {
                error_log("[Admin] Direct SQL deleted 0 rows");
                jsonResponse(false, 'ไม่สามารถลบรายการได้ (direct SQL failed)');
                return;
            }
        }
        catch (Exception $direct_error) {
            error_log("[Admin] Direct SQL error: " . $direct_error->getMessage());

            // Fall back to prepared statement
            error_log("[Admin] Falling back to prepared statement");
            $stmt = $pdo->prepare("DELETE FROM leave_requests WHERE id = ?");
            $delete_result = $stmt->execute([$id]);

            // Debug: Log deletion result
            error_log("[Admin] Prepared statement result: " . ($delete_result ? 'SUCCESS' : 'FAILED'));

            // Check if deletion was successful
            if (!$delete_result) {
                error_log("[Admin] Failed to delete leave request ID: $id");
                error_log("[Admin] PDO Error: " . json_encode($stmt->errorInfo()));
                jsonResponse(false, 'ไม่สามารถลบรายการลาได้');
                return;
            }

            // Check if any rows were actually deleted
            $rows_affected = $stmt->rowCount();
            error_log("[Admin] Rows affected by delete: $rows_affected");

            if ($rows_affected === 0) {
                error_log("[Admin] No rows were deleted for ID: $id");
                jsonResponse(false, 'ไม่พบรายการที่ต้องการลบ (ID: ' . $id . ')');
                return;
            }
        }

        // If the leave was approved, restore the leave days
        if ($leave_request['status'] === 'อนุมัติ') {
            $year = date('Y');
            $stmt = $pdo->prepare("
                UPDATE employee_leave_balance 
                SET used_days = used_days - ?, 
                    remaining_days = remaining_days + ? 
                WHERE employee_id = ? AND leave_type_id = ? AND year = ?
            ");
            $restore_result = $stmt->execute([
                $leave_request['total_days'],
                $leave_request['total_days'],
                $leave_request['employee_id'],
                $leave_request['leave_type_id'],
                $year
            ]);

            // Debug: Log restore result
            error_log("[Admin] Restore result: " . ($restore_result ? 'SUCCESS' : 'FAILED'));
            error_log("[Admin] Balance rows affected: " . $stmt->rowCount());

            if (!$restore_result) {
                $pdo->rollBack();
                error_log("[Admin] Failed to restore leave balance for employee {$leave_request['employee_id']}");
                jsonResponse(false, 'ไม่สามารถคืนวันลาได้');
                return;
            }

            error_log("[Admin] Leave balance restored after deletion: Employee {$leave_request['employee_id']}, Days: {$leave_request['total_days']}");
            jsonResponse(true, 'ลบข้อมูลสำเร็จ - วันลาได้ถูกคืนแล้ว');
        }
        else {
            // Leave was not approved, just delete without restoring days
            error_log("[Admin] Leave request deleted (not approved) for ID: $id");
            jsonResponse(true, 'ลบข้อมูลสำเร็จ');
        }

        // Commit transaction
        // try {
        //     $pdo->commit();
        //     error_log("[Admin] Transaction committed successfully for ID: $id");
        // } catch (Exception $commit_error) {
        //     error_log("[Admin] Commit failed: " . $commit_error->getMessage());
        //     $pdo->rollBack();
        //     jsonResponse(false, 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        //     return;
        // }

        error_log("[Admin] Delete completed successfully (no transaction) for ID: $id");

    }
    catch (PDOException $e) {
        // Rollback on error
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("[Admin] Error deleting leave: " . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function sendLeaveEmail()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $leave_id = $data['leave_id'] ?? '';
    $status = $data['status'] ?? '';

    if (empty($leave_id) || empty($status)) {
        jsonResponse(false, 'ข้อมูลไม่ครบถ้วน');
    }

    require_once '../includes/email_helper.php';

    try {
        // Send email based on status
        if ($status === 'รอหัวหน้าอนุมัติ') {
            // Send to manager
            $result = sendLeaveRequestNotification($pdo, $leave_id);
            if ($result !== false) {
                jsonResponse(true, 'ส่งอีเมลไปยังหัวหน้าสำเร็จ');
            }
            else {
                jsonResponse(false, 'ไม่สามารถส่งอีเมลได้ (หัวหน้าอาจไม่มีอีเมล)');
            }
        }
        elseif ($status === 'รอHRอนุมัติ') {
            // Send to HR
            $result = sendHRNotification($pdo, $leave_id);
            if ($result !== false) {
                jsonResponse(true, 'ส่งอีเมลไปยัง HR สำเร็จ');
            }
            else {
                jsonResponse(false, 'ไม่สามารถส่งอีเมลได้ (อาจยังไม่ได้ตั้งค่า HR Email)');
            }
        }
        else {
            jsonResponse(false, 'สถานะนี้ไม่สามารถส่งอีเมลได้');
        }

    }
    catch (Exception $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

// Department Management
function getDepartments()
{
    global $pdo;

    try {
        // Check if database connection exists
        if (!isset($pdo)) {
            jsonResponse(false, 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
        }

        $stmt = $pdo->query("
            SELECT d.*, 
                   CONCAT(e.first_name, ' ', e.last_name) as manager_name
            FROM departments d
            LEFT JOIN employees e ON d.manager_id = e.id
            ORDER BY d.name
        ");
        $departments = $stmt->fetchAll();

        jsonResponse(true, 'สำเร็จ', $departments);

    }
    catch (PDOException $e) {
        error_log('getDepartments error: ' . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function addDepartment()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);

    try {
        $stmt = $pdo->prepare("INSERT INTO departments (name, manager_id) VALUES (?, ?)");
        $stmt->execute([
            $data['name'],
            $data['manager_id'] ?? null
        ]);

        jsonResponse(true, 'เพิ่มแผนกสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function updateDepartment()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';

    try {
        $stmt = $pdo->prepare("UPDATE departments SET name = ?, manager_id = ? WHERE id = ?");
        $stmt->execute([
            $data['name'],
            $data['manager_id'] ?? null,
            $id
        ]);

        jsonResponse(true, 'อัพเดทแผนกสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function deleteDepartment()
{
    global $pdo;

    $id = $_POST['id'] ?? '';

    try {
        // Check if department has employees
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM employees WHERE department_id = ?");
        $stmt->execute([$id]);
        $result = $stmt->fetch();

        if ($result['count'] > 0) {
            jsonResponse(false, 'ไม่สามารถลบแผนกที่มีพนักงานอยู่ได้');
        }

        $stmt = $pdo->prepare("DELETE FROM departments WHERE id = ?");
        $stmt->execute([$id]);

        jsonResponse(true, 'ลบแผนกสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

// Leave Type Management
function getLeaveTypes()
{
    global $pdo;

    try {
        $stmt = $pdo->query("SELECT * FROM leave_types ORDER BY employee_type, name");
        $types = $stmt->fetchAll();

        jsonResponse(true, 'สำเร็จ', $types);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function addLeaveType()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);

    try {
        $stmt = $pdo->prepare("
            INSERT INTO leave_types (name, employee_type, min_work_days, max_days, icon) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['name'],
            $data['employee_type'],
            $data['min_work_days'],
            $data['max_days'],
            $data['icon'] ?? 'calendar'
        ]);

        jsonResponse(true, 'เพิ่มประเภทการลาสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function updateLeaveType()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';

    try {
        $stmt = $pdo->prepare("
            UPDATE leave_types 
            SET name = ?, employee_type = ?, min_work_days = ?, max_days = ?, icon = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $data['name'],
            $data['employee_type'],
            $data['min_work_days'],
            $data['max_days'],
            $data['icon'],
            $id
        ]);

        jsonResponse(true, 'อัพเดทประเภทการลาสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function deleteLeaveType()
{
    global $pdo;

    $id = $_POST['id'] ?? '';

    try {
        $stmt = $pdo->prepare("DELETE FROM leave_types WHERE id = ?");
        $stmt->execute([$id]);

        jsonResponse(true, 'ลบประเภทการลาสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

// Employee Type Management Functions
function getEmployeeTypes()
{
    global $pdo;
    try {
        $stmt = $pdo->query("SELECT * FROM employee_types ORDER BY id ASC");
        $types = $stmt->fetchAll();
        jsonResponse(true, 'สำเร็จ', $types);
    }
    catch (PDOException $e) {
        // Fallback if table doesn't exist yet
        jsonResponse(true, 'สำเร็จ', [
            ['id' => 1, 'name' => 'พนักงานประจำ'],
            ['id' => 2, 'name' => 'พนักงานทดลองงาน'],
            ['id' => 3, 'name' => 'นักศึกษาฝึกงาน'],
            ['id' => 4, 'name' => 'พนักงานสัญญาจ้าง']
        ]);
    }
}

function addEmployeeType()
{
    global $pdo;
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['name'])) {
        jsonResponse(false, 'กรุณาระบุชื่อประเภทพนักงาน');
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO employee_types (name) VALUES (?)");
        $stmt->execute([$data['name']]);
        jsonResponse(true, 'เพิ่มประเภทพนักงานสำเร็จ');
    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function deleteEmployeeType()
{
    global $pdo;
    $id = $_POST['id'] ?? '';

    if (empty($id)) {
        jsonResponse(false, 'ไม่พบ ID');
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM employee_types WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(true, 'ลบประเภทพนักงานสำเร็จ');
    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

// User Role Management
function updateUserRole()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';
    $role = $data['role'] ?? '';

    if (!in_array($role, ['พนักงาน', 'HR', 'IT Support', 'HR Admin', 'ผู้ดูแลระบบ'])) {
        jsonResponse(false, 'สิทธิ์ไม่ถูกต้อง');
    }

    try {
        $stmt = $pdo->prepare("UPDATE employees SET role = ? WHERE id = ?");
        $stmt->execute([$role, $id]);

        jsonResponse(true, 'อัพเดทสิทธิ์สำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

// Branch Management
function getBranches()
{
    global $pdo;

    try {
        $stmt = $pdo->query("
            SELECT * FROM branches 
            ORDER BY is_active DESC, name ASC
        ");
        $branches = $stmt->fetchAll();

        jsonResponse(true, 'สำเร็จ', $branches);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getBranch()
{
    global $pdo;

    $id = $_GET['id'] ?? '';

    try {
        $stmt = $pdo->prepare("SELECT * FROM branches WHERE id = ?");
        $stmt->execute([$id]);
        $branch = $stmt->fetch();

        if (!$branch) {
            jsonResponse(false, 'ไม่พบข้อมูล');
        }

        jsonResponse(true, 'สำเร็จ', $branch);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function addBranch()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);

    $required = ['name', 'latitude', 'longitude', 'radius'];
    foreach ($required as $field) {
        if (empty($data[$field]) && $data[$field] !== '0') {
            jsonResponse(false, "กรุณากรอก $field");
        }
    }

    try {
        // Convert to integer
        $is_default = isset($data['is_default']) ? (int)$data['is_default'] : 0;

        // Log for debugging
        error_log('=== Add Branch ===');
        error_log('is_default value: ' . $is_default);

        // ถ้าตั้งเป็นสาขาเริ่มต้น ให้ยกเลิกสาขาเริ่มต้นเดิมก่อน
        if ($is_default == 1) {
            error_log('Setting as default branch, unsetting others...');
            $pdo->exec("UPDATE branches SET is_default = 0");
        }

        $stmt = $pdo->prepare("
            INSERT INTO branches 
            (name, latitude, longitude, radius, google_maps_link, allow_checkin_outside, allow_checkout_outside, is_default, is_active) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['name'],
            $data['latitude'],
            $data['longitude'],
            $data['radius'],
            $data['google_maps_link'] ?? null,
            isset($data['allow_checkin_outside']) ? (int)$data['allow_checkin_outside'] : 0,
            isset($data['allow_checkout_outside']) ? (int)$data['allow_checkout_outside'] : 0,
            $is_default,
            isset($data['is_active']) ? (int)$data['is_active'] : 1
        ]);

        jsonResponse(true, 'เพิ่มสาขาสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function updateBranch()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';

    // Log for debugging
    error_log('=== Update Branch ===');
    error_log('Branch ID: ' . $id);
    error_log('is_default value: ' . ($data['is_default'] ?? 'NOT SET'));
    error_log('Full data: ' . print_r($data, true));

    try {
        // Convert to integer to ensure proper comparison
        $is_default = isset($data['is_default']) ? (int)$data['is_default'] : 0;

        // ถ้าตั้งเป็นสาขาเริ่มต้น ให้ยกเลิกสาขาเริ่มต้นเดิมก่อน
        if ($is_default == 1) {
            error_log('Setting as default branch, unsetting others...');
            $pdo->exec("UPDATE branches SET is_default = 0");
        }

        $stmt = $pdo->prepare("
            UPDATE branches SET 
            name = ?, latitude = ?, longitude = ?, radius = ?, 
            google_maps_link = ?, allow_checkin_outside = ?, 
            allow_checkout_outside = ?, is_default = ?, is_active = ?
            WHERE id = ?
        ");

        $params = [
            $data['name'],
            $data['latitude'],
            $data['longitude'],
            $data['radius'],
            $data['google_maps_link'] ?? null,
            isset($data['allow_checkin_outside']) ? (int)$data['allow_checkin_outside'] : 0,
            isset($data['allow_checkout_outside']) ? (int)$data['allow_checkout_outside'] : 0,
            $is_default,
            isset($data['is_active']) ? (int)$data['is_active'] : 1,
            $id
        ];

        error_log('SQL params: ' . print_r($params, true));

        $stmt->execute($params);

        error_log('Update successful');

        jsonResponse(true, 'อัพเดทข้อมูลสำเร็จ');

    }
    catch (PDOException $e) {
        error_log('Update error: ' . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function deleteBranch()
{
    global $pdo;

    $id = $_POST['id'] ?? '';

    try {
        $stmt = $pdo->prepare("DELETE FROM branches WHERE id = ?");
        $stmt->execute([$id]);

        jsonResponse(true, 'ลบสาขาสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

// Employee Branches Management Functions
function getEmployeeBranches()
{
    global $pdo;

    $employee_id = $_GET['employee_id'] ?? '';

    if (empty($employee_id)) {
        jsonResponse(false, 'ไม่พบ employee_id');
    }

    try {
        // ดึงสาขาที่พนักงานมีสิทธิ์เห็น
        $stmt = $pdo->prepare("
            SELECT branch_id 
            FROM employee_branches 
            WHERE employee_id = ?
        ");
        $stmt->execute([$employee_id]);
        $branches = $stmt->fetchAll(PDO::FETCH_COLUMN);

        jsonResponse(true, 'สำเร็จ', $branches);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function updateEmployeeBranches()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $employee_id = $data['employee_id'] ?? '';
    $branch_ids = $data['branch_ids'] ?? [];

    if (empty($employee_id)) {
        jsonResponse(false, 'ไม่พบ employee_id');
    }

    try {
        // เริ่ม transaction
        $pdo->beginTransaction();

        // ลบข้อมูลเดิมทั้งหมด
        $stmt = $pdo->prepare("DELETE FROM employee_branches WHERE employee_id = ?");
        $stmt->execute([$employee_id]);

        // เพิ่มข้อมูลใหม่
        if (!empty($branch_ids)) {
            $stmt = $pdo->prepare("INSERT INTO employee_branches (employee_id, branch_id) VALUES (?, ?)");
            foreach ($branch_ids as $branch_id) {
                $stmt->execute([$employee_id, $branch_id]);
            }
        }

        // Commit transaction
        $pdo->commit();

        jsonResponse(true, 'อัพเดทสาขาสำเร็จ');

    }
    catch (PDOException $e) {
        // Rollback on error
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

// Shift Management Functions
function getShifts()
{
    global $pdo;

    try {
        $stmt = $pdo->query("SELECT * FROM shifts ORDER BY name ASC");
        $shifts = $stmt->fetchAll();

        jsonResponse(true, 'สำเร็จ', $shifts);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getShift()
{
    global $pdo;

    $id = $_GET['id'] ?? '';

    try {
        $stmt = $pdo->prepare("SELECT * FROM shifts WHERE id = ?");
        $stmt->execute([$id]);
        $shift = $stmt->fetch();

        if (!$shift) {
            jsonResponse(false, 'ไม่พบข้อมูล');
        }

        jsonResponse(true, 'สำเร็จ', $shift);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function addShift()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);

    $required = ['name', 'start_time', 'end_time', 'work_days'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            jsonResponse(false, "กรุณากรอก $field");
        }
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO shifts (name, start_time, end_time, work_days) 
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['name'],
            $data['start_time'],
            $data['end_time'],
            $data['work_days']
        ]);

        jsonResponse(true, 'เพิ่มกะการทำงานสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function updateShift()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';

    try {
        $stmt = $pdo->prepare("
            UPDATE shifts SET 
            name = ?, start_time = ?, end_time = ?, work_days = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $data['name'],
            $data['start_time'],
            $data['end_time'],
            $data['work_days'],
            $id
        ]);

        jsonResponse(true, 'อัพเดทกะการทำงานสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function deleteShift()
{
    global $pdo;

    $id = $_POST['id'] ?? '';

    try {
        // Check if any employee is using this shift
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM employees WHERE shift_id = ?");
        $stmt->execute([$id]);
        $result = $stmt->fetch();

        if ($result['count'] > 0) {
            jsonResponse(false, 'ไม่สามารถลบกะที่มีพนักงานใช้งานอยู่ได้');
        }

        $stmt = $pdo->prepare("DELETE FROM shifts WHERE id = ?");
        $stmt->execute([$id]);

        jsonResponse(true, 'ลบกะการทำงานสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

// Employee Leave Balance Management Functions
function getEmployeeLeaveBalance()
{
    global $pdo;

    $employee_id = $_GET['employee_id'] ?? '';
    $year = $_GET['year'] ?? date('Y');

    if (empty($employee_id)) {
        jsonResponse(false, 'ไม่พบ employee_id');
    }

    try {
        $stmt = $pdo->prepare("
            SELECT 
                elb.*,
                lt.name as leave_type_name,
                lt.icon
            FROM employee_leave_balance elb
            JOIN leave_types lt ON elb.leave_type_id = lt.id
            WHERE elb.employee_id = ? AND elb.year = ?
            ORDER BY lt.name ASC
        ");
        $stmt->execute([$employee_id, $year]);
        $balances = $stmt->fetchAll();

        jsonResponse(true, 'สำเร็จ', $balances);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function initializeEmployeeLeaveBalance()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $employee_id = $data['employee_id'] ?? '';
    $employee_type = $data['employee_type'] ?? '';
    $year = $data['year'] ?? date('Y');

    if (empty($employee_id) || empty($employee_type)) {
        jsonResponse(false, 'ข้อมูลไม่ครบถ้วน');
    }

    try {
        // Get employee's work days
        $workDays = calculateWorkDays($employee_id, $pdo);

        // Get leave types for this employee type
        $stmt = $pdo->prepare("
            SELECT id, name, max_days, min_work_days 
            FROM leave_types 
            WHERE employee_type = ?
        ");
        $stmt->execute([$employee_type]);
        $leaveTypes = $stmt->fetchAll();

        if (empty($leaveTypes)) {
            jsonResponse(false, 'ไม่พบประเภทการลาสำหรับพนักงานประเภทนี้');
        }

        // Begin transaction
        $pdo->beginTransaction();

        // Delete existing leave balance for this year
        $stmt = $pdo->prepare("DELETE FROM employee_leave_balance WHERE employee_id = ? AND year = ?");
        $stmt->execute([$employee_id, $year]);

        // Insert new leave balance for each leave type
        $stmt = $pdo->prepare("
            INSERT INTO employee_leave_balance 
            (employee_id, leave_type_id, year, total_days, remaining_days) 
            VALUES (?, ?, ?, ?, ?)
        ");

        foreach ($leaveTypes as $leaveType) {
            // Check if employee meets minimum work days requirement
            if ($workDays >= $leaveType['min_work_days']) {
                $totalDays = $leaveType['max_days'];
                $stmt->execute([
                    $employee_id,
                    $leaveType['id'],
                    $year,
                    $totalDays,
                    $totalDays // Initially, remaining = total
                ]);
            }
        }

        $pdo->commit();

        jsonResponse(true, 'ตั้งค่าวันลาพื้นฐานสำเร็จ');

    }
    catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function updateEmployeeLeaveBalance()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $employee_id = $data['employee_id'] ?? '';
    $year = $data['year'] ?? date('Y');
    $leave_balances = $data['leave_balances'] ?? [];

    if (empty($employee_id) || empty($leave_balances)) {
        jsonResponse(false, 'ข้อมูลไม่ครบถ้วน');
    }

    try {
        // Begin transaction
        $pdo->beginTransaction();

        // Update or insert each leave balance
        $stmt = $pdo->prepare("
            INSERT INTO employee_leave_balance 
            (employee_id, leave_type_id, year, total_days, remaining_days) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            total_days = VALUES(total_days),
            remaining_days = VALUES(remaining_days)
        ");

        foreach ($leave_balances as $balance) {
            $stmt->execute([
                $employee_id,
                $balance['leave_type_id'],
                $year,
                $balance['total_days'],
                $balance['remaining_days']
            ]);
        }

        $pdo->commit();

        jsonResponse(true, 'บันทึกวันลาสำเร็จ');

    }
    catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

// Company Settings Management Functions
function getCompanySettings()
{
    global $pdo;

    try {
        $stmt = $pdo->prepare("SELECT * FROM company_settings WHERE id = 1");
        $stmt->execute();
        $settings = $stmt->fetch();

        if (!$settings) {
            // Create default settings if not exists
            $stmt = $pdo->prepare("
                INSERT INTO company_settings 
                (id, company_name, registration_code) 
                VALUES (1, 'China Thai Group', 'CTG2025')
            ");
            $stmt->execute();

            // Fetch again
            $stmt = $pdo->prepare("SELECT * FROM company_settings WHERE id = 1");
            $stmt->execute();
            $settings = $stmt->fetch();
        }

        // Get SMTP settings, HR settings, and App settings from system_settings
        $smtp_keys = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_secure', 'email_from_address', 'email_from_name', 'hr_email', 'hr_name', 'smile_detection_enabled'];
        $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('" . implode("','", $smtp_keys) . "')");
        $stmt->execute();
        $smtp_settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // Merge settings
        $all_settings = array_merge((array)$settings, $smtp_settings);

        jsonResponse(true, 'สำเร็จ', $all_settings);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function updateCompanySettings()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);

    $required = ['company_name', 'registration_code'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            jsonResponse(false, "กรุณากรอก $field");
        }
    }

    try {
        // Update company_settings table
        $stmt = $pdo->prepare("
            UPDATE company_settings SET 
            company_name = ?,
            company_address = ?,
            company_latitude = ?,
            company_longitude = ?,
            registration_code = ?,
            phone = ?,
            email = ?
            WHERE id = 1
        ");

        $stmt->execute([
            $data['company_name'],
            $data['company_address'] ?? null,
            $data['company_latitude'] ?? null,
            $data['company_longitude'] ?? null,
            $data['registration_code'],
            $data['phone'] ?? null,
            $data['email'] ?? null
        ]);

        // Update SMTP settings and HR settings in system_settings
        $smtp_fields = [
            'smtp_host',
            'smtp_port',
            'smtp_username',
            'smtp_password',
            'smtp_secure',
            'email_from_address',
            'email_from_name',
            'hr_email',
            'hr_name',
            'smile_detection_enabled'
        ];

        foreach ($smtp_fields as $field) {
            if (isset($data[$field])) {
                $stmt = $pdo->prepare("
                    INSERT INTO system_settings (setting_key, setting_value) 
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE setting_value = ?
                ");
                $stmt->execute([$field, $data[$field], $data[$field]]);
            }
        }

        jsonResponse(true, 'บันทึกข้อมูลบริษัทสำเร็จ');

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function testEmailSettings()
{
    $data = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    $required = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'email_from_address', 'test_recipient'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            jsonResponse(false, "ข้อมูลไม่ครบถ้วน: $field");
        }
    }

    // Load PHPMailer
    require_once '../includes/email_helper.php';

    try {
        $result = sendTestEmail([
            'smtp_host' => $data['smtp_host'],
            'smtp_port' => $data['smtp_port'],
            'smtp_username' => $data['smtp_username'],
            'smtp_password' => $data['smtp_password'],
            'smtp_secure' => $data['smtp_secure'] ?? 'tls',
            'email_from_address' => $data['email_from_address'],
            'email_from_name' => $data['email_from_name'] ?? 'HR Lanto System',
            'test_recipient' => $data['test_recipient']
        ]);

        if ($result['success']) {
            jsonResponse(true, 'ส่งอีเมลทดสอบสำเร็จ');
        }
        else {
            jsonResponse(false, $result['message']);
        }

    }
    catch (Exception $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

// Import Employees from Excel
function importEmployees()
{
    global $pdo;

    // Check if PhpSpreadsheet is available
    $vendorPath = __DIR__ . '/../vendor/autoload.php';
    if (!file_exists($vendorPath)) {
        jsonResponse(false, 'ระบบไม่รองรับการ Import Excel (ไม่พบ PhpSpreadsheet library) กรุณาติดต่อผู้ดูแลระบบ');
    }

    // Check if file was uploaded
    if (!isset($_FILES['excel_file'])) {
        jsonResponse(false, 'ไม่พบไฟล์ที่อัพโหลด');
    }

    $file = $_FILES['excel_file'];

    // Validate file type
    $allowedExtensions = ['xlsx'];
    $fileExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

    if (!in_array($fileExtension, $allowedExtensions)) {
        jsonResponse(false, 'รองรับเฉพาะไฟล์ .xlsx เท่านั้น');
    }

    // Validate file size (5MB)
    if ($file['size'] > 5 * 1024 * 1024) {
        jsonResponse(false, 'ไฟล์มีขนาดใหญ่เกิน 5MB');
    }

    // Create temp directory if not exists
    $tempDir = UPLOAD_DIR . 'temp/';
    if (!is_dir($tempDir)) {
        if (!mkdir($tempDir, 0777, true)) {
            jsonResponse(false, 'ไม่สามารถสร้างโฟลเดอร์ temp ได้');
        }
    }

    // Move file to temp directory
    $tempPath = $tempDir . uniqid() . '_' . $file['name'];
    if (!move_uploaded_file($file['tmp_name'], $tempPath)) {
        jsonResponse(false, 'ไม่สามารถอัพโหลดไฟล์ได้');
    }

    try {
        require_once $vendorPath;

        // Load Excel file (use fully qualified class name)
        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($tempPath);
        $sheet = $spreadsheet->getSheet(0); // First sheet
        $highestRow = $sheet->getHighestRow();

        $successCount = 0;
        $skipCount = 0;
        $errorCount = 0;
        $details = [];

        // Get default branch for new employees
        $stmt = $pdo->query("SELECT id FROM branches WHERE is_default = 1 LIMIT 1");
        $defaultBranch = $stmt->fetch();
        $defaultBranchId = $defaultBranch ? $defaultBranch['id'] : null;

        // Start from row 2 (skip header)
        for ($row = 2; $row <= $highestRow; $row++) {
            // Read data from Excel
            $employeeCode = trim($sheet->getCell("A$row")->getValue());
            $firstName = trim($sheet->getCell("B$row")->getValue());
            $lastName = trim($sheet->getCell("C$row")->getValue());
            $email = trim($sheet->getCell("D$row")->getValue());
            $employeeType = trim($sheet->getCell("E$row")->getValue());
            $departmentId = trim($sheet->getCell("F$row")->getValue());
            $startDate = $sheet->getCell("G$row")->getValue();
            $birthDate = $sheet->getCell("H$row")->getValue();
            $address = trim($sheet->getCell("I$row")->getValue());
            $subDistrict = trim($sheet->getCell("J$row")->getValue());
            $district = trim($sheet->getCell("K$row")->getValue());
            $province = trim($sheet->getCell("L$row")->getValue());
            $password = trim($sheet->getCell("M$row")->getValue());

            // Skip empty rows
            if (empty($employeeCode) && empty($firstName) && empty($lastName)) {
                continue;
            }

            // Validate required fields
            if (empty($employeeCode) || empty($firstName) || empty($lastName) || empty($employeeType) || empty($departmentId)) {
                $skipCount++;
                $details[] = [
                    'type' => 'skip',
                    'message' => "แถว $row: ข้อมูลไม่ครบถ้วน (ต้องมี: รหัสพนักงาน, ชื่อ, นามสกุล, ประเภทพนักงาน, รหัสแผนก)"
                ];
                continue;
            }

            // Validate employee type
            $validTypes = ['พนักงานประจำ', 'พนักงานทดลองงาน', 'นักศึกษาฝึกงาน'];
            if (!in_array($employeeType, $validTypes)) {
                $skipCount++;
                $details[] = [
                    'type' => 'skip',
                    'message' => "แถว $row: ประเภทพนักงานไม่ถูกต้อง (ต้องเป็น: พนักงานประจำ, พนักงานทดลองงาน, หรือ นักศึกษาฝึกงาน)"
                ];
                continue;
            }

            // Check if employee code already exists
            $stmt = $pdo->prepare("SELECT id FROM employees WHERE employee_code = ?");
            $stmt->execute([$employeeCode]);
            if ($stmt->fetch()) {
                $skipCount++;
                $details[] = [
                    'type' => 'skip',
                    'message' => "แถว $row: รหัสพนักงาน $employeeCode มีอยู่ในระบบแล้ว"
                ];
                continue;
            }

            // Check if department exists
            $stmt = $pdo->prepare("SELECT id FROM departments WHERE id = ?");
            $stmt->execute([$departmentId]);
            if (!$stmt->fetch()) {
                $skipCount++;
                $details[] = [
                    'type' => 'skip',
                    'message' => "แถว $row: ไม่พบรหัสแผนก $departmentId ในระบบ"
                ];
                continue;
            }

            // Format dates
            if ($startDate instanceof \DateTime) {
                $startDate = $startDate->format('Y-m-d');
            }
            elseif (is_numeric($startDate)) {
                // Excel date serial number
                $startDate = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($startDate)->format('Y-m-d');
            }

            if ($birthDate instanceof \DateTime) {
                $birthDate = $birthDate->format('Y-m-d');
            }
            elseif (is_numeric($birthDate)) {
                $birthDate = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($birthDate)->format('Y-m-d');
            }

            // Default password
            if (empty($password)) {
                $password = '12345678';
            }
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            // Insert employee
            try {
                $stmt = $pdo->prepare("
                    INSERT INTO employees (
                        employee_code, first_name, last_name, email, employee_type, 
                        department_id, start_date, birth_date, address, sub_district, 
                        district, province, password, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                ");

                $stmt->execute([
                    $employeeCode,
                    $firstName,
                    $lastName,
                    $email,
                    $employeeType,
                    $departmentId,
                    $startDate ?: null,
                    $birthDate ?: null,
                    $address,
                    $subDistrict,
                    $district,
                    $province,
                    $hashedPassword
                ]);

                $newEmployeeId = $pdo->lastInsertId();

                // Add default branch if exists
                if ($defaultBranchId) {
                    $stmt = $pdo->prepare("INSERT INTO employee_branches (employee_id, branch_id) VALUES (?, ?)");
                    $stmt->execute([$newEmployeeId, $defaultBranchId]);
                }

                // Initialize leave balance based on employee type
                initializeLeaveBalanceForEmployee($newEmployeeId, $employeeType);

                $successCount++;
                $details[] = [
                    'type' => 'success',
                    'message' => "แถว $row: เพิ่มพนักงาน $employeeCode ($firstName $lastName) สำเร็จ"
                ];

            }
            catch (PDOException $e) {
                $errorCount++;
                $details[] = [
                    'type' => 'error',
                    'message' => "แถว $row: เกิดข้อผิดพลาด - " . $e->getMessage()
                ];
            }
        }

        // Delete temp file
        if (file_exists($tempPath)) {
            unlink($tempPath);
        }

        jsonResponse(true, 'Import เรียบร้อยแล้ว', [
            'success_count' => $successCount,
            'skipped_count' => $skipCount,
            'error_count' => $errorCount,
            'details' => $details
        ]);

    }
    catch (Exception $e) {
        // Delete temp file on error
        if (isset($tempPath) && file_exists($tempPath)) {
            unlink($tempPath);
        }
        jsonResponse(false, 'เกิดข้อผิดพลาดในการอ่านไฟล์: ' . $e->getMessage());
    }
}

// Helper function to initialize leave balance for new employee
function initializeLeaveBalanceForEmployee($employeeId, $employeeType)
{
    global $pdo;

    try {
        // Get leave types for this employee type
        $stmt = $pdo->prepare("
            SELECT id, name, max_days 
            FROM leave_types 
            WHERE employee_type = ?
        ");
        $stmt->execute([$employeeType]);
        $leaveTypes = $stmt->fetchAll();

        // Insert leave balance for each leave type
        foreach ($leaveTypes as $leaveType) {
            $stmt = $pdo->prepare("
                INSERT INTO employee_leave_balance (employee_id, leave_type_id, days_remaining)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE days_remaining = ?
            ");
            $stmt->execute([
                $employeeId,
                $leaveType['id'],
                $leaveType['max_days'],
                $leaveType['max_days']
            ]);
        }
    }
    catch (PDOException $e) {
        // Log error but don't fail the import
        error_log("Failed to initialize leave balance for employee $employeeId: " . $e->getMessage());
    }
}

// Bulk Delete Employees
function bulkDeleteEmployees()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $employeeIds = $data['employee_ids'] ?? [];

    if (empty($employeeIds) || !is_array($employeeIds)) {
        jsonResponse(false, 'ไม่พบรายการพนักงานที่ต้องการลบ');
    }

    try {
        $pdo->beginTransaction();

        $placeholders = str_repeat('?,', count($employeeIds) - 1) . '?';

        // Delete related records first
        $tables = [
            'employee_branches',
            'employee_leave_balance',
            'time_logs',
            'leave_requests'
        ];

        foreach ($tables as $table) {
            $stmt = $pdo->prepare("DELETE FROM $table WHERE employee_id IN ($placeholders)");
            $stmt->execute($employeeIds);
        }

        // Delete employees
        $stmt = $pdo->prepare("DELETE FROM employees WHERE id IN ($placeholders)");
        $stmt->execute($employeeIds);

        $deletedCount = $stmt->rowCount();

        $pdo->commit();

        jsonResponse(true, 'ลบพนักงานสำเร็จ', [
            'deleted_count' => $deletedCount
        ]);

    }
    catch (PDOException $e) {
        $pdo->rollBack();
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

// Bulk Update Employees
function bulkUpdateEmployees()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);
    $employeeIds = $data['employee_ids'] ?? [];

    if (empty($employeeIds) || !is_array($employeeIds)) {
        jsonResponse(false, 'ไม่พบรายการพนักงานที่ต้องการแก้ไข');
    }

    // Build update fields
    $updateFields = [];
    $params = [];

    if (isset($data['department_id']) && $data['department_id'] !== '') {
        $updateFields[] = 'department_id = ?';
        $params[] = $data['department_id'];
    }

    if (isset($data['employee_type']) && $data['employee_type'] !== '') {
        $updateFields[] = 'employee_type = ?';
        $params[] = $data['employee_type'];
    }

    if (isset($data['shift_id'])) {
        if ($data['shift_id'] === null) {
            $updateFields[] = 'shift_id = NULL';
        }
        else {
            $updateFields[] = 'shift_id = ?';
            $params[] = $data['shift_id'];
        }
    }

    if (isset($data['is_active']) && $data['is_active'] !== '') {
        $updateFields[] = 'is_active = ?';
        $params[] = $data['is_active'];
    }

    if (empty($updateFields)) {
        jsonResponse(false, 'ไม่มีข้อมูลที่ต้องการแก้ไข');
    }

    try {
        $placeholders = str_repeat('?,', count($employeeIds) - 1) . '?';
        $params = array_merge($params, $employeeIds);

        $sql = "UPDATE employees SET " . implode(', ', $updateFields) . " WHERE id IN ($placeholders)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $updatedCount = $stmt->rowCount();

        jsonResponse(true, 'แก้ไขข้อมูลพนักงานสำเร็จ', [
            'updated_count' => $updatedCount
        ]);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

// Telegram Notification Settings Functions
function getTelegramSettings()
{
    global $pdo;

    try {
        $settings = [
            'telegram_enabled' => '0',
            'telegram_bot_token' => '',
            'telegram_timelog_chat_id' => '',
            'telegram_leave_chat_id' => ''
        ];

        $stmt = $pdo->prepare("
            SELECT setting_key, setting_value 
            FROM system_settings 
            WHERE setting_key LIKE 'telegram_%'
        ");
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        foreach ($results as $key => $value) {
            if (isset($settings[$key])) {
                $settings[$key] = $value;
            }
        }

        // ซ่อน token บางส่วนเพื่อความปลอดภัย
        if (!empty($settings['telegram_bot_token'])) {
            $token = $settings['telegram_bot_token'];
            if (strlen($token) > 20) {
                $settings['telegram_bot_token_masked'] = substr($token, 0, 10) . '...' . substr($token, -5);
            }
        }

        jsonResponse(true, 'สำเร็จ', $settings);

    }
    catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function updateTelegramSettings()
{
    global $pdo;

    $data = json_decode(file_get_contents('php://input'), true);

    $allowedKeys = [
        'telegram_enabled',
        'telegram_bot_token',
        'telegram_timelog_chat_id',
        'telegram_leave_chat_id'
    ];

    try {
        $pdo->beginTransaction();

        foreach ($allowedKeys as $key) {
            if (isset($data[$key])) {
                $value = trim($data[$key]);

                // ตรวจสอบว่ามี setting นี้อยู่แล้วหรือไม่
                $stmt = $pdo->prepare("SELECT id FROM system_settings WHERE setting_key = ?");
                $stmt->execute([$key]);

                if ($stmt->fetch()) {
                    // Update existing
                    $stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = ?");
                    $stmt->execute([$value, $key]);
                }
                else {
                    // Insert new
                    $stmt = $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value, setting_group) VALUES (?, ?, 'telegram')");
                    $stmt->execute([$key, $value]);
                }
            }
        }

        $pdo->commit();

        jsonResponse(true, 'บันทึกการตั้งค่า Telegram สำเร็จ');

    }
    catch (PDOException $e) {
        $pdo->rollBack();
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function testTelegramConnection()
{
    global $pdo;

    require_once '../includes/telegram_helper.php';

    $data = json_decode(file_get_contents('php://input'), true);
    $type = $data['type'] ?? 'timelog'; // 'timelog' หรือ 'leave'

    try {
        $telegram = new TelegramNotifier($pdo);

        if (!$telegram->isEnabled()) {
            jsonResponse(false, 'กรุณาเปิดใช้งานและตั้งค่า Telegram Bot ก่อน');
        }

        $result = $telegram->testConnection($type);

        if ($result['success']) {
            jsonResponse(true, 'ส่งข้อความทดสอบสำเร็จ! กรุณาตรวจสอบกลุ่ม Telegram');
        }
        else {
            jsonResponse(false, 'ไม่สามารถส่งข้อความได้: ' . $result['message']);
        }

    }
    catch (Exception $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}
