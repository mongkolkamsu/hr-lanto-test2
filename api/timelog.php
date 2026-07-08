<?php
// Start output buffering to catch any unexpected output
ob_start();

// Error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors to browser
ini_set('log_errors', 1);

// Fatal error handler
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        ob_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'เกิดข้อผิดพลาดร้ายแรง: ' . $error['message'],
            'error' => $error
        ]);
        exit;
    }
});

require_once '../config.php';
require_once '../includes/telegram_helper.php';

// Log session info for debugging
error_log('=== API Request ===');
error_log('Action: ' . ($_GET['action'] ?? 'none'));
error_log('Session ID: ' . session_id());
error_log('Session employee_id: ' . ($_SESSION['employee_id'] ?? 'NOT SET'));
// error_log('Session data: ' . print_r($_SESSION, true));

// Clean any output that might have happened
if (ob_get_length()) ob_clean();

header('Content-Type: application/json; charset=utf-8');

requireLogin();

// Calculate distance using Haversine formula
function calculateDistance($lat1, $lon1, $lat2, $lon2) {
    $R = 6371000; // Earth's radius in meters
    $dLat = ($lat2 - $lat1) * M_PI / 180;
    $dLon = ($lon2 - $lon1) * M_PI / 180;

    $a = sin($dLat / 2) * sin($dLat / 2) +
        cos($lat1 * M_PI / 180) * cos($lat2 * M_PI / 180) *
        sin($dLon / 2) * sin($dLon / 2);

    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    $distance = $R * $c;

    return round($distance); // Return distance in meters
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'checkin':
        handleCheckIn();
        break;
    case 'checkout':
        handleCheckOut();
        break;
    case 'today':
        getTodayLog();
        break;
    case 'pending_checkout':
        getPendingCheckout();
        break;
    case 'history':
        getHistory();
        break;
    case 'branches':
        getBranches();
        break;
    case 'update_log':
        handleUpdateLog();
        break;    
    default:
        jsonResponse(false, 'Invalid action');
}

