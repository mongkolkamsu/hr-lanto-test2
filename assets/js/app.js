// HR Lanto - Main Application Script

// Global State
const state = {
    user: null,
    currentLocation: null,
    map: null,
    marker: null,
    accuracyCircle: null,
    isCheckedIn: false
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 app.js: DOMContentLoaded'); // Debug log
    initializeApp();

    // Auto-trigger date picker when clicking anywhere on the date input
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.addEventListener('click', function () {
            if (typeof this.showPicker === 'function') {
                this.showPicker();
            }
        });
    });
});

function initializeApp() {
    // Check if user is logged in
    checkLoginStatus();

    // Setup event listeners
    setupEventListeners();

    // Start clock
    updateClock();
    setInterval(updateClock, 1000);

    // Initialize current date
    updateCurrentDate();

    // Hide splash screen after 2 seconds
    setTimeout(() => {
        document.getElementById('splash-screen').classList.add('hidden');
    }, 2000);

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed'));
    }
}

// Check login status
function checkLoginStatus() {
    fetch('api/auth.php?action=check', { credentials: 'same-origin' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Check for force password change
                if (data.require_change_password) {
                    showChangePasswordModal(data.employee_id);
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                    return;
                }

                state.user = data.data;
                window.currentUser = data.data; // Set global user variable for admin panel
                showMainApp();
                loadUserData();
                initializeMap();
            } else {
                showLoginPage();
            }
        })
        .catch(() => showLoginPage());
}

function showLoginPage() {
    const loginPage = document.getElementById('login-page');
    const mainApp = document.getElementById('main-app');
    const splashScreen = document.getElementById('splash-screen');

    // Hide splash screen
    if (splashScreen) {
        splashScreen.classList.add('hidden');
        splashScreen.style.display = 'none';
    }

    // Show login page
    if (loginPage) {
        loginPage.classList.remove('hidden');
        loginPage.classList.add('active');
        loginPage.style.display = 'block';
    }

    // Hide main app
    if (mainApp) {
        mainApp.classList.add('hidden');
        mainApp.style.display = 'none';
    }

    // Reset form
    document.getElementById('login-form')?.reset();
}

function showMainApp() {
    const loginPage = document.getElementById('login-page');
    const mainApp = document.getElementById('main-app');
    const splashScreen = document.getElementById('splash-screen');

    // Hide splash screen
    if (splashScreen) {
        splashScreen.classList.add('hidden');
        splashScreen.style.display = 'none';
    }

    // Hide login page
    if (loginPage) {
        loginPage.style.opacity = '0';

        setTimeout(() => {
            loginPage.classList.remove('active');
            loginPage.classList.add('hidden');
            loginPage.style.display = 'none';
            loginPage.style.opacity = '1';
        }, 300);
    }

    // Show main app
    if (mainApp) {
        setTimeout(() => {
            mainApp.classList.remove('hidden');
            mainApp.style.display = 'block';

            // Show admin menu if user has admin/HR/IT Support/HR Admin role
            if (state.user && (state.user.role === 'ผู้ดูแลระบบ' || state.user.role === 'HR' || state.user.role === 'IT Support' || state.user.role === 'HR Admin')) {
                const adminBtn = document.getElementById('admin-nav-btn');
                if (adminBtn) {
                    adminBtn.style.display = 'flex';
                }
            }
        }, 300);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);

    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            navigateToPage(page);
        });
    });

    // Mobile mode button
    document.getElementById('btn-mobile-mode')?.addEventListener('click', switchToMobileMode);

    // Check-in/out button
    document.getElementById('checkin-button')?.addEventListener('click', handleCheckInOut);

    // Refresh location
    document.getElementById('refresh-location')?.addEventListener('click', getCurrentLocation);

    // Leave request
    document.getElementById('btn-new-leave')?.addEventListener('click', showLeaveRequestModal);

    // Leave form
    document.getElementById('leave-request-form')?.addEventListener('submit', handleLeaveRequest);
    document.getElementById('leave-start-date')?.addEventListener('change', calculateLeaveDays);
    document.getElementById('leave-end-date')?.addEventListener('change', calculateLeaveDays);
    document.getElementById('leave-type-select')?.addEventListener('change', () => {
        // Trigger validation when leave type changes
        const daysCount = document.getElementById('leave-days-count').textContent;
        if (daysCount && daysCount !== '0') {
            validateLeaveBalance(parseFloat(daysCount));
        }
    });

    // Leave duration buttons
    document.getElementById('half-day-btn')?.addEventListener('click', () => selectLeaveDuration('half'));
    document.getElementById('full-day-btn')?.addEventListener('click', () => selectLeaveDuration('full'));
    document.getElementById('leave-half-date')?.addEventListener('change', calculateLeaveDays);

    // Leave attachment handlers
    document.getElementById('leave-attachment')?.addEventListener('change', handleLeaveAttachment);
    document.getElementById('leave-attachment-camera')?.addEventListener('change', handleLeaveAttachment);

    // Account form
    document.getElementById('account-form')?.addEventListener('submit', handleAccountUpdate);
    document.getElementById('btn-change-photo')?.addEventListener('click', () => {
        document.getElementById('profile-photo-input').click();
    });
    document.getElementById('profile-photo-input')?.addEventListener('change', handleProfilePhotoUpload);

    // ID Card upload
    document.getElementById('id-card-input')?.addEventListener('change', handleIdCardUpload);

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', handleLogout);

    // Payslip
    document.getElementById('btn-payslip')?.addEventListener('click', () => navigateToPage('payslip'));
    document.getElementById('btn-back-from-payslip')?.addEventListener('click', () => navigateToPage('account'));
    document.getElementById('payslip-year')?.addEventListener('change', loadPayslips);

    // Close modals
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') {
            closeModal();
        }
    });

    // History filter
    document.getElementById('history-month')?.addEventListener('change', loadHistory);
    document.getElementById('history-year')?.addEventListener('change', loadHistory);
}

// Handle hash-based navigation for admin panel
function handleHashNavigation() {
    const hash = window.location.hash;
    if (hash.startsWith('#admin')) {
        // Check if user has admin privileges
        if (state.user && (state.user.role === 'ผู้ดูแลระบบ' || state.user.role === 'HR' || state.user.role === 'IT Support' || state.user.role === 'HR Admin')) {
            // Navigate to admin page
            navigateToPage('admin');

            // Parse URL parameters
            const urlParams = new URLSearchParams(hash.split('?')[1] || '');
            const section = urlParams.get('section');

            // Trigger admin section loading after a delay
            setTimeout(() => {
                if (section && window.loadAdminSection) {
                    window.loadAdminSection(section);
                }
            }, 500);
        } else {
            // Redirect to main app if no admin privileges
            window.location.hash = '';
            navigateToPage('checkin');
        }
    }
}

// Listen for hash changes
window.addEventListener('hashchange', handleHashNavigation);

// Check hash on initial load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(handleHashNavigation, 100);
});

// Login Handler
function handleLogin(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    // Disable button and show loading
    submitButton.disabled = true;
    submitButton.textContent = 'กำลังเข้าสู่ระบบ...';

    fetch('api/auth.php?action=login', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Check for force password change
                if (data.require_change_password) {
                    showChangePasswordModal(data.employee_id);
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                    return;
                }

                state.user = data.data;
                window.currentUser = data.data; // Set global user variable for admin panel
                showToast('เข้าสู่ระบบสำเร็จ', 'success');

                // Wait a moment before transitioning
                setTimeout(() => {
                    showMainApp();
                    loadUserData();
                    initializeMap();

                    // Reset button
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                }, 500);
            } else {
                showToast(data.message, 'error');
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        })
        .catch(() => {
            showToast('เกิดข้อผิดพลาด', 'error');
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        });
}

// Logout Handler
function handleLogout() {
    if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
        fetch('api/auth.php?action=logout', {
            method: 'POST',
            credentials: 'same-origin'
        })
            .then(res => res.json())
            .then(data => {
                showToast('ออกจากระบบสำเร็จ', 'success');
                state.user = null;
                window.currentUser = null; // Clear global user variable
                showLoginPage();
            });
    }
}

