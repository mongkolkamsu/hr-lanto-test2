<?php
require_once 'config.php';

$id = $_GET['id'] ?? '';
$token = $_GET['token'] ?? '';
$error = '';
$success = false;

if (empty($id) || empty($token)) {
    $error = 'ลิงก์ไม่ถูกต้อง';
} else {
    try {
        $stmt = $pdo->prepare("SELECT id, password FROM employees WHERE id = ?");
        $stmt->execute([$id]);
        $employee = $stmt->fetch();

        if ($employee) {
            $secret = "HR_LANTO_RESET_SECRET_KEY"; 
            $expected_token = md5($employee['id'] . $employee['password'] . $secret);

            if ($token === $expected_token) {
                // Token Valid - Reset Password
                $new_password = password_hash('1234', PASSWORD_DEFAULT);
                
                // Update password and force change on next login
                $update = $pdo->prepare("UPDATE employees SET password = ?, force_password_change = 1 WHERE id = ?");
                $update->execute([$new_password, $id]);
                
                $success = true;
            } else {
                $error = 'ลิงก์หมดอายุหรือใช้งานไปแล้ว';
            }
        } else {
            $error = 'ไม่พบข้อมูลผู้ใช้งาน';
        }
    } catch (PDOException $e) {
        $error = 'เกิดข้อผิดพลาด: ' . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>รีเซ็ทรหัสผ่าน - HR Lanto</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600&display=swap');
        
        body {
            background-color: #FF6B35;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: 'Kanit', sans-serif;
        }
        .reset-container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }
        .icon-circle {
            width: 80px;
            height: 80px;
            background: #FF6B35;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 20px;
            color: white;
            font-size: 40px;
            box-shadow: 0 4px 10px rgba(255, 107, 53, 0.3);
        }
        .btn-login {
            display: inline-block;
            background: #FF6B35;
            color: white;
            padding: 12px 30px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: bold;
            margin-top: 20px;
            transition: all 0.3s;
            box-shadow: 0 4px 6px rgba(255, 107, 53, 0.2);
        }
        .btn-login:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(255, 107, 53, 0.3);
        }
    </style>
</head>
<body>
    <div class="reset-container">
        <?php if ($success): ?>
            <div class="icon-circle">✓</div>
            <h2 style="color: #FF6B35; margin-bottom: 10px;">รีเซ็ทรหัสผ่านสำเร็จ</h2>
            <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">
                รหัสผ่านของคุณถูกรีเซ็ตเป็น <strong>1234</strong> เรียบร้อยแล้ว<br>
                กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่
            </p>
            <a href="index.html" class="btn-login">เข้าสู่ระบบ</a>
        <?php else: ?>
            <div class="icon-circle" style="background: #dc3545; box-shadow: 0 4px 10px rgba(220, 53, 69, 0.3);">✕</div>
            <h2 style="color: #dc3545; margin-bottom: 10px;">เกิดข้อผิดพลาด</h2>
            <p style="color: #666; margin-bottom: 20px;">
                <?php echo htmlspecialchars($error); ?>
            </p>
            <a href="index.html" class="btn-login" style="background: #666; box-shadow: none;">กลับหน้าหลัก</a>
        <?php endif; ?>
    </div>
</body>
</html>
