<?php
/**
 * Telegram Helper - ระบบแจ้งเตือนผ่าน Telegram Bot API
 * 
 * ไฟล์นี้ใช้สำหรับส่งข้อความและรูปภาพไปยังกลุ่ม Telegram
 * รองรับ 2 กลุ่ม: แจ้งเตือนการเข้างาน และ แจ้งเตือนการลา
 */

class TelegramNotifier {
    private $botToken;
    private $timelogChatId;
    private $leaveChatId;
    private $enabled;
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->loadSettings();
    }
    
    /**
     * โหลดการตั้งค่าจาก database
     */
    private function loadSettings() {
        try {
            $settings = [
                'telegram_bot_token' => '',
                'telegram_timelog_chat_id' => '',
                'telegram_leave_chat_id' => '',
                'telegram_enabled' => '0'
            ];
            
            $stmt = $this->pdo->prepare("
                SELECT setting_key, setting_value 
                FROM system_settings 
                WHERE setting_key IN (?, ?, ?, ?)
            ");
            $stmt->execute(array_keys($settings));
            $results = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            
            $this->botToken = $results['telegram_bot_token'] ?? '';
            $this->timelogChatId = $results['telegram_timelog_chat_id'] ?? '';
            $this->leaveChatId = $results['telegram_leave_chat_id'] ?? '';
            $this->enabled = ($results['telegram_enabled'] ?? '0') === '1';
            
        } catch (PDOException $e) {
            error_log('[Telegram Helper] Error loading settings: ' . $e->getMessage());
            $this->enabled = false;
        }
    }
    
    /**
     * ตรวจสอบว่าระบบพร้อมใช้งานหรือไม่
     */
    public function isEnabled() {
        return $this->enabled && !empty($this->botToken);
    }
    
    /**
     * ส่งข้อความไปยัง Telegram
     */
    private function sendMessage($chatId, $message, $parseMode = 'HTML') {
        if (!$this->isEnabled() || empty($chatId)) {
            return ['success' => false, 'message' => 'Telegram not configured'];
        }
        
        $url = "https://api.telegram.org/bot{$this->botToken}/sendMessage";
        
        $data = [
            'chat_id' => $chatId,
            'text' => $message,
            'parse_mode' => $parseMode
        ];
        
        return $this->sendRequest($url, $data);
    }
    
    /**
     * ส่งรูปภาพไปยัง Telegram
     */
    private function sendPhoto($chatId, $photoPath, $caption = '') {
        if (!$this->isEnabled() || empty($chatId)) {
            return ['success' => false, 'message' => 'Telegram not configured'];
        }
        
        if (!file_exists($photoPath)) {
            error_log('[Telegram Helper] Photo file not found: ' . $photoPath);
            return ['success' => false, 'message' => 'Photo file not found'];
        }
        
        $url = "https://api.telegram.org/bot{$this->botToken}/sendPhoto";
        
        $data = [
            'chat_id' => $chatId,
            'photo' => new CURLFile($photoPath),
            'caption' => $caption,
            'parse_mode' => 'HTML'
        ];
        
        return $this->sendRequest($url, $data, true);
    }
    
    /**
     * ส่ง request ไปยัง Telegram API
     */
    private function sendRequest($url, $data, $isMultipart = false) {
        $ch = curl_init();
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        if ($isMultipart) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        } else {
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            error_log('[Telegram Helper] cURL Error: ' . $error);
            return ['success' => false, 'message' => 'cURL Error: ' . $error];
        }
        
        $result = json_decode($response, true);
        
        if ($httpCode === 200 && isset($result['ok']) && $result['ok']) {
            return ['success' => true, 'message' => 'Sent successfully'];
        } else {
            $errorMsg = $result['description'] ?? 'Unknown error';
            error_log('[Telegram Helper] API Error: ' . $errorMsg);
            return ['success' => false, 'message' => $errorMsg];
        }
    }
    
    /**
     * แจ้งเตือนการเข้างาน
     */
    public function notifyCheckIn($employeeData, $photoPath = null) {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'Telegram not enabled'];
        }
        
        $statusText = $this->getStatusText($employeeData['status'] ?? 'on_time');
        $statusEmoji = $this->getStatusEmoji($employeeData['status'] ?? 'on_time');
        
        $message = "🟢 <b>พนักงานเข้างาน</b>\n\n";
        $message .= "👤 <b>ชื่อ:</b> {$employeeData['name']}\n";
        $message .= "🏢 <b>แผนก:</b> {$employeeData['department']}\n";
        $message .= "📍 <b>สาขา:</b> {$employeeData['branch']}\n";
        $message .= "🕐 <b>เวลา:</b> {$employeeData['time']}\n";
        $message .= "📅 <b>วันที่:</b> {$employeeData['date']}\n";
        $message .= "{$statusEmoji} <b>สถานะ:</b> {$statusText}";
        
        // เพิ่ม Google Map Link
        if (!empty($employeeData['lat']) && !empty($employeeData['lng'])) {
            $mapUrl = "https://www.google.com/maps?q={$employeeData['lat']},{$employeeData['lng']}";
            $message .= "\n\n🗺 <a href=\"{$mapUrl}\">📍 ดูตำแหน่งบน Google Map</a>";
        }
        
        if ($photoPath && file_exists($photoPath)) {
            return $this->sendPhoto($this->timelogChatId, $photoPath, $message);
        } else {
            return $this->sendMessage($this->timelogChatId, $message);
        }
    }
    
    /**
     * แจ้งเตือนการออกงาน
     */
    public function notifyCheckOut($employeeData, $photoPath = null) {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'Telegram not enabled'];
        }
        
        $message = "🔴 <b>พนักงานออกงาน</b>\n\n";
        $message .= "👤 <b>ชื่อ:</b> {$employeeData['name']}\n";
        $message .= "🏢 <b>แผนก:</b> {$employeeData['department']}\n";
        $message .= "📍 <b>สาขา:</b> {$employeeData['branch']}\n";
        $message .= "🕐 <b>เข้างาน:</b> {$employeeData['check_in_time']}\n";
        $message .= "🕐 <b>ออกงาน:</b> {$employeeData['check_out_time']}\n";
        $message .= "⏱ <b>ชั่วโมงทำงาน:</b> {$employeeData['work_hours']}\n";
        $message .= "📅 <b>วันที่:</b> {$employeeData['date']}";
        
        // เพิ่ม Google Map Link
        if (!empty($employeeData['lat']) && !empty($employeeData['lng'])) {
            $mapUrl = "https://www.google.com/maps?q={$employeeData['lat']},{$employeeData['lng']}";
            $message .= "\n\n🗺 <a href=\"{$mapUrl}\">📍 ดูตำแหน่งบน Google Map</a>";
        }
        
        if ($photoPath && file_exists($photoPath)) {
            return $this->sendPhoto($this->timelogChatId, $photoPath, $message);
        } else {
            return $this->sendMessage($this->timelogChatId, $message);
        }
    }
    
    /**
     * แจ้งเตือนการขอลา
     */
    public function notifyLeaveRequest($leaveData, $attachmentPath = null) {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'Telegram not enabled'];
        }
        
        $message = "📋 <b>คำขอลางานใหม่</b>\n\n";
        $message .= "👤 <b>ชื่อ:</b> {$leaveData['name']}\n";
        $message .= "🏢 <b>แผนก:</b> {$leaveData['department']}\n";
        $message .= "📝 <b>ประเภทการลา:</b> {$leaveData['leave_type']}\n";
        $message .= "📅 <b>วันที่ลา:</b> {$leaveData['start_date']}";
        
        if ($leaveData['start_date'] !== $leaveData['end_date']) {
            $message .= " - {$leaveData['end_date']}";
        }
        
        $message .= "\n📊 <b>จำนวน:</b> {$leaveData['total_days']} วัน\n";
        $message .= "💬 <b>เหตุผล:</b> {$leaveData['reason']}\n";
        $message .= "🕐 <b>เวลาที่ส่ง:</b> {$leaveData['submitted_at']}";
        
        if ($attachmentPath && file_exists($attachmentPath)) {
            // ตรวจสอบว่าเป็นไฟล์รูปภาพหรือไม่
            $extension = strtolower(pathinfo($attachmentPath, PATHINFO_EXTENSION));
            $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            
            if (in_array($extension, $imageExtensions)) {
                return $this->sendPhoto($this->leaveChatId, $attachmentPath, $message);
            } else {
                // ส่งเป็น document
                return $this->sendDocument($this->leaveChatId, $attachmentPath, $message);
            }
        } else {
            return $this->sendMessage($this->leaveChatId, $message);
        }
    }
    
    /**
     * ส่งเอกสารไปยัง Telegram
     */
    private function sendDocument($chatId, $documentPath, $caption = '') {
        if (!$this->isEnabled() || empty($chatId)) {
            return ['success' => false, 'message' => 'Telegram not configured'];
        }
        
        if (!file_exists($documentPath)) {
            error_log('[Telegram Helper] Document file not found: ' . $documentPath);
            return ['success' => false, 'message' => 'Document file not found'];
        }
        
        $url = "https://api.telegram.org/bot{$this->botToken}/sendDocument";
        
        $data = [
            'chat_id' => $chatId,
            'document' => new CURLFile($documentPath),
            'caption' => $caption,
            'parse_mode' => 'HTML'
        ];
        
        return $this->sendRequest($url, $data, true);
    }
    
    /**
     * แปลงสถานะเป็นข้อความ
     */
    private function getStatusText($status) {
        $statusTexts = [
            'early' => 'มาก่อนเวลา',
            'on_time' => 'ตรงเวลา',
            'late' => 'มาสาย'
        ];
        return $statusTexts[$status] ?? 'ไม่ทราบ';
    }
    
    /**
     * ดึง emoji ตามสถานะ
     */
    private function getStatusEmoji($status) {
        $emojis = [
            'early' => '🌟',
            'on_time' => '✅',
            'late' => '⚠️'
        ];
        return $emojis[$status] ?? '❓';
    }
    
    /**
     * ทดสอบการเชื่อมต่อ
     */
    public function testConnection($type = 'timelog') {
        if (empty($this->botToken)) {
            return ['success' => false, 'message' => 'Bot Token ยังไม่ได้ตั้งค่า'];
        }
        
        $chatId = ($type === 'leave') ? $this->leaveChatId : $this->timelogChatId;
        
        if (empty($chatId)) {
            return ['success' => false, 'message' => 'Chat ID ยังไม่ได้ตั้งค่า'];
        }
        
        $message = "🔔 <b>ทดสอบการเชื่อมต่อ</b>\n\n";
        $message .= "✅ การเชื่อมต่อสำเร็จ!\n";
        $message .= "📅 " . date('d/m/Y H:i:s');
        
        return $this->sendMessage($chatId, $message);
    }
}

