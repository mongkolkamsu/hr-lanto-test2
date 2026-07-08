<?php
/**
 * Email Helper - ระบบส่งอีเมลด้วย PHPMailer
 * 
 * ไฟล์นี้ใช้สำหรับส่งอีเมลผ่าน SMTP โดยใช้ PHPMailer library
 * รองรับการตั้งค่า SMTP แบบ Dynamic จาก system_settings
 */

// Try to load PHPMailer via Composer autoload
$autoload_paths = [
    __DIR__ . '/../vendor/autoload.php',
    __DIR__ . '/../../vendor/autoload.php',
    __DIR__ . '/../../../vendor/autoload.php'
];

$phpmailer_loaded = false;
foreach ($autoload_paths as $autoload_path) {
    if (file_exists($autoload_path)) {
        require_once $autoload_path;
        $phpmailer_loaded = true;
        break;
    }
}

// Log if PHPMailer is not available
if (!$phpmailer_loaded) {
    error_log('[Email Helper] PHPMailer autoload not found. Will use fallback mail() function.');
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

/**
 * ส่งอีเมลด้วย SMTP
 * 
 * @param array $config การตั้งค่า SMTP
 * @param string $to อีเมลผู้รับ
 * @param string $subject หัวข้ออีเมล
 * @param string $body เนื้อหาอีเมล (HTML)
 * @return array ['success' => bool, 'message' => string]
 */
function sendEmailWithSMTP($config, $to, $subject, $body)
{
    // Check if PHPMailer is available
    if (!class_exists('PHPMailer\PHPMailer\PHPMailer')) {
        // If PHPMailer not available, use fallback mail() function
        error_log('[Email Helper] PHPMailer class not found. Using fallback mail() function.');
        return sendEmailWithMailFunction($config, $to, $subject, $body);
    }

    try {
        $mail = new PHPMailer(true);

        // Enable debug output for troubleshooting (comment out in production)
        // $mail->SMTPDebug = 2;

        // SMTP Configuration
        $mail->isSMTP();
        $mail->Host = $config['smtp_host'];
        $mail->SMTPAuth = true;
        $mail->Username = $config['smtp_username'];
        $mail->Password = $config['smtp_password'];
        $mail->SMTPSecure = $config['smtp_secure'] ?? 'tls';
        $mail->Port = $config['smtp_port'];
        $mail->CharSet = 'UTF-8';

        // Recipients
        $mail->setFrom($config['email_from_address'], $config['email_from_name']);
        $mail->addAddress($to);

        // Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $body;

        // Send
        $mail->send();

        error_log("[Email Helper] Email sent successfully to: $to");
        return ['success' => true, 'message' => 'ส่งอีเมลสำเร็จ'];

    }
    catch (Exception $e) {
        $error_msg = "ไม่สามารถส่งอีเมลได้: {$mail->ErrorInfo}";
        error_log("[Email Helper] Failed to send email to $to: {$mail->ErrorInfo}");
        return ['success' => false, 'message' => $error_msg];
    }
}

/**
 * ส่งอีเมลด้วย PHP mail() function (Fallback)
 * หมายเหตุ: ต้องตั้งค่า SMTP ใน php.ini ก่อนใช้งาน
 */
function sendEmailWithMailFunction($config, $to, $subject, $body)
{
    error_log("[Email Helper] Using PHP mail() function (fallback) to send email to: $to");
    error_log("[Email Helper] NOTE: PHP mail() requires SMTP configuration in php.ini");

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=utf-8\r\n";
    $headers .= "From: {$config['email_from_name']} <{$config['email_from_address']}>\r\n";

    if (mail($to, $subject, $body, $headers)) {
        error_log("[Email Helper] Email sent successfully using mail() function to: $to");
        return ['success' => true, 'message' => 'ส่งอีเมลสำเร็จ (ผ่าน PHP mail)'];
    }
    else {
        error_log("[Email Helper] Failed to send email using mail() function to: $to");
        error_log("[Email Helper] Please check: 1) SMTP configured in php.ini 2) mail() function enabled");
        return ['success' => false, 'message' => 'ไม่สามารถส่งอีเมลได้ (ตรวจสอบการตั้งค่า PHP mail)'];
    }
}

/**
 * ส่งอีเมลทดสอบ
 */
function sendTestEmail($config)
{
    $subject = "ทดสอบการส่งอีเมล - HR Lanto System";
    $body = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
        </head>
        <body style='font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;'>
            <div style='max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                <h2 style='color: #FF6B35; margin-bottom: 20px;'>
                    ✓ ทดสอบการส่งอีเมลสำเร็จ
                </h2>
                
                <p style='color: #333; line-height: 1.6; margin-bottom: 15px;'>
                    ระบบ HR Lanto สามารถส่งอีเมลได้แล้ว!
                </p>
                
                <div style='background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;'>
                    <h3 style='color: #1565C0; margin: 0 0 10px 0; font-size: 16px;'>
                        ข้อมูลการตั้งค่า SMTP:
                    </h3>
                    <table style='width: 100%; color: #333; font-size: 14px;'>
                        <tr>
                            <td style='padding: 5px 0;'><strong>SMTP Host:</strong></td>
                            <td style='padding: 5px 0;'>{$config['smtp_host']}</td>
                        </tr>
                        <tr>
                            <td style='padding: 5px 0;'><strong>SMTP Port:</strong></td>
                            <td style='padding: 5px 0;'>{$config['smtp_port']}</td>
                        </tr>
                        <tr>
                            <td style='padding: 5px 0;'><strong>Security:</strong></td>
                            <td style='padding: 5px 0;'>" . strtoupper($config['smtp_secure']) . "</td>
                        </tr>
                        <tr>
                            <td style='padding: 5px 0;'><strong>From:</strong></td>
                            <td style='padding: 5px 0;'>{$config['email_from_name']} &lt;{$config['email_from_address']}&gt;</td>
                        </tr>
                    </table>
                </div>
                
                <p style='color: #666; font-size: 14px; margin-top: 20px;'>
                    <strong>หมายเหตุ:</strong> หากคุณได้รับอีเมลนี้ แสดงว่าการตั้งค่า SMTP ของคุณถูกต้อง
                    และระบบพร้อมส่งอีเมลแจ้งเตือนให้กับผู้ใช้งานแล้ว
                </p>
                
                <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;'>
                    <p>ส่งจาก HR Lanto System</p>
                    <p>วันที่: " . date('d/m/Y H:i:s') . "</p>
                </div>
            </div>
        </body>
        </html>
    ";

    return sendEmailWithSMTP($config, $config['test_recipient'], $subject, $body);
}

/**
 * ดึงการตั้งค่า SMTP จากฐานข้อมูล
 */
function getEmailConfig($pdo)
{
    try {
        $smtp_keys = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_secure', 'email_from_address', 'email_from_name'];
        $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('" . implode("','", $smtp_keys) . "')");
        $stmt->execute();
        $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // Check if all required settings exist
        if (empty($settings['smtp_host'])) {
            error_log('[Email Helper] SMTP Host not configured in system_settings');
            return null;
        }
        if (empty($settings['smtp_username'])) {
            error_log('[Email Helper] SMTP Username not configured in system_settings');
            return null;
        }
        if (empty($settings['smtp_password'])) {
            error_log('[Email Helper] SMTP Password not configured in system_settings');
            return null;
        }

        error_log('[Email Helper] Email config loaded successfully from database');
        return $settings;

    }
    catch (PDOException $e) {
        error_log('[Email Helper] Failed to get email config: ' . $e->getMessage());
        return null;
    }
}

/**
 * ส่งอีเมลแจ้งเตือนคำขอลา (ใช้แทน mail() ใน api/leave.php)
 * @return bool true if email sent successfully, false otherwise
 */
function sendLeaveRequestNotification($pdo, $request_id)
{
    try {
        error_log("[Email Helper] Starting sendLeaveRequestNotification for request ID: $request_id");

        // Get email config
        $config = getEmailConfig($pdo);
        if (!$config) {
            error_log('[Email Helper] Email config not found or incomplete. Please configure SMTP settings.');
            return false;
        }

        // Get request details
        $stmt = $pdo->prepare("
            SELECT 
                lr.*,
                e.first_name, e.last_name, e.employee_code, e.department_id,
                lt.name as leave_type_name,
                d.manager_id
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE lr.id = ?
        ");
        $stmt->execute([$request_id]);
        $request = $stmt->fetch();

        if (!$request) {
            error_log("[Email Helper] Leave request not found: $request_id");
            return false;
        }

        if (!$request['manager_id']) {
            error_log("[Email Helper] No manager assigned to department for leave request: $request_id");
            return false;
        }

        // Get manager email
        $stmt = $pdo->prepare("SELECT email, first_name, last_name FROM employees WHERE id = ?");
        $stmt->execute([$request['manager_id']]);
        $manager = $stmt->fetch();

        if (!$manager || !$manager['email']) {
            error_log("[Email Helper] Manager email not found for manager ID: {$request['manager_id']}");
            return false;
        }

        error_log("[Email Helper] Sending leave request notification to manager: {$manager['email']}");

        // Create approval link with manager role
        $manager_token = md5($request_id . 'manager' . 'secret_key');
        $approval_url = BASE_URL . "approve_leave.php?id=" . $request_id . "&token=" . $manager_token . "&role=manager";

        $subject = "คำขอลา - {$request['first_name']} {$request['last_name']}";
        $body = "
            <h2>มีคำขอลาใหม่</h2>
            <p><strong>พนักงาน:</strong> {$request['first_name']} {$request['last_name']} ({$request['employee_code']})</p>
            <p><strong>ประเภทการลา:</strong> {$request['leave_type_name']}</p>
            <p><strong>วันที่:</strong> {$request['start_date']} ถึง {$request['end_date']} ({$request['total_days']} วัน)</p>
            <p><strong>เหตุผล:</strong> {$request['reason']}</p>
            <p><strong>เวลาที่ส่งคำขอ:</strong> " . date('d/m/Y H:i', strtotime($request['created_at'])) . " น.</p>
            <p><a href='{$approval_url}' style='display: inline-block; padding: 10px 20px; background: #FF6B35; color: white; text-decoration: none; border-radius: 5px;'>ดูรายละเอียดและอนุมัติ (หัวหน้า)</a></p>
        ";

        $result = sendEmailWithSMTP($config, $manager['email'], $subject, $body);

        if ($result['success']) {
            error_log("[Email Helper] Leave request notification sent successfully to: {$manager['email']}");
        }
        else {
            error_log("[Email Helper] Failed to send leave request notification: {$result['message']}");
        }

        return $result['success'];

    }
    catch (Exception $e) {
        error_log("[Email Helper] Exception in sendLeaveRequestNotification: " . $e->getMessage());
        return false;
    }
}

/**
 * ส่งอีเมลแจ้งเตือน HR (ใช้แทน mail() ใน approve_leave.php)
 * @return bool true if email sent successfully, false otherwise
 */
function sendHRNotification($pdo, $request_id)
{
    try {
        error_log("[Email Helper] Starting sendHRNotification for request ID: $request_id");

        // Get email config
        $config = getEmailConfig($pdo);
        if (!$config) {
            error_log('[Email Helper] Email config not found or incomplete. Please configure SMTP settings.');
            return false;
        }

        // Get request details
        $stmt = $pdo->prepare("
            SELECT 
                lr.*,
                e.first_name, e.last_name, e.employee_code,
                lt.name as leave_type_name
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.id = ?
        ");
        $stmt->execute([$request_id]);
        $request = $stmt->fetch();

        if (!$request) {
            error_log("[Email Helper] Leave request not found: $request_id");
            return false;
        }

        // Get HR email from system settings
        $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'hr_email'");
        $stmt->execute();
        $hr_email_setting = $stmt->fetch();
        $hr_email = $hr_email_setting ? $hr_email_setting['setting_value'] : null;

        if (!$hr_email) {
            error_log('[Email Helper] HR email not configured in system_settings (hr_email)');
            return false;
        }

        error_log("[Email Helper] Sending HR notification to: $hr_email");

        // Create approval link with HR role
        $hr_token = md5($request_id . 'hr' . 'secret_key');
        $approval_url = BASE_URL . "approve_leave.php?id=" . $request_id . "&token=" . $hr_token . "&role=hr";

        $subject = "คำขอลา (อนุมัติโดยหัวหน้าแล้ว) - {$request['first_name']} {$request['last_name']}";
        $body = "
            <h2>มีคำขอลาที่รออนุมัติจาก HR</h2>
            <p><strong>พนักงาน:</strong> {$request['first_name']} {$request['last_name']} ({$request['employee_code']})</p>
            <p><strong>ประเภทการลา:</strong> {$request['leave_type_name']}</p>
            <p><strong>วันที่:</strong> {$request['start_date']} ถึง {$request['end_date']} ({$request['total_days']} วัน)</p>
            <p><strong>เหตุผล:</strong> {$request['reason']}</p>
            <p><strong>เวลาที่ส่งคำขอ:</strong> " . date('d/m/Y H:i', strtotime($request['created_at'])) . " น.</p>
            <p><strong>สถานะ:</strong> หัวหน้าอนุมัติแล้ว</p>
            <p><a href='{$approval_url}' style='display: inline-block; padding: 10px 20px; background: #FF6B35; color: white; text-decoration: none; border-radius: 5px;'>ดูรายละเอียดและอนุมัติ (HR)</a></p>
        ";

        $result = sendEmailWithSMTP($config, $hr_email, $subject, $body);

        if ($result['success']) {
            error_log("[Email Helper] HR notification sent successfully to: $hr_email");
        }
        else {
            error_log("[Email Helper] Failed to send HR notification: {$result['message']}");
        }

        return $result['success'];

    }
    catch (Exception $e) {
        error_log("[Email Helper] Exception in sendHRNotification: " . $e->getMessage());
        return false;
    }
}

/**
 * ส่งอีเมลแจ้งพนักงานเมื่อวันลาได้รับการอนุมัติโดย HR
 * @param PDO $pdo Database connection
 * @param int $request_id Leave request ID
 * @return bool true if email sent successfully, false otherwise
 */
function sendLeaveApprovedNotification($pdo, $request_id)
{
    try {
        error_log("[Email Helper] Starting sendLeaveApprovedNotification for request ID: $request_id");

        // Get email config
        $config = getEmailConfig($pdo);
        if (!$config) {
            error_log('[Email Helper] Email config not found or incomplete. Please configure SMTP settings.');
            return false;
        }

        // Get request and employee details
        $stmt = $pdo->prepare("
            SELECT 
                lr.*,
                e.first_name, e.last_name, e.employee_code, e.email,
                lt.name as leave_type_name
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.id = ?
        ");
        $stmt->execute([$request_id]);
        $request = $stmt->fetch();

        if (!$request) {
            error_log("[Email Helper] Leave request not found: $request_id");
            return false;
        }

        if (!$request['email']) {
            error_log("[Email Helper] Employee email not found for request: $request_id");
            return false;
        }

        error_log("[Email Helper] Sending leave approved notification to employee: {$request['email']}");

        $subject = "✅ วันลาของคุณได้รับการอนุมัติแล้ว";
        $body = "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
            </head>
            <body style='font-family: \"Sarabun\", Arial, sans-serif; padding: 20px; background: #f5f5f5;'>
                <div style='max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                    <div style='text-align: center; margin-bottom: 30px;'>
                        <div style='font-size: 60px; margin-bottom: 10px;'>✅</div>
                        <h2 style='color: #4CAF50; margin: 0;'>วันลาได้รับการอนุมัติแล้ว</h2>
                    </div>
                    
                    <p style='color: #333; line-height: 1.6; margin-bottom: 20px;'>
                        เรียน คุณ{$request['first_name']} {$request['last_name']},
                    </p>
                    
                    <p style='color: #333; line-height: 1.6; margin-bottom: 20px;'>
                        คำขอลาของคุณได้รับการอนุมัติจาก HR เรียบร้อยแล้ว
                    </p>
                    
                    <div style='background: #E8F5E9; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50; margin: 20px 0;'>
                        <h3 style='color: #2E7D32; margin: 0 0 15px 0; font-size: 16px;'>รายละเอียดการลา:</h3>
                        <table style='width: 100%; color: #333; font-size: 14px;'>
                            <tr>
                                <td style='padding: 8px 0;'><strong>ประเภทการลา:</strong></td>
                                <td style='padding: 8px 0;'>{$request['leave_type_name']}</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>วันที่ลา:</strong></td>
                                <td style='padding: 8px 0;'>" . date('d/m/Y', strtotime($request['start_date'])) . " - " . date('d/m/Y', strtotime($request['end_date'])) . "</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>จำนวนวัน:</strong></td>
                                <td style='padding: 8px 0;'>{$request['total_days']} วัน</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>สถานะ:</strong></td>
                                <td style='padding: 8px 0;'><span style='color: #4CAF50; font-weight: bold;'>อนุมัติ</span></td>
                            </tr>
                        </table>
                    </div>
                    
                    <p style='color: #666; font-size: 14px; margin-top: 20px; line-height: 1.6;'>
                        วันลาได้ถูกหักออกจากสิทธิ์การลาของคุณแล้ว คุณสามารถตรวจสอบสิทธิ์การลาคงเหลือได้ในระบบ
                    </p>
                    
                    <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;'>
                        <p>ส่งจากระบบ HR Lanto</p>
                        <p>วันที่: " . date('d/m/Y H:i:s') . "</p>
                    </div>
                </div>
            </body>
            </html>
        ";

        $result = sendEmailWithSMTP($config, $request['email'], $subject, $body);

        if ($result['success']) {
            error_log("[Email Helper] Leave approved notification sent successfully to: {$request['email']}");
        }
        else {
            error_log("[Email Helper] Failed to send leave approved notification: {$result['message']}");
        }

        return $result['success'];

    }
    catch (Exception $e) {
        error_log("[Email Helper] Exception in sendLeaveApprovedNotification: " . $e->getMessage());
        return false;
    }
}

/**
 * ส่งอีเมลแจ้งพนักงานเมื่อวันลาถูกปฏิเสธโดยหัวหน้า
 * @param PDO $pdo Database connection
 * @param int $request_id Leave request ID
 * @param string $reject_reason Reason for rejection
 * @return bool true if email sent successfully, false otherwise
 */
function sendLeaveRejectedByManagerNotification($pdo, $request_id, $reject_reason)
{
    try {
        error_log("[Email Helper] Starting sendLeaveRejectedByManagerNotification for request ID: $request_id");

        // Get email config
        $config = getEmailConfig($pdo);
        if (!$config) {
            error_log('[Email Helper] Email config not found or incomplete. Please configure SMTP settings.');
            return false;
        }

        // Get request and employee details
        $stmt = $pdo->prepare("
            SELECT 
                lr.*,
                e.first_name, e.last_name, e.employee_code, e.email, e.department_id,
                lt.name as leave_type_name,
                d.manager_id,
                mgr.first_name as manager_first_name,
                mgr.last_name as manager_last_name
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN employees mgr ON d.manager_id = mgr.id
            WHERE lr.id = ?
        ");
        $stmt->execute([$request_id]);
        $request = $stmt->fetch();

        if (!$request) {
            error_log("[Email Helper] Leave request not found: $request_id");
            return false;
        }

        if (!$request['email']) {
            error_log("[Email Helper] Employee email not found for request: $request_id");
            return false;
        }

        $manager_name = ($request['manager_first_name'] && $request['manager_last_name'])
            ? $request['manager_first_name'] . ' ' . $request['manager_last_name']
            : 'หัวหน้า';

        error_log("[Email Helper] Sending leave rejected by manager notification to employee: {$request['email']}");

        $subject = "❌ วันลาของคุณถูกปฏิเสธโดยหัวหน้า";
        $body = "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
            </head>
            <body style='font-family: \"Sarabun\", Arial, sans-serif; padding: 20px; background: #f5f5f5;'>
                <div style='max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                    <div style='text-align: center; margin-bottom: 30px;'>
                        <div style='font-size: 60px; margin-bottom: 10px;'>❌</div>
                        <h2 style='color: #F44336; margin: 0;'>วันลาถูกปฏิเสธโดยหัวหน้า</h2>
                    </div>
                    
                    <p style='color: #333; line-height: 1.6; margin-bottom: 20px;'>
                        เรียน คุณ{$request['first_name']} {$request['last_name']},
                    </p>
                    
                    <p style='color: #333; line-height: 1.6; margin-bottom: 20px;'>
                        คำขอลาของคุณถูกปฏิเสธโดย {$manager_name}
                    </p>
                    
                    <div style='background: #FFEBEE; padding: 20px; border-radius: 8px; border-left: 4px solid #F44336; margin: 20px 0;'>
                        <h3 style='color: #C62828; margin: 0 0 15px 0; font-size: 16px;'>รายละเอียดการลา:</h3>
                        <table style='width: 100%; color: #333; font-size: 14px;'>
                            <tr>
                                <td style='padding: 8px 0;'><strong>ประเภทการลา:</strong></td>
                                <td style='padding: 8px 0;'>{$request['leave_type_name']}</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>วันที่ลา:</strong></td>
                                <td style='padding: 8px 0;'>" . date('d/m/Y', strtotime($request['start_date'])) . " - " . date('d/m/Y', strtotime($request['end_date'])) . "</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>จำนวนวัน:</strong></td>
                                <td style='padding: 8px 0;'>{$request['total_days']} วัน</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>สถานะ:</strong></td>
                                <td style='padding: 8px 0;'><span style='color: #F44336; font-weight: bold;'>ปฏิเสธการลา</span></td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style='background: #FFF3E0; padding: 15px; border-radius: 8px; border-left: 4px solid #FF9800; margin: 20px 0;'>
                        <h3 style='color: #E65100; margin: 0 0 10px 0; font-size: 15px;'>เหตุผลในการปฏิเสธ:</h3>
                        <p style='color: #333; margin: 0; line-height: 1.6;'>" . nl2br(htmlspecialchars($reject_reason)) . "</p>
                    </div>
                    
                    <p style='color: #666; font-size: 14px; margin-top: 20px; line-height: 1.6;'>
                        หากมีข้อสงสัยเกี่ยวกับการปฏิเสธนี้ กรุณาติดต่อหัวหน้าของคุณโดยตรง
                    </p>
                    
                    <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;'>
                        <p>ส่งจากระบบ HR Lanto</p>
                        <p>วันที่: " . date('d/m/Y H:i:s') . "</p>
                    </div>
                </div>
            </body>
            </html>
        ";

        $result = sendEmailWithSMTP($config, $request['email'], $subject, $body);

        if ($result['success']) {
            error_log("[Email Helper] Leave rejected by manager notification sent successfully to: {$request['email']}");
        }
        else {
            error_log("[Email Helper] Failed to send leave rejected by manager notification: {$result['message']}");
        }

        return $result['success'];

    }
    catch (Exception $e) {
        error_log("[Email Helper] Exception in sendLeaveRejectedByManagerNotification: " . $e->getMessage());
        return false;
    }
}

/**
 * ส่งอีเมลแจ้งพนักงานเมื่อวันลาถูกปฏิเสธโดย HR
 * @param PDO $pdo Database connection
 * @param int $request_id Leave request ID
 * @param string $reject_reason Reason for rejection
 * @return bool true if email sent successfully, false otherwise
 */
function sendLeaveRejectedByHRNotification($pdo, $request_id, $reject_reason)
{
    try {
        error_log("[Email Helper] Starting sendLeaveRejectedByHRNotification for request ID: $request_id");

        // Get email config
        $config = getEmailConfig($pdo);
        if (!$config) {
            error_log('[Email Helper] Email config not found or incomplete. Please configure SMTP settings.');
            return false;
        }

        // Get request and employee details
        $stmt = $pdo->prepare("
            SELECT 
                lr.*,
                e.first_name, e.last_name, e.employee_code, e.email,
                lt.name as leave_type_name
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.id = ?
        ");
        $stmt->execute([$request_id]);
        $request = $stmt->fetch();

        if (!$request) {
            error_log("[Email Helper] Leave request not found: $request_id");
            return false;
        }

        if (!$request['email']) {
            error_log("[Email Helper] Employee email not found for request: $request_id");
            return false;
        }

        error_log("[Email Helper] Sending leave rejected by HR notification to employee: {$request['email']}");

        $subject = "❌ วันลาของคุณถูกปฏิเสธโดย HR";
        $body = "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
            </head>
            <body style='font-family: \"Sarabun\", Arial, sans-serif; padding: 20px; background: #f5f5f5;'>
                <div style='max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                    <div style='text-align: center; margin-bottom: 30px;'>
                        <div style='font-size: 60px; margin-bottom: 10px;'>❌</div>
                        <h2 style='color: #F44336; margin: 0;'>วันลาถูกปฏิเสธโดย HR</h2>
                    </div>
                    
                    <p style='color: #333; line-height: 1.6; margin-bottom: 20px;'>
                        เรียน คุณ{$request['first_name']} {$request['last_name']},
                    </p>
                    
                    <p style='color: #333; line-height: 1.6; margin-bottom: 20px;'>
                        คำขอลาของคุณถูกปฏิเสธโดยแผนกทรัพยากรบุคคล (HR)
                    </p>
                    
                    <div style='background: #FFEBEE; padding: 20px; border-radius: 8px; border-left: 4px solid #F44336; margin: 20px 0;'>
                        <h3 style='color: #C62828; margin: 0 0 15px 0; font-size: 16px;'>รายละเอียดการลา:</h3>
                        <table style='width: 100%; color: #333; font-size: 14px;'>
                            <tr>
                                <td style='padding: 8px 0;'><strong>ประเภทการลา:</strong></td>
                                <td style='padding: 8px 0;'>{$request['leave_type_name']}</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>วันที่ลา:</strong></td>
                                <td style='padding: 8px 0;'>" . date('d/m/Y', strtotime($request['start_date'])) . " - " . date('d/m/Y', strtotime($request['end_date'])) . "</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>จำนวนวัน:</strong></td>
                                <td style='padding: 8px 0;'>{$request['total_days']} วัน</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>สถานะ:</strong></td>
                                <td style='padding: 8px 0;'><span style='color: #F44336; font-weight: bold;'>ปฏิเสธการลา</span></td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style='background: #FFF3E0; padding: 15px; border-radius: 8px; border-left: 4px solid #FF9800; margin: 20px 0;'>
                        <h3 style='color: #E65100; margin: 0 0 10px 0; font-size: 15px;'>เหตุผลในการปฏิเสธ:</h3>
                        <p style='color: #333; margin: 0; line-height: 1.6;'>" . nl2br(htmlspecialchars($reject_reason)) . "</p>
                    </div>
                    
                    <p style='color: #666; font-size: 14px; margin-top: 20px; line-height: 1.6;'>
                        หากมีข้อสงสัยเกี่ยวกับการปฏิเสธนี้ กรุณาติดต่อแผนก HR โดยตรง
                    </p>
                    
                    <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;'>
                        <p>ส่งจากระบบ HR Lanto</p>
                        <p>วันที่: " . date('d/m/Y H:i:s') . "</p>
                    </div>
                </div>
            </body>
            </html>
        ";

        $result = sendEmailWithSMTP($config, $request['email'], $subject, $body);

        if ($result['success']) {
            error_log("[Email Helper] Leave rejected by HR notification sent successfully to: {$request['email']}");
        }
        else {
            error_log("[Email Helper] Failed to send leave rejected by HR notification: {$result['message']}");
        }

        return $result['success'];

    }
    catch (Exception $e) {
        error_log("[Email Helper] Exception in sendLeaveRejectedByHRNotification: " . $e->getMessage());
        return false;
    }
}

/**
 * ส่งอีเมลแจ้งเตือนสลิปเงินเดือนใหม่
 * @param PDO $pdo Database connection
 * @param int $payslip_id Payslip ID
 * @return bool true if email sent successfully, false otherwise
 */
/**
 * ส่งอีเมลแจ้งเตือนสลิปเงินเดือนใหม่
 * @param PDO $pdo Database connection
 * @param int $payslip_id Payslip ID
 * @return bool true if email sent successfully, false otherwise
 */
function sendPayslipNotification($pdo, $payslip_id)
{
    try {
        error_log("[Email Helper] Starting sendPayslipNotification for payslip ID: $payslip_id");

        // Get email config
        $config = getEmailConfig($pdo);
        if (!$config) {
            error_log('[Email Helper] Email config not found or incomplete. Please configure SMTP settings.');
            return false;
        }

        // Get payslip and employee details
        $stmt = $pdo->prepare("
            SELECT 
                p.*,
                e.first_name, e.last_name, e.employee_code, e.email,
                d.name as department_name
            FROM payslips p
            JOIN employees e ON p.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE p.id = ?
        ");
        $stmt->execute([$payslip_id]);
        $payslip = $stmt->fetch();

        if (!$payslip) {
            error_log("[Email Helper] Payslip not found: $payslip_id");
            return false;
        }

        if (!$payslip['email']) {
            error_log("[Email Helper] Employee email not found for payslip: $payslip_id");
            return false;
        }

        error_log("[Email Helper] Sending payslip notification to employee: {$payslip['email']}");

        // Generate simple token for email link (compatible with view_payslip.php)
        $token = md5($payslip_id . 'payslip' . 'secret_key');
        $view_url = BASE_URL . "view_payslip.php?id=" . $payslip_id . "&token=" . $token;

        // Format month
        $thai_months = [
            1 => 'มกราคม', 2 => 'กุมภาพันธ์', 3 => 'มีนาคม', 4 => 'เมษายน',
            5 => 'พฤษภาคม', 6 => 'มิถุนายน', 7 => 'กรกฎาคม', 8 => 'สิงหาคม',
            9 => 'กันยายน', 10 => 'ตุลาคม', 11 => 'พฤศจิกายน', 12 => 'ธันวาคม'
        ];
        $date = new DateTime($payslip['payment_date']);
        $month = (int)$date->format('m');
        $year = (int)$date->format('Y') + 543;
        $month_year = $thai_months[$month] . ' ' . $year;

        $subject = "📄 สลิปเงินเดือนประจำเดือน {$month_year} - {$payslip['first_name']} {$payslip['last_name']}";
        $body = "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
            </head>
            <body style='font-family: \"Sarabun\", Arial, sans-serif; padding: 20px; background: #f5f5f5;'>
                <div style='max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                    <div style='text-align: center; margin-bottom: 30px;'>
                        <div style='font-size: 60px; margin-bottom: 10px;'>📄</div>
                        <h2 style='color: #FF6B35; margin: 0;'>สลิปเงินเดือนใหม่</h2>
                        <p style='color: #666; font-size: 18px; margin-top: 5px;'>ประจำเดือน {$month_year}</p>
                    </div>
                    
                    <p style='color: #333; line-height: 1.6; margin-bottom: 20px;'>
                        เรียน คุณ{$payslip['first_name']} {$payslip['last_name']},
                    </p>
                    
                    <p style='color: #333; line-height: 1.6; margin-bottom: 20px;'>
                        สลิปเงินเดือนประจำเดือน <strong>{$month_year}</strong> ได้ถูกออกให้เรียบร้อยแล้ว
                    </p>
                    
                    <div style='background: #FFF3E0; padding: 20px; border-radius: 8px; border-left: 4px solid #FF6B35; margin: 20px 0;'>
                        <h3 style='color: #E65100; margin: 0 0 15px 0; font-size: 16px;'>รายละเอียดเบื้องต้น:</h3>
                        <table style='width: 100%; color: #333; font-size: 14px;'>
                            <tr>
                                <td style='padding: 8px 0;'><strong>ชื่อ-นามสกุล:</strong></td>
                                <td style='padding: 8px 0;'>{$payslip['first_name']} {$payslip['last_name']}</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>รหัสพนักงาน:</strong></td>
                                <td style='padding: 8px 0;'>{$payslip['employee_code']}</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>แผนก:</strong></td>
                                <td style='padding: 8px 0;'>" . ($payslip['department_name'] ?? '-') . "</td>
                            </tr>
                            <tr>
                                <td style='padding: 8px 0;'><strong>วันที่จ่าย:</strong></td>
                                <td style='padding: 8px 0;'>" . date('d/m/Y', strtotime($payslip['payment_date'])) . "</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style='text-align: center; margin-top: 30px; margin-bottom: 30px;'>
                        <a href='{$view_url}' style='display: inline-block; padding: 12px 30px; background: #FF6B35; color: white; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(255, 107, 53, 0.3);'>
                            เข้าสู่เว็บไซต์เพื่อดูรายละเอียด
                        </a>
                    </div>
                    
                    <p style='color: #666; font-size: 14px; margin-top: 20px; line-height: 1.6;'>
                        คุณสามารถดูรายละเอียดเพิ่มเติมและดาวน์โหลดสลิปเงินเดือนฉบับเต็มได้ที่เว็บไซต์
                    </p>
                    
                    <div style='background: #FFF3E0; padding: 15px; border-radius: 8px; border-left: 4px solid #FF9800; margin: 20px 0;'>
                        <p style='color: #E65100; margin: 0; font-weight: bold; font-size: 14px;'>⚠️ ข้อควรทราบ:</p>
                        <p style='color: #333; margin: 8px 0 0 0; line-height: 1.5; font-size: 13px;'>
                            Link นี้จะหมดอายุภายใน 24 ชั่วโมง หากเกินระยะเวลาให้ดูที่แอพ HR Lanto แทน
                        </p>
                    </div>
                    
                    <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;'>
                        <p>ส่งจากระบบ HR Lanto</p>
                        <p>วันที่: " . date('d/m/Y H:i:s') . "</p>
                    </div>
                </div>
            </body>
            </html>
        ";

        $result = sendEmailWithSMTP($config, $payslip['email'], $subject, $body);

        if ($result['success']) {
            error_log("[Email Helper] Payslip notification sent successfully to: {$payslip['email']}");
        }
        else {
            error_log("[Email Helper] Failed to send payslip notification: {$result['message']}");
        }

        return $result['success'];

    }
    catch (Exception $e) {
        error_log("[Email Helper] Exception in sendPayslipNotification: " . $e->getMessage());
        return false;
    }
}