// Navigation
function navigateToPage(pageName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.nav-item[data-page="${pageName}"]`)?.classList.add('active');

    // Update content pages
    document.querySelectorAll('.content-page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`${pageName}-page`)?.classList.add('active');

    // Update header title
    const titles = {
        'checkin': 'ลงเวลา',
        'history': 'ประวัติ',
        'leave': 'แจ้งลา',
        'account': 'บัญชี',
        'admin': 'จัดการระบบ',
        'payslip': 'สลิปเงินเดือน'
    };
    document.getElementById('page-title').textContent = titles[pageName] || 'HR Lanto';

    // Switch to desktop mode for admin page
    const mainApp = document.getElementById('main-app');
    if (pageName === 'admin') {
        mainApp.classList.add('desktop-mode');
        // Automatically load the default or first allowed admin section
        if (window.loadAdminSection) {
            const activeItem = document.querySelector('.admin-menu-item.active');
            const section = activeItem ? activeItem.dataset.adminSection : 'employees';
            window.loadAdminSection(section);
        }
    } else {
        mainApp.classList.remove('desktop-mode');
    }

    // Load page data
    switch (pageName) {
        case 'checkin':
            loadTodaySummary();
            break;
        case 'history':
            loadHistory();
            break;
        case 'leave':
            loadLeaveBalance();
            loadLeaveRequests();
            break;
        case 'account':
            console.log('🔧 Account page requested - calling loadAccountData()');
            loadAccountData();
            break;
        case 'payslip':
            initializePayslipPage();
            break;
    }
}

// Switch to Mobile Mode
function switchToMobileMode() {
    const mainApp = document.getElementById('main-app');
    mainApp.classList.remove('desktop-mode');

    // Navigate back to checkin page
    navigateToPage('checkin');
}

// Load User Data
function loadUserData() {
    if (!state.user) return;

    // Update profile photo - ใช้ relative path ถ้ามี
    let profilePhoto = 'assets/images/default-avatar.png';
    if (state.user.profile_photo) {
        // ถ้าเป็น relative path ให้สร้าง absolute URL
        if (state.user.profile_photo.startsWith('uploads/')) {
            profilePhoto = getAbsoluteUrl(state.user.profile_photo);
        } else {
            profilePhoto = state.user.profile_photo;
        }
    }

    const profilePhotoEl = document.getElementById('profile-photo');
    if (profilePhotoEl) {
        profilePhotoEl.src = profilePhoto;
    }

    // Update employee name
    const employeeNameEl = document.getElementById('employee-name');
    if (employeeNameEl) {
        employeeNameEl.textContent = `${state.user.first_name} ${state.user.last_name}`;
    }

    // Update department
    const employeeDeptEl = document.getElementById('employee-department');
    if (employeeDeptEl) {
        employeeDeptEl.textContent = state.user.department_name || '-';
    }

    // Update company name
    fetch('api/settings.php?key=company_name', { credentials: 'same-origin' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const companyNameEl = document.getElementById('company-name');
                if (companyNameEl) {
                    companyNameEl.textContent = data.data;
                }
            }
        })
        .catch(error => {
            console.error('Error loading company name:', error);
        });

    // Load today's summary
    loadTodaySummary();
}

// Clock and Date
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        timeElement.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

function updateCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('th-TH', options);

    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        dateElement.textContent = dateStr;
    }
}

// Longdo Map
function initializeMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
        console.error('Leaflet not loaded');
        return;
    }

    // Default location (Bangkok - Siam)
    const defaultLocation = [13.7563, 100.5018]; // [lat, lng]

    // Create map instance with OpenStreetMap tiles
    state.map = L.map('map', {
        center: defaultLocation,
        zoom: 15,
        zoomControl: true
    });

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(state.map);

    // สร้าง custom icon สำหรับ marker
    const customIcon = L.divIcon({
        html: `
            <div class="custom-marker">
                <div class="marker-pulse"></div>
                <div class="marker-dot"></div>
            </div>
        `,
        className: 'custom-marker-wrapper',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
    });

    // Add marker ชั่วคราว (จะถูกแทนที่เมื่อได้ตำแหน่งจริง)
    state.marker = L.marker(defaultLocation, {
        icon: customIcon,
        title: 'กำลังค้นหาตำแหน่ง...'
    }).addTo(state.map);

    state.marker.bindPopup('กำลังค้นหาตำแหน่ง...');

    // Get current location
    getCurrentLocation();
}

function getCurrentLocation() {
    if (!navigator.geolocation) {
        showToast('เบราว์เซอร์ของคุณไม่รองรับ GPS', 'error');
        return;
    }

    showToast('กำลังค้นหาตำแหน่ง...', 'info');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            // Store for API calls
            state.currentLocation = {
                lat: lat,
                lng: lng,
                accuracy: accuracy
            };

            if (state.map && state.marker) {
                // Update map center and zoom
                state.map.setView([lat, lng], 16);

                // สร้าง custom icon สำหรับ marker
                const customIcon = L.divIcon({
                    html: `
                        <div class="custom-marker">
                            <div class="marker-pulse"></div>
                            <div class="marker-dot"></div>
                        </div>
                    `,
                    className: 'custom-marker-wrapper',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                    popupAnchor: [0, -15]
                });

                // Remove old marker
                state.map.removeLayer(state.marker);

                // Add new marker
                state.marker = L.marker([lat, lng], {
                    icon: customIcon,
                    title: 'ตำแหน่งปัจจุบันของคุณ'
                }).addTo(state.map);

                // Add popup
                state.marker.bindPopup(`
                    <strong>ตำแหน่งปัจจุบันของคุณ</strong><br>
                    ความแม่นยำ: ±${Math.round(accuracy)} เมตร
                `);

                // Remove old accuracy circle if exists
                if (state.accuracyCircle) {
                    state.map.removeLayer(state.accuracyCircle);
                }

                // Add accuracy circle
                state.accuracyCircle = L.circle([lat, lng], {
                    radius: accuracy, // เมตร
                    color: '#4285F4',
                    fillColor: '#4285F4',
                    fillOpacity: 0.2,
                    weight: 2
                }).addTo(state.map);
            }

            showToast('พบตำแหน่งปัจจุบันแล้ว', 'success');

            // Update checkout location check if in checkout mode
            if (checkinMode === 'checkout' && selectedBranch) {
                checkBranchDistanceForCheckout();
            }
        },
        (error) => {
            let errorMessage = 'ไม่สามารถค้นหาตำแหน่งได้';
            if (error.code === error.PERMISSION_DENIED) {
                errorMessage = 'กรุณาอนุญาตให้เข้าถึงตำแหน่งในการตั้งค่า';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMessage = 'ไม่สามารถระบุตำแหน่งได้';
            } else if (error.code === error.TIMEOUT) {
                errorMessage = 'หมดเวลารอตำแหน่ง กรุณาลองอีกครั้ง';
            }
            showToast(errorMessage, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

// Check In/Out
function handleCheckInOut() {
    // If not checked in yet, open camera modal for checkin
    if (!state.isCheckedIn) {
        checkinMode = 'checkin';
        openCheckinModal();
        return;
    }

    // If already checked in, open camera modal for checkout
    checkinMode = 'checkout';
    openCheckoutModal();
}

// Update checkin button state
function updateCheckinButton() {
    loadTodayTimeLog();
}

// Alias function for backward compatibility
function loadTodayTimeLog() {
    loadTodaySummary();
}

// Load Today's Summary
function loadTodaySummary() {
    // ตรวจสอบการเข้างานที่ยังไม่ได้ออกก่อน (จากทุกวัน)
    fetch('api/timelog.php?action=pending_checkout', { credentials: 'same-origin' })
        .then(res => res.json())
        .then(pendingData => {
            console.log('Pending checkout data:', pendingData);

            if (pendingData.success && pendingData.data) {
                // มีการเข้างานที่ยังไม่ได้ออก
                const pending = pendingData.data;
                todayLog = pending;

                console.log('Set todayLog to:', todayLog);

                const workDate = new Date(pending.work_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                workDate.setHours(0, 0, 0, 0);

                const isToday = workDate.getTime() === today.getTime();

                // แสดงข้อมูลการเข้างานที่ค้าง
                const summaryCheckin = document.getElementById('summary-checkin');
                const summaryCheckout = document.getElementById('summary-checkout');
                const statusBadge = document.getElementById('summary-status');

                if (summaryCheckin) {
                    summaryCheckin.textContent = formatTime(pending.check_in_time);
                }

                if (summaryCheckout) {
                    summaryCheckout.textContent = '-';
                }

                if (statusBadge) {
                    if (isToday) {
                        statusBadge.textContent = 'ยังไม่ออกงาน';
                        statusBadge.className = 'value badge late';
                    } else {
                        const dateStr = formatDate(pending.work_date);
                        statusBadge.textContent = `ยังไม่ออกงาน (${dateStr})`;
                        statusBadge.className = 'value badge late';
                    }
                }

                // แสดงปุ่มออกงาน
                state.isCheckedIn = true;
                const button = document.getElementById('checkin-button');
                const buttonText = document.getElementById('checkin-text');

                if (button && buttonText) {
                    button.classList.add('checkout');
                    if (isToday) {
                        buttonText.textContent = 'ออกงาน';
                    } else {
                        const dateStr = new Date(pending.work_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                        buttonText.textContent = `ออกงาน (${dateStr})`;
                    }
                }

                return; // ไม่ต้องโหลดข้อมูลวันนี้
            }

            // ไม่มีการเข้างานค้าง โหลดข้อมูลวันนี้
            fetch('api/timelog.php?action=today', { credentials: 'same-origin' })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.data) {
                        const log = data.data;
                        todayLog = log;

                        const summaryCheckin = document.getElementById('summary-checkin');
                        const summaryCheckout = document.getElementById('summary-checkout');
                        const statusBadge = document.getElementById('summary-status');

                        if (summaryCheckin) {
                            summaryCheckin.textContent = log.check_in_time ? formatTime(log.check_in_time) : '-';
                        }

                        if (summaryCheckout) {
                            summaryCheckout.textContent = log.check_out_time ? formatTime(log.check_out_time) : '-';
                        }

                        if (statusBadge) {
                            statusBadge.textContent = getStatusText(log.status);
                            statusBadge.className = `value badge ${log.status}`;
                        }

                        // Update button state
                        state.isCheckedIn = false;
                        const button = document.getElementById('checkin-button');
                        const buttonText = document.getElementById('checkin-text');

                        if (button && buttonText) {
                            button.classList.remove('checkout');
                            buttonText.textContent = 'เข้างาน';
                        }
                    } else {
                        // ไม่มีข้อมูลวันนี้เลย
                        todayLog = null;
                        state.isCheckedIn = false;

                        const summaryCheckin = document.getElementById('summary-checkin');
                        const summaryCheckout = document.getElementById('summary-checkout');
                        const statusBadge = document.getElementById('summary-status');

                        if (summaryCheckin) summaryCheckin.textContent = '-';
                        if (summaryCheckout) summaryCheckout.textContent = '-';
                        if (statusBadge) {
                            statusBadge.textContent = '-';
                            statusBadge.className = 'value badge';
                        }

                        const button = document.getElementById('checkin-button');
                        const buttonText = document.getElementById('checkin-text');

                        if (button && buttonText) {
                            button.classList.remove('checkout');
                            buttonText.textContent = 'เข้างาน';
                        }
                    }
                })
                .catch(error => {
                    console.error('Error loading today summary:', error);
                });
        })
        .catch(error => {
            console.error('Error checking pending checkout:', error);
        });
}

// Load History
function loadHistory() {
    const month = document.getElementById('history-month')?.value || new Date().getMonth() + 1;
    const year = document.getElementById('history-year')?.value || new Date().getFullYear();

    // Populate year dropdown if empty
    const yearSelect = document.getElementById('history-year');
    if (yearSelect && yearSelect.options.length === 0) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= currentYear - 5; y--) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y + 543; // Thai year
            if (y === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }
    }

    fetch(`api/timelog.php?action=history&month=${month}&year=${year}`, { credentials: 'same-origin' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Update stats
                document.getElementById('ontime-count').textContent = data.stats.ontime || 0;
                document.getElementById('late-count').textContent = data.stats.late || 0;
                document.getElementById('early-count').textContent = data.stats.early || 0;

                // Update history list
                const historyList = document.getElementById('history-list');
                historyList.innerHTML = '';

                if (data.data.length === 0) {
                    historyList.innerHTML = '<div class="empty-state"><p>ไม่พบข้อมูล</p></div>';
                    return;
                }

                data.data.forEach(log => {
                    const item = createHistoryItem(log);
                    historyList.appendChild(item);
                });
            }
        });
}

function createHistoryItem(log) {
    const div = document.createElement('div');
    div.className = 'history-item';

    // Create Google Maps links if coordinates exist
    const checkinMapButton = (log.check_in_lat && log.check_in_lng)
        ? `<a href="https://www.google.com/maps?q=${log.check_in_lat},${log.check_in_lng}" target="_blank" class="btn-map-link" title="ดูตำแหน่งเข้างานใน Google Maps">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
            📍
           </a>`
        : '';

    const checkoutMapButton = (log.check_out_lat && log.check_out_lng)
        ? `<a href="https://www.google.com/maps?q=${log.check_out_lat},${log.check_out_lng}" target="_blank" class="btn-map-link" title="ดูตำแหน่งออกงานใน Google Maps">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
            📍
           </a>`
        : '';

    // Create Photo buttons
    const checkinPhotoButton = log.check_in_photo
        ? `<button class="btn-photo-link btn-photo-checkin" 
                onclick="viewPhoto('${log.check_in_photo}', 'เข้างาน', '${state.user.first_name} ${state.user.last_name}', '${formatDate(log.work_date)} ${log.check_in_time ? formatTime(log.check_in_time) : ''}'); return false;"
                title="ดูรูปถ่ายเข้างาน">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
            </button>`
        : '';

    const checkoutPhotoButton = log.checkout_photo
        ? `<button class="btn-photo-link btn-photo-checkout" 
                onclick="viewPhoto('${log.checkout_photo}', 'ออกงาน', '${state.user.first_name} ${state.user.last_name}', '${formatDate(log.work_date)} ${log.check_out_time ? formatTime(log.check_out_time) : ''}'); return false;"
                title="ดูรูปถ่ายออกงาน">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
            </button>`
        : '';

    div.innerHTML = `
        <div class="history-date">${formatDate(log.work_date)}</div>
        <div class="history-details">
            <div class="history-detail-item">
                <span class="history-detail-label">เข้างาน</span>
                <span class="history-detail-value">
                    ${log.check_in_time ? formatTime(log.check_in_time) : '-'}
                    ${checkinMapButton}
                    ${checkinPhotoButton}
                </span>
            </div>
            <div class="history-detail-item">
                <span class="history-detail-label">ออกงาน</span>
                <span class="history-detail-value">
                    ${log.check_out_time ? formatTime(log.check_out_time) : '-'}
                    ${checkoutMapButton}
                    ${checkoutPhotoButton}
                </span>
            </div>
            <div class="history-detail-item">
                <span class="history-detail-label">สถานะ</span>
                <span class="history-detail-value badge ${log.status}">${getStatusText(log.status)}</span>
            </div>
        </div>
    `;

    return div;
}

// Leave Management
let leaveBalanceData = []; // Global variable to store leave balance

function loadLeaveBalance() {
    fetch('api/leave.php?action=balance', { credentials: 'same-origin' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Store balance data globally for validation
                leaveBalanceData = data.data || [];

                const balanceList = document.getElementById('leave-balance-list');
                if (!balanceList) {
                    console.warn('leave-balance-list element not found');
                    return;
                }

                balanceList.innerHTML = '';

                if (data.data.length === 0) {
                    balanceList.innerHTML = '<div class="empty-state"><p>ไม่พบข้อมูลวันลา</p></div>';
                    return;
                }

                data.data.forEach(balance => {
                    const item = createLeaveBalanceItem(balance);
                    balanceList.appendChild(item);
                });

                // Populate leave type select
                const leaveTypeSelect = document.getElementById('leave-type-select');
                if (leaveTypeSelect) {
                    leaveTypeSelect.innerHTML = '<option value="">เลือกประเภทการลา</option>';
                    data.data.forEach(balance => {
                        const option = document.createElement('option');
                        option.value = balance.leave_type_id;
                        option.textContent = `${balance.leave_type_name} (เหลือ ${balance.remaining_days} วัน)`;
                        option.dataset.remainingDays = balance.remaining_days;
                        leaveTypeSelect.appendChild(option);
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error loading leave balance:', error);
            // Don't show error to user - balance will just not update
        });
}

function createLeaveBalanceItem(balance) {
    const div = document.createElement('div');
    div.className = 'leave-balance-item';

    const iconClass = getLeaveIconClass(balance.leave_type_name);
    const icon = getLeaveIcon(balance.leave_type_name);

    div.onclick = () => showLeaveRequestModal(balance.leave_type_id);
    div.style.cursor = 'pointer';

    div.innerHTML = `
        <div class="leave-icon ${iconClass}">${icon}</div>
        <div class="leave-info">
            <div class="leave-name">${balance.leave_type_name}</div>
            <div class="leave-days">
                เหลือ <span class="leave-days-value">${balance.remaining_days}</span> จาก ${balance.total_days} วัน
            </div>
        </div>
    `;

    return div;
}

function getLeaveIconClass(leaveName) {
    if (leaveName.includes('ลากิจ')) return 'business';
    if (leaveName.includes('ลาป่วย')) return 'medical';
    if (leaveName.includes('ลาพักร้อน')) return 'vacation';
    return 'business';
}

function getLeaveIcon(leaveName) {
    if (leaveName.includes('ลากิจ')) return '💼';
    if (leaveName.includes('ลาป่วย')) return '🏥';
    if (leaveName.includes('ลาพักร้อน')) return '🌴';
    return '📅';
}

function loadLeaveRequests() {
    fetch('api/leave.php?action=requests', { credentials: 'same-origin' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const requestsList = document.getElementById('leave-requests-list');
                if (!requestsList) {
                    console.warn('leave-requests-list element not found');
                    return;
                }

                requestsList.innerHTML = '';

                if (data.data.length === 0) {
                    requestsList.innerHTML = '<div class="empty-state"><p>ไม่มีคำขอลา</p></div>';
                    return;
                }

                data.data.forEach(request => {
                    const item = createLeaveRequestItem(request);
                    requestsList.appendChild(item);
                });
            }
        })
        .catch(error => {
            console.error('Error loading leave requests:', error);
            // Don't show error to user - list will just not update
        });
}

function createLeaveRequestItem(request) {
    const div = document.createElement('div');
    div.className = 'leave-request-item';

    const statusClass = getLeaveStatusClass(request.status);

    // Show cancel button only for pending requests
    const canCancel = request.status === 'รอหัวหน้าอนุมัติ';

    div.innerHTML = `
        <div class="leave-request-header">
            <span class="leave-request-type">${request.leave_type_name}</span>
            <span class="leave-request-status ${statusClass}">${request.status}</span>
        </div>
        <div class="leave-request-dates">
            ${formatDate(request.start_date)} - ${formatDate(request.end_date)} (${request.total_days} วัน)
        </div>
        <div class="leave-request-reason">${request.reason}</div>
        ${canCancel ? `
            <div class="leave-request-actions" style="margin-top: 10px; text-align: right;">
                <button class="btn-sm btn-delete" onclick="cancelLeaveRequest(${request.id})" style="background: #dc3545; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    ยกเลิกคำขอ
                </button>
            </div>
        ` : ''}
    `;

    return div;
}

function getLeaveStatusClass(status) {
    if (status.includes('อนุมัติ')) return 'approved';
    if (status.includes('ปฏิเสธ')) return 'rejected';
    return 'pending';
}

function showLeaveRequestModal(leaveTypeId = null) {
    // Hide all other modals first
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });

    // Reset the form locally to ensure clean state
    const leaveRequestForm = document.getElementById('leave-request-form');
    if (leaveRequestForm) {
        leaveRequestForm.reset();
    }

    // Reset custom elements
    const daysCountElement = document.getElementById('leave-days-count');
    if (daysCountElement) {
        daysCountElement.textContent = '0';
    }
    document.getElementById('leave-attachment-preview').innerHTML = '';
    resizedLeaveAttachment = null;

    // Reset duration to full
    if (typeof selectLeaveDuration === 'function') {
        selectLeaveDuration('full');
    }

    // Show leave request modal
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('leave-request-modal').style.display = 'block';

    const leaveTypeSelect = document.getElementById('leave-type-select');

    // Load leave types if not locked or if empty
    if (!leaveTypeId) {
        loadLeaveTypes();
        if (leaveTypeSelect) {
            leaveTypeSelect.disabled = false;
            leaveTypeSelect.style.backgroundColor = '';
            leaveTypeSelect.style.opacity = '';
        }
    } else {
        // If locked, just set the value (assuming options are already loaded from the page view)
        if (leaveTypeSelect) {
            leaveTypeSelect.value = leaveTypeId;
            leaveTypeSelect.disabled = true;
            leaveTypeSelect.style.backgroundColor = '#f0f0f0';
            leaveTypeSelect.style.opacity = '1'; // Ensure it's readable

            // Trigger validation check since we changed the type
            // (Wait a tick to ensure DOM is ready/value is set)
            setTimeout(() => {
                const daysCount = document.getElementById('leave-days-count').textContent;
                if (daysCount && daysCount !== '0') {
                    validateLeaveBalance(parseFloat(daysCount));
                }
            }, 0);
        }
    }

    // Fetch supervisor name
    fetch('api/leave.php?action=supervisor', { credentials: 'same-origin' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const supervisorInput = document.getElementById('leave-supervisor-name');
                if (supervisorInput) {
                    supervisorInput.value = data.data.name;
                }
            }
        })
        .catch(console.error);
}

// Alias function for backward compatibility
function loadLeaveTypes() {
    loadLeaveBalance();
}

function closeModal() {
    try {
        // Hide overlay
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.add('hidden');
        }

        // Hide all modals
        const modals = document.querySelectorAll('.modal');
        if (modals && modals.length > 0) {
            modals.forEach(modal => {
                if (modal && modal.style) {
                    modal.style.display = 'none';
                }
            });
        }

        // Reset forms
        const leaveRequestForm = document.getElementById('leave-request-form');
        if (leaveRequestForm) {
            leaveRequestForm.reset();
        }

        // Re-enable leave type select
        const leaveTypeSelect = document.getElementById('leave-type-select');
        if (leaveTypeSelect) {
            leaveTypeSelect.disabled = false;
            leaveTypeSelect.style.backgroundColor = '';
            leaveTypeSelect.style.opacity = '';
        }

        // Reset submit button state
        const submitButton = document.querySelector('#leave-request-form button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'ส่งคำขอลา';
            submitButton.style.backgroundColor = '';
            submitButton.style.cursor = '';
            submitButton.style.opacity = '';
        }

        // Reset leave days count display
        const daysCountElement = document.getElementById('leave-days-count');
        if (daysCountElement) {
            daysCountElement.textContent = '0';
            daysCountElement.style.color = '';
        }

        // Remove any validation messages
        const balanceWarning = document.querySelector('.balance-warning');
        if (balanceWarning) {
            balanceWarning.remove();
        }
        const errorMessage = document.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }

        // Reset leave duration to full day
        if (typeof selectLeaveDuration === 'function') {
            selectLeaveDuration('full');
        }

        // Reset leave attachment
        if (typeof removeLeaveAttachment === 'function') {
            removeLeaveAttachment();
        }

        // Stop camera if open
        if (typeof cameraStream !== 'undefined' && cameraStream) {
            if (typeof stopCamera === 'function') {
                stopCamera();
            }
        }
    } catch (error) {
        console.error('Error in closeModal:', error);
        // Don't show error to user since this is just cleanup
    }
}

function calculateLeaveDays() {
    const duration = document.getElementById('leave-duration').value;

    if (duration === 'half') {
        // ลาครึ่งวัน - แสดง 0.5 วันเสมอ
        const halfDate = document.getElementById('leave-half-date').value;
        if (halfDate) {
            const daysCount = 0.5;
            document.getElementById('leave-days-count').textContent = daysCount;
            validateLeaveBalance(daysCount);
        }
    } else {
        // ลาเต็มวัน - คำนวณปกติ
        const startDate = document.getElementById('leave-start-date').value;
        const endDate = document.getElementById('leave-end-date').value;

        if (startDate && endDate) {
            // ตรวจสอบว่าวันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (end < start) {
                // วันที่สิ้นสุดน้อยกว่าวันที่เริ่มต้น - แสดง error
                document.getElementById('leave-days-count').textContent = '0';
                document.getElementById('leave-days-count').style.color = 'var(--danger-color)';

                // แสดงข้อความ error
                const daysCountElement = document.getElementById('leave-days-count').parentElement;
                if (!daysCountElement.querySelector('.error-message')) {
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'error-message';
                    errorMsg.style.color = 'var(--danger-color)';
                    errorMsg.style.fontSize = '12px';
                    errorMsg.style.marginTop = '4px';
                    errorMsg.textContent = '❌ วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น';
                    daysCountElement.appendChild(errorMsg);
                }
                return;
            } else {
                // ลบข้อความ error ถ้ามี
                const errorMsg = document.querySelector('.error-message');
                if (errorMsg) {
                    errorMsg.remove();
                }
                document.getElementById('leave-days-count').style.color = '';
            }

            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            document.getElementById('leave-days-count').textContent = diffDays;
            validateLeaveBalance(diffDays);
        }
    }
}

function validateLeaveBalance(requestedDays) {
    const leaveTypeSelect = document.getElementById('leave-type-select');
    const selectedLeaveTypeId = leaveTypeSelect?.value;

    if (!selectedLeaveTypeId) {
        return; // ไม่ต้องตรวจสอบถ้ายังไม่เลือกประเภทการลา
    }

    // หาข้อมูลวันลาคงเหลือจาก global variable
    const selectedLeaveType = leaveBalanceData.find(balance => balance.leave_type_id == selectedLeaveTypeId);

    if (selectedLeaveType) {
        const remainingDays = parseFloat(selectedLeaveType.remaining_days);
        const daysCountElement = document.getElementById('leave-days-count');
        const daysCountParent = daysCountElement.parentElement;

        // ลบข้อความเตือนเก่า
        const existingWarning = daysCountParent.querySelector('.balance-warning');
        if (existingWarning) {
            existingWarning.remove();
        }

        if (requestedDays > remainingDays) {
            // วันลาที่ขอเกินวันที่เหลืออยู่
            daysCountElement.style.color = 'var(--danger-color)';

            const warningMsg = document.createElement('div');
            warningMsg.className = 'balance-warning';
            warningMsg.style.color = 'var(--danger-color)';
            warningMsg.style.fontSize = '12px';
            warningMsg.style.marginTop = '4px';
            warningMsg.style.fontWeight = '600';
            warningMsg.textContent = `❌ วันลาคงเหลือไม่พอ (เหลือ ${remainingDays} วัน, ขอ ${requestedDays} วัน)`;
            daysCountParent.appendChild(warningMsg);

            // ปิดปุ่มส่งคำขอ
            const submitButton = document.querySelector('#leave-request-form button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = '🚫 วันลาคงเหลือไม่พอ';
                submitButton.style.backgroundColor = '#ccc';
                submitButton.style.cursor = 'not-allowed';
            }
        } else {
            // วันลาพอ
            daysCountElement.style.color = 'var(--success-color)';

            // เปิดปุ่มส่งคำขอ
            const submitButton = document.querySelector('#leave-request-form button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'ส่งคำขอลา';
                submitButton.style.backgroundColor = '';
                submitButton.style.cursor = '';
            }
        }
    }
}

// ฟังก์ชันเลือกระยะเวลาการลา
function selectLeaveDuration(duration) {
    const halfBtn = document.getElementById('half-day-btn');
    const fullBtn = document.getElementById('full-day-btn');
    const fullDateRow = document.getElementById('full-date-row');
    const halfDateRow = document.getElementById('half-date-row');
    const durationInput = document.getElementById('leave-duration');

    // ลบ class active ทั้งหมด
    halfBtn.classList.remove('active');
    fullBtn.classList.remove('active');

    // ลบข้อความ error ถ้ามี
    const errorMsg = document.querySelector('.error-message');
    if (errorMsg) {
        errorMsg.remove();
    }
    document.getElementById('leave-days-count').style.color = '';

    if (duration === 'half') {
        // เลือกลาครึ่งวัน
        halfBtn.classList.add('active');
        fullDateRow.style.display = 'none';
        halfDateRow.style.display = 'block';
        durationInput.value = 'half';

        // ลบ required จากฟิลด์เต็มวัน
        document.getElementById('leave-start-date').removeAttribute('required');
        document.getElementById('leave-end-date').removeAttribute('required');
        document.getElementById('leave-half-date').setAttribute('required', 'required');

        // เคลียร์ค่าเก่า
        document.getElementById('leave-start-date').value = '';
        document.getElementById('leave-end-date').value = '';
        document.getElementById('leave-days-count').textContent = '0';
    } else {
        // เลือกลาเต็มวัน
        fullBtn.classList.add('active');
        fullDateRow.style.display = ''; // Reset to CSS default (grid)
        halfDateRow.style.display = 'none';
        durationInput.value = 'full';

        // เพิ่ม required ให้ฟิลด์เต็มวัน
        document.getElementById('leave-start-date').setAttribute('required', 'required');
        document.getElementById('leave-end-date').setAttribute('required', 'required');
        document.getElementById('leave-half-date').removeAttribute('required');

        // เคลียร์ค่าเก่า
        document.getElementById('leave-half-date').value = '';
        document.getElementById('leave-days-count').textContent = '0';
    }
}

let resizedLeaveAttachment = null; // เก็บไฟล์ที่ลดขนาดแล้ว

function handleLeaveAttachment(e) {
    console.log('=== handleLeaveAttachment เริ่มทำงาน ===');

    const file = e.target.files[0];
    if (!file) {
        console.log('ไม่มีไฟล์ที่เลือก');
        return;
    }

    console.log('ไฟล์ที่เลือก:', file.name, 'ขนาด:', (file.size / 1024).toFixed(2), 'KB', 'ประเภท:', file.type);

    // ตรวจสอบว่าเป็นไฟล์รูปภาพหรือไม่
    if (!file.type.startsWith('image/')) {
        console.error('ไฟล์ไม่ใช่รูปภาพ:', file.type);
        showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
        e.target.value = '';
        return;
    }

    // แสดง loading
    showToast('กำลังประมวลผลรูปภาพ...', 'info');

    // อ่านและย่อรูปภาพลง 50%
    console.log('เริ่มย่อรูปภาพ...');
    resizeImage(file, 0.5).then(resizedBlob => {
        console.log('ย่อรูปสำเร็จ, ขนาดใหม่:', (resizedBlob.size / 1024).toFixed(2), 'KB');

        // เก็บไฟล์ที่ย่อแล้ว
        resizedLeaveAttachment = new File([resizedBlob], file.name, { type: file.type });
        console.log('บันทึก resizedLeaveAttachment สำเร็จ');

        // แสดง preview
        const reader = new FileReader();
        reader.onload = function (event) {
            const preview = document.getElementById('leave-attachment-preview');
            if (preview) {
                preview.innerHTML = `
                    <div style="position: relative; display: inline-block;">
                        <img src="${event.target.result}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 10px;">
                        <button type="button" onclick="removeLeaveAttachment()" style="position: absolute; top: 5px; right: 5px; background: red; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 16px; line-height: 1;">×</button>
                    </div>
                    <p style="margin-top: 5px; color: #666; font-size: 13px;">ขนาดไฟล์: ${(resizedBlob.size / 1024).toFixed(2)} KB (ลดจาก ${(file.size / 1024).toFixed(2)} KB)</p>
                `;
                console.log('แสดง preview สำเร็จ');
            } else {
                console.error('ไม่พบ element leave-attachment-preview');
            }
        };
        reader.readAsDataURL(resizedBlob);

        showToast('ประมวลผลรูปภาพสำเร็จ', 'success');
    }).catch(error => {
        console.error('เกิดข้อผิดพลาดในการย่อรูป:', error);
        showToast('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ: ' + error.message, 'error');
        e.target.value = '';
    });
}

function removeLeaveAttachment() {
    resizedLeaveAttachment = null;

    const leaveAttachment = document.getElementById('leave-attachment');
    if (leaveAttachment) {
        leaveAttachment.value = '';
    }

    const leaveAttachmentCamera = document.getElementById('leave-attachment-camera');
    if (leaveAttachmentCamera) {
        leaveAttachmentCamera.value = '';
    }

    const leaveAttachmentPreview = document.getElementById('leave-attachment-preview');
    if (leaveAttachmentPreview) {
        leaveAttachmentPreview.innerHTML = '';
    }
}

function handleLeaveRequest(e) {
    e.preventDefault();

    console.log('=== handleLeaveRequest เริ่มทำงาน ===');

    // ป้องกันการกดซ้ำ - ปิดปุ่มชั่วคราว
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    if (submitButton.disabled) {
        console.log('ปุ่มถูกปิดใช้งานอยู่แล้ว - ไม่ทำอะไร');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = '⏳ กำลังส่งคำขอลา...';
    submitButton.style.cursor = 'not-allowed';
    submitButton.style.opacity = '0.6';

    // ตรวจสอบข้อมูลฟอร์ม
    const leaveType = document.getElementById('leave-type-select')?.value;
    const duration = document.getElementById('leave-duration')?.value;
    const startDate = document.getElementById('leave-start-date')?.value;
    const endDate = document.getElementById('leave-end-date')?.value;
    const halfDate = document.getElementById('leave-half-date')?.value;
    const reason = document.getElementById('leave-reason')?.value;

    console.log('ข้อมูลที่กรอก:');
    console.log('  - ประเภทการลา:', leaveType);
    console.log('  - ระยะเวลา:', duration);
    console.log('  - วันที่เริ่ม:', startDate);
    console.log('  - วันที่สิ้นสุด:', endDate);
    console.log('  - วันที่ลาครึ่งวัน:', halfDate);
    console.log('  - เหตุผล:', reason);
    console.log('  - มีไฟล์แนบ:', !!resizedLeaveAttachment);

    // ตรวจสอบว่ากรอกข้อมูลครบหรือไม่
    if (!leaveType) {
        console.error('ไม่ได้เลือกประเภทการลา');
        showToast('❌ กรุณาเลือกประเภทการลา', 'error');
        resetSubmitButton(submitButton, originalText);
        return;
    }

    if (duration === 'half') {
        // ตรวจสอบสำหรับลาครึ่งวัน
        if (!halfDate) {
            console.error('ไม่ได้เลือกวันที่ลาครึ่งวัน');
            showToast('❌ กรุณาเลือกวันที่ลาครึ่งวัน', 'error');
            resetSubmitButton(submitButton, originalText);
            return;
        }
    } else {
        // ตรวจสอบสำหรับลาเต็มวัน
        if (!startDate) {
            console.error('ไม่ได้เลือกวันที่เริ่มลา');
            showToast('❌ กรุณาเลือกวันที่เริ่มลา', 'error');
            resetSubmitButton(submitButton, originalText);
            return;
        }

        if (!endDate) {
            console.error('ไม่ได้เลือกวันที่สิ้นสุด');
            showToast('❌ กรุณาเลือกวันที่สิ้นสุด', 'error');
            resetSubmitButton(submitButton, originalText);
            return;
        }

        // ตรวจสอบวันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) {
            console.error('วันที่สิ้นสุดน้อยกว่าวันที่เริ่มต้น');
            showToast('❌ วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น', 'error');
            resetSubmitButton(submitButton, originalText);
            return;
        }
    }

    if (!reason || reason.trim() === '') {
        console.error('ไม่ได้กรอกเหตุผลการลา');
        showToast('❌ กรุณากรอกเหตุผลการลา', 'error');
        resetSubmitButton(submitButton, originalText);
        return;
    }

    // ตรวจสอบว่ามีการอัพโหลดรูปหรือไม่
    if (!resizedLeaveAttachment) {
        console.error('ไม่มีไฟล์แนบ - resizedLeaveAttachment is null');
        showToast('❌ กรุณาแนบรูปภาพประกอบการลา (บังคับ)', 'error');
        resetSubmitButton(submitButton, originalText);
        return;
    }

    // ตรวจสอบวันลาคงเหลือ
    const selectedLeaveType = leaveBalanceData.find(balance => balance.leave_type_id == leaveType);
    if (selectedLeaveType) {
        const remainingDays = parseFloat(selectedLeaveType.remaining_days);
        let requestedDays = 0;

        if (duration === 'half') {
            requestedDays = 0.5;
        } else {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end - start);
            requestedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        if (requestedDays > remainingDays) {
            console.error('วันลาคงเหลือไม่พอ');
            showToast(`❌ วันลาคงเหลือไม่พอ (เหลือ ${remainingDays} วัน, ขอ ${requestedDays} วัน)`, 'error');
            resetSubmitButton(submitButton, originalText);
            return;
        }
    }

    console.log('✓ ผ่านการตรวจสอบข้อมูลทั้งหมด');

    const formData = new FormData(e.target);

    // เพิ่มข้อมูลประเภทการลา (กรณีที่ select ถูก disabled จะไม่ถูกรวมใน FormData)
    if (leaveType) {
        formData.append('leave-type-select', leaveType);
    }

    // เพิ่มข้อมูลระยะเวลาการลา
    formData.append('leave-duration', duration);

    // สำหรับลาครึ่งวัน - ใช้ halfDate เป็นทั้ง start_date และ end_date
    if (duration === 'half') {
        formData.delete('leave-start-date');
        formData.delete('leave-end-date');
        formData.append('leave-start-date', halfDate);
        formData.append('leave-end-date', halfDate);
    }

    // แสดงข้อมูลที่จะส่ง
    console.log('ข้อมูลฟอร์มที่จะส่ง:');
    for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
            console.log(`  ${pair[0]}: [File] ${pair[1].name}`);
        } else {
            console.log(`  ${pair[0]}: ${pair[1]}`);
        }
    }

    // ลบไฟล์เดิมและใช้ไฟล์ที่ลดขนาดแล้วแทน
    formData.delete('leave-attachment');
    formData.append('leave-attachment', resizedLeaveAttachment);
    console.log('เพิ่มไฟล์ที่ลดขนาดแล้ว');

    console.log('กำลังส่งข้อมูลไปยัง API...');

    fetch('api/leave.php?action=request', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
    })
        .then(res => {
            console.log('Response status:', res.status);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            console.log('Response data:', data);
            if (data.success) {
                console.log('✓ ส่งคำขอลาสำเร็จ');
                showToast('ส่งคำขอลาสำเร็จ', 'success');
                closeModal();
                loadLeaveRequests();
                loadLeaveBalance();
                // Reset
                resizedLeaveAttachment = null;
            } else {
                console.error('API Error:', data.message);
                showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
            }
            // คืนค่าปุ่มทุกกรณี
            resetSubmitButton(submitButton, originalText);
        })
        .catch(error => {
            console.error('Fetch Error:', error);
            showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
            // คืนค่าปุ่มเมื่อเกิด error
            resetSubmitButton(submitButton, originalText);
        });
}

// ฟังก์ชันคืนค่าปุ่มส่งคำขอลา
function resetSubmitButton(button, originalText) {
    if (button) {
        button.disabled = false;
        button.textContent = originalText;
        button.style.cursor = '';
        button.style.opacity = '';
        console.log('คืนค่าปุ่มเป็นปกติแล้ว');
    }
}

function cancelLeaveRequest(requestId) {
    if (!confirm('คุณต้องการยกเลิกคำขอลานี้ใช่หรือไม่?')) {
        return;
    }

    const formData = new FormData();
    formData.append('request_id', requestId);

    fetch('api/leave.php?action=cancel', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('ยกเลิกคำขอลาสำเร็จ', 'success');
                loadLeaveRequests();
                loadLeaveBalance();
            } else {
                showToast(data.message, 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
}

// Account Management
function loadAccountData() {
    console.log('🔧 loadAccountData() function called');
    if (!state.user) {
        console.log('❌ No user in state, cannot load account data');
        return;
    }

    console.log('🔧 Fetching employee profile from API...');
    fetch('api/employee.php?action=profile', { credentials: 'same-origin' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const employee = data.data;

                // สร้าง URL จาก relative path เพื่อให้ทำงานได้ทั้ง localhost และ production
                const profilePhotoUrl = employee.profile_photo_path
                    ? getAbsoluteUrl(employee.profile_photo_path)
                    : 'assets/images/default-avatar.png';

                document.getElementById('account-profile-photo').src = profilePhotoUrl;
                document.getElementById('account-employee-code').value = employee.employee_code;
                document.getElementById('account-first-name').value = employee.first_name;
                document.getElementById('account-last-name').value = employee.last_name;
                document.getElementById('account-birth-date').value = employee.birth_date || '';
                document.getElementById('account-address').value = employee.address || '';
                document.getElementById('account-sub-district').value = employee.sub_district || '';
                document.getElementById('account-district').value = employee.district || '';
                document.getElementById('account-province').value = employee.province || '';

                // Debug: Check if function exists and employee data
                console.log('🔍 Debug - Employee data:', {
                    province: employee.province,
                    district: employee.district,
                    sub_district: employee.sub_district
                });
                console.log('🔍 Debug - Function exists:', typeof initializeAccountAddressDropdowns);

                // Initialize Thai address dropdowns for account page and populate with current values
                if (typeof initializeAccountAddressDropdowns === 'function') {
                    console.log('🔧 Calling initializeAccountAddressDropdowns');
                    initializeAccountAddressDropdowns(employee.province, employee.district, employee.sub_district);
                } else {
                    console.error('❌ initializeAccountAddressDropdowns function not found');
                }

                // ตรวจสอบให้แน่ใจว่าฟิลด์ที่อยู่สามารถแก้ไขได้เสมอ
                const addressFields = [
                    'account-address', 'account-sub-district', 'account-district', 'account-province'
                ];
                addressFields.forEach(fieldId => {
                    const field = document.getElementById(fieldId);
                    if (field) {
                        field.readOnly = false;
                        field.disabled = false;
                        field.style.backgroundColor = '';
                        field.style.cursor = '';
                    }
                });

                document.getElementById('account-email').value = employee.email || '';
                document.getElementById('account-employee-type').value = employee.employee_type || '';
                console.log('🔍 Account employee_type:', employee.employee_type);
                document.getElementById('account-department').value = employee.department_name || '-';
                document.getElementById('account-start-date').value = employee.start_date || '';

                // ถ้ามีโปรไฟล์แล้ว ให้ disable เฉพาะฟิลด์ที่ไม่ควรแก้ไข (ยกเว้นที่อยู่)
                if (employee.profile_photo) {
                    document.getElementById('account-first-name').readOnly = true;
                    document.getElementById('account-last-name').readOnly = true;
                    document.getElementById('account-birth-date').readOnly = true;
                    document.getElementById('account-email').readOnly = true;

                    // เพิ่มสไตล์ให้ดูเป็น disabled (ยกเว้นฟิลด์ที่อยู่)
                    const disabledFields = [
                        'account-first-name', 'account-last-name', 'account-birth-date', 'account-email'
                    ];
                    disabledFields.forEach(fieldId => {
                        const field = document.getElementById(fieldId);
                        if (field) {
                            field.style.backgroundColor = '#f5f5f5';
                            field.style.cursor = 'not-allowed';
                        }
                    });

                    // ตรวจสอบให้แน่ใจว่าฟิลด์ที่อยู่สามารถแก้ไขได้ (ซ้ำอีกครั้งเพื่อความแน่ใจ)
                    addressFields.forEach(fieldId => {
                        const field = document.getElementById(fieldId);
                        if (field) {
                            field.readOnly = false;
                            field.disabled = false;
                            field.style.backgroundColor = '';
                            field.style.cursor = '';
                        }
                    });
                }

                if (employee.id_card_photo_path) {
                    const idCardUrl = getAbsoluteUrl(employee.id_card_photo_path);
                    document.getElementById('id-card-preview').src = idCardUrl;
                    document.getElementById('id-card-preview').style.display = 'block';
                }
            }
        });
}

function handleAccountUpdate(e) {
    e.preventDefault();

    const formData = new FormData(e.target);

    fetch('api/employee.php?action=update', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('บันทึกข้อมูลสำเร็จ', 'success');
                loadUserData();
            } else {
                showToast(data.message, 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
}

function handleProfilePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // ตรวจสอบว่าเป็นไฟล์รูปภาพหรือไม่
    if (!file.type.startsWith('image/')) {
        showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
        return;
    }

    // แสดง loading
    showToast('กำลังประมวลผลรูปภาพ...', 'info');

    // อ่านและย่อรูปภาพก่อนอัพโหลด
    resizeImage(file, 0.5).then(resizedBlob => {
        const formData = new FormData();
        formData.append('profile_photo', resizedBlob, file.name);

        fetch('api/employee.php?action=upload_photo', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // อัพเดทรูปภาพทั้ง 2 ที่
                    document.getElementById('account-profile-photo').src = data.data.url;
                    document.getElementById('profile-photo').src = data.data.url;
                    showToast('อัพโหลดรูปภาพสำเร็จ', 'success');
                } else {
                    showToast(data.message, 'error');
                }
            })
            .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
    }).catch(error => {
        showToast('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ', 'error');
        console.error(error);
    });
}

function handleIdCardUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // ตรวจสอบว่าเป็นไฟล์รูปภาพหรือไม่
    if (!file.type.startsWith('image/')) {
        showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
        return;
    }

    // แสดง loading
    showToast('กำลังประมวลผลรูปภาพ...', 'info');

    // อ่านและย่อรูปภาพก่อนอัพโหลด
    resizeImage(file, 0.5).then(resizedBlob => {
        const formData = new FormData();
        formData.append('id_card', resizedBlob, file.name);

        fetch('api/employee.php?action=upload_id_card', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // อัพเดทรูปภาพ preview
                    const idCardUrl = data.data.url || getAbsoluteUrl(data.data.path);
                    document.getElementById('id-card-preview').src = idCardUrl;
                    document.getElementById('id-card-preview').style.display = 'block';
                    showToast('อัพโหลดรูปบัตรประชาชนสำเร็จ', 'success');

                    // เคลียร์ input เพื่อให้สามารถเลือกรูปเดิมซ้ำได้
                    e.target.value = '';
                } else {
                    showToast(data.message, 'error');
                }
            })
            .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
    }).catch(error => {
        showToast('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ', 'error');
        console.error(error);
    });
}

// ฟังก์ชันสำหรับย่อขนาดรูปภาพ
function resizeImage(file, scaleFactor) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                // สร้าง canvas สำหรับย่อรูป
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // คำนวณขนาดใหม่ (50% ของขนาดเดิม)
                const newWidth = Math.round(img.width * scaleFactor);
                const newHeight = Math.round(img.height * scaleFactor);

                canvas.width = newWidth;
                canvas.height = newHeight;

                // วาดรูปภาพที่ย่อขนาดแล้ว
                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                // แปลง canvas เป็น blob
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('ไม่สามารถสร้างรูปภาพได้'));
                    }
                }, file.type, 0.9); // ใช้ quality 0.9 เพื่อคุณภาพที่ดี
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Payslip Management
function initializePayslipPage() {
    // Populate year dropdown
    const yearSelect = document.getElementById('payslip-year');
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';

        // Add years from current year to 5 years back
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year + 543; // Convert to Buddhist year
            yearSelect.appendChild(option);
        }
    }

    // Load payslips for current year
    loadPayslips();
}

function loadPayslips() {
    const year = document.getElementById('payslip-year')?.value || new Date().getFullYear();

    fetch(`api/payslip.php?action=list&year=${year}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderPayslips(data.data);
            } else {
                showToast(data.message || 'ไม่สามารถโหลดข้อมูลสลิปเงินเดือนได้', 'error');
            }
        })
        .catch(error => {
            console.error('Error loading payslips:', error);
            showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
        });
}

