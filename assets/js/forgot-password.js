
// ============================================
// Forgot Password Functions
// ============================================

function showForgotPasswordModal() {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.getElementById('forgot-password-form').reset();
    }
}

// Handle Forgot Password Form Submission
document.getElementById('forgot-password-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const employeeCode = document.getElementById('forgot-emp-code').value;
    const email = document.getElementById('forgot-email').value;
    const btn = this.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;

    if (!employeeCode || !email) {
        showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        return;
    }

    // Disable button and show loading
    btn.disabled = true;
    btn.innerHTML = 'กำลังส่ง...';

    fetch('api/auth.php?action=forgot_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_code: employeeCode, email: email })
    })
    .then(res => res.json())
    .then(response => {
        if (response.success) {
            showToast('ส่ง Email สำเร็จ ให้ตรวจสอบ Email ที่ลงทะเบียนไว้', 'success');
            closeForgotPasswordModal();
        } else {
            showToast(response.message || 'เกิดข้อผิดพลาด', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerHTML = originalText;
    });
});
