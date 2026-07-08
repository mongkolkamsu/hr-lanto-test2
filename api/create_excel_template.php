<?php
/**
 * สคริปต์สร้างไฟล์ Excel ตัวอย่างสำหรับ Import พนักงาน
 * เรียกใช้ครั้งเดียวเพื่อสร้างไฟล์ template
 */
require_once '../vendor/autoload.php';
require_once '../config.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

// สร้าง Spreadsheet ใหม่
$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();

// ตั้งชื่อ Sheet
$sheet->setTitle('พนักงาน');

// กำหนดหัวตาราง
$headers = [
    'A1' => 'รหัสพนักงาน *',
    'B1' => 'ชื่อ *',
    'C1' => 'นามสกุล *',
    'D1' => 'Email',
    'E1' => 'ประเภทพนักงาน *',
    'F1' => 'รหัสแผนก *',
    'G1' => 'วันเริ่มงาน',
    'H1' => 'วันเกิด',
    'I1' => 'ที่อยู่',
    'J1' => 'ตำบล',
    'K1' => 'อำเภอ',
    'L1' => 'จังหวัด',
    'M1' => 'รหัสผ่านเริ่มต้น'
];

// ใส่หัวตาราง
foreach ($headers as $cell => $value) {
    $sheet->setCellValue($cell, $value);
}

// จัดรูปแบบหัวตาราง
$headerStyle = [
    'font' => [
        'bold' => true,
        'color' => ['rgb' => 'FFFFFF'],
        'size' => 12,
    ],
    'fill' => [
        'fillType' => Fill::FILL_SOLID,
        'startColor' => ['rgb' => 'FF6B35'],
    ],
    'alignment' => [
        'horizontal' => Alignment::HORIZONTAL_CENTER,
        'vertical' => Alignment::VERTICAL_CENTER,
    ],
    'borders' => [
        'allBorders' => [
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['rgb' => '000000'],
        ],
    ],
];

$sheet->getStyle('A1:M1')->applyFromArray($headerStyle);

// กำหนดความกว้างคอลัมน์
$sheet->getColumnDimension('A')->setWidth(15);
$sheet->getColumnDimension('B')->setWidth(15);
$sheet->getColumnDimension('C')->setWidth(15);
$sheet->getColumnDimension('D')->setWidth(25);
$sheet->getColumnDimension('E')->setWidth(20);
$sheet->getColumnDimension('F')->setWidth(15);
$sheet->getColumnDimension('G')->setWidth(15);
$sheet->getColumnDimension('H')->setWidth(15);
$sheet->getColumnDimension('I')->setWidth(30);
$sheet->getColumnDimension('J')->setWidth(15);
$sheet->getColumnDimension('K')->setWidth(15);
$sheet->getColumnDimension('L')->setWidth(15);
$sheet->getColumnDimension('M')->setWidth(20);

// ความสูงแถวหัวตาราง
$sheet->getRowDimension(1)->setRowHeight(25);