function renderPayslips(payslips) {
    const payslipList = document.getElementById('payslip-list');

    if (!payslips || payslips.length === 0) {
        payslipList.innerHTML = `
            <div class="payslip-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <p>ไม่พบข้อมูลสลิปเงินเดือน</p>
                <small>สลิปเงินเดือนจะแสดงเมื่อบริษัทออกสลิป</small>
            </div>
        `;
        return;
    }

    const monthNames = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    payslipList.innerHTML = payslips.map(payslip => {
        const monthName = monthNames[payslip.month - 1];
        const yearThai = parseInt(payslip.year) + 543;
        const totalIncome = parseFloat(payslip.basic_salary || 0) + parseFloat(payslip.allowances || 0) + parseFloat(payslip.overtime_pay || 0) + parseFloat(payslip.bonus || 0);
        const totalDeductions = parseFloat(payslip.deductions || 0) + parseFloat(payslip.tax || 0) + parseFloat(payslip.social_security || 0);
        const netSalary = parseFloat(payslip.net_salary || 0);

        return `
            <div class="payslip-item">
                <div class="payslip-item-header">
                    <div class="payslip-month">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        ${monthName} ${yearThai}
                    </div>
                    <span class="payslip-status ${payslip.status === 'paid' ? 'available' : 'pending'}">
                        ${payslip.status === 'paid' ? 'จ่ายแล้ว' : 'รอจ่าย'}
                    </span>
                </div>
                
                <div class="payslip-item-body">
                    <div class="payslip-detail" style="grid-column: 1 / -1;">
                        <span class="payslip-detail-label">รายได้สุทธิ</span>
                        <span class="payslip-detail-value highlight">฿${netSalary.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                
                <div class="payslip-item-footer">
                    <button class="btn-download-payslip" onclick="downloadPayslip(${payslip.id})" ${payslip.status !== 'paid' ? 'disabled' : ''}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        ดาวน์โหลด
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function downloadPayslip(payslipId) {
    // Show loading toast
    showToast('กำลังดาวน์โหลดสลิปเงินเดือน...', 'info');

    // Open download in new window
    window.open(`api/payslip.php?action=download&id=${payslipId}`, '_blank');
}

// Utility Functions
function getAbsoluteUrl(relativePath) {
    // สร้าง absolute URL จาก relative path โดยใช้ current domain
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    return baseUrl + relativePath;
}

function formatTime(timeStr) {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getStatusText(status) {
    const statusMap = {
        'on_time': 'ตรงเวลา',
        'late': 'สาย',
        'early': 'เข้าก่อนเวลา',
        'absent': 'ขาดงาน'
    };
    return statusMap[status] || status;
}

function showToast(message, type = 'info') {
    let toast = document.getElementById('toast');

    // Create toast element if it doesn't exist
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Install PWA prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show install button/banner if needed
    console.log('PWA can be installed');
});

window.addEventListener('appinstalled', () => {
    console.log('PWA installed');
    deferredPrompt = null;
});

// ============================================
// Check-in Camera Modal Functions
// ============================================

let cameraStream = null;
let capturedPhotoData = null;
let allBranches = [];
let selectedBranch = null;
let checkinMode = 'checkin'; // 'checkin' or 'checkout'
let todayLog = null; // เก็บข้อมูลการเข้างานวันนี้

// Open check-in modal when check-in button is clicked
function openCheckinModal() {
    // Hide all other modals first
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });

    // Update modal title
    const modalTitle = document.querySelector('#checkin-camera-modal .modal-header h2');
    if (modalTitle) {
        modalTitle.textContent = 'เช็คเข้างาน';
    }

    // Update button text
    const confirmBtn = document.getElementById('btn-confirm-checkin');
    if (confirmBtn) {
        confirmBtn.textContent = 'เข้างาน';
    }

    // Show branch selection
    const branchGroup = document.querySelector('#checkin-camera-modal .form-group');
    if (branchGroup && branchGroup.querySelector('#checkin-branch-select')) {
        branchGroup.style.display = 'block';
    }

    // Load branches that employee can see
    fetch('api/employee.php?action=get_branches', { credentials: 'same-origin' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allBranches = data.data;

                const branchSelect = document.getElementById('checkin-branch-select');
                branchSelect.innerHTML = '<option value="">-- เลือกสาขา --</option>';

                if (allBranches.length === 0) {
                    branchSelect.innerHTML = '<option value="">-- ไม่มีสาขาที่สามารถเลือกได้ --</option>';
                    showToast('คุณยังไม่ได้รับสิทธิ์ในการเข้างานที่สาขาใด กรุณาติดต่อผู้ดูแลระบบ', 'warning');
                } else {
                    allBranches.forEach(branch => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        branchSelect.appendChild(option);
                    });
                }
            } else {
                showToast(data.message || 'ไม่สามารถโหลดข้อมูลสาขาได้', 'error');
            }
        })
        .catch(err => {
            console.error('Error loading branches:', err);
            showToast('ไม่สามารถโหลดข้อมูลสาขาได้', 'error');
        });

    // Load available flexible shifts
    fetch('api/employee.php?action=get_flexible_shifts', { credentials: 'same-origin' })
        .then(res => res.json())
        .then(data => {
            const shiftGroup = document.getElementById('checkin-shift-group');
            const shiftSelect = document.getElementById('checkin-shift-select');
            
            if (data.success && data.data && data.data.length > 0) {
                if (shiftGroup) shiftGroup.style.display = 'block';
                if (shiftSelect) {
                    shiftSelect.innerHTML = '<option value="">-- เลือกกะการทำงาน (ของวันนี้) --</option>';
                    data.data.forEach(shift => {
                        const option = document.createElement('option');
                        option.value = shift.id;
                        option.textContent = `${shift.name} (${shift.start_time.substring(0,5)} - ${shift.end_time.substring(0,5)})`;
                        shiftSelect.appendChild(option);
                    });
                }
            } else {
                if (shiftGroup) shiftGroup.style.display = 'none';
                if (shiftSelect) shiftSelect.innerHTML = '';
            }
        })
        .catch(err => console.error('Error loading shifts:', err));

    // Open modal
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('checkin-camera-modal').style.display = 'block';

    // Start camera
    startCamera();
}

// Open checkout modal
function openCheckoutModal() {
    // Hide all other modals first
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });

    // Update modal title - แสดงวันที่ที่จะออกงาน
    const modalTitle = document.querySelector('#checkin-camera-modal .modal-header h2');
    if (modalTitle) {
        if (todayLog && todayLog.work_date) {
            const workDate = new Date(todayLog.work_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            workDate.setHours(0, 0, 0, 0);

            if (workDate.getTime() === today.getTime()) {
                modalTitle.textContent = 'เช็คออกงาน';
            } else {
                const dateStr = new Date(todayLog.work_date).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                modalTitle.textContent = `เช็คออกงาน (${dateStr})`;
            }
        } else {
            modalTitle.textContent = 'เช็คออกงาน';
        }
    }

    // Update button text
    const confirmBtn = document.getElementById('btn-confirm-checkin');
    if (confirmBtn) {
        confirmBtn.textContent = 'ออกงาน';
    }

    // Check if we have todayLog data, if not, fetch it again
    if (!todayLog || !todayLog.branch_id) {
        console.log('No todayLog or branch_id, fetching pending checkout data...');
        fetch('api/timelog.php?action=pending_checkout', { credentials: 'same-origin' })
            .then(res => res.json())
            .then(pendingData => {
                console.log('Fetched pending checkout data:', pendingData);
                if (pendingData.success && pendingData.data) {
                    todayLog = pendingData.data;
                    console.log('Updated todayLog:', todayLog);
                    // Now setup branch selection with the updated data
                    setupBranchSelectionForCheckout();
                } else {
                    console.log('No pending checkout found');
                    setupBranchSelectionForCheckout();
                }
            })
            .catch(error => {
                console.error('Error fetching pending checkout:', error);
                setupBranchSelectionForCheckout();
            });
    } else {
        setupBranchSelectionForCheckout();
    }

    // Get current location for checkout
    if (!state.currentLocation) {
        getCurrentLocation();
    }

    // Open modal
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('checkin-camera-modal').style.display = 'block';

    // Start camera
    startCamera();
}

// Separate function to setup branch selection for checkout
function setupBranchSelectionForCheckout() {
    // Show branch selection for checkout (but disabled)
    const branchGroup = document.querySelector('#checkin-camera-modal .form-group');
    if (branchGroup && branchGroup.querySelector('#checkin-branch-select')) {
        const branchSelect = branchGroup.querySelector('#checkin-branch-select');
        const branchLabel = branchGroup.querySelector('label');

        // Debug: Log todayLog to check if branch_id exists
        console.log('TodayLog for checkout:', todayLog);

        // First load all branches to populate the dropdown
        fetch(`api/timelog.php?action=branches`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    console.log('Branches loaded:', data.data);

                    // Clear and populate dropdown
                    branchSelect.innerHTML = '<option value="">-- เลือกสาขา --</option>';
                    data.data.forEach(branch => {
                        const option = document.createElement('option');
                        option.value = branch.id;
                        option.textContent = branch.name;
                        branchSelect.appendChild(option);
                    });

                    // Set and disable the branch from pending check-in
                    if (todayLog && todayLog.branch_id) {
                        console.log('Setting branch to:', todayLog.branch_id);
                        const branch = data.data.find(b => b.id == todayLog.branch_id);
                        if (branch) {
                            branchSelect.value = todayLog.branch_id;
                            branchSelect.disabled = true;
                            selectedBranch = branch;

                            // Update label to indicate this is the check-in branch
                            if (branchLabel) {
                                branchLabel.innerHTML = 'สาขาที่เข้างาน <span style="color: #666;">(ไม่สามารถแก้ไขได้)</span>';
                            }

                            // Show location status for checkout
                            checkBranchDistanceForCheckout();
                        } else {
                            console.error('Branch not found for ID:', todayLog.branch_id);
                            // Branch not found in list, enable selection
                            branchSelect.disabled = false;
                            if (branchLabel) {
                                branchLabel.innerHTML = 'เลือกสาขา <span style="color: red;">*</span>';
                            }
                        }
                    } else {
                        console.log('No branch_id in todayLog');
                        // No branch found, enable selection
                        branchSelect.disabled = false;
                        if (branchLabel) {
                            branchLabel.innerHTML = 'เลือกสาขา <span style="color: red;">*</span>';
                        }
                    }
                } else {
                    console.error('Failed to load branches:', data);
                }
            })
            .catch(error => {
                console.error('Error loading branches:', error);
                // If loading fails, at least disable the select if we have today's branch
                if (todayLog && todayLog.branch_id) {
                    branchSelect.value = todayLog.branch_id;
                    branchSelect.disabled = true;
                    if (branchLabel) {
                        branchLabel.innerHTML = 'สาขาที่เข้างาน <span style="color: #666;">(ไม่สามารถแก้ไขได้)</span>';
                    }
                }
            });
    }
}

function closeCheckinModal() {
    // Hide overlay and modal
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('checkin-camera-modal').style.display = 'none';

    // Stop camera
    stopCamera();

    // Reset
    resetCheckinModal();
}

function resetCheckinModal() {
    capturedPhotoData = null;
    selectedBranch = null;

    document.getElementById('camera-video').style.display = 'block';
    document.getElementById('captured-photo').style.display = 'none';

    // Reset capture button (deprecated)
    // document.getElementById('btn-capture').style.display = 'block';
    document.getElementById('btn-retake').style.display = 'none';

    // Hide auto-capture indicator if exists
    const autoCaptureIndicator = document.getElementById('auto-capture-indicator');
    if (autoCaptureIndicator) {
        autoCaptureIndicator.style.display = 'none';
    }

    // Reset branch select and label
    const branchSelect = document.getElementById('checkin-branch-select');
    const branchGroup = document.querySelector('#checkin-camera-modal .form-group');
    const branchLabel = branchGroup ? branchGroup.querySelector('label') : null;

    if (branchSelect) {
        branchSelect.value = '';
        branchSelect.disabled = false;
    }

    if (branchLabel) {
        branchLabel.innerHTML = 'เลือกสาขา <span style="color: red;">*</span>';
    }

    // Hide location status
    const locationStatus = document.getElementById('location-status');
    if (locationStatus) {
        locationStatus.style.display = 'none';
    }
    
    // Hide shift group
    const shiftGroup = document.getElementById('checkin-shift-group');
    if (shiftGroup) {
        shiftGroup.style.display = 'none';
    }

    // Disable confirm button
    const confirmBtn = document.getElementById('btn-confirm-checkin');
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }
}

// Global flag to indicate auto capture is enabled
// Global flag to indicate auto capture is enabled
// let autoCaptureModeEnabled = true; // Deprecated - always enabled

// Start camera
async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        const video = document.getElementById('camera-video');
        video.srcObject = cameraStream;

        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
        });

        video.play();

        // Set up auto-capture mode - hide manual capture button
        // Set up auto-capture mode - always enabled
        const indicator = document.getElementById('auto-capture-indicator');
        if (indicator) {
            indicator.style.display = 'block';
        }

        // Start face detection if available
        if (typeof startFaceDetection === 'function') {
            setTimeout(() => {
                startFaceDetection();
            }, 1000); // Slight delay to ensure video is playing
        }

        showToast('กล้องพร้อมใช้งาน', 'success');
    } catch (err) {
        console.error('Error accessing camera:', err);
        showToast('ไม่สามารถเปิดกล้องได้: ' + err.message, 'error');
    }
}

// Stop camera
function stopCamera() {
    // Stop camera stream
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    // Stop face detection if available
    if (typeof stopFaceDetection === 'function') {
        stopFaceDetection();
    }
}

// Capture photo
function capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const ctx = canvas.getContext('2d');

    // Check if video is ready
    if (!video.videoWidth || !video.videoHeight) {
        showToast('กรุณารอสักครู่ กล้องยังไม่พร้อม', 'warning');
        console.error('Video not ready:', video.videoWidth, video.videoHeight);
        return;
    }

    // Check for face detection if available
    if (typeof isFaceValid === 'function') {
        if (!isFaceValid()) {
            showToast('ไม่สามารถตรวจจับใบหน้าได้ กรุณาจัดตำแหน่งใบหน้าให้อยู่ในกรอบ', 'error');
            return;
        }
    }

    // Set canvas size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    console.log('Canvas size:', canvas.width, 'x', canvas.height);

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Get image data
    capturedPhotoData = canvas.toDataURL('image/jpeg', 0.8);

    // Validate photo data
    if (!capturedPhotoData || capturedPhotoData === 'data:,' || capturedPhotoData.length < 100) {
        showToast('เกิดข้อผิดพลาดในการถ่ายรูป กรุณาลองใหม่', 'error');
        console.error('Invalid photo data:', capturedPhotoData);
        capturedPhotoData = null;
        return;
    }

    console.log('Photo captured successfully, size:', capturedPhotoData.length, 'bytes');

    // Show captured photo
    document.getElementById('photo-preview').src = capturedPhotoData;
    document.getElementById('camera-video').style.display = 'none';
    document.getElementById('captured-photo').style.display = 'block';
    // document.getElementById('btn-capture').style.display = 'none';
    document.getElementById('btn-retake').style.display = 'block';

    // Hide the entire camera container (black frame) after capturing
    const cameraContainer = document.querySelector('.camera-container');
    if (cameraContainer) {
        cameraContainer.style.display = 'none';
    }

    // Hide camera overlay (white circle) after capturing
    const cameraOverlay = document.querySelector('.camera-overlay');
    if (cameraOverlay) {
        cameraOverlay.style.display = 'none';
    }

    // Enable confirm button after photo is captured
    // For checkout mode, enable button immediately since we don't need to check location
    const confirmBtn = document.getElementById('btn-confirm-checkin');
    if (checkinMode === 'checkout') {
        // For checkout, enable button immediately after taking photo
        // We only need: 1) photo captured 2) selected branch 3) location
        // Branch is already set from today's check-in, location will be obtained
        if (capturedPhotoData) {
            // Enable button if we have photo
            // Location will be checked again when confirming
            confirmBtn.disabled = false;
            showToast('ถ่ายรูปสำเร็จ กดปุ่มออกงานได้เลย', 'success');
        }
    }
    // For checkin mode, button will be enabled by checkBranchDistance()

    // Stop camera
    stopCamera();
}

// Retake photo
function retakePhoto() {
    capturedPhotoData = null;

    document.getElementById('camera-video').style.display = 'block';
    document.getElementById('captured-photo').style.display = 'none';
    // document.getElementById('btn-capture').style.display = 'block';
    document.getElementById('btn-retake').style.display = 'none';

    // Show camera container again when retaking photo
    const cameraContainer = document.querySelector('.camera-container');
    if (cameraContainer) {
        cameraContainer.style.display = 'block';
    }

    // Show camera overlay again when retaking photo
    const cameraOverlay = document.querySelector('.camera-overlay');
    if (cameraOverlay) {
        cameraOverlay.style.display = 'block';
    }

    // Disable confirm button when retaking photo
    const confirmBtn = document.getElementById('btn-confirm-checkin');
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }

    // Restart camera
    startCamera();
}

// Calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance); // Return distance in meters
}

// Check branch distance for checkout
function checkBranchDistanceForCheckout() {
    const statusDiv = document.getElementById('location-status');
    const confirmBtn = document.getElementById('btn-confirm-checkin');

    if (!selectedBranch || !state.currentLocation) {
        // Hide status if no branch or location
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
        return;
    }

    // Show loading
    statusDiv.style.display = 'block';
    statusDiv.className = 'location-status';
    document.getElementById('status-text').textContent = 'กำลังตรวจสอบตำแหน่ง...';
    document.getElementById('distance-text').textContent = 'กรุณารอสักครู่';

    // Calculate distance
    const distance = calculateDistance(
        state.currentLocation.lat,
        state.currentLocation.lng,
        parseFloat(selectedBranch.latitude),
        parseFloat(selectedBranch.longitude)
    );

    // Update status
    const statusText = document.getElementById('status-text');
    const distanceText = document.getElementById('distance-text');

    // Show accuracy warning if needed
    let distanceDisplay = `ระยะทาง: ${distance} เมตร`;
    if (state.currentLocation.accuracy > 100) {
        distanceDisplay += ` (ความแม่นยำ ±${Math.round(state.currentLocation.accuracy)}ม.)`;
    }
    distanceText.textContent = distanceDisplay;

    // Check if within radius
    const isWithinRadius = distance <= parseInt(selectedBranch.radius);
    const canCheckoutOutside = selectedBranch.allow_checkout_outside == 1;

    if (isWithinRadius) {
        // Within radius - green
        statusDiv.className = 'location-status status-success';
        statusText.textContent = 'ออกงานได้';
        confirmBtn.disabled = false;
    } else if (canCheckoutOutside) {
        // Outside but allowed - orange
        statusDiv.className = 'location-status status-warning';
        statusText.textContent = 'คุณอยู่นอกตำแหน่ง (แต่สามารถออกงานได้)';
        confirmBtn.disabled = false;
    } else {
        // Outside and not allowed - red
        statusDiv.className = 'location-status status-error';
        statusText.textContent = 'คุณอยู่นอกพิกัดเข้างาน';
        confirmBtn.disabled = true;
    }
}

// Check branch distance
function checkBranchDistance() {
    const branchId = document.getElementById('checkin-branch-select').value;
    const statusDiv = document.getElementById('location-status');
    const retryBtn = document.getElementById('btn-retry-location');

    if (!branchId) {
        statusDiv.style.display = 'none';
        document.getElementById('btn-confirm-checkin').disabled = true;
        return;
    }

    // Find selected branch
    selectedBranch = allBranches.find(b => b.id == branchId);

    if (!selectedBranch) return;

    // Get current location
    if (!state.currentLocation) {
        // Show loading status
        statusDiv.style.display = 'block';
        statusDiv.className = 'location-status';
        document.getElementById('status-text').textContent = 'กำลังค้นหาตำแหน่ง...';
        document.getElementById('distance-text').textContent = 'กรุณารอสักครู่';
        retryBtn.style.display = 'none';

        getCurrentLocationForCheckin()
            .then(() => {
                checkBranchDistance(); // Retry after getting location
            })
            .catch((error) => {
                // Show error with retry button
                statusDiv.className = 'location-status status-error';
                document.getElementById('status-text').textContent = 'ไม่สามารถหาตำแหน่งได้';
                document.getElementById('distance-text').textContent = 'กรุณาลองอีกครั้ง';
                retryBtn.style.display = 'block';
                document.getElementById('btn-confirm-checkin').disabled = true;
            });
        return;
    }

    // Hide retry button when location is available
    retryBtn.style.display = 'none';

    // Calculate distance
    const distance = calculateDistance(
        state.currentLocation.lat,
        state.currentLocation.lng,
        parseFloat(selectedBranch.latitude),
        parseFloat(selectedBranch.longitude)
    );

    // Update status
    const statusText = document.getElementById('status-text');
    const distanceText = document.getElementById('distance-text');
    const confirmBtn = document.getElementById('btn-confirm-checkin');

    statusDiv.style.display = 'block';

    // Show accuracy warning if needed
    let distanceDisplay = `ระยะทาง: ${distance} เมตร`;
    if (state.currentLocation.accuracy > 100) {
        distanceDisplay += ` (ความแม่นยำ ±${Math.round(state.currentLocation.accuracy)}ม.)`;
    }
    distanceText.textContent = distanceDisplay;

    // Check if within radius
    const isWithinRadius = distance <= parseInt(selectedBranch.radius);
    const canCheckinOutside = selectedBranch.allow_checkin_outside == 1;

    if (isWithinRadius) {
        // Within radius - green
        statusDiv.className = 'location-status status-success';
        statusText.textContent = 'เข้างานได้';
        confirmBtn.disabled = false;
    } else if (canCheckinOutside) {
        // Outside but allowed - orange
        statusDiv.className = 'location-status status-warning';
        statusText.textContent = 'คุณอยู่นอกตำแหน่ง (แต่สามารถเข้างานได้)';
        confirmBtn.disabled = false;
    } else {
        // Outside and not allowed - red
        statusDiv.className = 'location-status status-error';
        statusText.textContent = 'คุณอยู่นอกตำแหน่ง';
        confirmBtn.disabled = true;
    }
}

// Retry get location
function retryGetLocation() {
    // Reset location
    state.currentLocation = null;

    // Show loading
    const statusDiv = document.getElementById('location-status');
    statusDiv.className = 'location-status';
    document.getElementById('status-text').textContent = 'กำลังค้นหาตำแหน่งอีกครั้ง...';
    document.getElementById('distance-text').textContent = 'กรุณารอสักครู่';
    document.getElementById('btn-retry-location').style.display = 'none';

    // Try again
    checkBranchDistance();
}

// Get current location with retry (for checkin modal)
function getCurrentLocationForCheckin(retryCount = 0) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            showToast('เบราว์เซอร์ไม่รองรับ GPS', 'error');
            reject('Geolocation not supported');
            return;
        }

        const options = {
            enableHighAccuracy: retryCount === 0, // First try with high accuracy
            timeout: retryCount === 0 ? 15000 : 30000, // Increase timeout on retry
            maximumAge: retryCount === 0 ? 0 : 10000 // Allow cached location on retry
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };

                // Check accuracy
                if (position.coords.accuracy > 100) {
                    showToast(`ตำแหน่งไม่แม่นยำมาก (±${Math.round(position.coords.accuracy)}ม.)`, 'warning');
                }

                resolve(state.currentLocation);
            },
            (error) => {
                console.error('Error getting location:', error);

                let errorMessage = 'ไม่สามารถค้นหาตำแหน่งได้';
                let canRetry = false;

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'กรุณาอนุญาตให้เข้าถึงตำแหน่ง';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'ไม่สามารถระบุตำแหน่งได้ กรุณาเปิด GPS';
                        canRetry = true;
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'หาตำแหน่งใช้เวลานานเกินไป';
                        canRetry = true;
                        break;
                }

                // Retry with lower accuracy if first attempt failed
                if (canRetry && retryCount < 1) {
                    console.log('Retrying with lower accuracy...');
                    showToast('กำลังลองค้นหาตำแหน่งอีกครั้ง...', 'warning');

                    setTimeout(() => {
                        getCurrentLocationForCheckin(retryCount + 1)
                            .then(resolve)
                            .catch(reject);
                    }, 1000);
                } else {
                    showToast(errorMessage, 'error');
                    reject(error);
                }
            },
            options
        );
    });
}

// Confirm check-in or check-out
function confirmCheckin() {
    // Validate
    if (!capturedPhotoData) {
        showToast('กรุณาถ่ายรูปก่อน', 'warning');
        return;
    }

    // Validate photo data more strictly
    if (capturedPhotoData === 'data:,' || capturedPhotoData.length < 100) {
        showToast('ข้อมูลรูปภาพไม่ถูกต้อง กรุณาถ่ายรูปใหม่', 'error');
        console.error('Invalid photo data:', capturedPhotoData);
        return;
    }

    if (!selectedBranch) {
        showToast(checkinMode === 'checkin' ? 'กรุณาเลือกสาขา' : 'ไม่พบข้อมูลสาขา', 'warning');
        return;
    }

    if (!state.currentLocation) {
        // For checkout mode, try to get location one more time
        if (checkinMode === 'checkout') {
            showToast('กำลังค้นหาตำแหน่ง กรุณารอสักครู่...', 'warning');

            // Disable button and try to get location
            const btn = document.getElementById('btn-confirm-checkin');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'กำลังค้นหาตำแหน่ง...';

            // Try to get location with timeout
            let locationFound = false;

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        locationFound = true;
                        state.currentLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            accuracy: position.coords.accuracy
                        };

                        // Re-enable button and proceed
                        btn.disabled = false;
                        btn.textContent = originalText;
                        showToast('พบตำแหน่งแล้ว กำลังบันทึก...', 'success');

                        // Call confirmCheckin again now that we have location
                        setTimeout(() => confirmCheckin(), 100);
                    },
                    (error) => {
                        showToast('ไม่สามารถระบุตำแหน่งได้ กรุณาเปิด GPS และลองอีกครั้ง', 'error');
                        btn.disabled = false;
                        btn.textContent = originalText;
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            } else {
                showToast('เบราว์เซอร์ไม่รองรับ GPS', 'error');
                btn.disabled = false;
                btn.textContent = originalText;
            }

            return;
        } else {
            showToast('ไม่สามารถระบุตำแหน่งได้', 'error');
            return;
        }
    }

    // Prepare data
    const data = {
        latitude: state.currentLocation.lat,
        longitude: state.currentLocation.lng,
        photo: capturedPhotoData
    };

    // Only include branch_id for check-in, not for checkout
    if (checkinMode === 'checkin') {
        data.branch_id = selectedBranch.id;
        
        const shiftGroup = document.getElementById('checkin-shift-group');
        const shiftSelect = document.getElementById('checkin-shift-select');
        
        if (shiftGroup && shiftGroup.style.display !== 'none') {
            if (!shiftSelect || !shiftSelect.value) {
                showToast('กรุณาเลือกกะการทำงาน (ของวันนี้)', 'warning');
                return;
            }
            data.selected_shift_id = shiftSelect.value;
        }
    }

    // Debug: Log data being sent
    console.log(`=== ${checkinMode === 'checkin' ? 'Check-in' : 'Check-out'} Data ===`);
    console.log('Branch ID:', data.branch_id || 'N/A (auto from check-in)');
    console.log('Latitude:', data.latitude);
    console.log('Longitude:', data.longitude);
    console.log('Photo length:', data.photo ? data.photo.length : 0);

    // Disable button
    const btn = document.getElementById('btn-confirm-checkin');
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';

    // Determine API action
    const action = checkinMode === 'checkin' ? 'checkin' : 'checkout';

    // Send to server
    fetch(`api/timelog.php?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(data)
    })
        .then(res => {
            console.log('Response status:', res.status);
            return res.text();
        })
        .then(text => {
            console.log('Response text:', text);
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('JSON Parse Error:', e);
                console.error('Response was:', text);
                throw new Error('Invalid JSON response: ' + text.substring(0, 100));
            }
        })
        .then(response => {
            console.log('Response data:', response);
            if (response.success) {
                showToast(checkinMode === 'checkin' ? 'เข้างานสำเร็จ' : 'ออกงานสำเร็จ', 'success');
                closeCheckinModal();
                loadTodayTimeLog();
                updateCheckinButton();
            } else {
                showToast(response.message, 'error');
                btn.disabled = false;
                btn.textContent = checkinMode === 'checkin' ? 'เข้างาน' : 'ออกงาน';
            }
        })
        .catch((error) => {
            console.error(`${checkinMode} Error:`, error);
            showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
            btn.disabled = false;
            btn.textContent = checkinMode === 'checkin' ? 'เข้างาน' : 'ออกงาน';
        });
}

