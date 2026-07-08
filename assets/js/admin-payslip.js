// ==================== PAYSLIP MANAGEMENT ====================

function loadPayslipManagementSection() {
    const currentYear = new Date().getFullYear();

    const html = `
        <div class="admin-section">
            <div class="admin-payslip-header">
                <h2>จัดการสลิปเงินเดือน</h2>
                <button class="btn-primary" onclick="openPayslipModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    เพิ่มสลิปเงินเดือน
                </button>
            </div>
            
            <div class="admin-payslip-filters">
                <select id="admin-payslip-year" class="form-control" onchange="filterAdminPayslips()">
                    ${Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => `
                        <option value="${y}">${y + 543}</option>
                    `).join('')}
                </select>
                
                <select id="admin-payslip-month" class="form-control" onchange="filterAdminPayslips()">
                    <option value="">ทุกเดือน</option>
                    ${['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
            .map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}
                </select>
                
                <select id="admin-payslip-employee" class="form-control" onchange="filterAdminPayslips()">
                    <option value="">ทุกพนักงาน</option>
                </select>
            </div>
            
            <div class="admin-payslip-table">
                <table>
                    <thead>
                        <tr>
                            <th>รหัสพนักงาน</th>
                            <th>ชื่อ-นามสกุล</th>
                            <th>แผนก</th>
                            <th>วันที่อัพโหลด</th>
                            <th>เงินเดือนที่ได้รับ</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="admin-payslip-tbody">
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 40px;">
                                กำลังโหลดข้อมูล...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;

    // Load employees for filter
    loadEmployeesForPayslipFilter();

    // Load payslips
    loadAdminPayslips();
}

function loadEmployeesForPayslipFilter() {
    fetch('api/admin.php?action=employees')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const select = document.getElementById('admin-payslip-employee');
                if (select) {
                    data.data.forEach(emp => {
                        const option = document.createElement('option');
                        option.value = emp.id;
                        option.textContent = `${emp.employee_code} - ${emp.first_name} ${emp.last_name}`;
                        select.appendChild(option);
                    });
                }

                // Also populate modal employee select with data attributes
                const modalSelect = document.getElementById('payslip-employee');
                if (modalSelect) {
                    modalSelect.innerHTML = '<option value="">-- ค้นหาและเลือกพนักงาน --</option>';
                    data.data.forEach(emp => {
                        const option = document.createElement('option');
                        option.value = emp.id;
                        option.textContent = `${emp.employee_code} - ${emp.first_name} ${emp.last_name}`;
                        // Add data attributes for auto-fill
                        option.dataset.name = `${emp.first_name} ${emp.last_name}`;
                        option.dataset.department = emp.department_name || '-';
                        option.dataset.code = emp.employee_code;
                        modalSelect.appendChild(option);
                    });
                }
            }
        });
}

function filterAdminPayslips() {
    loadAdminPayslips();
}

function loadAdminPayslips() {
    const year = document.getElementById('admin-payslip-year')?.value || new Date().getFullYear();
    const month = document.getElementById('admin-payslip-month')?.value || '';
    const employee_id = document.getElementById('admin-payslip-employee')?.value || '';

    let url = `api/payslip.php?action=admin_list&year=${year}`;
    if (month) url += `&month=${month}`;
    if (employee_id) url += `&employee_id=${employee_id}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderAdminPayslipsTable(data.data);
            } else {
                showToast(data.message || 'ไม่สามารถโหลดข้อมูลได้', 'error');
            }
        })
        .catch(error => {
            console.error('Error loading payslips:', error);
            showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
        });
}

