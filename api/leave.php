<?php
require_once '../config.php';
require_once '../includes/telegram_helper.php';

header('Content-Type: application/json; charset=utf-8');

requireLogin();

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'balance':
        getLeaveBalance();
        break;
    case 'requests':
        getLeaveRequests();
        break;
    case 'supervisor':
        getSupervisor();
        break;
    case 'request':
        submitLeaveRequest();
        break;
    case 'cancel':
        cancelLeaveRequest();
        break;
    default:
        jsonResponse(false, 'Invalid action');
}

function getSupervisor() {
    global $pdo;
    
    $department_id = $_SESSION['department_id'] ?? null;
    
    if (!$department_id) {
        jsonResponse(true, 'สำเร็จ', ['name' => '-']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT CONCAT(e.first_name, ' ', e.last_name) as name
            FROM departments d
            LEFT JOIN employees e ON d.manager_id = e.id
            WHERE d.id = ?
        ");
        $stmt->execute([$department_id]);
        $result = $stmt->fetch();
        
        $name = $result['name'] ?? '-';
        
        jsonResponse(true, 'สำเร็จ', ['name' => $name]);
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getLeaveBalance() {
    global $pdo;
    
    $employee_id = $_SESSION['employee_id'];
    $year = date('Y');
    
    try {
        // Get employee info
        $stmt = $pdo->prepare("SELECT employee_type, start_date FROM employees WHERE id = ?");
        $stmt->execute([$employee_id]);
        $employee = $stmt->fetch();
        
        if (!$employee) {
            jsonResponse(false, 'ไม่พบข้อมูลพนักงาน');
        }
        
        $work_days = calculateWorkDays($employee_id, $pdo);
        
        // Get leave types for this employee
        $stmt = $pdo->prepare("
            SELECT * FROM leave_types 
            WHERE employee_type = ? AND min_work_days <= ?
        ");
        $stmt->execute([$employee['employee_type'], $work_days]);
        $leave_types = $stmt->fetchAll();
        
        $balances = [];
        
        foreach ($leave_types as $type) {
            // Check if balance exists
            $stmt = $pdo->prepare("
                SELECT * FROM employee_leave_balance 
                WHERE employee_id = ? AND leave_type_id = ? AND year = ?
            ");
            $stmt->execute([$employee_id, $type['id'], $year]);
            $balance = $stmt->fetch();
            
            if (!$balance) {
                // Create balance
                $stmt = $pdo->prepare("
                    INSERT INTO employee_leave_balance 
                    (employee_id, leave_type_id, year, total_days, remaining_days) 
                    VALUES (?, ?, ?, ?, ?)
                ");
                $stmt->execute([$employee_id, $type['id'], $year, $type['max_days'], $type['max_days']]);
                
                $balance = [
                    'employee_id' => $employee_id,
                    'leave_type_id' => $type['id'],
                    'year' => $year,
                    'total_days' => $type['max_days'],
                    'used_days' => 0,
                    'remaining_days' => $type['max_days']
                ];
            }
            
            $balance['leave_type_name'] = $type['name'];
            $balance['icon'] = $type['icon'];
            $balances[] = $balance;
        }
        
        jsonResponse(true, 'สำเร็จ', $balances);
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getLeaveRequests() {
    global $pdo;
    
    $employee_id = $_SESSION['employee_id'];
    
    try {
        $stmt = $pdo->prepare("
            SELECT lr.*, lt.name as leave_type_name 
            FROM leave_requests lr 
            JOIN leave_types lt ON lr.leave_type_id = lt.id 
            WHERE lr.employee_id = ? 
            ORDER BY lr.created_at DESC
            LIMIT 20
        ");
        $stmt->execute([$employee_id]);
        $requests = $stmt->fetchAll();
        
        jsonResponse(true, 'สำเร็จ', $requests);
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function submitLeaveRequest() {
    global $pdo;
    
    $employee_id = $_SESSION['employee_id'];
    $leave_type_id = $_POST['leave-type-select'] ?? '';
    $start_date = $_POST['leave-start-date'] ?? '';
    $end_date = $_POST['leave-end-date'] ?? '';
    $duration = $_POST['leave-duration'] ?? 'full';
    $reason = $_POST['leave-reason'] ?? '';
    
    if (empty($leave_type_id) || empty($start_date) || empty($end_date) || empty($reason)) {
        jsonResponse(false, 'กรุณากรอกข้อมูลให้ครบถ้วน');
    }
    
    try {
        // คำนวณจำนวนวัน
        if ($duration === 'half') {
            // ลาครึ่งวัน = 0.5 วัน
            $total_days = 0.5;
        } else {
            // ลาเต็มวัน - คำนวณปกติ
            $start = new DateTime($start_date);
            $end = new DateTime($end_date);
            $diff = $start->diff($end);
            $total_days = $diff->days + 1;
        }
        
        // Check leave balance
        $year = date('Y');
        $stmt = $pdo->prepare("
            SELECT remaining_days FROM employee_leave_balance 
            WHERE employee_id = ? AND leave_type_id = ? AND year = ?
        ");
        $stmt->execute([$employee_id, $leave_type_id, $year]);
        $balance = $stmt->fetch();
        
        if (!$balance || $balance['remaining_days'] < $total_days) {
            jsonResponse(false, 'วันลาคงเหลือไม่เพียงพอ');
        }
        
        // Handle file upload
        $attachment = null;
        if (isset($_FILES['leave-attachment']) && $_FILES['leave-attachment']['error'] === UPLOAD_ERR_OK) {
            $upload_result = uploadFile($_FILES['leave-attachment'], 'leave_attachments');
            if ($upload_result['success']) {
                $attachment = $upload_result['filename'];
            }
        }
        
        // Insert leave request
        $stmt = $pdo->prepare("
            INSERT INTO leave_requests 
            (employee_id, leave_type_id, start_date, end_date, total_days, reason, attachment, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'รอหัวหน้าอนุมัติ')
        ");
        $stmt->execute([$employee_id, $leave_type_id, $start_date, $end_date, $total_days, $reason, $attachment]);
        
        $request_id = $pdo->lastInsertId();
        
        // ไม่หักวันลาทันที - รอการอนุมัติจาก HR ก่อน
        
        // Send email notification to manager
        require_once '../includes/email_helper.php';
        sendLeaveRequestNotification($pdo, $request_id);
        
        // ส่งแจ้งเตือน Telegram
        sendTelegramLeaveNotification($pdo, $request_id);
        
        jsonResponse(true, 'ส่งคำขอลาสำเร็จ');
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function cancelLeaveRequest() {
    global $pdo;
    
    $request_id = $_POST['request_id'] ?? '';
    $employee_id = $_SESSION['employee_id'];
    
    try {
        // Check if request belongs to user and can be cancelled
        $stmt = $pdo->prepare("
            SELECT * FROM leave_requests 
            WHERE id = ? AND employee_id = ? AND status = 'รอหัวหน้าอนุมัติ'
        ");
        $stmt->execute([$request_id, $employee_id]);
        $request = $stmt->fetch();
        
        if (!$request) {
            jsonResponse(false, 'ไม่สามารถยกเลิกคำขอนี้ได้');
        }
        
        // Update status
        $stmt = $pdo->prepare("UPDATE leave_requests SET status = 'ยกเลิกโดยพนักงาน' WHERE id = ?");
        $stmt->execute([$request_id]);
        
        jsonResponse(true, 'ยกเลิกคำขอลาสำเร็จ');
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}