// ============================================
// Registration Functions
// ============================================

// Show register modal
function showRegisterModal() {
    // Load departments
    fetch('api/auth.php?action=get_departments')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const deptSelect = document.getElementById('reg-department');
                deptSelect.innerHTML = '<option value="">เลือกแผนก</option>';
                data.data.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.id;
                    option.textContent = dept.name;
                    deptSelect.appendChild(option);
                });
            }
        });

    // Load employee types from employee_types table
    fetch('api/auth.php?action=get_employee_types')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const empTypeSelect = document.getElementById('reg-employee-type');
                empTypeSelect.innerHTML = '<option value="">เลือกประเภท</option>';
                data.data.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.name;
                    option.textContent = type.name;
                    empTypeSelect.appendChild(option);
                });
            }
        })
        .catch(() => {
            console.error('Failed to load employee types');
        });

    // Load shifts (ใช้ auth.php เพราะหน้าสมัครสมาชิกยังไม่ได้ login)
    fetch('api/auth.php?action=get_shifts')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const shiftSelect = document.getElementById('reg-shift');
                shiftSelect.innerHTML = '<option value="">-- ไม่กำหนด --</option>';
                data.data.forEach(shift => {
                    const option = document.createElement('option');
                    option.value = shift.id;
                    // ใช้ shift.name แทน shift.shift_name เพราะชื่อ column ในฐานข้อมูลคือ name
                    option.textContent = shift.name + ' (' + formatTime(shift.start_time) + ' - ' + formatTime(shift.end_time) + ')';
                    shiftSelect.appendChild(option);
                });
            }
        })
        .catch(() => {
            console.error('Failed to load shifts');
        });

    // Initialize Thai Address Selects (จังหวัด, อำเภอ, ตำบล)
    if (typeof initThaiAddressSelects === 'function') {
        initThaiAddressSelects();
    }

    document.getElementById('register-modal').classList.remove('hidden');
}