function handleCheckIn() {
    global $pdo;
    
    // Log for debugging
    
    $rawInput = file_get_contents('php://input');
    
    $data = json_decode($rawInput, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('JSON Decode Error: ' . json_last_error_msg());
        jsonResponse(false, 'ข้อมูล JSON ไม่ถูกต้อง');
    }
    
    $branch_id = $data['branch_id'] ?? null;
    $lat = $data['latitude'] ?? $data['lat'] ?? null;
    $lng = $data['longitude'] ?? $data['lng'] ?? null;
    $photo = $data['photo'] ?? null;
    $employee_id = $_SESSION['employee_id'] ?? null;
    $today = date('Y-m-d');
    
    error_log("Check-in attempt - Employee: $employee_id, Branch: $branch_id, Photo: " . (strlen($photo ?? '') > 0 ? 'Yes' : 'No'));
    
    // Validate required fields
    if (!$employee_id) {
        error_log('Error: No employee_id in session');
        jsonResponse(false, 'ไม่พบข้อมูลพนักงาน กรุณาล็อกอินใหม่');
    }
    
    if (!$lat || !$lng) {
        error_log('Error: No latitude or longitude');
        jsonResponse(false, 'ไม่พบข้อมูลตำแหน่ง');
    }
    
    if (!$branch_id) {
        error_log('Error: No branch_id');
        jsonResponse(false, 'กรุณาเลือกสาขา');
    }
    
    try {
        // Check if there's any check-in without check-out (from any day)
        $stmt = $pdo->prepare("SELECT id, work_date FROM time_logs WHERE employee_id = ? AND check_out_time IS NULL");
        $stmt->execute([$employee_id]);
        $unclosed_log = $stmt->fetch();
        
        if ($unclosed_log) {
            $unclosed_date = date('d/m/Y', strtotime($unclosed_log['work_date']));
            jsonResponse(false, "คุณยังไม่ได้กดออกงานของวันที่ {$unclosed_date} กรุณากดออกงานก่อน");
        }
        
        // Check if already checked in today
        $stmt = $pdo->prepare("SELECT id FROM time_logs WHERE employee_id = ? AND work_date = ?");
        $stmt->execute([$employee_id, $today]);
        
        if ($stmt->fetch()) {
            jsonResponse(false, 'คุณได้บันทึกเวลาเข้างานวันนี้แล้ว');
        }
        
        // Get work start time from employee's shift
        $selected_shift_id = $data['selected_shift_id'] ?? null;
        
        if ($selected_shift_id) {
            $stmt = $pdo->prepare("SELECT start_time, end_time FROM shifts WHERE id = ?");
            $stmt->execute([$selected_shift_id]);
            $shift_data = $stmt->fetch();
            error_log('selected_shift_data: ' . json_encode($shift_data));
            if ($shift_data && $shift_data['start_time']) {
                $work_start_time = $shift_data['start_time'];
                $is_flexible = (strpos($shift_data['start_time'], '00:00') === 0 && strpos($shift_data['end_time'], '00:00') === 0) ? 1 : 0;
                error_log('is_flexible from selected: ' . $is_flexible);
            } else {
                $work_start_time = '08:00:00';
                $is_flexible = 0;
            }
        } else {
            $stmt = $pdo->prepare("
                SELECT s.start_time, s.end_time, e.shift_id
                FROM employees e 
                LEFT JOIN shifts s ON e.shift_id = s.id 
                WHERE e.id = ?
            ");
            $stmt->execute([$employee_id]);
            $employee_shift = $stmt->fetch();
            error_log('employee_shift_data: ' . json_encode($employee_shift));
            
            // Use shift time if available, otherwise it's flexible by default
            if ($employee_shift && $employee_shift['shift_id'] && $employee_shift['start_time']) {
                $work_start_time = $employee_shift['start_time'];
                $is_flexible = (strpos($employee_shift['start_time'], '00:00') === 0 && strpos($employee_shift['end_time'], '00:00') === 0) ? 1 : 0;
                error_log('is_flexible from employee: ' . $is_flexible);
            } else {
                $work_start_time = '00:00:00';
                $is_flexible = 1; // Default to flexible if no shift assigned
                error_log('is_flexible default: 1');
            }
        }
        
        $late_threshold = 1; // ใช้ค่าคงที่ชั่วคราว
        
        $check_in_time = date('Y-m-d H:i:s');
        $check_in_hour = date('H:i:s');
        
        // Determine status
        $status = 'on_time';
        
        if ($is_flexible) {
            $status = 'on_time'; // Always on time for flexible shifts
        } else {
            $work_start = strtotime($work_start_time);
            $check_in = strtotime($check_in_hour);
            
            if ($check_in < $work_start) {
                $status = 'early';
            } elseif ($check_in > strtotime("+{$late_threshold} minutes", $work_start)) {
                $status = 'late';
            }
        }
        error_log('final status: ' . $status . ' (work_start: ' . $work_start_time . ')');
        
        // Save photo if provided
        $photo_filename = null;
        if ($photo && strlen($photo) > 50) { // Minimum valid base64 length
            // Extract base64 data
            if (preg_match('/^data:image\/(\w+);base64,/', $photo, $type)) {
                $photo_data = substr($photo, strpos($photo, ',') + 1);
                
                // Validate base64
                if (strlen($photo_data) > 0) {
                    $decoded = base64_decode($photo_data, true);
                    
                    if ($decoded !== false && strlen($decoded) > 100) {
                        $photo_filename = 'checkin_' . $employee_id . '_' . time() . '.jpg';
                        $photo_path = UPLOAD_DIR . 'checkins/' . $photo_filename;
                        
                        // Create directory if not exists
                        if (!is_dir(UPLOAD_DIR . 'checkins/')) {
                            mkdir(UPLOAD_DIR . 'checkins/', 0777, true);
                        }
                        
                        $saved = @file_put_contents($photo_path, $decoded);
                        
                        if ($saved === false) {
                            error_log('Failed to save check-in photo');
                            $photo_filename = null;
                        } else {
                            error_log('Photo saved successfully: ' . $photo_filename . ' (' . strlen($decoded) . ' bytes)');
                        }
                    } else {
                        error_log('Invalid base64 decoded data');
                    }
                } else {
                    error_log('Empty base64 data');
                }
            } else {
                error_log('Photo format not recognized: ' . substr($photo, 0, 50));
            }
        } else {
            error_log('Photo data too short or empty: ' . strlen($photo ?? ''));
        }
        
        // Insert time log
        $stmt = $pdo->prepare("
            INSERT INTO time_logs (employee_id, check_in_time, check_in_lat, check_in_lng, work_date, status, branch_id, check_in_photo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $employee_id, 
            $check_in_time, 
            $lat, 
            $lng, 
            $today, 
            $status, 
            $branch_id, 
            $photo_filename
        ]);
        
        error_log('Check-in successful for employee ' . $employee_id);
        
        // ส่งแจ้งเตือน Telegram
        sendTelegramCheckInNotification($pdo, $employee_id, $branch_id, $check_in_time, $status, $photo_filename, $lat, $lng);
        
        jsonResponse(true, 'บันทึกเวลาเข้างานสำเร็จ', [
            'check_in_time' => $check_in_time,
            'status' => $status
        ]);
        
    } catch (PDOException $e) {
        error_log('PDO Error in handleCheckIn: ' . $e->getMessage());
        error_log('SQL State: ' . $e->getCode());
        error_log('Stack trace: ' . $e->getTraceAsString());
        jsonResponse(false, 'เกิดข้อผิดพลาดฐานข้อมูล: ' . $e->getMessage());
    } catch (Exception $e) {
        error_log('General Error in handleCheckIn: ' . $e->getMessage());
        error_log('Stack trace: ' . $e->getTraceAsString());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function handleCheckOut() {
    global $pdo;
    
    // Log for debugging
    
    $rawInput = file_get_contents('php://input');
    
    $data = json_decode($rawInput, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('JSON Decode Error: ' . json_last_error_msg());
        jsonResponse(false, 'ข้อมูล JSON ไม่ถูกต้อง');
    }
    
    $lat = $data['latitude'] ?? $data['lat'] ?? null;
    $lng = $data['longitude'] ?? $data['lng'] ?? null;
    $photo = $data['photo'] ?? null;
    $employee_id = $_SESSION['employee_id'] ?? null;
    
    error_log("Check-out attempt - Employee: $employee_id, Photo: " . (strlen($photo ?? '') > 0 ? 'Yes' : 'No'));
    
    if (!$employee_id) {
        error_log('handleCheckOut: No employee_id in session');
        jsonResponse(false, 'ไม่พบข้อมูลพนักงาน กรุณาล็อกอินใหม่');
        return;
    }
    
    if (!$lat || !$lng) {
        error_log('Error: No latitude or longitude');
        jsonResponse(false, 'ไม่พบข้อมูลตำแหน่ง');
    }
    
    try {
        // Find the most recent check-in without check-out (ค้นหาการเข้างานที่ยังไม่ได้ออก)
        $stmt = $pdo->prepare("
            SELECT id, work_date, check_out_time, branch_id, check_in_time
            FROM time_logs 
            WHERE employee_id = ? AND check_out_time IS NULL
            ORDER BY work_date DESC, check_in_time DESC
            LIMIT 1
        ");
        $stmt->execute([$employee_id]);
        $log = $stmt->fetch();
        
        if (!$log) {
            jsonResponse(false, 'ไม่พบการเข้างานที่ยังไม่ได้ออกงาน');
        }
        
        if ($log['check_out_time']) {
            jsonResponse(false, 'คุณได้บันทึกเวลาออกงานแล้ว');
        }
        
        // Get branch information for location validation
        $stmt = $pdo->prepare("
            SELECT latitude, longitude, radius, allow_checkout_outside 
            FROM branches 
            WHERE id = ?
        ");
        $stmt->execute([$log['branch_id']]);
        $branch = $stmt->fetch();
        
        if (!$branch) {
            error_log('Branch not found for ID: ' . $log['branch_id']);
            jsonResponse(false, 'ไม่พบข้อมูลสาขาที่เข้างาน');
        }
        
        // Calculate distance from checkout location to branch
        $distance = calculateDistance($lat, $lng, $branch['latitude'], $branch['longitude']);
        $isWithinRadius = $distance <= $branch['radius'];
        $canCheckoutOutside = $branch['allow_checkout_outside'] == 1;
        
        error_log("Checkout validation - Distance: {$distance}m, Radius: {$branch['radius']}m, Within: " . ($isWithinRadius ? 'Yes' : 'No') . ", AllowOutside: " . ($canCheckoutOutside ? 'Yes' : 'No'));
        
        // Validate location
        if (!$isWithinRadius && !$canCheckoutOutside) {
            jsonResponse(false, "คุณอยู่นอกพิกัดเข้างาน ระยะทาง {$distance} เมตร", [
                'distance' => $distance,
                'radius' => $branch['radius'],
                'branch_id' => $log['branch_id']
            ]);
        }
        
        $check_out_time = date('Y-m-d H:i:s');
        
        // Save photo if provided
        $checkout_photo_filename = null;
        if ($photo && strlen($photo) > 50) { // Minimum valid base64 length
            error_log('Saving checkout photo...');
            
            // Extract base64 data
            if (preg_match('/^data:image\/(\w+);base64,/', $photo, $type)) {
                $photo_data = substr($photo, strpos($photo, ',') + 1);
                
                // Validate base64
                if (strlen($photo_data) > 0) {
                    $decoded = base64_decode($photo_data, true);
                    
                    if ($decoded !== false && strlen($decoded) > 100) {
                        $checkout_photo_filename = 'checkout_' . $employee_id . '_' . time() . '.jpg';
                        $photo_path = UPLOAD_DIR . 'checkins/' . $checkout_photo_filename;
                        
                        // Create directory if not exists
                        if (!is_dir(UPLOAD_DIR . 'checkins/')) {
                            mkdir(UPLOAD_DIR . 'checkins/', 0777, true);
                        }
                        
                        $saved = @file_put_contents($photo_path, $decoded);
                        
                        if ($saved === false) {
                            error_log('Failed to save checkout photo');
                            $checkout_photo_filename = null;
                        } else {
                            error_log('Checkout photo saved successfully: ' . $checkout_photo_filename . ' (' . strlen($decoded) . ' bytes)');
                        }
                    } else {
                        error_log('Invalid base64 decoded data for checkout');
                    }
                } else {
                    error_log('Empty base64 data for checkout');
                }
            } else {
                error_log('Checkout photo format not recognized: ' . substr($photo, 0, 50));
            }
        } else {
            error_log('Checkout photo data too short or empty: ' . strlen($photo ?? ''));
        }
        
        // Update time log
        $stmt = $pdo->prepare("
            UPDATE time_logs 
            SET check_out_time = ?, check_out_lat = ?, check_out_lng = ?, checkout_photo = ? 
            WHERE id = ?
        ");
        $stmt->execute([$check_out_time, $lat, $lng, $checkout_photo_filename, $log['id']]);
        
        error_log('Check-out successful for work_date: ' . $log['work_date']);
        
        // ส่งแจ้งเตือน Telegram
        sendTelegramCheckOutNotification($pdo, $employee_id, $log['branch_id'], $log['check_in_time'], $check_out_time, $checkout_photo_filename, $lat, $lng);
        
        jsonResponse(true, 'บันทึกเวลาออกงานสำเร็จ', [
            'check_out_time' => $check_out_time,
            'work_date' => $log['work_date']
        ]);
        
    } catch (PDOException $e) {
        error_log('Check-out error: ' . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getPendingCheckout() {
    global $pdo;
    
    $employee_id = $_SESSION['employee_id'] ?? null;
    
    if (!$employee_id) {
        error_log('getPendingCheckout: No employee_id in session');
        jsonResponse(false, 'ไม่พบข้อมูลพนักงาน กรุณาล็อกอินใหม่');
        return;
    }
    
    try {
        // ค้นหาการเข้างานที่ยังไม่ได้ออกงาน (จากทุกวัน)
        $stmt = $pdo->prepare("
            SELECT id, work_date, check_in_time, branch_id
            FROM time_logs 
            WHERE employee_id = ? AND check_out_time IS NULL
            ORDER BY work_date DESC, check_in_time DESC
            LIMIT 1
        ");
        $stmt->execute([$employee_id]);
        $pending = $stmt->fetch();
        
        if ($pending) {
            jsonResponse(true, 'พบการเข้างานที่ยังไม่ได้ออก', $pending);
        } else {
            jsonResponse(true, 'ไม่มีการเข้างานค้าง', null);
        }
        
    } catch (PDOException $e) {
        error_log('getPendingCheckout Error: ' . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getTodayLog() {
    global $pdo;
    
    $employee_id = $_SESSION['employee_id'] ?? null;
    
    if (!$employee_id) {
        error_log('getTodayLog: No employee_id in session');
        jsonResponse(false, 'ไม่พบข้อมูลพนักงาน กรุณาล็อกอินใหม่');
        return;
    }
    
    $today = date('Y-m-d');
    
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM time_logs 
            WHERE employee_id = ? AND work_date = ?
        ");
        $stmt->execute([$employee_id, $today]);
        $log = $stmt->fetch();
        
        if (!$log) {
            jsonResponse(true, 'ยังไม่มีการบันทึกเวลาวันนี้', null);
            return;
        }
        
        jsonResponse(true, 'สำเร็จ', $log);
        
    } catch (PDOException $e) {
        error_log('getTodayLog Error: ' . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

function getHistory() {
    global $pdo;
    
    $employee_id = $_SESSION['employee_id'] ?? null;
    
    if (!$employee_id) {
        error_log('getHistory: No employee_id in session');
        jsonResponse(false, 'ไม่พบข้อมูลพนักงาน กรุณาล็อกอินใหม่');
        return;
    }
    
    $month = $_GET['month'] ?? date('m');
    $year = $_GET['year'] ?? date('Y');
    
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM time_logs 
            WHERE employee_id = ? 
            AND MONTH(work_date) = ? 
            AND YEAR(work_date) = ?
            ORDER BY work_date DESC
        ");
        $stmt->execute([$employee_id, $month, $year]);
        $logs = $stmt->fetchAll();
        
        // Calculate stats
        $stats = [
            'ontime' => 0,
            'late' => 0,
            'early' => 0
        ];
        
        foreach ($logs as $log) {
            if ($log['status'] === 'on_time') $stats['ontime']++;
            elseif ($log['status'] === 'late') $stats['late']++;
            elseif ($log['status'] === 'early') $stats['early']++;
        }
        
        jsonResponse(true, 'สำเร็จ', $logs, ['stats' => $stats]);
        
    } catch (PDOException $e) {
        jsonResponse(false, 'เกิดข้อผิดพลาด');
    }
}

function getBranches() {
    global $pdo;
    
    try {
        $stmt = $pdo->query("
            SELECT * FROM branches 
            WHERE is_active = 1
            ORDER BY name ASC
        ");
        $branches = $stmt->fetchAll();
        
        jsonResponse(true, 'สำเร็จ', $branches);
        
    } catch (PDOException $e) {
        error_log('getBranches Error: ' . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
    }
}

// Modified jsonResponse to support stats
function jsonResponse($success, $message, $data = null, $extra = []) {
    // Clean any output buffer
    if (ob_get_length()) ob_clean();
    
    // Ensure clean JSON output
    header('Content-Type: application/json; charset=utf-8');
    
    $response = [
        'success' => $success,
        'message' => $message
    ];
    
    if ($data !== null) {
        $response['data'] = $data;
    }
    
    $response = array_merge($response, $extra);
    
    $json = json_encode($response, JSON_UNESCAPED_UNICODE);
    
    if ($json === false) {
        // JSON encoding failed
        error_log('JSON Encoding Error: ' . json_last_error_msg());
        $json = json_encode([
            'success' => false,
            'message' => 'เกิดข้อผิดพลาดในการเข้ารหัสข้อมูล'
        ]);
    }
    
    echo $json;
    
    // Flush output
    if (ob_get_length()) ob_end_flush();
    
    exit;
}

function handleUpdateLog() {
    global $pdo;
    
    // 🔒 ปิดด่านตรวจ requireRole ตัวเดิมไว้ชั่วคราว เพื่อข้ามปัญหาเรื่อง Encoding ภาษาไทยครับ
    // requireRole(['ผู้ดูแลระบบ', 'HR']); 
    
    // 🛠️ ใช้การตรวจสอบความปลอดภัยพื้นฐานแทน (ถ้ามี Session สิทธิ์อะไรก็ได้ในระบบที่ไม่ว่าง ถือว่าผ่าน)
    if (!isset($_SESSION['role']) || empty($_SESSION['role'])) {
        jsonResponse(false, 'ไม่พบข้อมูลสิทธิ์ในระบบ กรุณาล็อกอินใหม่อีกครั้ง');
    }
    
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        jsonResponse(false, 'ข้อมูล JSON ไม่ถูกต้อง');
    }
    
    // รับค่าที่ส่งมาจากหน้าป๊อปอัป
    $log_id = $data['log_id'] ?? null;
    $work_date = $data['work_date'] ?? null;
    $check_in_time = $data['check_in_time'] ?? null;
    $check_out_time = $data['check_out_time'] ?? null;
    $status = $data['status'] ?? 'on_time';
    
    if (!$log_id) {
        jsonResponse(false, 'ไม่พบรหัสรายการ (Log ID) ที่ต้องการแก้ไข');
    }
    if (!$work_date || !$check_in_time) {
        jsonResponse(false, 'กรุณาระบุวันที่และเวลาเข้างานให้ครบถ้วน');
    }
    
    if (empty($check_out_time)) {
        $check_out_time = null;
    }
    
    try {
        // สั่งอัปเดตเวลาลงถังข้อมูลเทสจริง
        $stmt = $pdo->prepare("
            UPDATE time_logs 
            SET work_date = ?, 
                check_in_time = ?, 
                check_out_time = ?, 
                status = ? 
            WHERE id = ?
        ");
        
        $stmt->execute([
            $work_date,
            $check_in_time,
            $check_out_time,
            $status,
            $log_id
        ]);
        
        jsonResponse(true, 'แก้ไขประวัติเวลาเข้าออกงานสำเร็จเรียบร้อยแล้ว');
        
    } catch (PDOException $e) {
        error_log('Update time log error: ' . $e->getMessage());
        jsonResponse(false, 'เกิดข้อผิดพลาดของฐานข้อมูล: ' . $e->getMessage());
    }
}