function renderAdminPayslipsTable(payslips) {
    const tbody = document.getElementById('admin-payslip-tbody');

    if (!payslips || payslips.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
                    ไม่พบข้อมูลสลิปเงินเดือน
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = payslips.map(p => {
        const date = new Date(p.payment_date);
        const thaiDate = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

        return `
            <tr>
                <td>${p.employee_code}</td>
                <td>${p.first_name} ${p.last_name}</td>
                <td>${p.department_name || '-'}</td>
                <td>${thaiDate}</td>
                <td class="salary-amount">฿${parseFloat(p.net_salary).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                <td>
                    <div class="payslip-actions">
                        <button class="btn-icon download" onclick="downloadAdminPayslip(${p.id})" title="ดาวน์โหลด">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </button>
                        <button class="btn-icon delete" onclick="deletePayslip(${p.id})" title="ลบ">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Modal Functions
function updatePayslipDate() {
    const month = parseInt(document.getElementById('payslip-select-month').value);
    const year = parseInt(document.getElementById('payslip-select-year').value);

    if (month && year) {
        // Set date to the last day of the selected month
        const date = new Date(year, month, 0);
        const yearStr = date.getFullYear();
        const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
        const dayStr = date.getDate().toString().padStart(2, '0');

        document.getElementById('payslip-upload-date').value = `${yearStr}-${monthStr}-${dayStr}`;
    }
}

function openPayslipModal(payslipId = null) {
    const modal = document.getElementById('payslip-modal');
    const form = document.getElementById('payslip-form');
    const title = document.getElementById('payslip-modal-title');

    // Reset form
    form.reset();
    document.getElementById('payslip-id').value = '';
    document.getElementById('current-pdf-file').style.display = 'none';
    document.getElementById('payslip-employee-name').value = '';
    document.getElementById('payslip-department').value = '';

    // Populate Year Select (Current + 1 to Current - 5)
    const yearSelect = document.getElementById('payslip-select-year');
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let y = currentYear + 1; y >= currentYear - 5; y--) {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y + 543;
        yearSelect.appendChild(option);
    }

    // Set default month/year (Today)
    const today = new Date();
    document.getElementById('payslip-select-month').value = today.getMonth() + 1;
    document.getElementById('payslip-select-year').value = today.getFullYear();
    updatePayslipDate();

    if (payslipId) {
        // Edit mode
        title.textContent = 'แก้ไขสลิปเงินเดือน';
        loadPayslipData(payslipId);
    } else {
        // Add mode
        title.textContent = 'เพิ่มสลิปเงินเดือน';
    }


    // Initialize Select2 for employee dropdown if not already initialized
    if (!$('#payslip-employee').hasClass('select2-hidden-accessible')) {
        $('#payslip-employee').select2({
            dropdownParent: $('#payslip-modal'),
            placeholder: '-- ค้นหาและเลือกพนักงาน --',
            allowClear: true,
            width: '100%'
        });
    }

    modal.classList.remove('hidden');
}

function closePayslipModal() {
    const modal = document.getElementById('payslip-modal');
    modal.classList.add('hidden');

    // Destroy Select2 to prevent memory leaks
    if ($('#payslip-employee').hasClass('select2-hidden-accessible')) {
        $('#payslip-employee').select2('destroy');
    }
}

function updateEmployeeInfo() {
    const employeeSelect = document.getElementById('payslip-employee');
    const selectedOption = employeeSelect.options[employeeSelect.selectedIndex];

    if (selectedOption && selectedOption.value) {
        const employeeData = selectedOption.dataset;
        document.getElementById('payslip-employee-name').value = employeeData.name || '';
        document.getElementById('payslip-department').value = employeeData.department || '';
    } else {
        document.getElementById('payslip-employee-name').value = '';
        document.getElementById('payslip-department').value = '';
    }
}

function loadPayslipData(payslipId) {
    fetch(`api/payslip.php?action=view&id=${payslipId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const p = data.data;
                document.getElementById('payslip-id').value = p.id;
                document.getElementById('payslip-employee').value = p.employee_id;
                document.getElementById('payslip-salary-amount').value = p.net_salary;
                document.getElementById('payslip-upload-date').value = p.payment_date;
                document.getElementById('payslip-net-salary').value = p.net_salary;

                // Set Month/Year Dropdowns from payment_date
                if (p.payment_date) {
                    const [year, month, day] = p.payment_date.split('-');
                    document.getElementById('payslip-select-month').value = parseInt(month);
                    document.getElementById('payslip-select-year').value = parseInt(year);
                }

                // Set employee name and department
                document.getElementById('payslip-employee-name').value = `${p.first_name} ${p.last_name}`;
                document.getElementById('payslip-department').value = p.department_name || '';

                if (p.file_path) {
                    document.getElementById('current-pdf-file').style.display = 'block';
                    document.getElementById('current-pdf-name').textContent = p.file_path.split('/').pop();
                }

                // Trigger Select2 refresh
                $('#payslip-employee').trigger('change');
            }
        });
}

function removePdfFile() {
    document.getElementById('current-pdf-file').style.display = 'none';
    document.getElementById('payslip-pdf-file').value = '';

    // Add hidden field to indicate file should be removed
    let removeInput = document.getElementById('remove-pdf-flag');
    if (!removeInput) {
        removeInput = document.createElement('input');
        removeInput.type = 'hidden';
        removeInput.id = 'remove-pdf-flag';
        removeInput.name = 'remove_pdf';
        removeInput.value = '1';
        document.getElementById('payslip-form').appendChild(removeInput);
    }
}

// Form submission
document.addEventListener('DOMContentLoaded', function () {
    const payslipForm = document.getElementById('payslip-form');
    if (payslipForm) {
        payslipForm.addEventListener('submit', handlePayslipSubmit);
    }
});

function handlePayslipSubmit(e) {
    e.preventDefault();

    const payslipId = document.getElementById('payslip-id').value;
    const salaryAmount = document.getElementById('payslip-salary-amount').value;

    // Set net_salary to salary_amount value
    document.getElementById('payslip-net-salary').value = salaryAmount;

    const formData = new FormData(e.target);
    const action = payslipId ? 'update' : 'create';

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังบันทึก...';

    fetch(`api/payslip.php?action=${action}`, {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast(data.message || 'บันทึกสำเร็จ', 'success');
                closePayslipModal();
                loadAdminPayslips();
            } else {
                showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        });
}

function editPayslip(payslipId) {
    openPayslipModal(payslipId);
}

function deletePayslip(payslipId) {
    if (!confirm('คุณต้องการลบสลิปเงินเดือนนี้ใช่หรือไม่?')) {
        return;
    }

    const formData = new FormData();
    formData.append('id', payslipId);

    fetch('api/payslip.php?action=delete', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('ลบสลิปเงินเดือนสำเร็จ', 'success');
                loadAdminPayslips();
            } else {
                showToast(data.message || 'ไม่สามารถลบได้', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('เกิดข้อผิดพลาดในการลบ', 'error');
        });
}

function downloadAdminPayslip(payslipId) {
    window.open(`api/payslip.php?action=download&id=${payslipId}`, '_blank');
}

// Make functions available globally
window.updateEmployeeInfo = updateEmployeeInfo;
window.closePayslipModal = closePayslipModal;
window.removePdfFile = removePdfFile;