// Helper function to format time (HH:MM:SS -> HH:MM)
function formatTime(timeStr) {
    if (!timeStr) return '-';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
}

// Close register modal
function closeRegisterModal() {
    // Stop camera streams if active
    stopRegProfileCamera();
    stopRegIdCardCamera();

    document.getElementById('register-modal').classList.add('hidden');
    document.getElementById('register-form').reset();

    // Reset photo previews
    document.getElementById('reg-profile-photo').style.display = 'none';
    document.getElementById('reg-profile-photo').src = '';
    document.getElementById('reg-idcard-photo').style.display = 'none';
    document.getElementById('reg-idcard-photo').src = '';

    // Reset buttons
    document.getElementById('btn-reg-start-profile-camera').style.display = 'block';
    document.getElementById('btn-reg-capture-profile').style.display = 'none';
    document.getElementById('btn-reg-retake-profile').style.display = 'none';
    document.getElementById('btn-reg-start-idcard-camera').style.display = 'block';
    document.getElementById('btn-reg-capture-idcard').style.display = 'none';
    document.getElementById('btn-reg-retake-idcard').style.display = 'none';
}

// Global variables for camera streams
let regProfileStream = null;
let regIdCardStream = null;
let regProfilePhotoData = null;
let regIdCardPhotoData = null;