// ดึงข้อมูลแผนกจากฐานข้อมูล (ถ้าเชื่อมต่อได้)
$departments = [];
try {
    if (isset($pdo)) {
        $stmt = $pdo->query("SELECT id, name FROM departments ORDER BY name");
        $departments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
} catch (Exception $e) {
    // ถ้าไม่สามารถเชื่อมต่อได้ ใช้ข้อมูลตัวอย่าง
    $departments = [
        ['id' => '1', 'name' => 'ฝ่ายบัญชี'],
        ['id' => '2', 'name' => 'ฝ่ายขาย'],
        ['id' => '3', 'name' => 'ฝ่ายผลิต'],
    ];
}

// สร้างตัวอย่างข้อมูล 3 แถว
$exampleData = [
    ['EMP001', 'สมชาย', 'ใจดี', 'somchai@example.com', 'พนักงานประจำ', '1', '2024-01-15', '1990-05-20', '123 หมู่ 1', 'ตำบลตัวอย่าง', 'อำเภอตัวอย่าง', 'กรุงเทพมหานคร', '12345678'],
    ['EMP002', 'สมหญิง', 'รักงาน', 'somying@example.com', 'พนักงานทดลองงาน', '2', '2024-02-01', '1995-08-15', '456 หมู่ 2', 'ตำบลตัวอย่าง', 'อำเภอตัวอย่าง', 'กรุงเทพมหานคร', 'password123'],
    ['EMP003', 'สมศรี', 'มีสุข', 'somsri@example.com', 'นักศึกษาฝึกงาน', '1', '2024-03-01', '2000-12-10', '789 หมู่ 3', 'ตำบลตัวอย่าง', 'อำเภอตัวอย่าง', 'กรุงเทพมหานคร', 'welcome2024'],
];

$row = 2;
foreach ($exampleData as $data) {
    $col = 'A';
    foreach ($data as $value) {
        $sheet->setCellValue($col . $row, $value);
        $col++;
    }
    $row++;
}

// จัดรูปแบบข้อมูลตัวอย่าง
$dataStyle = [
    'alignment' => [
        'horizontal' => Alignment::HORIZONTAL_LEFT,
        'vertical' => Alignment::VERTICAL_CENTER,
    ],
    'borders' => [
        'allBorders' => [
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['rgb' => 'CCCCCC'],
        ],
    ],
];
$sheet->getStyle('A2:M4')->applyFromArray($dataStyle);

// เพิ่ม Sheet คำแนะนำ
$instructionSheet = $spreadsheet->createSheet();
$instructionSheet->setTitle('คำแนะนำ');

$instructions = [
    ['คำแนะนำการใช้งานไฟล์ Import พนักงาน'],
    [''],
    ['1. คอลัมน์ที่มีเครื่องหมาย * คือข้อมูลที่จำเป็นต้องกรอก'],
    [''],
    ['2. รหัสพนักงาน: ต้องไม่ซ้ำกับรหัสที่มีอยู่ในระบบ (ตัวอย่าง: EMP001, EMP002)'],
    [''],
    ['3. ประเภทพนักงาน: เลือกได้เพียง 3 ประเภท'],
    ['   - พนักงานประจำ'],
    ['   - พนักงานทดลองงาน'],
    ['   - นักศึกษาฝึกงาน'],
    [''],
    ['4. รหัสแผนก: ใส่ ID ของแผนก (ตัวเลข) ดูรายการแผนกได้จากหน้าจัดการแผนก'],
];

// ถ้ามีข้อมูลแผนก ให้แสดงรายการ
if (!empty($departments)) {
    $instructions[] = [''];
    $instructions[] = ['รายการแผนกในระบบ:'];
    $instructions[] = ['รหัสแผนก', 'ชื่อแผนก'];
    foreach ($departments as $dept) {
        $instructions[] = [$dept['id'], $dept['name']];
    }
}

$instructions[] = [''];
$instructions[] = ['5. วันเริ่มงาน และ วันเกิด: ใช้รูปแบบ YYYY-MM-DD (ตัวอย่าง: 2024-01-15)'];
$instructions[] = [''];
$instructions[] = ['6. รหัสผ่านเริ่มต้น: ถ้าไม่ระบุ จะใช้รหัสผ่านเริ่มต้นเป็น "12345678"'];
$instructions[] = [''];
$instructions[] = ['7. หลังจาก Import สำเร็จ พนักงานสามารถเข้าสู่ระบบด้วย:'];
$instructions[] = ['   - Username: รหัสพนักงาน'];
$instructions[] = ['   - Password: รหัสผ่านที่ระบุในไฟล์ หรือ 12345678'];
$instructions[] = [''];
$instructions[] = ['8. ลบข้อมูลตัวอย่างออก และกรอกข้อมูลพนักงานจริงในแถวถัดไป'];
$instructions[] = [''];
$instructions[] = ['9. สามารถ Import พนักงานได้ครั้งละหลายคน (แนะนำไม่เกิน 100 คน/ครั้ง)'];
$instructions[] = [''];
$instructions[] = ['⚠️ หมายเหตุสำคัญ:'];
$instructions[] = ['   - ไฟล์ต้องเป็น .xlsx เท่านั้น'];
$instructions[] = ['   - ตรวจสอบข้อมูลให้ถูกต้องก่อน Import'];
$instructions[] = ['   - รหัสพนักงานที่ซ้ำจะถูกข้ามและแสดงในรายงาน'];

$row = 1;
foreach ($instructions as $instruction) {
    $col = 'A';
    foreach ($instruction as $value) {
        $instructionSheet->setCellValue($col . $row, $value);
        $col++;
    }
    $row++;
}

// จัดรูปแบบคำแนะนำ
$instructionSheet->getStyle('A1')->applyFromArray([
    'font' => [
        'bold' => true,
        'size' => 16,
        'color' => ['rgb' => 'FF6B35'],
    ],
]);

$instructionSheet->getStyle('A3:A' . ($row - 1))->getAlignment()->setWrapText(true);
$instructionSheet->getColumnDimension('A')->setWidth(80);
$instructionSheet->getColumnDimension('B')->setWidth(30);

// บันทึกไฟล์
$templatePath = __DIR__ . '/../templates/employee_import_template.xlsx';
$writer = new Xlsx($spreadsheet);
$writer->save($templatePath);

echo "✅ สร้างไฟล์ Excel ตัวอย่างสำเร็จ!\n";
echo "📁 ที่อยู่ไฟล์: " . $templatePath . "\n";
echo "📝 ขนาดไฟล์: " . round(filesize($templatePath) / 1024, 2) . " KB\n";
