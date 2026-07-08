<?php
// แก้ไขพาธเชื่อมต่อให้ดึงจากหน้าแรกตรง ๆ ให้ถูกต้องตามตำแหน่งไฟล์
require_once 'config.php'; 

// ตรวจสอบสิทธิ์ (ล็อกให้เข้าได้เฉพาะ Admin เท่านั้น)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    die("<div style='text-align:center; margin-top:50px; font-family:sans-serif;'><h2>คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะ Admin เท่านั้น)</h2><a href='index.html'>กลับหน้าหลัก</a></div>");
}

// 1. ดึงข้อมูลประวัติเวลาเข้าออกงานทั้งหมดมาจากฐานข้อมูลถังเทส
try {
    $stmt = $pdo->query("SELECT * FROM time_logs ORDER BY work_date DESC, check_in_time DESC");
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    die("เกิดข้อผิดพลาดในการดึงข้อมูล: " . $e->getMessage());
}
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ระบบจัดการประวัติเวลาเข้าออกงาน (Admin)</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="bg-gray-100 font-sans p-6">

    <div class="max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-2xl font-bold text-gray-800">📋 จัดการประวัติเวลาเข้าออกงาน (ถังระบบเทส)</h1>
            <a href="index.html" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">กลับหน้าหลัก</a>
        </div>

        <div class="overflow-x-auto">
            <table class="min-w-full bg-white border border-gray-200">
                <thead>
                    <tr class="bg-gray-200 text-gray-700 text-left text-sm uppercase font-semibold">
                        <th class="p-3 border">Log ID</th>
                        <th class="p-3 border">ID พนักงาน</th>
                        <th class="p-3 border">วันที่ทำงาน</th>
                        <th class="p-3 border">เวลาเข้างาน</th>
                        <th class="p-3 border">เวลาออกงาน</th>
                        <th class="p-3 border">สถานะ</th>
                        <th class="p-3 border text-center">จัดการ</th>
                    </tr>
                </thead>
                <tbody class="text-gray-600 text-sm">
                    <?php if (empty($logs)): ?>
                        <tr><td colspan="7" class="p-4 text-center text-gray-400">ยังไม่มีข้อมูลบันทึกเวลา</td></tr>
                    <?php else: ?>
                        <?php foreach ($logs as $log): ?>
                            <tr class="border-b hover:bg-gray-50">
                                <td class="p-3 border"><?= $log['id'] ?></td>
                                <td class="p-3 border font-medium text-gray-900"><?= $log['employee_id'] ?></td>
                                <td class="p-3 border"><?= $log['work_date'] ?></td>
                                <td class="p-3 border text-green-600 font-mono"><?= $log['check_in_time'] ?></td>
                                <td class="p-3 border text-red-600 font-mono"><?= $log['check_out_time'] ?? '-' ?></td>
                                <td class="p-3 border">
                                    <span class="px-2 py-1 rounded text-xs font-bold <?= $log['status'] === 'on_time' ? 'bg-green-100 text-green-800' : ($log['status'] === 'late' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800') ?>">
                                        <?= $log['status'] ?>
                                    </span>
                                </td>
                                <td class="p-3 border text-center">
                                    <button onclick="openEditModal(<?= htmlspecialchars(json_encode($log)) ?>)" class="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs transition">
                                        ✏️ แก้ไขเวลา
                                    </button>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <div id="editModal" class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm hidden flex items-center justify-center p-4">
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 class="text-lg font-bold text-gray-800 mb-4">✏️ แก้ไขประวัติเวลาเข้าออกงาน</h3>
            
            <form id="editForm" onsubmit="saveTimeLog(event)">
                <input type="hidden" id="modal_log_id">
                
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">วันที่ทำงาน (work_date)</label>
                    <input type="date" id="modal_work_date" class="w-full border p-2 rounded focus:ring-2 focus:ring-orange-500 outline-none" required>
                </div>
                
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">เวลาเข้างาน (check_in_time)</label>
                    <input type="text" id="modal_check_in" class="w-full border p-2 rounded font-mono focus:ring-2 focus:ring-orange-500 outline-none" placeholder="YYYY-MM-DD HH:MM:SS" required>
                </div>
                
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">เวลาออกงาน (check_out_time)</label>
                    <input type="text" id="modal_check_out" class="w-full border p-2 rounded font-mono focus:ring-2 focus:ring-orange-500 outline-none" placeholder="YYYY-MM-DD HH:MM:SS (เว้นว่างได้)">
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">สถานะ (status)</label>
                    <select id="modal_status" class="w-full border p-2 rounded focus:ring-2 focus:ring-orange-500 outline-none">
                        <option value="on_time">on_time (ตรงเวลา)</option>
                        <option value="late">late (สาย)</option>
                        <option value="early">early (มาก่อนเวลา)</option>
                    </select>
                </div>

                <div class="flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded">ยกเลิก</button>
                    <button type="submit" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-bold">💾 บันทึกการแก้ไข</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        const modal = document.getElementById('editModal');

        // ฟังก์ชันเปิดกล่องแก้ไข และดึงค่าจากแถวนั้นมาหยอดใส่ช่องพิมพ์
        function openEditModal(log) {
            document.getElementById('modal_log_id').value = log.id;
            document.getElementById('modal_work_date').value = log.work_date;
            document.getElementById('modal_check_in').value = log.check_in_time;
            document.getElementById('modal_check_out').value = log.check_out_time || '';
            document.getElementById('modal_status').value = log.status;
            modal.classList.remove('hidden');
        }

        function closeModal() {
            modal.classList.add('hidden');
        }

        // ฟังก์ชันยิงข้อมูลข้ามท่อไปหาฟังก์ชัน handleUpdateLog() ที่เราทำไว้ใน api/timelog.php
        function saveTimeLog(event) {
            event.preventDefault();

            const payload = {
                log_id: document.getElementById('modal_log_id').value,
                work_date: document.getElementById('modal_work_date').value,
                check_in_time: document.getElementById('modal_check_in').value,
                check_out_time: document.getElementById('modal_check_out').value,
                status: document.getElementById('modal_status').value
            };

            fetch('api/timelog.php?action=update_log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('🎉 ' + data.message);
                    location.reload(); // รีเฟรชหน้าจอเพื่ออัปเดตข้อมูลตารางล่าสุด
                } else {
                    alert('❌ ผิดพลาด: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
            });
        }
    </script>
</body>
</html>