// Profile Photo Camera Functions
function startRegProfileCamera() {
    const video = document.getElementById('reg-profile-video');

    navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
    })
        .then(stream => {
            regProfileStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';

            document.getElementById('btn-reg-start-profile-camera').style.display = 'none';
            document.getElementById('btn-reg-capture-profile').style.display = 'block';
            document.getElementById('reg-profile-photo').style.display = 'none';
        })
        .catch(err => {
            console.error('Error accessing camera:', err);
            showToast('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง', 'error');
        });
}

function captureRegProfilePhoto() {
    const video = document.getElementById('reg-profile-video');
    const canvas = document.getElementById('reg-profile-canvas');
    const photo = document.getElementById('reg-profile-photo');

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    regProfilePhotoData = canvas.toDataURL('image/jpeg', 0.8);

    // Show photo preview
    photo.src = regProfilePhotoData;
    photo.style.display = 'block';

    // Hide video and stop camera
    video.style.display = 'none';
    stopRegProfileCamera();

    // Update buttons
    document.getElementById('btn-reg-capture-profile').style.display = 'none';
    document.getElementById('btn-reg-retake-profile').style.display = 'block';

    showToast('ถ่ายรูปโปรไฟล์สำเร็จ', 'success');
}

function retakeRegProfilePhoto() {
    regProfilePhotoData = null;
    document.getElementById('reg-profile-photo').style.display = 'none';
    document.getElementById('btn-reg-retake-profile').style.display = 'none';
    document.getElementById('btn-reg-start-profile-camera').style.display = 'block';
}