/**
 * ฟังก์ชันช่วยสำหรับแจ้งเตือนเข้างาน
 */
function sendTelegramCheckInNotification($pdo, $employeeId, $branchId, $checkInTime, $status, $photoFilename = null, $lat = null, $lng = null) {
    try {
        // ดึงข้อมูลพนักงาน
        $stmt = $pdo->prepare("
            SELECT 
                CONCAT(e.first_name, ' ', e.last_name) as name,
                COALESCE(d.name, '-') as department,
                b.name as branch
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN branches b ON b.id = ?
            WHERE e.id = ?
        ");
        $stmt->execute([$branchId, $employeeId]);
        $employee = $stmt->fetch();
        
        if (!$employee) {
            error_log('[Telegram Helper] Employee not found: ' . $employeeId);
            return;
        }
        
        $telegram = new TelegramNotifier($pdo);
        
        $photoPath = null;
        if ($photoFilename) {
            $photoPath = UPLOAD_DIR . 'checkins/' . $photoFilename;
        }
        
        $data = [
            'name' => $employee['name'],
            'department' => $employee['department'],
            'branch' => $employee['branch'] ?? '-',
            'time' => date('H:i น.', strtotime($checkInTime)),
            'date' => date('d/m/Y', strtotime($checkInTime)),
            'status' => $status,
            'lat' => $lat,
            'lng' => $lng
        ];
        
        $result = $telegram->notifyCheckIn($data, $photoPath);
        
        if (!$result['success']) {
            error_log('[Telegram Helper] Check-in notification failed: ' . $result['message']);
        }
        
    } catch (Exception $e) {
        error_log('[Telegram Helper] Error in sendTelegramCheckInNotification: ' . $e->getMessage());
    }
}

/**
 * ฟังก์ชันช่วยสำหรับแจ้งเตือนออกงาน
 */
function sendTelegramCheckOutNotification($pdo, $employeeId, $branchId, $checkInTime, $checkOutTime, $photoFilename = null, $lat = null, $lng = null) {
    try {
        // ดึงข้อมูลพนักงาน
        $stmt = $pdo->prepare("
            SELECT 
                CONCAT(e.first_name, ' ', e.last_name) as name,
                COALESCE(d.name, '-') as department,
                b.name as branch
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN branches b ON b.id = ?
            WHERE e.id = ?
        ");
        $stmt->execute([$branchId, $employeeId]);
        $employee = $stmt->fetch();
        
        if (!$employee) {
            error_log('[Telegram Helper] Employee not found: ' . $employeeId);
            return;
        }
        
        // คำนวณชั่วโมงทำงาน
        $start = new DateTime($checkInTime);
        $end = new DateTime($checkOutTime);
        $diff = $start->diff($end);
        $workHours = sprintf('%d ชม. %d นาที', $diff->h + ($diff->days * 24), $diff->i);
        
        $telegram = new TelegramNotifier($pdo);
        
        $photoPath = null;
        if ($photoFilename) {
            $photoPath = UPLOAD_DIR . 'checkins/' . $photoFilename;
        }
        
        $data = [
            'name' => $employee['name'],
            'department' => $employee['department'],
            'branch' => $employee['branch'] ?? '-',
            'check_in_time' => date('H:i น.', strtotime($checkInTime)),
            'check_out_time' => date('H:i น.', strtotime($checkOutTime)),
            'work_hours' => $workHours,
            'date' => date('d/m/Y', strtotime($checkOutTime)),
            'lat' => $lat,
            'lng' => $lng
        ];
        
        $result = $telegram->notifyCheckOut($data, $photoPath);
        
        if (!$result['success']) {
            error_log('[Telegram Helper] Check-out notification failed: ' . $result['message']);
        }
        
    } catch (Exception $e) {
        error_log('[Telegram Helper] Error in sendTelegramCheckOutNotification: ' . $e->getMessage());
    }
}

/**
 * ฟังก์ชันช่วยสำหรับแจ้งเตือนขอลา
 */
function sendTelegramLeaveNotification($pdo, $requestId) {
    try {
        // ดึงข้อมูลคำขอลา
        $stmt = $pdo->prepare("
            SELECT 
                lr.*,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                COALESCE(d.name, '-') as department,
                lt.name as leave_type_name
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.id = ?
        ");
        $stmt->execute([$requestId]);
        $request = $stmt->fetch();
        
        if (!$request) {
            error_log('[Telegram Helper] Leave request not found: ' . $requestId);
            return;
        }
        
        $telegram = new TelegramNotifier($pdo);
        
        $attachmentPath = null;
        if (!empty($request['attachment'])) {
            $attachmentPath = UPLOAD_DIR . 'leave_attachments/' . $request['attachment'];
        }
        
        $data = [
            'name' => $request['employee_name'],
            'department' => $request['department'],
            'leave_type' => $request['leave_type_name'],
            'start_date' => date('d/m/Y', strtotime($request['start_date'])),
            'end_date' => date('d/m/Y', strtotime($request['end_date'])),
            'total_days' => $request['total_days'],
            'reason' => $request['reason'],
            'submitted_at' => date('d/m/Y H:i น.', strtotime($request['created_at']))
        ];
        
        $result = $telegram->notifyLeaveRequest($data, $attachmentPath);
        
        if (!$result['success']) {
            error_log('[Telegram Helper] Leave notification failed: ' . $result['message']);
        }
        
    } catch (Exception $e) {
        error_log('[Telegram Helper] Error in sendTelegramLeaveNotification: ' . $e->getMessage());
    }
}
