<?php
require_once 'config.php';

$request_id = $_GET['id'] ?? '';
$token = $_GET['token'] ?? '';
$role = $_GET['role'] ?? '';
$action = $_GET['action'] ?? '';

// Verify token with role
$expected_token = md5($request_id . $role . 'secret_key');
if ($token !== $expected_token) {
    die('Invalid token - การเข้าถึงไม่ถูกต้อง');
}

// Validate role
if (!in_array($role, ['manager', 'hr'])) {
    die('Invalid role - บทบาทไม่ถูกต้อง');
}

// Get request details
try {
    $stmt = $pdo->prepare("
        SELECT 
            lr.*,
            e.first_name, e.last_name, e.employee_code, e.profile_photo,
            lt.name as leave_type_name,
            d.name as department_name
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE lr.id = ?
    ");
    $stmt->execute([$request_id]);
    $request = $stmt->fetch();
    
    if (!$request) {
        die('Request not found');
    }
    
    // Handle approval/rejection
    if ($action === 'approve_manager' || $action === 'reject_manager') {
        handleManagerAction($request_id, $action, $pdo);
    } elseif ($action === 'approve_hr' || $action === 'reject_hr') {
        handleHRAction($request_id, $action, $pdo);
    }
    
} catch (PDOException $e) {
    die('Database error');
}

function handleManagerAction($request_id, $action, $pdo) {
    $reason = $_POST['reason'] ?? '';
    
    if ($action === 'approve_manager') {
        // Get manager info from department
        $stmt = $pdo->prepare("
            SELECT d.manager_id 
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            JOIN departments d ON e.department_id = d.id
            WHERE lr.id = ?
        ");
        $stmt->execute([$request_id]);
        $dept = $stmt->fetch();
        $manager_id = $dept['manager_id'] ?? null;
        
        $stmt = $pdo->prepare("
            UPDATE leave_requests 
            SET status = 'รอHRอนุมัติ', 
                manager_approved_at = NOW(),
                manager_approved_by = ?
            WHERE id = ?
        ");
        $stmt->execute([$manager_id, $request_id]);
        
        // Send notification to HR
        sendHRNotificationEmail($request_id, $pdo);
        
        $message = 'อนุมัติคำขอลาสำเร็จ คำขอจะถูกส่งไปยัง HR เพื่อพิจารณาต่อ';
    } else {
        $stmt = $pdo->prepare("
            UPDATE leave_requests 
            SET status = 'ปฏิเสธการลา', manager_reject_reason = ? 
            WHERE id = ?
        ");
        $stmt->execute([$reason, $request_id]);
        
        // Send notification to employee about rejection by manager
        sendManagerRejectionEmail($request_id, $reason, $pdo);
        
        $message = 'ปฏิเสธคำขอลาสำเร็จ';
    }
    
    $redirect_token = md5($request_id . 'manager' . 'secret_key');
    header("Location: approve_leave.php?id=$request_id&token=$redirect_token&role=manager&message=" . urlencode($message));
    exit;
}

function handleHRAction($request_id, $action, $pdo) {
    global $employee_id;
    $reason = $_POST['reason'] ?? '';
    
    if ($action === 'approve_hr') {
        // Get current user ID (HR who is approving) from session if available
        session_start();
        $hr_id = $_SESSION['employee_id'] ?? null;
        
        // If no session, try to get from employees with role HR (fallback)
        if (!$hr_id) {
            $stmt = $pdo->prepare("SELECT id FROM employees WHERE role = 'HR' OR role = 'ผู้ดูแลระบบ' LIMIT 1");
            $stmt->execute();
            $hr = $stmt->fetch();
            $hr_id = $hr['id'] ?? null;
        }
        
        $stmt = $pdo->prepare("
            UPDATE leave_requests 
            SET status = 'อนุมัติ', 
                hr_approved_at = NOW(),
                hr_approved_by = ?
            WHERE id = ?
        ");
        $stmt->execute([$hr_id, $request_id]);
        
        // Deduct leave balance
        $stmt = $pdo->prepare("
            SELECT employee_id, leave_type_id, total_days 
            FROM leave_requests 
            WHERE id = ?
        ");
        $stmt->execute([$request_id]);
        $request = $stmt->fetch();
        
        $year = date('Y');
        $stmt = $pdo->prepare("
            UPDATE employee_leave_balance 
            SET used_days = used_days + ?, remaining_days = remaining_days - ? 
            WHERE employee_id = ? AND leave_type_id = ? AND year = ?
        ");
        $stmt->execute([
            $request['total_days'], 
            $request['total_days'],
            $request['employee_id'],
            $request['leave_type_id'],
            $year
        ]);
        
        // Send notification to employee about approval
        sendHRApprovalEmail($request_id, $pdo);
        
        $message = 'อนุมัติคำขอลาสำเร็จ วันลาได้ถูกหักแล้ว';
    } else {
        $stmt = $pdo->prepare("
            UPDATE leave_requests 
            SET status = 'ปฏิเสธการลา', hr_reject_reason = ? 
            WHERE id = ?
        ");
        $stmt->execute([$reason, $request_id]);
        
        // Send notification to employee about rejection by HR
        sendHRRejectionEmail($request_id, $reason, $pdo);
        
        $message = 'ปฏิเสธคำขอลาสำเร็จ';
    }
    
    $redirect_token = md5($request_id . 'hr' . 'secret_key');
    header("Location: approve_leave.php?id=$request_id&token=$redirect_token&role=hr&message=" . urlencode($message));
    exit;
}

function sendHRNotificationEmail($request_id, $pdo) {
    // Use new email helper
    require_once 'includes/email_helper.php';
    
    try {
        sendHRNotification($pdo, $request_id);
    } catch (Exception $e) {
        error_log('Failed to send HR notification: ' . $e->getMessage());
    }
}

function sendManagerRejectionEmail($request_id, $reason, $pdo) {
    // Use new email helper
    require_once 'includes/email_helper.php';
    
    try {
        sendLeaveRejectedByManagerNotification($pdo, $request_id, $reason);
    } catch (Exception $e) {
        error_log('Failed to send manager rejection notification: ' . $e->getMessage());
    }
}

function sendHRApprovalEmail($request_id, $pdo) {
    // Use new email helper
    require_once 'includes/email_helper.php';
    
    try {
        sendLeaveApprovedNotification($pdo, $request_id);
    } catch (Exception $e) {
        error_log('Failed to send HR approval notification: ' . $e->getMessage());
    }
}

function sendHRRejectionEmail($request_id, $reason, $pdo) {
    // Use new email helper
    require_once 'includes/email_helper.php';
    
    try {
        sendLeaveRejectedByHRNotification($pdo, $request_id, $reason);
    } catch (Exception $e) {
        error_log('Failed to send HR rejection notification: ' . $e->getMessage());
    }
}

$message = $_GET['message'] ?? '';
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>อนุมัติคำขอลา - HR Lanto</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #FF6B35 0%, #E85A2A 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 30px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 {
            color: #FF6B35;
            margin-bottom: 20px;
            font-size: 1.8rem;
        }
        .profile {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 20px;
            background: #f5f5f5;
            border-radius: 12px;
            margin-bottom: 20px;
        }
        .profile-photo {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: #ddd;
            overflow: hidden;
        }
        .profile-photo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .profile-info h2 {
            font-size: 1.3rem;
            color: #333;
            margin-bottom: 5px;
        }
        .profile-info p {
            color: #666;
            font-size: 0.9rem;
        }
        .info-grid {
            display: grid;
            gap: 15px;
            margin-bottom: 30px;
        }
        .info-item {
            padding: 15px;
            background: #f5f5f5;
            border-radius: 10px;
        }
        .info-label {
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 5px;
        }
        .info-value {
            color: #333;
            font-size: 1.1rem;
            font-weight: 600;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
        }
        .status-pending {
            background: #FFF3E0;
            color: #FF9800;
        }
        .status-approved {
            background: #E8F5E9;
            color: #4CAF50;
        }
        .status-rejected {
            background: #FFEBEE;
            color: #F44336;
        }
        .attachment {
            margin: 15px 0;
        }
        .attachment img {
            max-width: 100%;
            border-radius: 10px;
        }
        .actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 30px;
        }
        button {
            padding: 15px 20px;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .btn-approve {
            background: #4CAF50;
            color: white;
        }
        .btn-reject {
            background: #F44336;
            color: white;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .message {
            padding: 15px;
            background: #4CAF50;
            color: white;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-family: inherit;
            margin-top: 10px;
            resize: vertical;
        }
        .form-group {
            margin: 15px 0;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>คำขอลา</h1>
        
        <?php if ($message): ?>
            <div class="message"><?= htmlspecialchars($message) ?></div>
        <?php endif; ?>
        
        <div class="profile">
            <div class="profile-photo">
                <?php if ($request['profile_photo']): ?>
                    <img src="<?= UPLOAD_URL ?>profiles/<?= htmlspecialchars($request['profile_photo']) ?>" alt="Profile">
                <?php endif; ?>
            </div>
            <div class="profile-info">
                <h2><?= htmlspecialchars($request['first_name'] . ' ' . $request['last_name']) ?></h2>
                <p>รหัสพนักงาน: <?= htmlspecialchars($request['employee_code']) ?></p>
                <p>แผนก: <?= htmlspecialchars($request['department_name'] ?? '-') ?></p>
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">ประเภทการลา</div>
                <div class="info-value"><?= htmlspecialchars($request['leave_type_name']) ?></div>
            </div>
            
            <div class="info-item">
                <div class="info-label">วันที่ลา</div>
                <div class="info-value">
                    <?= date('d/m/Y', strtotime($request['start_date'])) ?> - 
                    <?= date('d/m/Y', strtotime($request['end_date'])) ?>
                    (<?= $request['total_days'] ?> วัน)
                </div>
            </div>
            
            <div class="info-item">
                <div class="info-label">เหตุผล</div>
                <div class="info-value"><?= nl2br(htmlspecialchars($request['reason'])) ?></div>
            </div>
            
            <div class="info-item">
                <div class="info-label">สถานะ</div>
                <div class="info-value">
                    <?php
                    $statusClass = 'status-pending';
                    if ($request['status'] === 'อนุมัติ') $statusClass = 'status-approved';
                    elseif (strpos($request['status'], 'ปฏิเสธ') !== false) $statusClass = 'status-rejected';
                    ?>
                    <span class="status-badge <?= $statusClass ?>">
                        <?= htmlspecialchars($request['status']) ?>
                    </span>
                </div>
            </div>
            
            <?php if ($request['attachment']): ?>
            <div class="info-item" style="grid-column: 1 / -1;">
                <div class="info-label">ไฟล์แนบ</div>
                <div class="attachment">
                    <img src="<?= UPLOAD_URL ?>leave_attachments/<?= htmlspecialchars($request['attachment']) ?>" alt="Attachment">
                </div>
            </div>
            <?php endif; ?>
        </div>
        
        <?php if ($request['status'] === 'รอหัวหน้าอนุมัติ' && $role === 'manager'): ?>
            <!-- Manager approval section -->
            <div class="actions">
                <form method="POST" action="?id=<?= $request_id ?>&token=<?= $token ?>&role=<?= $role ?>&action=approve_manager">
                    <button type="submit" class="btn-approve">อนุมัติลา (หัวหน้า)</button>
                </form>
                
                <button type="button" class="btn-reject" onclick="showRejectForm('manager')">ปฏิเสธลา</button>
            </div>
            
            <form id="reject-form" method="POST" action="?id=<?= $request_id ?>&token=<?= $token ?>&role=<?= $role ?>&action=reject_manager" style="display: none;">
                <div class="form-group">
                    <label>เหตุผลในการปฏิเสธ <span style="color: red;">*</span></label>
                    <textarea name="reason" rows="3" required placeholder="กรุณาระบุเหตุผลในการปฏิเสธ"></textarea>
                </div>
                <button type="submit" class="btn-reject" style="width: 100%;">ยืนยันการปฏิเสธ</button>
            </form>
        <?php elseif ($request['status'] === 'รอHRอนุมัติ' && $role === 'hr'): ?>
            <!-- HR approval section -->
            <div class="actions">
                <form method="POST" action="?id=<?= $request_id ?>&token=<?= $token ?>&role=<?= $role ?>&action=approve_hr">
                    <button type="submit" class="btn-approve">อนุมัติลา (HR)</button>
                </form>
                
                <button type="button" class="btn-reject" onclick="showRejectForm('hr')">ปฏิเสธลา</button>
            </div>
            
            <form id="reject-form" method="POST" action="?id=<?= $request_id ?>&token=<?= $token ?>&role=<?= $role ?>&action=reject_hr" style="display: none;">
                <div class="form-group">
                    <label>เหตุผลในการปฏิเสธ <span style="color: red;">*</span></label>
                    <textarea name="reason" rows="3" required placeholder="กรุณาระบุเหตุผลในการปฏิเสธ"></textarea>
                </div>
                <button type="submit" class="btn-reject" style="width: 100%;">ยืนยันการปฏิเสธ</button>
            </form>
        <?php elseif (in_array($request['status'], ['อนุมัติ', 'ปฏิเสธการลา'])): ?>
            <!-- Status is final, no buttons should be shown -->
            <div style="text-align: center; padding: 20px; background: #f5f5f5; border-radius: 10px; margin-top: 20px;">
                <p style="color: #666; font-size: 16px; margin: 0;">
                    <?php if ($request['status'] === 'อนุมัติ'): ?>
                        ✅ คำขอนี้ได้รับการอนุมัติแล้ว
                    <?php else: ?>
                        ❌ คำขอนี้ถูกปฏิเสธแล้ว
                    <?php endif; ?>
                </p>
            </div>
        <?php elseif ($request['status'] === 'รอหัวหน้าอนุมัติ' && $role === 'hr'): ?>
            <!-- HR viewing manager pending approval -->
            <div style="text-align: center; padding: 20px; background: #FFF3E0; border-radius: 10px; margin-top: 20px; border-left: 4px solid #FF9800;">
                <p style="color: #E65100; font-size: 16px; margin: 0;">
                    ⏳ คำขอนี้กำลังรอการอนุมัติจากหัวหน้า<br>
                    <span style="font-size: 14px; color: #666;">HR สามารถอนุมัติได้เมื่อหัวหน้าอนุมัติแล้วเท่านั้น</span>
                </p>
            </div>
        <?php elseif ($request['status'] === 'รอHRอนุมัติ' && $role === 'manager'): ?>
            <!-- Manager viewing HR pending approval -->
            <div style="text-align: center; padding: 20px; background: #E3F2FD; border-radius: 10px; margin-top: 20px; border-left: 4px solid #2196F3;">
                <p style="color: #1565C0; font-size: 16px; margin: 0;">
                    ✓ คุณได้อนุมัติคำขอนี้แล้ว<br>
                    <span style="font-size: 14px; color: #666;">กำลังรอการอนุมัติจาก HR</span>
                </p>
            </div>
        <?php else: ?>
            <!-- No permission or invalid state -->
            <div style="text-align: center; padding: 20px; background: #FFEBEE; border-radius: 10px; margin-top: 20px; border-left: 4px solid #F44336;">
                <p style="color: #C62828; font-size: 16px; margin: 0;">
                    ⚠️ คุณไม่มีสิทธิ์ในการดำเนินการกับคำขอนี้
                </p>
            </div>
        <?php endif; ?>
    </div>
    
    <script>
        function showRejectForm(role) {
            document.querySelector('.actions').style.display = 'none';
            document.getElementById('reject-form').style.display = 'block';
        }
    </script>
</body>
</html>