function stopRegProfileCamera() {
    if (regProfileStream) {
        regProfileStream.getTracks().forEach(track => track.stop());
        regProfileStream = null;
    }
    const video = document.getElementById('reg-profile-video');
    if (video) {
        video.style.display = 'none';
        video.srcObject = null;
    }
}

// ID Card Photo Camera Functions
function startRegIdCardCamera() {
    const video = document.getElementById('reg-idcard-video');

    navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
    })
        .then(stream => {
            regIdCardStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';

            document.getElementById('btn-reg-start-idcard-camera').style.display = 'none';
            document.getElementById('btn-reg-capture-idcard').style.display = 'block';
            document.getElementById('reg-idcard-photo').style.display = 'none';
        })
        .catch(err => {
            console.error('Error accessing camera:', err);
            showToast('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง', 'error');
        });
}

function captureRegIdCardPhoto() {
    const video = document.getElementById('reg-idcard-video');
    const canvas = document.getElementById('reg-idcard-canvas');
    const photo = document.getElementById('reg-idcard-photo');

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    regIdCardPhotoData = canvas.toDataURL('image/jpeg', 0.8);

    // Show photo preview
    photo.src = regIdCardPhotoData;
    photo.style.display = 'block';

    // Hide video and stop camera
    video.style.display = 'none';
    stopRegIdCardCamera();

    // Update buttons
    document.getElementById('btn-reg-capture-idcard').style.display = 'none';
    document.getElementById('btn-reg-retake-idcard').style.display = 'block';

    showToast('ถ่ายรูปบัตรประชาชนสำเร็จ', 'success');
}

