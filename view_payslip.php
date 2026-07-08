<?php
require_once 'config.php';

$payslip_id = $_GET['id'] ?? '';
$token = $_GET['token'] ?? '';
$action = $_GET['action'] ?? '';

// Verify token
$expected_token = md5($payslip_id . 'payslip' . 'secret_key');
if ($token !== $expected_token) {
    die('Invalid token - การเข้าถึงไม่ถูกต้อง');
}

// Get payslip details
try {
    $stmt = $pdo->prepare("
        SELECT 
            p.*,
            e.first_name, e.last_name, e.employee_code,
            d.name as department_name
        FROM payslips p
        JOIN employees e ON p.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE p.id = ?
    ");
    $stmt->execute([$payslip_id]);
    $payslip = $stmt->fetch();
    
    if (!$payslip) {
        die('Payslip not found - ไม่พบข้อมูลสลิปเงินเดือน');
    }
    
    // Check file existence
    require_once 'includes/file_paths.php';
    $filepath = PAYSLIP_PATH . '/' . $payslip['file_path'];
    
    if ($action === 'download') {
        if (!file_exists($filepath)) {
            die('File not found');
        }
        
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="payslip_' . $payslip['id'] . '.pdf"');
        header('Content-Length: ' . filesize($filepath));
        readfile($filepath);
        exit;
    }
    
    $file_exists = file_exists($filepath);
    
    // Format date
    $thai_months = [
        1 => 'มกราคม', 2 => 'กุมภาพันธ์', 3 => 'มีนาคม', 4 => 'เมษายน', 
        5 => 'พฤษภาคม', 6 => 'มิถุนายน', 7 => 'กรกฎาคม', 8 => 'สิงหาคม', 
        9 => 'กันยายน', 10 => 'ตุลาคม', 11 => 'พฤศจิกายน', 12 => 'ธันวาคม'
    ];
    $date = new DateTime($payslip['payment_date']);
    $month = (int)$date->format('m');
    $year = (int)$date->format('Y') + 543;
    $month_year = $thai_months[$month] . ' ' . $year;
    
} catch (PDOException $e) {
    die('Database error: ' . $e->getMessage());
}
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>สลิปเงินเดือน - <?php echo htmlspecialchars($payslip['first_name'] . ' ' . $payslip['last_name']); ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/style.css">
    <style>
        body {
            background-color: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .payslip-container {
            background: white;
            border-radius: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            padding: 30px;
            text-align: center;
        }
        .payslip-header {
            margin-bottom: 30px;
        }
        .payslip-header h1 {
            color: var(--primary-color);
            font-size: 1.5rem;
            margin-bottom: 10px;
        }
        .employee-info {
            text-align: left;
            background: #f9f9f9;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .info-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        .info-label {
            color: #666;
            font-weight: 500;
        }
        .info-value {
            color: #333;
            font-weight: 600;
        }
        .net-salary {
            font-size: 1.2rem;
            color: var(--primary-color);
        }
        .btn-download {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 12px 30px;
            font-size: 1.1rem;
            border-radius: 50px;
            text-decoration: none;
            width: 100%;
            max-width: 300px;
            background-color: #FF6B35;
            color: white;
            box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
            transition: all 0.3s ease;
        }
        .btn-download:hover {
            background-color: #E65100;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 107, 53, 0.4);
            color: white;
        }
        .error-message {
            color: var(--danger-color);
            background: #ffebee;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="payslip-container">
        <div class="payslip-header">
            <div style="font-size: 40px; margin-bottom: 10px;">📄</div>
            <h1>สลิปเงินเดือน</h1>
            <p style="color: #666;"><?php echo $month_year; ?></p>
        </div>
        
        <div class="employee-info">
            <div class="info-row">
                <span class="info-label">ชื่อ-นามสกุล</span>
                <span class="info-value"><?php echo htmlspecialchars($payslip['first_name'] . ' ' . $payslip['last_name']); ?></span>
            </div>
            <div class="info-row">
                <span class="info-label">รหัสพนักงาน</span>
                <span class="info-value"><?php echo htmlspecialchars($payslip['employee_code']); ?></span>
            </div>
            <div class="info-row">
                <span class="info-label">แผนก</span>
                <span class="info-value"><?php echo htmlspecialchars($payslip['department_name'] ?? '-'); ?></span>
            </div>
            <div class="info-row">
                <span class="info-label">รายได้สุทธิ</span>
                <span class="info-value net-salary"><?php echo number_format($payslip['net_salary'], 2); ?> บาท</span>
            </div>
        </div>
        
        <?php if ($file_exists): ?>
            <a href="view_payslip.php?action=download&id=<?php echo $payslip_id; ?>&token=<?php echo $token; ?>" class="btn btn-primary btn-download">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                ดาวน์โหลดสลิปเงินเดือน
            </a>
            <p style="margin-top: 15px; font-size: 0.9rem; color: #999;">
                ไฟล์อยู่ในรูปแบบ PDF
            </p>
        <?php else: ?>
            <div class="error-message">
                ไม่พบไฟล์เอกสารสลิปเงินเดือน
            </div>
        <?php endif; ?>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <a href="index.html" style="color: #666; text-decoration: none; font-size: 0.9rem;">
                &larr; กลับสู่หน้าหลัก HR Lanto
            </a>
        </div>
    </div>
</body>
</html>