function retakeRegIdCardPhoto() {
    regIdCardPhotoData = null;
    document.getElementById('reg-idcard-photo').style.display = 'none';
    document.getElementById('btn-reg-retake-idcard').style.display = 'none';
    document.getElementById('btn-reg-start-idcard-camera').style.display = 'block';
}

function stopRegIdCardCamera() {
    if (regIdCardStream) {
        regIdCardStream.getTracks().forEach(track => track.stop());
        regIdCardStream = null;
    }
    const video = document.getElementById('reg-idcard-video');
    if (video) {
        video.style.display = 'none';
        video.srcObject = null;
    }
}

// Handle register form submission
document.getElementById('register-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const firstName = document.getElementById('reg-first-name').value;
    const lastName = document.getElementById('reg-last-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    // Validate Thai characters only for first name and last name
    const thaiPattern = /^[\u0E00-\u0E7F\s]+$/;
    if (!thaiPattern.test(firstName)) {
        showToast('กรุณากรอกชื่อเป็นภาษาไทยเท่านั้น', 'error');
        return;
    }

    if (!thaiPattern.test(lastName)) {
        showToast('กรุณากรอกนามสกุลเป็นภาษาไทยเท่านั้น', 'error');
        return;
    }

    // Validate email
    if (!email || email.trim() === '') {
        showToast('กรุณากรอก Email', 'error');
        return;
    }

    // Validate password match
    if (password !== confirmPassword) {
        showToast('รหัสผ่านไม่ตรงกัน', 'error');
        return;
    }

    // Validate password length
    if (password.length < 8) {
        showToast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 'error');
        return;
    }

    // Validate profile photo
    if (!regProfilePhotoData) {
        showToast('กรุณาถ่ายรูปโปรไฟล์', 'error');
        return;
    }

    // Validate ID card photo
    if (!regIdCardPhotoData) {
        showToast('กรุณาถ่ายรูปบัตรประชาชน', 'error');
        return;
    }

    const formData = new FormData(this);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    // Add photos to data
    data.profile_photo = regProfilePhotoData;
    data.id_card_photo = regIdCardPhotoData;

    // Show loading
    showToast('กำลังสมัครสมาชิก...', 'info');

    fetch('api/auth.php?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ', 'success');
                closeRegisterModal();

                // Auto fill employee code
                document.getElementById('employee_code').value = data.employee_code;
            } else {
                showToast(response.message || 'เกิดข้อผิดพลาด', 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
});

// ============================================
// Change Password Modal Functions
// ============================================

function showChangePasswordModal(employeeId) {
    // Check if modal exists
    let modalOverlay = document.getElementById('change-password-overlay');

    if (!modalOverlay) {
        // Create modal if not exists
        const modalHtml = `
            <div id="change-password-overlay" class="modal-overlay force-centered" style="display: none; z-index: 9999;">
                <div id="change-password-modal" class="modal force-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>เปลี่ยนรหัสผ่าน</h2>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning" style="background: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                                <strong>แจ้งเตือน:</strong> รหัสผ่านของคุณถูกรีเซ็ตหรือเป็นรหัสผ่านชั่วคราว กรุณาเปลี่ยนรหัสผ่านใหม่เพื่อความปลอดภัย
                            </div>
                            <form id="change-password-form">
                                <input type="hidden" id="cp-employee-id" name="employee_id">
                                
                                <div class="form-group">
                                    <label for="cp-new-password">รหัสผ่านใหม่</label>
                                    <input type="password" id="cp-new-password" name="new_password" required>
                                    <small class="text-muted">ต้องมีความยาวอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวพิมพ์ใหญ่และตัวพิมพ์เล็ก</small>
                                </div>
                                
                                <div class="form-group">
                                    <label for="cp-confirm-password">ยืนยันรหัสผ่านใหม่</label>
                                    <input type="password" id="cp-confirm-password" name="confirm_password" required>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="submit" class="btn-primary" style="width: 100%;">เปลี่ยนรหัสผ่าน</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modalOverlay = document.getElementById('change-password-overlay');

        // Add event listener
        document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
    }

    // Set employee ID
    document.getElementById('cp-employee-id').value = employeeId;

    // Clear fields
    document.getElementById('cp-new-password').value = '';
    document.getElementById('cp-confirm-password').value = '';

    // Show modal
    modalOverlay.style.display = 'flex';
}

function handleChangePassword(e) {
    e.preventDefault();

    const employeeId = document.getElementById('cp-employee-id').value;
    const newPassword = document.getElementById('cp-new-password').value;
    const confirmPassword = document.getElementById('cp-confirm-password').value;

    // Validate password match
    if (newPassword !== confirmPassword) {
        showToast('รหัสผ่านไม่ตรงกัน', 'error');
        return;
    }

    // Validate password complexity
    if (newPassword.length < 8) {
        showToast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 'error');
        return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword)) {
        showToast('รหัสผ่านต้องประกอบด้วยตัวพิมพ์ใหญ่และตัวพิมพ์เล็ก', 'error');
        return;
    }

    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังบันทึก...';

    fetch('api/auth.php?action=change_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            employee_id: employeeId,
            new_password: newPassword
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่', 'success');
                const overlay = document.getElementById('change-password-overlay');
                if (overlay) {
                    overlay.style.display = 'none';
                } else {
                    // Fallback for older version if element not found (though should be updated)
                    const modal = document.getElementById('change-password-modal');
                    if (modal) modal.style.display = 'none';
                }

                // Clear form
                document.getElementById('login-form').reset();
            } else {
                showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
            }
        })
        .catch(err => {
            console.error('Error:', err);
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        });
}
