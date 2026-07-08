// HR Lanto - Admin Panel Script

// Global variables
let departments = [];
let currentEmployeeId = null;
let currentEmployeeName = null; // Store current employee name for leave history
let currentEmployeeCode = null; // Store current employee code for leave history
let employeeCodeSortOrder = 'desc'; // 'desc' for high to low, 'asc' for low to high

// Role-based access control
function canAccessSection(section) {
    const userRole = getCurrentUserRole();

    // HR Admin can ONLY access timelogs and leave-management as Read-Only
    if (userRole === 'HR Admin') {
        const allowedSections = ['timelogs', 'leave-management'];
        if (allowedSections.includes(section)) {
            return { allowed: true, readOnly: true };
        }
        return { allowed: false, readOnly: false };
    }

    // IT Support cannot access these sections
    const restrictedSections = [
        'payslip-management',
        'user-roles'
    ];

    // IT Support has read-only access to telegram-settings
    const readOnlySections = [
        'telegram-settings'
    ];

    if (userRole === 'IT Support') {
        if (restrictedSections.includes(section)) {
            return { allowed: false, readOnly: false };
        }
        if (readOnlySections.includes(section)) {
            return { allowed: true, readOnly: true };
        }
        return { allowed: true, readOnly: false };
    }

    // Admin and HR have full access
    return { allowed: true, readOnly: false };
}

// Get the first allowed section for the current user role to redirect restricted access automatically
function getFirstAllowedSection() {
    const allSections = [
        'employees', 'timelogs', 'leave-management', 'departments',
        'branches', 'leave-types', 'shifts', 'company-settings',
        'employee-types', 'user-roles', 'payslip-management', 'telegram-settings'
    ];
    for (const sec of allSections) {
        if (canAccessSection(sec).allowed) {
            return sec;
        }
    }
    return 'timelogs'; // default fallback
}

function getCurrentUserRole() {
    // Get user role from session or global state
    // This assumes the role is stored in a global variable or can be fetched from the server
    return window.currentUser?.role || 'พนักงาน';
}

function isReadOnlySection(section) {
    const access = canAccessSection(section);
    return access.readOnly;
}

// Debug function to test IT Support permissions (can be called from browser console)
function debugITSupportPermissions() {
    const currentRole = getCurrentUserRole();
    console.log('🔍 Current User Role:', currentRole);
    console.log('🔍 Window User:', window.currentUser);

    const allSections = [
        'employees', 'timelogs', 'leave-management', 'departments',
        'branches', 'leave-types', 'shifts', 'company-settings',
        'employee-types', 'user-roles', 'payslip-management', 'telegram-settings'
    ];

    console.log('📋 Section Access Permissions:');
    allSections.forEach(section => {
        const access = canAccessSection(section);
        console.log(`  ${section}:`, {
            allowed: access.allowed,
            readOnly: access.readOnly,
            status: access.allowed ? (access.readOnly ? '👁️ Read-Only' : '✅ Full Access') : '🚫 Restricted'
        });
    });
}

// Auto-debug when admin panel loads (only in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    setTimeout(() => {
        if (getCurrentUserRole() === 'IT Support') {
            console.log('🛠️ IT Support Role Detected - Run debugITSupportPermissions() for details');
        }
    }, 2000);
}

// Pagination Manager
const adminPagination = {
    sections: {
        employees: { data: [], page: 1, limit: 10 },
        timelogs: { data: [], page: 1, limit: 10 },
        leaves: { data: [], page: 1, limit: 10 },
        departments: { data: [], page: 1, limit: 10 },
        branches: { data: [], page: 1, limit: 10 },
        userRoles: { data: [], page: 1, limit: 10 }
    },

    setData(section, data) {
        if (!this.sections[section]) {
            this.sections[section] = { data: [], page: 1, limit: 10 };
        }
        this.sections[section].data = data;
        const totalPages = Math.ceil(data.length / this.sections[section].limit);
        if (this.sections[section].page > totalPages && totalPages > 0) {
            this.sections[section].page = 1;
        }
    },

    getPaginatedData(section) {
        const state = this.sections[section];
        const start = (state.page - 1) * state.limit;
        const end = start + state.limit;
        return state.data.slice(start, end);
    },

    setLimit(section, limit) {
        this.sections[section].limit = parseInt(limit);
        this.sections[section].page = 1;
        this.reRender(section);
    },

    setPage(section, page) {
        this.sections[section].page = parseInt(page);
        this.reRender(section);
    },

    reRender(section) {
        const data = this.getPaginatedData(section);
        switch (section) {
            case 'employees': renderEmployeesTableHTML(data); break;
            case 'timelogs': renderTimeLogsTableHTML(data); break;
            case 'leaves': renderLeavesTableHTML(data); break;
            case 'departments': renderDepartmentsTableHTML(data); break;
            case 'branches': renderBranchesTableHTML(data); break;
            case 'userRoles': renderUserRolesTableHTML(data); break;
        }
        this.renderControls(section);
    },

    renderControls(section) {
        const state = this.sections[section];
        const totalItems = state.data.length;
        const totalPages = Math.ceil(totalItems / state.limit);
        const container = document.getElementById(`${section}-pagination`);

        if (!container) return;

        if (totalItems === 0) {
            container.innerHTML = '';
            return;
        }

        let html = `
            <div class="pagination-container" style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 10px; background: #f9f9f9; border-radius: 8px;">
                <div class="pagination-info">
                    แสดง ${(state.page - 1) * state.limit + 1} ถึง ${Math.min(state.page * state.limit, totalItems)} จาก ${totalItems} รายการ
                </div>
                <div class="pagination-controls" style="display: flex; gap: 10px; align-items: center;">
                    <select onchange="adminPagination.setLimit('${section}', this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid #ddd;">
                        <option value="10" ${state.limit === 10 ? 'selected' : ''}>10 รายการ/หน้า</option>
                        <option value="20" ${state.limit === 20 ? 'selected' : ''}>20 รายการ/หน้า</option>
                        <option value="50" ${state.limit === 50 ? 'selected' : ''}>50 รายการ/หน้า</option>
                        <option value="100" ${state.limit === 100 ? 'selected' : ''}>100 รายการ/หน้า</option>
                    </select>
                    
                    <div class="btn-group" style="display: flex; gap: 5px;">
                        <button class="btn-sm btn-secondary" 
                                onclick="adminPagination.setPage('${section}', ${state.page - 1})"
                                ${state.page === 1 ? 'disabled' : ''}>
                            &lt; ก่อนหน้า
                        </button>
                        
                        <select onchange="adminPagination.setPage('${section}', this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid #ddd;">
                            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                                <option value="${p}" ${p === state.page ? 'selected' : ''}>หน้าที่ ${p}</option>
                            `).join('')}
                        </select>
                        
                        <button class="btn-sm btn-secondary" 
                                onclick="adminPagination.setPage('${section}', ${state.page + 1})"
                                ${state.page === totalPages ? 'disabled' : ''}>
                            ถัดไป &gt;
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
};

// Employee Types Management
function loadEmployeeTypes(selectId, selectedValue = null) {
    fetch('api/admin.php?action=get_employee_types')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const select = document.getElementById(selectId);
                if (select) {
                    // Clear all options and add default option
                    select.innerHTML = '<option value="">เลือกประเภทพนักงาน</option>';

                    data.data.forEach(type => {
                        const option = document.createElement('option');
                        option.value = type.name;
                        option.textContent = type.name;
                        if (selectedValue && type.name === selectedValue) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
            }
        })
        .catch(() => {
            console.error('Failed to load employee types');
        });
}

function showManageEmployeeTypesModal() {
    // Redirect to the section instead of showing a modal
    loadAdminSection('employee-types');
}

function closeEmployeeTypesModal() {
    // Deprecated
}

function loadEmployeeTypesTable() {
    fetch('api/admin.php?action=get_employee_types')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const tbody = document.getElementById('employee-types-table-body');
                if (tbody) {
                    tbody.innerHTML = data.data.map(type => `
                        <tr>
                            <td>${type.id}</td>
                            <td>${type.name}</td>
                            <td>
                                <button class="btn-sm btn-delete" onclick="deleteEmployeeType(${type.id})">ลบ</button>
                            </td>
                        </tr>
                    `).join('');
                }
            }
        });
}

function addEmployeeType() {
    const nameInput = document.getElementById('new-employee-type-name');
    const name = nameInput.value.trim();

    if (!name) {
        showToast('กรุณากรอกชื่อประเภทพนักงาน', 'error');
        return;
    }

    fetch('api/admin.php?action=add_employee_type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('เพิ่มสำเร็จ', 'success');
                nameInput.value = '';
                loadEmployeeTypesTable();
            } else {
                showToast(data.message, 'error');
            }
        });
}

function deleteEmployeeType(id) {
    if (!confirm('ยืนยันการลบประเภทพนักงานนี้?')) return;

    const formData = new FormData();
    formData.append('id', id);

    fetch('api/admin.php?action=delete_employee_type', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('ลบสำเร็จ', 'success');
                loadEmployeeTypesTable();
            } else {
                showToast(data.message, 'error');
            }
        });
}


// Setup admin navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Admin Navigation - Use event delegation for robustness
    document.body.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.admin-menu-item');
        if (menuItem) {
            e.preventDefault();
            const section = menuItem.dataset.adminSection;
            loadAdminSection(section);
        }
    });
});

function loadAdminSection(section) {
    // Hide menu items that are not allowed for the current user role
    document.querySelectorAll('.admin-menu-item').forEach(item => {
        const sec = item.dataset.adminSection;
        const access = canAccessSection(sec);
        if (!access.allowed) {
            item.style.display = 'none';
        } else {
            item.style.display = 'flex';
        }
    });

    const contentContainer = document.getElementById('admin-content');
    if (!contentContainer) return;

    // Check access permissions
    const access = canAccessSection(section);
    if (!access.allowed) {
        // Automatically redirect to the first allowed section instead of showing access denied
        const firstAllowed = getFirstAllowedSection();
        if (firstAllowed && firstAllowed !== section) {
            loadAdminSection(firstAllowed);
            return;
        }

        contentContainer.innerHTML = `
            <div style="text-align: center; padding: 50px;">
                <div style="color: #dc3545; font-size: 48px; margin-bottom: 20px;">🚫</div>
                <h3 style="color: #dc3545;">ไม่มีสิทธิ์เข้าถึง</h3>
                <p>คุณไม่มีสิทธิ์ในการเข้าถึงส่วนนี้ กรุณาติดต่อผู้ดูแลระบบ</p>
            </div>
        `;
        return;
    }

    // Update active menu item
    document.querySelectorAll('.admin-menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.adminSection === section) {
            item.classList.add('active');
        }
    });

    // Show loading
    contentContainer.innerHTML = '<div style="text-align: center; padding: 50px;"><div class="loading"></div><p>กำลังโหลด...</p></div>';

    switch (section) {
        case 'employees':
            loadEmployeesSection();
            break;
        case 'timelogs':
            loadTimeLogsSection();
            break;
        case 'leave-management':
            loadLeaveManagementSection();
            break;
        case 'departments':
            loadDepartmentsSection();
            break;
        case 'branches':
            loadBranchesSection();
            break;
        case 'leave-types':
            loadLeaveTypesSection();
            break;
        case 'shifts':
            loadShiftsSection();
            break;
        case 'company-settings':
            loadCompanySettingsSection();
            break;
        case 'employee-types':
            loadEmployeeTypesSection();
            break;
        case 'user-roles':
            loadUserRolesSection();
            break;
        case 'payslip-management':
            loadPayslipManagementSection();
            break;
        case 'telegram-settings':
            loadTelegramSettingsSection(access.readOnly);
            break;
    }
}

// Load Departments
function loadDepartments() {
    return fetch('api/admin.php?action=departments')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                departments = data.data;
            }
        });
}

// Load Branches
let branches = [];
function loadBranches() {
    return fetch('api/admin.php?action=branches')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                branches = data.data;
            }
        });
}

// Employee Management
// Employee Management
function loadEmployeesSection() {
    // โหลดแผนกและสาขาก่อน
    Promise.all([loadDepartments(), loadBranches()])
        .then(() => {
            return fetch('api/admin.php?action=employees');
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderEmployeesTable(data.data);
            }
        });
}

function renderEmployeesTable(employees) {
    adminPagination.setData('employees', employees);

    // Generate Department Options
    const departmentOptions = departments.map(d =>
        `<option value="${d.id}">${d.name}</option>`
    ).join('');

    // Generate Branch Options
    const branchOptions = branches.map(b =>
        `<option value="${b.id}">${b.name}</option>`
    ).join('');

    const html = `
        <div class="admin-section">
            <div class="section-header" style="justify-content: space-between; align-items: center;">
                <h2 style="white-space: nowrap;">จัดการข้อมูลพนักงาน</h2>
                <div style="display: flex; gap: 10px; width: auto; align-self: center;">
                    <button class="btn-primary" onclick="showAddEmployeeModal()" style="white-space: nowrap; width: 100%; height: 51px;">+ เพิ่มพนักงาน</button>
                    <button class="btn-secondary" onclick="exportEmployeesToCSV()" style="white-space: nowrap; width: 100%; height: 51px; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export CSV
                    </button>
                    <button class="btn-secondary" onclick="showImportEmployeeModal()" style="white-space: nowrap; width: 100%; height: 51px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 5px;">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Import Excel
                    </button>
                </div>
            </div>
            
            <div class="filter-bar" style="margin-bottom: 20px; display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div class="filter-item" style="flex: 1; min-width: 100px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">ค้นหา</label>
                    <input type="text" id="employee-search" class="form-control" placeholder="รหัสพนักงาน หรือ ชื่อ-นามสกุล..." style="width: 100%; height: 51px;">
                </div>

                <div class="filter-item" style="width: 150px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">แผนก</label>
                    <select id="filter-department" class="form-control" style="width: 100%; height: 51px;">
                        <option value="">ทุกแผนก</option>
                        ${departmentOptions}
                    </select>
                </div>

                <div class="filter-item" style="width: 150px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">สาขา</label>
                    <select id="filter-branch" class="form-control" style="width: 100%; height: 51px;">
                        <option value="">ทุกสาขา</option>
                        ${branchOptions}
                    </select>
                </div>

                <div class="filter-item" style="display: flex; gap: 5px;">
                    <button class="btn-primary" id="btn-search-employees" style="height: 51px; display: flex; align-items: center; justify-content: center; min-width: 100px;" title="ค้นหา">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 5px;">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        ค้นหา
                    </button>
                    <button class="btn-secondary" id="btn-clear-employees" style="height: 51px; display: flex; align-items: center; justify-content: center; min-width: 130px;" title="ล้างค่าตัวกรอง">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 5px;">
                            <path d="M23 4v6h-6"></path>
                            <path d="M1 20v-6h6"></path>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        ล้างค่า
                    </button>
                </div>
            </div>

            <div id="bulk-actions" style="display: none; gap: 10px; align-items: center; margin-bottom: 15px; padding: 10px; background: #fff3cd; border-radius: 8px;">
                <span id="selected-count" style="color: #856404; font-weight: bold;">เลือก 0 รายการ</span>
                <button class="btn-sm btn-danger" onclick="bulkDeleteEmployees()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    ลบที่เลือก
                </button>
                <button class="btn-sm btn-secondary" onclick="bulkUpdateEmployees()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    แก้ไขที่เลือก
                </button>
            </div>
            
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">
                                <input type="checkbox" id="select-all-employees" onchange="toggleSelectAllEmployees(this)" style="cursor: pointer;">
                            </th>
                            <th onclick="sortEmployeesByCode()" style="cursor: pointer; user-select: none;">
                                รหัส 
                                <span id="employee-code-sort-indicator" style="margin-left: 5px; font-size: 12px; color: #666;">
                                    ↓
                                </span>
                            </th>
                            <th>ชื่อ-นามสกุล</th>
                            <th>แผนก</th>
                            <th>สาขา</th>
                            <th>ประเภท</th>
                            <th>สถานะ</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="employee-table-body">
                        <!-- Rendered by renderEmployeesTableHTML -->
                    </tbody>
                </table>
            </div>
            <div id="employees-pagination"></div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;

    // Filter Logic
    const filterFunc = () => {
        const searchTerm = document.getElementById('employee-search').value.toLowerCase().trim();
        const deptId = document.getElementById('filter-department').value;
        const branchId = document.getElementById('filter-branch').value;

        const filtered = employees.filter(emp => {
            // Search Text
            const matchSearch = !searchTerm ||
                emp.employee_code.toLowerCase().includes(searchTerm) ||
                (emp.first_name + ' ' + emp.last_name).toLowerCase().includes(searchTerm);

            // Department
            const matchDept = !deptId || emp.department_id == deptId;

            // Branch
            // emp.branch_ids is a string "1,2,3" or null
            const empBranchIds = emp.branch_ids ? emp.branch_ids.split(',') : [];
            const matchBranch = !branchId || empBranchIds.includes(branchId);

            return matchSearch && matchDept && matchBranch;
        });

        adminPagination.setData('employees', filtered);
        adminPagination.reRender('employees');

        // Reset bulk actions
        updateBulkActionsVisibility();
        document.getElementById('select-all-employees').checked = false;
    };

    // Add search functionality
    document.getElementById('btn-search-employees').addEventListener('click', filterFunc);

    // Add clear functionality
    document.getElementById('btn-clear-employees').addEventListener('click', function () {
        document.getElementById('employee-search').value = '';
        document.getElementById('filter-department').value = '';
        document.getElementById('filter-branch').value = '';
        filterFunc();
    });

    // Add Enter key support for search input
    document.getElementById('employee-search').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            filterFunc();
        }
    });

    // Optional: Auto-filter on dropdown change (User asked for "Search Button", but usually dropdowns auto-filter. 
    // I will stick to "Search Button" requirement primarily, but maybe auto-filter is better UX? 
    // The user explicitly said "press button to search". So I'll rely on the button, 
    // but maybe adding listener to dropdowns doesn't hurt if I debounce or just let it wait for button.
    // I'll stick to button only for strict adherence, or add it for convenience. 
    // The user said "add dropdowns and press button to search". I will follow that.)

    adminPagination.reRender('employees');
}

function renderEmployeesTableHTML(employees) {
    const tbody = document.getElementById('employee-table-body');
    if (!tbody) return;

    tbody.innerHTML = employees.map(emp => `
        <tr data-employee-code="${emp.employee_code.toLowerCase()}" data-employee-name="${(emp.first_name + ' ' + emp.last_name).toLowerCase()}" data-employee-id="${emp.id}">
            <td>
                <input type="checkbox" class="employee-checkbox" value="${emp.id}" onchange="updateBulkActionsVisibility()" style="cursor: pointer;">
            </td>
            <td>${emp.employee_code}</td>
            <td>${emp.first_name} ${emp.last_name}</td>
            <td>${emp.department_name || '-'}</td>
            <td>${emp.branch_names || '-'}</td>
            <td>${emp.employee_type}</td>
            <td>
                <span class="badge ${emp.is_active ? 'badge-active' : 'badge-inactive'}">
                    ${emp.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                </span>
            </td>
            <td>
                <button class="btn-sm btn-edit" onclick="editEmployee(${emp.id})">แก้ไข</button>
                <button class="btn-sm btn-reset" onclick="resetEmployeePassword(${emp.id})">รีเซ็ทรหัส</button>
            </td>
        </tr>
    `).join('');

    // Update bulk actions visibility after re-render (usually none selected)
    updateBulkActionsVisibility();
}

// Bulk Actions Functions
function toggleSelectAllEmployees(checkbox) {
    const checkboxes = document.querySelectorAll('.employee-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
    updateBulkActionsVisibility();
}

function updateBulkActionsVisibility() {
    const checkboxes = document.querySelectorAll('.employee-checkbox:checked');
    const bulkActions = document.getElementById('bulk-actions');
    const selectedCount = document.getElementById('selected-count');

    if (bulkActions) {
        if (checkboxes.length > 0) {
            bulkActions.style.display = 'flex';
            if (selectedCount) selectedCount.textContent = `เลือก ${checkboxes.length} รายการ`;
        } else {
            bulkActions.style.display = 'none';
        }
    }

    // Update select all checkbox state
    const allCheckboxes = document.querySelectorAll('.employee-checkbox');
    const selectAllCheckbox = document.getElementById('select-all-employees');
    if (selectAllCheckbox && allCheckboxes.length > 0) {
        selectAllCheckbox.checked = checkboxes.length === allCheckboxes.length;
    }
}

function getSelectedEmployeeIds() {
    const checkboxes = document.querySelectorAll('.employee-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Sort employees by code function
function sortEmployeesByCode() {
    const currentData = adminPagination.sections.employees.data;
    const indicator = document.getElementById('employee-code-sort-indicator');

    // Toggle sort order
    employeeCodeSortOrder = employeeCodeSortOrder === 'desc' ? 'asc' : 'desc';

    // Sort the data
    const sortedData = [...currentData].sort((a, b) => {
        // Extract numeric parts from employee codes for proper sorting
        const getNumericValue = (code) => {
            const match = code.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
        };

        const aValue = getNumericValue(a.employee_code);
        const bValue = getNumericValue(b.employee_code);

        if (employeeCodeSortOrder === 'desc') {
            return bValue - aValue; // High to low
        } else {
            return aValue - bValue; // Low to high
        }
    });

    // Update indicator
    if (indicator) {
        indicator.textContent = employeeCodeSortOrder === 'desc' ? '↓' : '↑';
    }

    // Update pagination data and re-render
    adminPagination.setData('employees', sortedData);
    adminPagination.reRender('employees');
}

function bulkDeleteEmployees() {
    const selectedIds = getSelectedEmployeeIds();

    if (selectedIds.length === 0) {
        showToast('กรุณาเลือกพนักงานที่ต้องการลบ', 'error');
        return;
    }

    if (!confirm(`คุณต้องการลบพนักงาน ${selectedIds.length} คนที่เลือกใช่หรือไม่?\n\n⚠️ การดำเนินการนี้ไม่สามารถย้อนกลับได้`)) {
        return;
    }

    showToast('กำลังลบพนักงาน...', 'info');

    fetch('api/admin.php?action=bulk_delete_employees', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employee_ids: selectedIds })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast(`ลบพนักงานสำเร็จ ${data.deleted_count} คน`, 'success');
                loadEmployeesSection();
            } else {
                showToast('เกิดข้อผิดพลาด: ' + data.message, 'error');
            }
        })
        .catch(error => {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        });
}

function bulkUpdateEmployees() {
    const selectedIds = getSelectedEmployeeIds();

    if (selectedIds.length === 0) {
        showToast('กรุณาเลือกพนักงานที่ต้องการแก้ไข', 'error');
        return;
    }

    showBulkUpdateModal(selectedIds);
}

function showImportEmployeeModal() {
    showModal('import-employee-modal');
    document.getElementById('import-result').innerHTML = '';
    document.getElementById('import-file-input').value = '';
}

// Time Logs Management
// Time Logs Management
function loadTimeLogsSection() {
    // Load dependencies first
    Promise.all([loadDepartments(), loadBranches()])
        .then(() => {
            return fetch('api/admin.php?action=all_timelogs');
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderTimeLogsTable(data.data);
            } else {
                showToast(data.message || 'ไม่สามารถโหลดข้อมูลได้', 'error');
                document.getElementById('admin-content').innerHTML = '<div style="padding: 20px; color: red;">Error: ' + (data.message || 'Unknown error') + '</div>';
            }
        })
        .catch(err => {
            showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
            document.getElementById('admin-content').innerHTML = '<div style="padding: 20px; color: red;">Error: ' + err.message + '</div>';
        });
}

function renderTimeLogsTable(logs, startDate = '', endDate = '', departmentId = '', branchId = '') {
    adminPagination.setData('timelogs', logs);

    // Generate Department Options
    const departmentOptions = departments.map(d =>
        `<option value="${d.id}" ${d.id == departmentId ? 'selected' : ''}>${d.name}</option>`
    ).join('');

    // Generate Branch Options
    const branchOptions = branches.map(b =>
        `<option value="${b.id}" ${b.id == branchId ? 'selected' : ''}>${b.name}</option>`
    ).join('');

    const today = new Date().toISOString().split('T')[0];

    const html = `
        <div class="admin-section">
            <div class="section-header" style="justify-content: space-between; align-items: center;">
                <h2 style="white-space: nowrap;">ประวัติการเข้าออกงาน</h2>
                <button class="btn-secondary" onclick="exportTimeLogsToCSV()" style="display: flex; align-items: center; gap: 5px; width: auto; align-self: center;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Export to CSV
                </button>
            </div>
            
            <div class="filter-bar" style="margin-bottom: 20px; display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div class="filter-item" style="flex: 1; min-width: 100px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">ค้นหา</label>
                    <input type="text" id="employee-search" placeholder="รหัสพนักงาน หรือ ชื่อ..." class="form-control" style="width: 100%; height: 51px;">
                </div>
                
                <div class="filter-item" style="width: 150px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">แผนก</label>
                    <select id="filter-department" class="form-control" style="width: 100%; height: 51px;">
                        <option value="">ทุกแผนก</option>
                        ${departmentOptions}
                    </select>
                </div>

                <div class="filter-item" style="width: 150px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">สาขา</label>
                    <select id="filter-branch" class="form-control" style="width: 100%; height: 51px;">
                        <option value="">ทุกสาขา</option>
                        ${branchOptions}
                    </select>
                </div>

                <div class="filter-item" style="min-width: 130px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">วันที่เริ่ม</label>
                    <input type="date" id="start-date" class="form-control" style="width: 100%; height: 51px; cursor: pointer;" value="${startDate}" max="${today}" onclick="try { this.showPicker() } catch(e) {}">
                </div>

                <div class="filter-item" style="min-width: 130px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">ถึงวันที่</label>
                    <input type="date" id="end-date" class="form-control" style="width: 100%; height: 51px; cursor: pointer;" value="${endDate}" max="${today}" onclick="try { this.showPicker() } catch(e) {}">
                </div>
                
                <div class="filter-item" style="display: flex; gap: 5px;">
                    <button class="btn-primary" onclick="filterTimeLogs()" style="height: 51px; display: flex; align-items: center; justify-content: center; min-width: 51px;" title="ค้นหา">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        ค้นหา
                    </button>
                    <button class="btn-secondary" onclick="resetTimeLogFilters()" style="height: 51px; display: flex; align-items: center; justify-content: center; min-width: 130px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6"></path>
                            <path d="M1 20v-6h6"></path>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        ล้างค่า
                    </button>
                </div>
            </div>
            
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>วันที่</th>
                            <th>รหัสพนักงาน</th>
                            <th>ชื่อ-นามสกุล</th>
                            <th>แผนก</th>
                            <th>กะการทำงาน</th>
                            <th>สาขาที่เข้างาน</th>
                            <th>เข้างาน</th>
                            <th>ออกงาน</th>
                            <th>สถานะ</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="timelogs-table-body">
                         <!-- Rendered by renderTimeLogsTableHTML -->
                    </tbody>
                </table>
            </div>
            <div id="timelogs-pagination"></div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;

    // Add search functionality
    document.getElementById('employee-search')?.addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = logs.filter(log =>
            (log.employee_code && log.employee_code.toLowerCase().includes(searchTerm)) ||
            (log.first_name && log.first_name.toLowerCase().includes(searchTerm)) ||
            (log.last_name && log.last_name.toLowerCase().includes(searchTerm))
        );
        adminPagination.setData('timelogs', filtered);
        adminPagination.reRender('timelogs');
    });

    // Add date filter functionality
    document.getElementById('start-date')?.addEventListener('change', function (e) {
        // Option 1: Auto-filter on change
        // filterTimeLogs();
        // Option 2: Do nothing, let user click Search button (Preferred as per button existence)
    });

    document.getElementById('end-date')?.addEventListener('change', function (e) {
        // filterTimeLogs();
    });

    adminPagination.reRender('timelogs');

    // Add event listeners for photo buttons using event delegation
    // Remove old event listener first to prevent duplicate event handlers
    const adminContent = document.getElementById('admin-content');
    const oldHandler = adminContent._photoClickHandler;
    if (oldHandler) {
        adminContent.removeEventListener('click', oldHandler);
    }

    // Create new handler and store reference
    const newHandler = function (e) {
        const photoBtn = e.target.closest('.btn-photo-link');
        if (photoBtn) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            const photo = photoBtn.dataset.photo;
            const type = photoBtn.dataset.type;
            const employee = photoBtn.dataset.employee;
            const datetime = photoBtn.dataset.datetime;
            viewPhoto(photo, type, employee, datetime);
        }
    };

    adminContent._photoClickHandler = newHandler;
    adminContent.addEventListener('click', newHandler);
}

function renderTimeLogsTableHTML(logs) {
    const tbody = document.getElementById('timelogs-table-body');
    if (!tbody) return;

    tbody.innerHTML = logs.map(log => {
        // Create Google Maps links if coordinates exist
        const checkinMapButton = (log.check_in_lat && log.check_in_lng)
            ? `<a href="https://www.google.com/maps?q=${log.check_in_lat},${log.check_in_lng}" target="_blank" class="btn-map-link" title="ดูตำแหน่งเข้างานใน Google Maps" style="margin-left: 5px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                            📍
                           </a>`
            : '';

        const checkoutMapButton = (log.check_out_lat && log.check_out_lng)
            ? `<a href="https://www.google.com/maps?q=${log.check_out_lat},${log.check_out_lng}" target="_blank" class="btn-map-link" title="ดูตำแหน่งออกงานใน Google Maps" style="margin-left: 5px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                            📍
                           </a>`
            : '';

        // Create photo buttons if photos exist
        const checkinPhotoButton = log.check_in_photo
            ? `<button class="btn-photo-link btn-photo-checkin" 
                            data-photo="${log.check_in_photo}" 
                            data-type="เข้างาน" 
                            data-employee="${log.first_name} ${log.last_name}" 
                            data-datetime="${formatDateTime(log.check_in_time)}"
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
                            data-photo="${log.checkout_photo}" 
                            data-type="ออกงาน" 
                            data-employee="${log.first_name} ${log.last_name}" 
                            data-datetime="${formatDateTime(log.check_out_time)}"
                            title="ดูรูปถ่ายออกงาน">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                           </button>`
            : '';

        return `
                        <tr data-checkin-lat="${log.check_in_lat || ''}" 
                            data-checkin-lng="${log.check_in_lng || ''}" 
                            data-checkout-lat="${log.check_out_lat || ''}" 
                            data-checkout-lng="${log.check_out_lng || ''}" 
                            data-checkin-photo="${log.check_in_photo || ''}" 
                            data-checkout-photo="${log.checkout_photo || ''}">
                            <td>${formatDate(log.work_date)}</td>
                            <td>${log.employee_code}</td>
                            <td>${log.first_name} ${log.last_name}</td>
                            <td>${log.department_name || '-'}</td>
                            <td>${log.shift_name || 'กะปกติ'}</td>
                            <td>${log.branch_name || '-'}</td>
                            <td>${log.check_in_time ? formatTime(log.check_in_time) : '-'}${checkinMapButton}${checkinPhotoButton}</td>
                            <td>${log.check_out_time ? formatTime(log.check_out_time) : '-'}${checkoutMapButton}${checkoutPhotoButton}</td>
                            <td>
                                <span class="badge ${log.status}">
                                    ${getStatusText(log.status)}
                                </span>
                            </td>
                            <td>
                                <button class="btn-sm btn-edit" style="background: #f16e00; color: white; cursor: pointer;" 
                                        onclick="window.openEditTimeLogModal(${log.id}, '${log.work_date}', '${log.check_in_time || ''}', '${log.check_out_time || ''}', '${log.status}', '${log.first_name} ${log.last_name}')">
                                    ✏️ แก้ไข
                                </button>
                            </td>
                        </tr>
                    `;
    }).join('');
}

// Filter Time Logs by date range
function filterTimeLogs() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const departmentId = document.getElementById('filter-department').value;
    const branchId = document.getElementById('filter-branch').value;

    // Prevent future dates
    const today = new Date().toISOString().split('T')[0];
    if ((startDate && startDate > today) || (endDate && endDate > today)) {
        showToast('ไม่สามารถเลือกวันที่ล่วงหน้าได้', 'error');
        return;
    }

    let url = 'api/admin.php?action=all_timelogs';

    // Add parameters if provided
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    if (departmentId) url += `&department_id=${departmentId}`;
    if (branchId) url += `&branch_id=${branchId}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderTimeLogsTable(data.data, startDate, endDate, departmentId, branchId);
            } else {
                showToast('ไม่สามารถโหลดข้อมูลได้', 'error');
            }
        })
        .catch(error => {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        });
}

function resetTimeLogFilters() {
    const url = 'api/admin.php?action=all_timelogs';
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Render with empty filter parameters to clear inputs
                renderTimeLogsTable(data.data, '', '', '', '');
                showToast('ล้างค่าตัวกรองเรียบร้อย', 'success');
            } else {
                showToast('ไม่สามารถโหลดข้อมูลได้', 'error');
            }
        })
        .catch(error => {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        });
}

// Leave Management
function loadLeaveManagementSection() {
    // Check for employee filter in URL parameters first
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const employeeFilter = urlParams.get('employee');

    // If viewing specific employee history, fetch all records; otherwise use last 30 days (default backend behavior)
    let fetchUrl = 'api/admin.php?action=all_leaves';
    fetch(fetchUrl)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderLeavesTable(data.data);

                if (employeeFilter) {
                    // Apply employee filter after a short delay to ensure the search input is rendered
                    setTimeout(() => {
                        const searchInput = document.getElementById('leave-employee-search');
                        if (searchInput) {
                            searchInput.value = decodeURIComponent(employeeFilter);
                            searchInput.dispatchEvent(new Event('input'));

                            // Show notification that filter is applied
                            showToast(`กรองประวัติการลา: รหัสพนักงาน ${decodeURIComponent(employeeFilter)} (แสดงทุกช่วงเวลา)`, 'info');
                        }
                    }, 100);
                }
            } else {
                showToast('ไม่สามารถโหลดข้อมูลการลาได้', 'error');
            }
        })
        .catch(error => {
            console.error('Error loading leave management:', error);
            showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
        });
}

function renderLeavesTable(leaves, startDate = '', endDate = '') {
    adminPagination.setData('leaves', leaves);

    // Max date for inputs (today)
    const today = new Date().toISOString().split('T')[0];

    const html = `
        <div class="admin-section">
            <div class="section-header" style="justify-content: space-between; align-items: center;">
                <h2 style="white-space: nowrap;">ข้อมูลการลา</h2>
                <button class="btn-secondary" onclick="exportLeavesToCSV()" style="display: flex; align-items: center; gap: 5px; width: auto; align-self: center;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Export to CSV
                </button>
            </div>
            
            <div class="filter-bar" style="margin-bottom: 20px; display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div class="filter-item" style="flex: 1; min-width: 100px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">ค้นหา</label>
                    <input type="text" id="leave-employee-search" placeholder="ค้นหาพนักงาน..." class="form-control" style="width: 100%; height: 51px;">
                </div>

                <div class="filter-item" style="min-width: 130px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">วันที่เริ่ม</label>
                    <input type="date" id="leave-start-date" class="form-control" style="width: 100%; height: 51px; cursor: pointer;" value="${startDate}" max="${today}" onclick="try { this.showPicker() } catch(e) {}">
                </div>

                <div class="filter-item" style="min-width: 130px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">ถึงวันที่</label>
                    <input type="date" id="leave-end-date" class="form-control" style="width: 100%; height: 51px; cursor: pointer;" value="${endDate}" max="${today}" onclick="try { this.showPicker() } catch(e) {}">
                </div>

                <div class="filter-item" style="min-width: 150px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px;">ประเภทการลา</label>
                    <select id="leave-type-filter" class="form-control" style="width: 100%; height: 51px;">
                        <option value="">ทุกประเภท</option>
                        ${[...new Set(leaves.map(l => l.leave_type_name))].filter(Boolean).sort().map(type => `<option value="${type}">${type}</option>`).join('')}
                    </select>
                </div>

                <div class="filter-item" style="display: flex; gap: 5px;">
                    <button class="btn-primary" onclick="filterLeaves()" style="height: 51px; display: flex; align-items: center; justify-content: center; min-width: 100px; white-space: nowrap;" title="ค้นหา">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 5px;">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        ค้นหา
                    </button>
                    <button class="btn-secondary" onclick="resetLeaveFilters()" style="height: 51px; display: flex; align-items: center; justify-content: center; min-width: 130px; white-space: nowrap;" title="ล้างค่าตัวกรอง">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 5px;">
                            <path d="M23 4v6h-6"></path>
                            <path d="M1 20v-6h6"></path>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        ล้างค่า
                    </button>
                </div>
            </div>
            
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>วันที่ส่งคำขอ</th>
                            <th>รหัสพนักงาน</th>
                            <th>ชื่อ-นามสกุล</th>
                            <th>ประเภทการลา</th>
                            <th>วันที่ลา</th>
                            <th>จำนวนวัน</th>
                            <th>สถานะ</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="leave-table-body">
                         <!-- Rendered by renderLeavesTableHTML -->
                    </tbody>
                </table>
            </div>
            <div id="leaves-pagination"></div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;

    // Add search functionality
    document.getElementById('leave-employee-search')?.addEventListener('input', applyLeaveFilters);
    document.getElementById('leave-type-filter')?.addEventListener('change', applyLeaveFilters);

    function applyLeaveFilters() {
        const searchTerm = (document.getElementById('leave-employee-search')?.value || '').toLowerCase();
        const typeFilter = document.getElementById('leave-type-filter')?.value || '';

        const filtered = leaves.filter(leave => {
            const matchSearch = (leave.employee_code && leave.employee_code.toLowerCase().includes(searchTerm)) ||
                (leave.first_name && leave.first_name.toLowerCase().includes(searchTerm)) ||
                (leave.last_name && leave.last_name.toLowerCase().includes(searchTerm));

            const matchType = typeFilter === '' || leave.leave_type_name === typeFilter;

            return matchSearch && matchType;
        });

        adminPagination.setData('leaves', filtered);
        adminPagination.reRender('leaves');
    }

    adminPagination.reRender('leaves');
}

function renderLeavesTableHTML(leaves) {
    const tbody = document.getElementById('leave-table-body');
    if (!tbody) return;

    // ตรวจสอบว่าผู้ใช้งานมีสิทธิ์แบบ Read-Only หรือไม่ (เช่น HR Admin)
    const isReadOnly = isReadOnlySection('leave-management');

    tbody.innerHTML = leaves.map(leave => `
        <tr data-employee-code="${leave.employee_code.toLowerCase()}" data-employee-name="${(leave.first_name + ' ' + leave.last_name).toLowerCase()}">
            <td>${formatDate(leave.created_at)}</td>
            <td>${leave.employee_code}</td>
            <td>${leave.first_name} ${leave.last_name}</td>
            <td>${leave.leave_type_name}</td>
            <td>${formatDate(leave.start_date)} - ${formatDate(leave.end_date)}</td>
            <td>${leave.total_days}</td>
            <td>
                <span class="badge ${getLeaveStatusClass(leave.status)}">
                    ${leave.status}
                </span>
            </td>
            <td>
                ${isReadOnly ? `
                    <span style="color: #6c757d; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
                        👁️ ดูได้อย่างเดียว
                    </span>
                ` : `
                    <button class="btn-sm btn-edit" onclick="editLeave(${leave.id})">แก้ไข</button>
                    <button class="btn-sm btn-delete" onclick="deleteLeave(${leave.id})">ลบ</button>
                `}
            </td>
        </tr>
    `).join('');
}

// Filter Leaves by date range
function filterLeaves() {
    const startDate = document.getElementById('leave-start-date').value;
    const endDate = document.getElementById('leave-end-date').value;

    let fetchUrl = 'api/admin.php?action=all_leaves';
    if (startDate) fetchUrl += `&start_date=${startDate}`;
    if (endDate) fetchUrl += `&end_date=${endDate}`;

    fetch(fetchUrl)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderLeavesTable(data.data, startDate, endDate);
            } else {
                showToast('ไม่สามารถโหลดข้อมูลได้', 'error');
            }
        })
        .catch(error => {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        });
}

function resetLeaveFilters() {
    document.getElementById('leave-employee-search').value = '';

    // reset type filter if exists (it's dynamically refreshed but good to clear just in case)
    const typeFilter = document.getElementById('leave-type-filter');
    if (typeFilter) {
        typeFilter.value = '';
    }

    document.getElementById('leave-start-date').value = '';
    document.getElementById('leave-end-date').value = '';

    filterLeaves();
}

// Departments Management
function loadDepartmentsSection() {
    fetch('api/admin.php?action=departments')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderDepartmentsTable(data.data);
            }
        });
}

function renderDepartmentsTable(departments) {
    adminPagination.setData('departments', departments);

    const html = `
        <div class="admin-section">
            <div class="section-header" style="justify-content: space-between; align-items: center;">
                <h2 style="white-space: nowrap;">ข้อมูลแผนก</h2>
                <button class="btn-primary" onclick="showAddDepartmentModal()" style="width: auto; align-self: center;">+ เพิ่มแผนก</button>
            </div>
            
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ชื่อแผนก</th>
                            <th>หัวหน้าแผนก</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="departments-table-body">
                         <!-- Rendered by renderDepartmentsTableHTML -->
                    </tbody>
                </table>
            </div>
            <div id="departments-pagination"></div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;
    adminPagination.reRender('departments');
}

function renderDepartmentsTableHTML(departments) {
    const tbody = document.getElementById('departments-table-body');
    if (!tbody) return;

    tbody.innerHTML = departments.map(dept => `
        <tr>
            <td>${dept.name}</td>
            <td>${dept.manager_name || '-'}</td>
            <td>
                <button class="btn-sm btn-edit" onclick="editDepartment(${dept.id})">แก้ไข</button>
                <button class="btn-sm btn-delete" onclick="deleteDepartment(${dept.id})">ลบ</button>
            </td>
        </tr>
    `).join('');
}

// Leave Types Management
function loadLeaveTypesSection() {
    fetch('api/admin.php?action=leave_types')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderLeaveTypesTable(data.data);
            }
        });
}

function renderLeaveTypesTable(types) {
    // Leave types usually few, but can be paginated if needed. Assuming user wants pagination on all main tables.
    // For now, let's just render it directly as it wasn't explicitly requested to be paginated in the prompt list 
    // (Wait, the prompt said "pagination to 6 admin pages... Leave Information, Department Information, Branch Information, System Settings...").
    // "Leave Types" (Conditions) was not explicitly in the list "จัดการข้อมูลพนักงาน,ประวัติการเข้าออกงาน,ข้อมูลการลา,ข้อมูลแผนก,ข้อมูลสาขา และหน้า ตั้งค่าผู้ดูแลระบบ".
    // "ตั้งค่าเงื่อนไขการลา" is separate.
    // However, consistency is good. But let's stick to the list.

    const html = `
        <div class="admin-section">
            <div class="section-header" style="justify-content: space-between; align-items: center;">
                <h2 style="white-space: nowrap;">ตั้งค่าเงื่อนไขการลา</h2>
                <div style="display: flex; gap: 10px; width: auto; align-self: center;">
                    <button class="btn-secondary" onclick="showManageEmployeeTypesModal()" style="white-space: nowrap;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 5px;">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        จัดการประเภทพนักงาน
                    </button>
                    <button class="btn-primary" onclick="showAddLeaveTypeModal()" style="white-space: nowrap;">+ เพิ่มประเภทการลา</button>
                </div>
            </div>
            
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ประเภทการลา</th>
                            <th>ประเภทพนักงาน</th>
                            <th>อายุงานขั้นต่ำ (วัน)</th>
                            <th>จำนวนวันที่ลาได้</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${types.map(type => `
                            <tr>
                                <td>${type.name}</td>
                                <td>${type.employee_type}</td>
                                <td>${type.min_work_days}</td>
                                <td>${type.max_days}</td>
                                <td>
                                    <button class="btn-sm btn-edit" onclick="editLeaveType(${type.id})">แก้ไข</button>
                                    <button class="btn-sm btn-delete" onclick="deleteLeaveType(${type.id})">ลบ</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;
}

function loadEmployeeTypesSection() {
    const html = `
        <div class="admin-section">
            <div class="section-header">
                <h2>จัดการประเภทพนักงาน</h2>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ddd;">
                <h3 style="margin-top: 0; font-size: 16px; margin-bottom: 15px;">เพิ่มประเภทพนักงาน</h3>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="new-employee-type-name" class="form-control" placeholder="ชื่อประเภทพนักงาน (เช่น พนักงานประจำ, ทดลองงาน)" style="flex: 1;">
                    <button class="btn-primary" onclick="addEmployeeType()">บันทึก</button>
                </div>
            </div>
            
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th style="width: 80px;">ID</th>
                            <th>ชื่อประเภทพนักงาน</th>
                            <th style="width: 100px;">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="employee-types-table-body">
                        <!-- Rendered by loadEmployeeTypesTable -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;
    loadEmployeeTypesTable();
}


// Shifts Management
function loadShiftsSection() {
    fetch('api/admin.php?action=shifts')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderShiftsTable(data.data);
            }
        });
}

function renderShiftsTable(shifts) {
    const html = `
        <div class="admin-section">
            <div class="section-header" style="justify-content: space-between; align-items: center;">
                <h2 style="white-space: nowrap;">ตั้งค่าเวลาทำงาน (กะการทำงาน)</h2>
                <button class="btn-primary" onclick="showAddShiftModal()" style="width: auto; align-self: center;">+ เพิ่มกะการทำงาน</button>
            </div>
            
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ชื่อกะ</th>
                            <th>เวลาเข้างาน</th>
                            <th>เวลาเลิกงาน</th>
                            <th>วันที่ทำงาน</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${shifts.map(shift => {
        let workDays = [];
        try {
            workDays = JSON.parse(shift.work_days || '[]');
        } catch (e) {
            workDays = [];
        }

        const dayNames = {
            'monday': 'จันทร์',
            'tuesday': 'อังคาร',
            'wednesday': 'พุธ',
            'thursday': 'พฤหัส',
            'friday': 'ศุกร์',
            'saturday': 'เสาร์',
            'sunday': 'อาทิตย์'
        };

        const workDaysText = workDays.map(day => dayNames[day] || day).join(', ');

        return `
                                <tr>
                                    <td><strong>${shift.name}</strong></td>
                                    <td>${(shift.start_time === '00:00:00' && shift.end_time === '00:00:00') ? '<span class="badge badge-active">ไม่จำกัดเวลา</span>' : formatTime(shift.start_time)}</td>
                                    <td>${(shift.start_time === '00:00:00' && shift.end_time === '00:00:00') ? '<span class="badge badge-active">ไม่จำกัดเวลา</span>' : formatTime(shift.end_time)}</td>
                                    <td>${workDaysText || '-'}</td>
                                    <td>
                                        <button class="btn-sm btn-edit" onclick="editShift(${shift.id})">แก้ไข</button>
                                        <button class="btn-sm btn-delete" onclick="deleteShift(${shift.id})">ลบ</button>
                                    </td>
                                </tr>
                            `;
    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;
}

// Branches Management
function loadBranchesSection() {
    fetch('api/admin.php?action=branches')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderBranchesTable(data.data);
            }
        });
}

function renderBranchesTable(branches) {
    adminPagination.setData('branches', branches);

    const html = `
        <div class="admin-section">
            <div class="section-header" style="justify-content: space-between; align-items: center;">
                <h2 style="white-space: nowrap;">ตั้งค่าสาขา</h2>
                <button class="btn-primary" onclick="showAddBranchModal()" style="width: auto; align-self: center;">+ เพิ่มสาขา</button>
            </div>
            
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ชื่อที่ตั้ง</th>
                            <th>พิกัด (Lat, Long)</th>
                            <th>รัศมี (ม.)</th>
                            <th>เข้างานนอกสถานที่</th>
                            <th>ออกงานนอกสถานที่</th>
                            <th>สาขาเริ่มต้น</th>
                            <th>สถานะ</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="branches-table-body">
                         <!-- Rendered by renderBranchesTableHTML -->
                    </tbody>
                </table>
            </div>
            <div id="branches-pagination"></div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;
    adminPagination.reRender('branches');
}

function renderBranchesTableHTML(branches) {
    const tbody = document.getElementById('branches-table-body');
    if (!tbody) return;

    tbody.innerHTML = branches.map(branch => `
        <tr>
            <td>
                ${branch.name}
                ${branch.is_default ? '<span class="badge badge-active" style="margin-left: 8px; font-size: 11px;">⭐ เริ่มต้น</span>' : ''}
            </td>
            <td>${branch.latitude}, ${branch.longitude}</td>
            <td>${branch.radius}</td>
            <td>
                <span class="badge ${branch.allow_checkin_outside ? 'badge-active' : 'badge-inactive'}">
                    ${branch.allow_checkin_outside ? 'อนุญาต' : 'ไม่อนุญาต'}
                </span>
            </td>
            <td>
                <span class="badge ${branch.allow_checkout_outside ? 'badge-active' : 'badge-inactive'}">
                    ${branch.allow_checkout_outside ? 'อนุญาต' : 'ไม่อนุญาต'}
                </span>
            </td>
            <td>
                <span class="badge ${branch.is_default ? 'badge-active' : 'badge-inactive'}">
                    ${branch.is_default ? '✓ ใช่' : 'ไม่ใช่'}
                </span>
            </td>
            <td>
                <span class="badge ${branch.is_active ? 'badge-active' : 'badge-inactive'}">
                    ${branch.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                </span>
            </td>
            <td>
                <button class="btn-sm btn-edit" onclick="editBranch(${branch.id})">แก้ไข</button>
                <button class="btn-sm btn-delete" onclick="deleteBranch(${branch.id})">ลบ</button>
                ${branch.google_maps_link ? `<a href="${branch.google_maps_link}" target="_blank" class="btn-sm" style="background: #4285F4; color: white; text-decoration: none; display: inline-block;">แผนที่</a>` : ''}
            </td>
        </tr>
    `).join('');
}

// ... Rest of the file (Shifts, Company Settings, User Roles, etc.)
// I'll keep the rest of the functions as they are, but ensuring UserRoles uses pagination

// User Roles Management
function loadUserRolesSection() {
    fetch('api/admin.php?action=employees')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderUserRolesTable(data.data);
            }
        });
}

function renderUserRolesTable(employees) {
    adminPagination.setData('userRoles', employees);

    const html = `
        <div class="admin-section">
            <div class="section-header">
                <h2>ตั้งค่าผู้ดูแลระบบ</h2>
            </div>
            
            <div class="filter-bar" style="margin-bottom: 20px;">
                <input type="text" id="roles-search" class="form-control" placeholder="🔍 ค้นหารหัสพนักงาน หรือ ชื่อ-นามสกุล..." style="max-width: 400px;">
            </div>
            
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>รหัสพนักงาน</th>
                            <th>ชื่อ-นามสกุล</th>
                            <th>แผนก</th>
                            <th>สิทธิ์ปัจจุบัน</th>
                            <th>เปลี่ยนสิทธิ์</th>
                        </tr>
                    </thead>
                    <tbody id="roles-table-body">
                       <!-- Rendered by renderUserRolesTableHTML -->
                    </tbody>
                </table>
            </div>
            
            <div id="userRoles-pagination"></div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;

    // Add search functionality
    document.getElementById('roles-search')?.addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase();
        // Filter from full data
        const filtered = employees.filter(emp =>
            emp.employee_code.toLowerCase().includes(searchTerm) ||
            (emp.first_name + ' ' + emp.last_name).toLowerCase().includes(searchTerm)
        );
        adminPagination.setData('userRoles', filtered);
        adminPagination.reRender('userRoles');
    });

    adminPagination.reRender('userRoles');
}

function renderUserRolesTableHTML(employees) {
    const tbody = document.getElementById('roles-table-body');
    if (!tbody) return;

    tbody.innerHTML = employees.map(emp => `
        <tr data-employee-code="${emp.employee_code.toLowerCase()}" data-employee-name="${(emp.first_name + ' ' + emp.last_name).toLowerCase()}">
            <td>${emp.employee_code}</td>
            <td>${emp.first_name} ${emp.last_name}</td>
            <td>${emp.department_name || '-'}</td>
            <td>
                <span class="badge ${getRoleBadgeClass(emp.role || 'พนักงาน')}">
                    ${emp.role || 'พนักงาน'}
                </span>
            </td>
            <td>
                <select class="form-control" onchange="updateUserRole(${emp.id}, this.value)">
                    <option value="พนักงาน" ${(emp.role || 'พนักงาน') === 'พนักงาน' ? 'selected' : ''}>พนักงาน</option>
                    <option value="HR" ${(emp.role || 'พนักงาน') === 'HR' ? 'selected' : ''}>HR</option>
                    <option value="IT Support" ${(emp.role || 'พนักงาน') === 'IT Support' ? 'selected' : ''}>IT Support</option>
                    <option value="HR Admin" ${(emp.role || 'พนักงาน') === 'HR Admin' ? 'selected' : ''}>HR Admin</option>
                    <option value="ผู้ดูแลระบบ" ${(emp.role || 'พนักงาน') === 'ผู้ดูแลระบบ' ? 'selected' : ''}>ผู้ดูแลระบบ</option>
                </select>
            </td>
        </tr>
    `).join('');
}

// Shift Modal Functions
let currentShiftId = null;

function showAddShiftModal() {
    currentShiftId = null;
    document.getElementById('shift-modal-title').textContent = 'เพิ่มกะการทำงาน';
    document.getElementById('shift-form').reset();
    document.getElementById('shift-id').value = '';
    const flexCheckbox = document.getElementById('shift-is-flexible');
    if (flexCheckbox) {
        flexCheckbox.dispatchEvent(new Event('change'));
    }

    // Uncheck all work days
    document.querySelectorAll('#shift-work-days input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Show modal
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('shift-modal').style.display = 'block';
    document.getElementById('employee-modal').style.display = 'none';
    document.getElementById('leave-request-modal').style.display = 'none';
    document.getElementById('branch-modal').style.display = 'none';
    document.getElementById('department-modal').style.display = 'none';
    document.getElementById('leavetype-modal').style.display = 'none';
}

function editShift(shiftId) {
    currentShiftId = shiftId;
    document.getElementById('shift-modal-title').textContent = 'แก้ไขกะการทำงาน';

    // Fetch shift data
    fetch(`api/admin.php?action=shift&id=${shiftId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const shift = data.data;

                // Fill form
                document.getElementById('shift-id').value = shift.id;
                document.getElementById('shift-name').value = shift.name;
                document.getElementById('shift-start-time').value = shift.start_time;
                document.getElementById('shift-end-time').value = shift.end_time;
                const flexCheckbox = document.getElementById('shift-is-flexible');
                if (flexCheckbox) {
                    flexCheckbox.checked = (shift.start_time === '00:00:00' && shift.end_time === '00:00:00');
                    // Trigger change event to update inputs disabled state
                    flexCheckbox.dispatchEvent(new Event('change'));
                }

                // Parse work days
                let workDays = [];
                try {
                    workDays = JSON.parse(shift.work_days || '[]');
                } catch (e) {
                    workDays = [];
                }

                // Check the appropriate checkboxes
                document.querySelectorAll('#shift-work-days input[type="checkbox"]').forEach(cb => {
                    cb.checked = workDays.includes(cb.value);
                });

                // Show modal
                document.getElementById('modal-overlay').classList.remove('hidden');
                document.getElementById('shift-modal').style.display = 'block';
                document.getElementById('employee-modal').style.display = 'none';
                document.getElementById('leave-request-modal').style.display = 'none';
                document.getElementById('branch-modal').style.display = 'none';
                document.getElementById('department-modal').style.display = 'none';
                document.getElementById('leavetype-modal').style.display = 'none';
            }
        });
}

function closeShiftModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('shift-modal').style.display = 'none';
    document.getElementById('shift-form').reset();
    currentShiftId = null;
}

function deleteShift(shiftId) {
    if (!confirm('คุณต้องการลบกะการทำงานนี้ใช่หรือไม่?')) {
        return;
    }

    const formData = new FormData();
    formData.append('id', shiftId);

    fetch('api/admin.php?action=delete_shift', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('ลบกะการทำงานสำเร็จ', 'success');
                loadShiftsSection();
            } else {
                showToast(data.message, 'error');
            }
        });
}

// Handle flexible shift checkbox toggle
document.getElementById('shift-is-flexible')?.addEventListener('change', function () {
    const isFlexible = this.checked;
    const startTimeInput = document.getElementById('shift-start-time');
    const endTimeInput = document.getElementById('shift-end-time');
    
    if (isFlexible) {
        startTimeInput.disabled = true;
        endTimeInput.disabled = true;
        startTimeInput.required = false;
        endTimeInput.required = false;
        startTimeInput.value = '';
        endTimeInput.value = '';
    } else {
        startTimeInput.disabled = false;
        endTimeInput.disabled = false;
        startTimeInput.required = true;
        endTimeInput.required = true;
    }
});

// Handle shift form submission
document.getElementById('shift-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {};

    // Get basic fields
    data.id = formData.get('id');
    data.name = formData.get('name');
    const flexCheckbox = document.getElementById('shift-is-flexible');
    const is_flexible = flexCheckbox ? flexCheckbox.checked : false;
    data.is_flexible = is_flexible ? 1 : 0;
    
    if (is_flexible) {
        data.start_time = '00:00:00';
        data.end_time = '00:00:00';
    } else {
        data.start_time = formData.get('start_time');
        data.end_time = formData.get('end_time');
        
        if (!data.start_time || !data.end_time) {
            showToast('กรุณากรอกเวลาเข้างานและเวลาเลิกงาน', 'error');
            return;
        }
    }

    // Get work days as array
    const workDays = [];
    document.querySelectorAll('#shift-work-days input[type="checkbox"]:checked').forEach(cb => {
        workDays.push(cb.value);
    });

    if (workDays.length === 0) {
        showToast('กรุณาเลือกวันที่ทำงานอย่างน้อย 1 วัน', 'error');
        return;
    }

    data.work_days = JSON.stringify(workDays);

    const url = currentShiftId
        ? 'api/admin.php?action=update_shift'
        : 'api/admin.php?action=add_shift';

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast(currentShiftId ? 'อัพเดทกะการทำงานสำเร็จ' : 'เพิ่มกะการทำงานสำเร็จ', 'success');
                closeShiftModal();
                loadShiftsSection();
            } else {
                showToast(response.message, 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
});

// Company Settings Management
function loadCompanySettingsSection() {
    fetch('api/admin.php?action=get_company_settings')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderCompanySettingsForm(data.data);
            } else {
                showToast('ไม่สามารถโหลดข้อมูลบริษัทได้', 'error');
            }
        })
        .catch(() => {
            showToast('เกิดข้อผิดพลาด', 'error');
        });
}

function renderCompanySettingsForm(settings) {
    const html = `
        <div class="admin-section">
            <div class="section-header" style="justify-content: space-between; align-items: center;">
                <h2 style="white-space: nowrap; display: flex; align-items: center;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    จัดการข้อมูลบริษัท
                </h2>
            </div>
            
            <div style="max-width: 800px; margin: 0 auto;">
                <form id="company-settings-form" style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    
                    <!-- ข้อมูลพื้นฐาน -->
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #FF6B35; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FF6B35;">
                            📋 ข้อมูลพื้นฐาน
                        </h3>
                        
                        <div class="form-group">
                            <label>ชื่อบริษัท <span style="color: red;">*</span></label>
                            <input type="text" 
                                   id="company-name" 
                                   name="company_name" 
                                   class="form-control" 
                                   value="${settings.company_name || ''}" 
                                   required
                                   placeholder="เช่น China Thai Group">
                        </div>
                        
                        <div class="form-group">
                            <label>ที่อยู่บริษัท</label>
                            <textarea id="company-address" 
                                      name="company_address" 
                                      class="form-control" 
                                      rows="3"
                                      placeholder="เช่น 123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110">${settings.company_address || ''}</textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>เบอร์โทรศัพท์</label>
                                <input type="tel" 
                                       id="company-phone" 
                                       name="phone" 
                                       class="form-control" 
                                       value="${settings.phone || ''}"
                                       placeholder="02-123-4567">
                            </div>
                            <div class="form-group">
                                <label>อีเมล</label>
                                <input type="email" 
                                       id="company-email" 
                                       name="email" 
                                       class="form-control" 
                                       value="${settings.email || ''}"
                                       placeholder="contact@company.com">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Email แจ้งเตือน HR -->
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #FF6B35; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FF6B35;">
                            📧 ข้อมูล HR สำหรับการแจ้งเตือน
                        </h3>
                        
                        <div class="form-group">
                            <label>ชื่อ HR อนุมัติ <span style="color: red;">*</span></label>
                            <input type="text" 
                                   id="hr-name" 
                                   name="hr_name" 
                                   class="form-control" 
                                   value="${settings.hr_name || ''}"
                                   required
                                   placeholder="เช่น คุณสมหญิง วิชัย">
                            <small style="color: #666; display: block; margin-top: 5px;">
                                👤 ชื่อ-นามสกุล ของ HR ที่รับผิดชอบการอนุมัติลา (จะแสดงในขั้นตอนการอนุมัติ)
                            </small>
                        </div>
                        
                        <div class="form-group">
                            <label>Email รับการแจ้งเตือนของ HR <span style="color: red;">*</span></label>
                            <input type="email" 
                                   id="hr-email" 
                                   name="hr_email" 
                                   class="form-control" 
                                   value="${settings.hr_email || ''}"
                                   required
                                   placeholder="hr@company.com">
                            <small style="color: #666; display: block; margin-top: 5px;">
                                📨 Email นี้จะใช้สำหรับรับการแจ้งเตือนเมื่อมีคำขอลาที่รออนุมัติจาก HR
                            </small>
                        </div>
                        
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; border-left: 4px solid #2196F3; margin-top: 15px;">
                            <p style="margin: 0; color: #1565C0; font-size: 14px;">
                                <strong>💡 หมายเหตุ:</strong> เมื่อหัวหน้าแผนกอนุมัติการลาแล้ว ระบบจะส่งอีเมลแจ้งเตือนไปยัง Email นี้เพื่อให้ HR อนุมัติต่อ และชื่อที่กรอกจะแสดงในขั้นตอนการอนุมัติ
                            </p>
                        </div>
                    </div>
                    
                    <!-- ตำแหน่งบริษัท -->
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #FF6B35; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FF6B35;">
                            📍 ตำแหน่งบริษัท (พิกัด)
                        </h3>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>ละติจูด (Latitude)</label>
                                <input type="number" 
                                       id="company-latitude" 
                                       name="company_latitude" 
                                       class="form-control" 
                                       step="0.00000001"
                                       value="${settings.company_latitude || ''}"
                                       placeholder="13.7563">
                                <small style="color: #666;">พิกัดละติจูดของที่ตั้งบริษัท</small>
                            </div>
                            <div class="form-group">
                                <label>ลองจิจูด (Longitude)</label>
                                <input type="number" 
                                       id="company-longitude" 
                                       name="company_longitude" 
                                       class="form-control" 
                                       step="0.00000001"
                                       value="${settings.company_longitude || ''}"
                                       placeholder="100.5018">
                                <small style="color: #666;">พิกัดลองจิจูดของที่ตั้งบริษัท</small>
                            </div>
                        </div>
                        
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin-top: 10px;">
                            <p style="margin: 0; color: #666; font-size: 14px;">
                                💡 <strong>วิธีหาพิกัด:</strong> เปิด Google Maps → คลิกขวาที่ตำแหน่งบริษัท → คัดลอกพิกัด
                            </p>
                        </div>
                    </div>
                    
                    <!-- รหัสแนะนำ -->
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #FF6B35; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FF6B35;">
                            🔐 รหัสแนะนำสำหรับสมัครสมาชิก
                        </h3>
                        
                        <div class="form-group">
                            <label>รหัสแนะนำ <span style="color: red;">*</span></label>
                            <input type="text" 
                                   id="registration-code" 
                                   name="registration_code" 
                                   class="form-control" 
                                   value="${settings.registration_code || ''}"
                                   required
                                   placeholder="เช่น CTG2025">
                            <button type="button" 
                                    class="btn-secondary" 
                                    onclick="generateRegistrationCode()"
                                    style="margin-top: 8px; padding: 8px 15px; font-size: 14px; width: 100%;">
                                🎲 สุ่มรหัสอัตโนมัติ
                            </button>
                            <small style="color: #666; display: block; margin-top: 8px;">
                                ⚠️ รหัสนี้ใช้สำหรับการสมัครสมาชิกของพนักงาน (ควรเป็นรหัสลับ)
                            </small>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; margin-top: 15px;">
                            <p style="margin: 0; color: #856404; font-size: 14px;">
                                <strong>⚠️ คำเตือน:</strong> การเปลี่ยนรหัสแนะนำจะส่งผลต่อการสมัครสมาชิกใหม่ พนักงานที่ลงทะเบียนไว้แล้วจะไม่ได้รับผลกระทบ
                            </p>
                        </div>
                    </div>
                    
                    <!-- ตั้งค่าการสแกนใบหน้า -->
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #FF6B35; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FF6B35;">
                            📷 ตั้งค่าการสแกนใบหน้า
                        </h3>
                        
                        <div style="background: #f1f8e9; padding: 20px; border-radius: 8px; border-left: 4px solid #8bc34a;">
                            <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                                <div class="toggle-switch" style="position: relative; width: 60px; height: 34px; margin-right: 15px;">
                                    <input type="checkbox" id="smile_detection_enabled" name="smile_detection_enabled" value="1" 
                                        ${settings.smile_detection_enabled === '1' ? 'checked' : ''}
                                        onclick="if(this.checked) { showToast('เปิดใช้งานการตรวจจับรอยยิ้มเรียบร้อยแล้ว ✅', 'success'); } else { showToast('ปิดใช้งานการตรวจจับรอยยิ้มแล้ว', 'info'); }"
                                        style="opacity: 0; width: 0; height: 0; margin: 0; position: absolute;">
                                    <span class="slider round"></span>
                                </div>
                                <div>
                                    <span style="font-size: 16px; font-weight: 600; color: #333;">บังคับให้ยิ้มเมื่อสแกนใบหน้า</span>
                                    <small style="display: block; color: #666; margin-top: 5px;">
                                        หากเปิดใช้งาน พนักงานจะต้องยิ้มให้เห็นฟันหรือมีรอยยิ้มที่ชัดเจน ระบบจึงจะยอมรับการลงเวลา
                                    </small>
                                </div>
                            </label>
                            <style>
                                /* Scoped Toggle Switch CSS */
                                #smile_detection_enabled + .slider {
                                    position: absolute;
                                    cursor: pointer;
                                    top: 0;
                                    left: 0;
                                    right: 0;
                                    bottom: 0;
                                    background-color: #ccc;
                                    transition: .4s;
                                    border-radius: 34px;
                                }

                                #smile_detection_enabled + .slider:before {
                                    position: absolute;
                                    content: "";
                                    height: 26px;
                                    width: 26px;
                                    left: 4px;
                                    bottom: 4px;
                                    background-color: white;
                                    transition: .4s;
                                    border-radius: 50%;
                                }

                                #smile_detection_enabled:checked + .slider {
                                    background-color: #8bc34a;
                                }

                                #smile_detection_enabled:focus + .slider {
                                    box-shadow: 0 0 1px #8bc34a;
                                }

                                #smile_detection_enabled:checked + .slider:before {
                                    transform: translateX(26px);
                                }
                            </style>
                        </div>
                    </div>

                    <!-- ตั้งค่า Email แจ้งเตือน -->
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #FF6B35; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FF6B35;">
                            📧 ตั้งค่า Email แจ้งเตือน (SMTP)
                        </h3>
                        
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; border-left: 4px solid #2196F3; margin-bottom: 20px;">
                            <p style="margin: 0 0 8px 0; color: #1565C0; font-size: 14px; font-weight: 600;">
                                💡 ข้อมูล SMTP สำหรับส่งอีเมลแจ้งเตือน
                            </p>
                            <p style="margin: 0; color: #1976D2; font-size: 13px;">
                                ระบบจะใช้ข้อมูลนี้ในการส่งอีเมลแจ้งเตือนเมื่อมีคำขอลา การอนุมัติ หรือการปฏิเสธ
                            </p>
                        </div>
                        
                        <!-- Email Provider Presets -->
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #333;">
                                🚀 ใช้ค่าเริ่มต้นสำหรับ:
                            </label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <button type="button" 
                                        onclick="applyGmailPreset()" 
                                        style="padding: 12px; background: #fff; border: 2px solid #4285F4; color: #4285F4; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;"
                                        onmouseover="this.style.background='#4285F4'; this.style.color='white';"
                                        onmouseout="this.style.background='#fff'; this.style.color='#4285F4';">
                                    📧 Gmail
                                </button>
                                <button type="button" 
                                        onclick="applyOutlookPreset()" 
                                        style="padding: 12px; background: #fff; border: 2px solid #0078D4; color: #0078D4; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;"
                                        onmouseover="this.style.background='#0078D4'; this.style.color='white';"
                                        onmouseout="this.style.background='#fff'; this.style.color='#0078D4';">
                                    📧 Outlook
                                </button>
                            </div>
                            <small style="color: #666; display: block; margin-top: 8px;">
                                💡 คลิกเพื่อใส่ค่าเริ่มต้นของ Gmail หรือ Outlook (เหลือแค่กรอก Username และ Password)
                            </small>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>SMTP Host <span style="color: red;">*</span></label>
                                <input type="text" 
                                       id="smtp-host" 
                                       name="smtp_host" 
                                       class="form-control" 
                                       value="${settings.smtp_host || ''}"
                                       placeholder="smtp.gmail.com">
                                <small style="color: #666;">เซิร์ฟเวอร์ SMTP (เช่น smtp.gmail.com)</small>
                            </div>
                            <div class="form-group">
                                <label>SMTP Port <span style="color: red;">*</span></label>
                                <input type="number" 
                                       id="smtp-port" 
                                       name="smtp_port" 
                                       class="form-control" 
                                       value="${settings.smtp_port || '587'}"
                                       placeholder="587">
                                <small style="color: #666;">587 (TLS) หรือ 465 (SSL)</small>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>SMTP Security</label>
                            <select id="smtp-secure" 
                                    name="smtp_secure" 
                                    class="form-control">
                                <option value="tls" ${(settings.smtp_secure === 'tls' || !settings.smtp_secure) ? 'selected' : ''}>TLS (Port 587)</option>
                                <option value="ssl" ${settings.smtp_secure === 'ssl' ? 'selected' : ''}>SSL (Port 465)</option>
                            </select>
                            <small style="color: #666;">โปรโตคอลความปลอดภัย (แนะนำ TLS)</small>
                        </div>
                        
                        <div class="form-group">
                            <label>SMTP Username <span style="color: red;">*</span></label>
                            <input type="email" 
                                   id="smtp-username" 
                                   name="smtp_username" 
                                   class="form-control" 
                                   value="${settings.smtp_username || ''}"
                                   placeholder="your-email@gmail.com">
                            <small style="color: #666;">อีเมลสำหรับ login SMTP</small>
                        </div>
                        
                        <div class="form-group">
                            <label>SMTP Password <span style="color: red;">*</span></label>
                            <input type="password" 
                                   id="smtp-password" 
                                   name="smtp_password" 
                                   class="form-control" 
                                   value="${settings.smtp_password || ''}"
                                   placeholder="••••••••">
                            <small style="color: #666;">รหัสผ่าน หรือ App Password (สำหรับ Gmail)</small>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Email ผู้ส่ง <span style="color: red;">*</span></label>
                                <input type="email" 
                                       id="email-from-address" 
                                       name="email_from_address" 
                                       class="form-control" 
                                       value="${settings.email_from_address || 'noreply@hrlanto.com'}"
                                       placeholder="noreply@hrlanto.com">
                                <small style="color: #666;">Email ที่แสดงเป็นผู้ส่ง</small>
                            </div>
                            <div class="form-group">
                                <label>ชื่อผู้ส่ง</label>
                                <input type="text" 
                                       id="email-from-name" 
                                       name="email_from_name" 
                                       class="form-control" 
                                       value="${settings.email_from_name || 'HR Lanto System'}"
                                       placeholder="HR Lanto System">
                                <small style="color: #666;">ชื่อที่แสดงในอีเมล</small>
                            </div>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; margin-top: 15px;">
                            <div style="margin-bottom: 15px;">
                                <p style="margin: 0 0 8px 0; color: #856404; font-size: 14px; font-weight: 600;">
                                    📧 Gmail - วิธีตั้งค่า SMTP:
                                </p>
                                <ol style="margin: 0; padding-left: 20px; color: #856404; font-size: 13px;">
                                    <li>เปิด Google Account → Security</li>
                                    <li>เปิด 2-Step Verification</li>
                                    <li>สร้าง App Password: Security → App passwords</li>
                                    <li>เลือก "Mail" และ "Other device"</li>
                                    <li>คัดลอก App Password 16 ตัวมาใส่ในช่อง SMTP Password</li>
                                </ol>
                            </div>
                            
                            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(133,100,4,0.2);">
                                <p style="margin: 0 0 8px 0; color: #856404; font-size: 14px; font-weight: 600;">
                                    📧 Outlook - วิธีตั้งค่า SMTP:
                                </p>
                                <ol style="margin: 0; padding-left: 20px; color: #856404; font-size: 13px;">
                                    <li>คลิกปุ่ม "Outlook" ด้านบน (ค่าจะถูกกรอกอัตโนมัติ)</li>
                                    <li>กรอก SMTP Username: อีเมล Outlook ของคุณ</li>
                                    <li>กรอก SMTP Password: รหัสผ่าน Outlook ของคุณ</li>
                                    <li>Email ผู้ส่ง: ใช้อีเมล Outlook เดียวกัน</li>
                                    <li><strong>หมายเหตุ:</strong> Outlook ใช้รหัสผ่านปกติได้เลย (ไม่ต้อง App Password)</li>
                                </ol>
                            </div>
                        </div>
                        
                        <div style="margin-top: 15px;">
                            <button type="button" 
                                    class="btn-secondary" 
                                    onclick="testEmailSettings()"
                                    style="padding: 10px 20px; font-size: 14px; width: 100%;">
                                🧪 ทดสอบการส่งอีเมล
                            </button>
                        </div>
                    </div>
                    
                    <!-- ปุ่มบันทึก -->
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                        <button type="submit" id="btn-save-company-settings" class="btn-primary" style="padding: 12px 40px; font-size: 16px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                            บันทึกข้อมูล
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('admin-content').innerHTML = html;

    // Debug listener
    document.getElementById('btn-save-company-settings').addEventListener('click', function () {
        console.log('Save button clicked');
        // Check form validity
        if (!document.getElementById('company-settings-form').checkValidity()) {
            console.warn('Form validation failed');
            showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        }
    });

    // Handle form submission
    document.getElementById('company-settings-form').addEventListener('submit', function (e) {
        e.preventDefault();
        console.log('Form submitted');
        saveCompanySettings();
    });
}

function generateRegistrationCode() {
    // Generate random 8-character code (uppercase letters and numbers)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('registration-code').value = code;
}

function applyGmailPreset() {
    document.getElementById('smtp-host').value = 'smtp.gmail.com';
    document.getElementById('smtp-port').value = '587';
    document.getElementById('smtp-secure').value = 'tls';
    document.getElementById('smtp-username').placeholder = 'your-email@gmail.com';
    document.getElementById('smtp-password').placeholder = 'App Password 16 ตัว';
    document.getElementById('email-from-address').placeholder = 'your-email@gmail.com';
    document.getElementById('email-from-name').value = 'HR Lanto System';

    showToast('✓ ใส่ค่าเริ่มต้นสำหรับ Gmail แล้ว (กรุณากรอก Username และ Password)', 'success');

    // Highlight username and password fields
    document.getElementById('smtp-username').focus();
}

function applyOutlookPreset() {
    document.getElementById('smtp-host').value = 'smtp-mail.outlook.com';
    document.getElementById('smtp-port').value = '587';
    document.getElementById('smtp-secure').value = 'tls';
    document.getElementById('smtp-username').placeholder = 'your-email@outlook.com';
    document.getElementById('smtp-password').placeholder = 'รหัสผ่าน Outlook ของคุณ';
    document.getElementById('email-from-address').placeholder = 'your-email@outlook.com';
    document.getElementById('email-from-name').value = 'HR Lanto System';

    showToast('✓ ใส่ค่าเริ่มต้นสำหรับ Outlook แล้ว (กรุณากรอก Username และ Password)', 'success');

    // Highlight username and password fields
    document.getElementById('smtp-username').focus();
}

function saveCompanySettings() {
    const formData = new FormData(document.getElementById('company-settings-form'));
    const data = {};

    formData.forEach((value, key) => {
        data[key] = value;
    });

    // Manually handle checkbox because FormData doesn't include unchecked checkboxes
    try {
        const smileCheckbox = document.getElementById('smile_detection_enabled');
        data['smile_detection_enabled'] = smileCheckbox && smileCheckbox.checked ? '1' : '0';
    } catch (e) {
        console.error('Error reading smile detection checkbox:', e);
        data['smile_detection_enabled'] = '0'; // Default to 0 on error
    }

    // Validate required fields
    if (!data.company_name || !data.registration_code) {
        showToast('กรุณากรอกข้อมูลที่จำเป็น', 'error');
        return;
    }

    // Show loading
    const submitBtn = document.querySelector('#company-settings-form button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span style="margin-right: 8px;">⏳</span>กำลังบันทึก...';

    fetch('api/admin.php?action=update_company_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast('บันทึกข้อมูลบริษัทสำเร็จ ✓', 'success');

                // Update company name in the header
                const companyNameElement = document.getElementById('company-name');
                if (companyNameElement) {
                    document.getElementById('company-name').textContent = data.company_name;
                }
            } else {
                showToast(response.message || 'เกิดข้อผิดพลาด', 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'))
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
}

function testEmailSettings() {
    // Get current form values
    const smtp_host = document.getElementById('smtp-host').value;
    const smtp_port = document.getElementById('smtp-port').value;
    const smtp_username = document.getElementById('smtp-username').value;
    const smtp_password = document.getElementById('smtp-password').value;
    const email_from_address = document.getElementById('email-from-address').value;

    // Validate
    if (!smtp_host || !smtp_port || !smtp_username || !smtp_password || !email_from_address) {
        showToast('กรุณากรอกข้อมูล SMTP ให้ครบถ้วน', 'error');
        return;
    }

    // Show loading
    const testBtn = event.target;
    const originalText = testBtn.innerHTML;
    testBtn.disabled = true;
    testBtn.innerHTML = '<span style="margin-right: 8px;">⏳</span>กำลังทดสอบ...';

    // Send test email
    fetch('api/admin.php?action=test_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            smtp_host,
            smtp_port,
            smtp_username,
            smtp_password,
            smtp_secure: document.getElementById('smtp-secure').value,
            email_from_address,
            email_from_name: document.getElementById('email-from-name').value,
            test_recipient: smtp_username // ส่งไปที่อีเมลตัวเอง
        })
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast('✓ ส่งอีเมลทดสอบสำเร็จ! กรุณาตรวจสอบกล่องจดหมายของคุณ', 'success');
            } else {
                showToast('❌ ' + (response.message || 'ไม่สามารถส่งอีเมลได้'), 'error');
            }
        })
        .catch(error => {
            showToast('❌ เกิดข้อผิดพลาด: ' + error.message, 'error');
        })
        .finally(() => {
            testBtn.disabled = false;
            testBtn.innerHTML = originalText;
        });
}

// Helper functions
function getRoleBadgeClass(role) {
    if (role === 'ผู้ดูแลระบบ') return 'badge-admin';
    if (role === 'HR') return 'badge-hr';
    if (role === 'IT Support') return 'badge-it';
    if (role === 'HR Admin') return 'badge-hr-admin';
    return 'badge-employee';
}

function updateUserRole(employeeId, newRole) {
    if (!confirm('คุณต้องการเปลี่ยนสิทธิ์ผู้ใช้นี้ใช่หรือไม่?')) {
        return;
    }

    fetch('api/admin.php?action=update_role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: employeeId, role: newRole })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('อัพเดทสิทธิ์สำเร็จ', 'success');
                loadUserRolesSection();
            } else {
                showToast(data.message, 'error');
            }
        })
        .catch(error => {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        });
}


function resetEmployeePassword(employeeId) {
    if (!confirm('คุณต้องการรีเซ็ทรหัสผ่านเป็น "1234" ใช่หรือไม่?')) {
        return;
    }

    fetch('api/admin.php?action=reset_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: employeeId, password: '1234' })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('รีเซ็ทรหัสผ่านสำเร็จ', 'success');
            } else {
                showToast(data.message, 'error');
            }
        });
}

function editLeave(leaveId) {
    // Fetch leave data
    fetch(`api/admin.php?action=all_leaves`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const leave = data.data.find(l => l.id == leaveId);
                if (leave) {
                    showEditLeaveModal(leave);
                } else {
                    showToast('ไม่พบข้อมูลการลา', 'error');
                }
            }
        });
}

function showEditLeaveModal(leave) {
    // Hide all other modals first
    document.getElementById('employee-modal').style.display = 'none';
    document.getElementById('leave-request-modal').style.display = 'none';
    document.getElementById('branch-modal').style.display = 'none';
    document.getElementById('department-modal').style.display = 'none';
    document.getElementById('leavetype-modal').style.display = 'none';
    document.getElementById('shift-modal').style.display = 'none';

    // Populate form
    document.getElementById('edit-leave-id').value = leave.id;
    document.getElementById('edit-leave-employee').value = `${leave.first_name} ${leave.last_name} (${leave.employee_code})`;
    document.getElementById('edit-leave-type').value = leave.leave_type_name;
    document.getElementById('edit-leave-start-date').value = leave.start_date;
    document.getElementById('edit-leave-end-date').value = leave.end_date;
    document.getElementById('edit-leave-status').value = leave.status;
    document.getElementById('edit-leave-reason').value = leave.reason || '';

    // Show attachment if exists
    const attachmentSection = document.getElementById('edit-leave-attachment-section');
    const attachmentImage = document.getElementById('edit-leave-attachment-image');
    if (leave.attachment) {
        const attachmentUrl = getAbsoluteUrl('uploads/leave_attachments/' + leave.attachment);
        attachmentImage.src = attachmentUrl;
        attachmentSection.style.display = 'block';
    } else {
        attachmentSection.style.display = 'none';
    }

    // Calculate days or Set Existing Days
    document.getElementById('edit-leave-days-input').value = leave.total_days;

    // Render approval steps
    renderApprovalSteps(leave);

    // Add event listeners for date changes
    document.getElementById('edit-leave-start-date').addEventListener('change', calculateEditLeaveDays);
    document.getElementById('edit-leave-end-date').addEventListener('change', calculateEditLeaveDays);

    // Add event listener for status change to show/hide email button
    document.getElementById('edit-leave-status').addEventListener('change', updateEmailSection);

    // Update email section based on current status
    updateEmailSection();

    // Show modal
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('edit-leave-modal').style.display = 'block';
}

function viewLeaveAttachment(imageUrl) {
    window.open(imageUrl, '_blank');
}

function renderApprovalSteps(leave) {
    const stepsContainer = document.getElementById('approval-steps-container');
    if (!stepsContainer) return;

    // Determine manager info
    let managerName = '-';
    let managerEmail = '-';

    // If there's a manager who approved
    if (leave.manager_first_name && leave.manager_last_name) {
        managerName = `${leave.manager_first_name} ${leave.manager_last_name}`;
        managerEmail = leave.manager_email || '-';
    }
    // Otherwise, check department manager
    else if (leave.dept_manager_first_name && leave.dept_manager_last_name) {
        managerName = `${leave.dept_manager_first_name} ${leave.dept_manager_last_name}`;
        managerEmail = leave.dept_manager_email || '-';
    }

    // Determine HR info (ผู้อนุมัติจริง - สำหรับขั้นตอน "อนุมัติ")
    let hrName = '-';
    let hrEmail = '-';
    if (leave.hr_first_name && leave.hr_last_name) {
        hrName = `${leave.hr_first_name} ${leave.hr_last_name}`;
        hrEmail = leave.hr_email || '-';
    }

    // HR Approver info (จาก system_settings - สำหรับขั้นตอน "รอ HR อนุมัติ")
    const hrApproverName = leave.hr_approver_name || '-';
    const hrApproverEmail = leave.hr_approver_email || '-';

    // Determine step states
    const managerStatus = getStepStatus(leave.status, 'manager', leave.manager_reject_reason, leave.hr_reject_reason);
    const hrPendingStatus = getStepStatus(leave.status, 'hr_pending', leave.manager_reject_reason, leave.hr_reject_reason);
    const approvedStatus = getStepStatus(leave.status, 'approved', leave.manager_reject_reason, leave.hr_reject_reason);

    const steps = [
        {
            title: 'ลางาน',
            status: 'completed',
            icon: '📝',
            info: `วันที่ส่งคำขอ: ${formatDate(leave.created_at)}`,
            name: `${leave.first_name} ${leave.last_name}`,
            email: '-',
            rejectReason: null
        },
        {
            title: 'หัวหน้าอนุมัติ',
            status: managerStatus,
            icon: managerStatus === 'rejected' ? '❌' : '👤',
            info: leave.manager_approved_at ? `วันที่อนุมัติ: ${formatDateTime(leave.manager_approved_at)}` : '',
            name: managerName,
            email: managerEmail,
            rejectReason: leave.manager_reject_reason || null
        },
        {
            title: 'รอ HR อนุมัติ',
            status: hrPendingStatus,
            icon: hrPendingStatus === 'rejected' ? '❌' : '⏳',
            info: '',
            name: hrApproverName,
            email: hrApproverEmail,
            rejectReason: null
        },
        {
            title: 'อนุมัติ',
            status: approvedStatus,
            icon: approvedStatus === 'rejected' ? '❌' : '✅',
            info: leave.hr_approved_at ? `วันที่อนุมัติ: ${formatDateTime(leave.hr_approved_at)}` : '',
            name: hrName,
            email: hrEmail,
            rejectReason: leave.hr_reject_reason || null
        }
    ];

    // Generate HTML
    let html = '<div class="approval-steps">';
    steps.forEach((step, index) => {
        const statusClass = step.status === 'completed' ? 'step-completed' :
            step.status === 'current' ? 'step-current' :
                step.status === 'rejected' ? 'step-rejected' : 'step-pending';

        html += `
            <div class="approval-step ${statusClass}">
                <div class="step-indicator">
                    <div class="step-icon">${step.icon}</div>
                    <div class="step-number">${index + 1}</div>
                </div>
                <div class="step-content">
                    <div class="step-title">${step.title}</div>
                    ${step.info ? `<div class="step-info">${step.info}</div>` : ''}
                    ${step.rejectReason ? `
                        <div class="step-reject-reason">
                            <strong style="color: #F44336;">เหตุผลในการปฏิเสธ:</strong>
                            <p style="margin: 5px 0 0 0; color: #666;">${step.rejectReason}</p>
                        </div>
                    ` : ''}
                    ${step.name !== '-' ? `
                        <div class="step-details">
                            <div class="step-detail-item">
                                <strong>ชื่อ:</strong> ${step.name}
                            </div>
                            ${step.email !== '-' ? `
                                <div class="step-detail-item">
                                    <strong>Email:</strong> ${step.email}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Add connector line (except for last step)
        if (index < steps.length - 1) {
            const connectorClass = step.status === 'completed' ? 'connector-completed' :
                step.status === 'rejected' ? 'connector-rejected' : 'connector-pending';
            html += `<div class="step-connector ${connectorClass}"></div>`;
        }
    });
    html += '</div>';

    stepsContainer.innerHTML = html;
}

function getStepStatus(leaveStatus, stepType, managerRejectReason, hrRejectReason) {
    if (leaveStatus === 'ยกเลิกโดยพนักงาน') {
        return 'pending';
    }

    switch (stepType) {
        case 'manager':
            if (leaveStatus === 'รอหัวหน้าอนุมัติ') return 'current';
            if (leaveStatus === 'รอHRอนุมัติ' || leaveStatus === 'อนุมัติ') return 'completed';
            if (leaveStatus === 'ปฏิเสธการลา' && managerRejectReason) return 'rejected';
            return 'pending';

        case 'hr_pending':
            if (leaveStatus === 'รอHRอนุมัติ') return 'current';
            if (leaveStatus === 'อนุมัติ') return 'completed';
            if (leaveStatus === 'ปฏิเสธการลา' && hrRejectReason) return 'rejected';
            return 'pending';

        case 'approved':
            if (leaveStatus === 'อนุมัติ') return 'completed';
            if (leaveStatus === 'ปฏิเสธการลา') return 'rejected';
            return 'pending';

        default:
            return 'pending';
    }
}

function closeEditLeaveModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('edit-leave-modal').style.display = 'none';
    document.getElementById('edit-leave-form').reset();

    // Remove event listeners
    document.getElementById('edit-leave-start-date').removeEventListener('change', calculateEditLeaveDays);
    document.getElementById('edit-leave-end-date').removeEventListener('change', calculateEditLeaveDays);
    document.getElementById('edit-leave-status').removeEventListener('change', updateEmailSection);

    // Hide email section
    document.getElementById('send-email-section').style.display = 'none';
}

function calculateEditLeaveDays() {
    const startDate = document.getElementById('edit-leave-start-date').value;
    const endDate = document.getElementById('edit-leave-end-date').value;

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        document.getElementById('edit-leave-days-input').value = diffDays;
    }
}

function updateEmailSection() {
    const status = document.getElementById('edit-leave-status').value;
    const emailSection = document.getElementById('send-email-section');
    const emailInfoText = document.getElementById('email-info-text');
    const sendBtn = document.getElementById('btn-send-email');

    // Show email section only for specific statuses
    if (status === 'รอหัวหน้าอนุมัติ' || status === 'รอHRอนุมัติ') {
        emailSection.style.display = 'block';

        if (status === 'รอหัวหน้าอนุมัติ') {
            emailInfoText.textContent = 'ส่งอีเมลแจ้งเตือนไปยังหัวหน้าเพื่อพิจารณาอนุมัติ';
            sendBtn.innerHTML = '📧 ส่งอีเมลไปหัวหน้า';
        } else if (status === 'รอHRอนุมัติ') {
            emailInfoText.textContent = 'ส่งอีเมลแจ้งเตือนไปยัง HR เพื่อพิจารณาอนุมัติ';
            sendBtn.innerHTML = '📧 ส่งอีเมลไป HR';
        }
    } else {
        emailSection.style.display = 'none';
    }
}

function sendLeaveEmailNotification() {
    const leaveId = document.getElementById('edit-leave-id').value;
    const status = document.getElementById('edit-leave-status').value;

    if (!leaveId || !status) {
        showToast('ข้อมูลไม่ครบถ้วน', 'error');
        return;
    }

    // Show loading on button
    const sendBtn = document.getElementById('btn-send-email');
    const originalText = sendBtn.innerHTML;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span style="margin-right: 8px;">⏳</span>กำลังส่งอีเมล...';

    // Send email
    fetch('api/admin.php?action=send_leave_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            leave_id: leaveId,
            status: status
        })
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast('✓ ' + response.message, 'success');
            } else {
                showToast('❌ ' + response.message, 'error');
            }
        })
        .catch(error => {
            showToast('❌ เกิดข้อผิดพลาด: ' + error.message, 'error');
        })
        .finally(() => {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
        });
}

function deleteLeave(leaveId) {
    console.log('🗑️ [DEBUG] deleteLeave function called with ID:', leaveId);

    if (!confirm('คุณต้องการลบคำขอลานี้ใช่หรือไม่?')) {
        console.log('🗑️ [DEBUG] User cancelled deletion');
        return;
    }

    console.log('🗑️ [DEBUG] User confirmed deletion, preparing FormData');

    const formData = new FormData();
    formData.append('id', leaveId);

    console.log('🗑️ [DEBUG] FormData prepared:', {
        id: leaveId,
        formDataEntries: Array.from(formData.entries())
    });

    console.log('🗑️ [DEBUG] Sending fetch request to api/admin.php?action=delete_leave');

    fetch('api/admin.php?action=delete_leave', {
        method: 'POST',
        body: formData
    })
        .then(res => {
            console.log('🗑️ [DEBUG] Fetch response received:', {
                status: res.status,
                statusText: res.statusText,
                ok: res.ok
            });
            return res.json();
        })
        .then(data => {
            console.log('🗑️ [DEBUG] Response data received:', data);

            if (data.success) {
                // แสดงข้อความตามสถานะของการลบ
                if (data.message && data.message.includes('วันลาได้ถูกคืนแล้ว')) {
                    console.log('🗑️ [DEBUG] Leave deleted and balance restored');
                    showToast('ลบรายการและคืนวันลาให้พนักงานเรียบร้อย', 'success');
                } else {
                    console.log('🗑️ [DEBUG] Leave deleted (no balance restore needed)');
                    showToast('ลบข้อมูลสำเร็จ', 'success');
                }
                console.log('🗑️ [DEBUG] Calling loadLeaveManagementSection() to refresh table');
                loadLeaveManagementSection();
            } else {
                console.log('🗑️ [DEBUG] Deletion failed:', data.message);
                showToast(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('🗑️ [DEBUG] Network/JavaScript error:', error);
            showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
        });
}

// Employee Modal Functions
function showAddEmployeeModal() {
    currentEmployeeId = null;
    document.getElementById('employee-modal-title').textContent = 'เพิ่มพนักงาน';
    document.getElementById('employee-form').reset();
    document.getElementById('employee-id').value = '';

    // Clear/Reset all fields and images
    document.getElementById('emp-profile-photo').src = 'assets/images/default-avatar.png';
    document.getElementById('emp-id-card-preview').style.display = 'none';
    document.getElementById('emp-id-card-preview').src = '';

    // Enable employee code field (in case it was disabled from edit)
    document.getElementById('emp-code').readOnly = false;

    // Hide leave balance section (only show for edit)
    const leaveBalanceSection = document.getElementById('emp-leave-balance-section');
    if (leaveBalanceSection) {
        leaveBalanceSection.style.display = 'none';
    }

    // โหลดแผนกจากฐานข้อมูล
    fetch('api/admin.php?action=departments')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                departments = data.data;

                // Populate departments dropdown
                const deptSelect = document.getElementById('emp-department');
                deptSelect.innerHTML = '<option value="">เลือกแผนก</option>';
                departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.id;
                    option.textContent = dept.name;
                    deptSelect.appendChild(option);
                });
            }
        });

    // Populate shifts
    loadShiftsForEmployee(null);

    // Populate employee types
    loadEmployeeTypes('emp-type');

    // Set default date to today
    document.getElementById('emp-startdate').value = new Date().toISOString().split('T')[0];

    // Load branches for selection
    loadBranchesForEmployee(null);

    // Show modal
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('employee-modal').style.display = 'block';
    document.getElementById('leave-request-modal').style.display = 'none';
}

function editEmployee(employeeId) {
    currentEmployeeId = employeeId;
    document.getElementById('employee-modal-title').textContent = 'แก้ไขข้อมูลพนักงาน';

    // โหลดแผนกจากฐานข้อมูลก่อน จากนั้นโหลดข้อมูลพนักงาน
    fetch('api/admin.php?action=departments')
        .then(res => res.json())
        .then(deptData => {
            if (deptData.success) {
                departments = deptData.data;

                // จากนั้นโหลดข้อมูลพนักงาน
                return fetch(`api/admin.php?action=employee&id=${employeeId}`);
            } else {
                throw new Error('ไม่สามารถโหลดข้อมูลแผนกได้');
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const emp = data.data;

                // Store employee data for leave history
                currentEmployeeName = `${emp.first_name} ${emp.last_name}`;
                currentEmployeeCode = emp.employee_code;

                // Populate departments dropdown
                const deptSelect = document.getElementById('emp-department');
                deptSelect.innerHTML = '<option value="">เลือกแผนก</option>';
                departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.id;
                    option.textContent = dept.name;
                    if (dept.id == emp.department_id) {
                        option.selected = true;
                    }
                    deptSelect.appendChild(option);
                });

                // Populate shifts with current selection
                loadShiftsForEmployee(emp.shift_id);

                // Populate employee types with current selection
                loadEmployeeTypes('emp-type', emp.employee_type);

                // Fill form
                document.getElementById('employee-id').value = emp.id;
                document.getElementById('emp-code').value = emp.employee_code;
                document.getElementById('emp-firstname').value = emp.first_name;
                document.getElementById('emp-lastname').value = emp.last_name;
                document.getElementById('emp-email').value = emp.email || '';
                document.getElementById('emp-type').value = emp.employee_type;
                document.getElementById('emp-startdate').value = emp.start_date || '';
                document.getElementById('emp-active').value = emp.is_active ? '1' : '0';

                // Fill address fields
                document.getElementById('emp-address').value = emp.address || '';

                // Load profile photo
                if (emp.profile_photo_path) {
                    document.getElementById('emp-profile-photo').src = getAbsoluteUrl(emp.profile_photo_path);
                } else {
                    document.getElementById('emp-profile-photo').src = 'assets/images/default-avatar.png';
                }

                // Load ID card photo
                if (emp.id_card_photo_path) {
                    const idCardImg = document.getElementById('emp-id-card-preview');
                    idCardImg.src = getAbsoluteUrl(emp.id_card_photo_path);
                    idCardImg.style.display = 'block';
                } else {
                    document.getElementById('emp-id-card-preview').style.display = 'none';
                }

                // Disable employee code for edit
                document.getElementById('emp-code').readOnly = true;

                // Setup photo upload handlers
                setupEmployeePhotoHandlers(employeeId);

                // Load branches for this employee
                loadBranchesForEmployee(employeeId);

                // Initialize Thai address dropdowns and populate with current values
                if (typeof initializeEmployeeAddressDropdowns === 'function') {
                    console.log('🔧 Admin - Employee data:', {
                        province: emp.province,
                        district: emp.district,
                        sub_district: emp.sub_district
                    });
                    initializeEmployeeAddressDropdowns(emp.province, emp.district, emp.sub_district);
                }

                // Show leave balance section and load data
                document.getElementById('emp-leave-balance-section').style.display = 'block';
                loadEmployeeLeaveBalance(employeeId, emp.employee_type);

                // Show modal
                document.getElementById('modal-overlay').classList.remove('hidden');
                document.getElementById('employee-modal').style.display = 'block';
                document.getElementById('leave-request-modal').style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error loading employee data:', error);
            showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
        });
}

// Load employee leave balance
function loadEmployeeLeaveBalance(employeeId, employeeType) {
    const currentYear = new Date().getFullYear();

    fetch(`api/admin.php?action=get_employee_leave_balance&employee_id=${employeeId}&year=${currentYear}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderLeaveBalanceList(data.data, employeeType);
            } else {
                document.getElementById('emp-leave-balance-list').innerHTML =
                    '<p style="text-align: center; color: #999;">ยังไม่มีข้อมูลวันลา คลิก "ดึงวันลาพื้นฐานจากระบบ" เพื่อตั้งค่า</p>';
            }
        })
        .catch(error => {
            console.error('Error loading leave balance:', error);
            document.getElementById('emp-leave-balance-list').innerHTML =
                '<p style="text-align: center; color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
        });
}

// Render leave balance list with editable fields
function renderLeaveBalanceList(leaveBalances, employeeType) {
    const container = document.getElementById('emp-leave-balance-list');

    if (!leaveBalances || leaveBalances.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">ยังไม่มีข้อมูลวันลา คลิก "ดึงวันลาพื้นฐานจากระบบ" เพื่อตั้งค่า</p>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';

    leaveBalances.forEach((balance, index) => {
        const icon = getLeaveTypeIcon(balance.icon || 'calendar');
        html += `
            <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #ddd;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 20px;">${icon}</span>
                        <strong style="font-size: 15px;">${balance.leave_type_name}</strong>
                    </div>
                    <span style="background: #e3f2fd; color: #1976d2; padding: 3px 10px; border-radius: 12px; font-size: 12px;">
                        ประเภท: ${employeeType}
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; font-size: 13px; color: #666; margin-bottom: 5px;">วันลาทั้งหมด (วัน)</label>
                        <input type="number" 
                               id="leave-total-${balance.leave_type_id}" 
                               class="form-control" 
                               value="${balance.total_days}" 
                               min="0" 
                               step="0.1"
                               style="padding: 8px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 13px; color: #666; margin-bottom: 5px;">วันลาคงเหลือ (วัน)</label>
                        <input type="number" 
                               id="leave-remaining-${balance.leave_type_id}" 
                               class="form-control" 
                               value="${balance.remaining_days}" 
                               min="0" 
                               step="0.1"
                               style="padding: 8px;">
                    </div>
                </div>
                <input type="hidden" id="leave-type-id-${index}" value="${balance.leave_type_id}">
            </div>
        `;
    });

    html += '</div>';
    html += `
        <div style="margin-top: 15px; text-align: right;">
            <button type="button" class="btn-secondary" onclick="viewEmployeeLeaveHistory()" style="margin-right: 10px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 5px;">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
                ดูประวัติการลาพนักงาน
            </button>
            <button type="button" class="btn-primary" onclick="saveEmployeeLeaveBalance()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 5px;">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
                บันทึกวันลา
            </button>
        </div>
    `;

    container.innerHTML = html;
}

// Get leave type icon
function getLeaveTypeIcon(iconName) {
    const icons = {
        'calendar': '📅',
        'briefcase': '💼',
        'medical': '🏥',
        'sunny': '☀️'
    };
    return icons[iconName] || '📅';
}

// Load default leave balance from system
function loadDefaultLeaveBalance() {
    if (!currentEmployeeId) {
        showToast('ไม่พบข้อมูลพนักงาน', 'error');
        return;
    }

    const employeeType = document.getElementById('emp-type').value;
    if (!employeeType) {
        showToast('กรุณาเลือกประเภทพนักงานก่อน', 'error');
        return;
    }

    if (!confirm('คุณต้องการดึงวันลาพื้นฐานจากระบบใช่หรือไม่?\n\nการกระทำนี้จะแทนที่ข้อมูลวันลาปัจจุบันทั้งหมด')) {
        return;
    }

    const currentYear = new Date().getFullYear();

    // Calculate work days for the employee
    fetch(`api/admin.php?action=initialize_employee_leave_balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            employee_id: currentEmployeeId,
            employee_type: employeeType,
            year: currentYear
        })
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast('ดึงวันลาพื้นฐานสำเร็จ', 'success');
                loadEmployeeLeaveBalance(currentEmployeeId, employeeType);
            } else {
                showToast(response.message || 'เกิดข้อผิดพลาด', 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
}

// Save employee leave balance
function saveEmployeeLeaveBalance() {
    if (!currentEmployeeId) {
        showToast('ไม่พบข้อมูลพนักงาน', 'error');
        return;
    }

    const currentYear = new Date().getFullYear();
    const leaveBalances = [];

    // Collect all leave balance data
    const container = document.getElementById('emp-leave-balance-list');
    const leaveTypeInputs = container.querySelectorAll('input[id^="leave-type-id-"]');

    leaveTypeInputs.forEach(input => {
        const leaveTypeId = input.value;
        const totalDays = document.getElementById(`leave-total-${leaveTypeId}`).value;
        const remainingDays = document.getElementById(`leave-remaining-${leaveTypeId}`).value;

        leaveBalances.push({
            leave_type_id: leaveTypeId,
            total_days: parseFloat(totalDays) || 0,
            remaining_days: parseFloat(remainingDays) || 0
        });
    });

    if (leaveBalances.length === 0) {
        showToast('ไม่มีข้อมูลวันลาที่จะบันทึก', 'error');
        return;
    }

    // Save to database
    fetch('api/admin.php?action=update_employee_leave_balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            employee_id: currentEmployeeId,
            year: currentYear,
            leave_balances: leaveBalances
        })
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast('บันทึกวันลาสำเร็จ', 'success');
            } else {
                showToast(response.message || 'เกิดข้อผิดพลาด', 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
}

function closeEmployeeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('employee-modal').style.display = 'none';
    document.getElementById('employee-form').reset();
    document.getElementById('emp-code').readOnly = false;
    document.getElementById('emp-leave-balance-section').style.display = 'none';
    currentEmployeeId = null;
    currentEmployeeName = null;
    currentEmployeeCode = null;
}

function viewEmployeeLeaveHistory() {
    if (!currentEmployeeCode) {
        showToast('ไม่พบข้อมูลพนักงาน', 'error');
        return;
    }

    // Get the current URL and construct the correct URL for admin panel
    const currentPath = window.location.pathname;
    const baseUrl = window.location.origin + currentPath.substring(0, currentPath.lastIndexOf('/')) + '/index.html';

    // Add hash parameters for admin section and employee filter (using employee code)
    const employeeFilter = encodeURIComponent(currentEmployeeCode);
    const url = `${baseUrl}#admin?section=leave-management&employee=${employeeFilter}`;

    // Open in new tab
    window.open(url, '_blank');

    showToast(`กำลังเปิดประวัติการลาของ ${currentEmployeeName} (${currentEmployeeCode})`, 'success');
}

// Handle employee form submission
document.getElementById('employee-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    // Include shift_id (convert empty string to null)
    const shiftId = document.getElementById('emp-shift').value;
    data.shift_id = shiftId ? shiftId : null;

    // Include address fields from Select2 dropdowns
    data.address = document.getElementById('emp-address').value || null;
    data.province = $('#emp-province').val() || null;
    data.district = $('#emp-district').val() || null;
    data.sub_district = $('#emp-sub-district').val() || null;

    // Include employee type from dropdown
    data.employee_type = document.getElementById('emp-type').value || null;

    const url = currentEmployeeId
        ? 'api/admin.php?action=update_employee'
        : 'api/admin.php?action=add_employee';

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                // บันทึกข้อมูลพนักงานสำเร็จแล้ว ต่อไปบันทึกสาขาที่เลือก
                const employeeId = currentEmployeeId || (response.data && response.data.employee_id);

                // เก็บ branch_ids ที่เลือกไว้
                const selectedBranches = [];
                document.querySelectorAll('#emp-branches-list input[type="checkbox"]:checked').forEach(checkbox => {
                    selectedBranches.push(parseInt(checkbox.value));
                });

                // บันทึกสาขาที่เลือก
                return fetch('api/admin.php?action=update_employee_branches', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        employee_id: employeeId,
                        branch_ids: selectedBranches
                    })
                })
                    .then(res => res.json())
                    .then(branchResponse => {
                        if (branchResponse.success) {
                            showToast(currentEmployeeId ? 'อัพเดทข้อมูลสำเร็จ' : 'เพิ่มพนักงานสำเร็จ', 'success');
                            closeEmployeeModal();
                            loadEmployeesSection();
                        } else {
                            showToast('บันทึกข้อมูลพนักงานสำเร็จ แต่ไม่สามารถบันทึกสาขาได้', 'warning');
                            closeEmployeeModal();
                            loadEmployeesSection();
                        }
                    });
            } else {
                showToast(response.message, 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
});

// Branch Modal Functions
function showAddBranchModal() {
    currentBranchId = null;
    document.getElementById('branch-modal-title').textContent = 'เพิ่มสาขา';
    document.getElementById('branch-form').reset();
    document.getElementById('branch-id').value = '';

    // Show modal
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('branch-modal').style.display = 'block';
    document.getElementById('employee-modal').style.display = 'none';
    document.getElementById('leave-request-modal').style.display = 'none';
}

function editBranch(branchId) {
    currentBranchId = branchId;
    document.getElementById('branch-modal-title').textContent = 'แก้ไขข้อมูลสาขา';

    // Fetch branch data
    fetch(`api/admin.php?action=branch&id=${branchId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const branch = data.data;

                // Fill form
                document.getElementById('branch-id').value = branch.id;
                document.getElementById('branch-name').value = branch.name;
                document.getElementById('branch-latitude').value = branch.latitude;
                document.getElementById('branch-longitude').value = branch.longitude;
                document.getElementById('branch-radius').value = branch.radius;
                document.getElementById('branch-google-maps').value = branch.google_maps_link || '';
                document.getElementById('branch-checkin-outside').checked = branch.allow_checkin_outside == 1;
                document.getElementById('branch-checkout-outside').checked = branch.allow_checkout_outside == 1;
                document.getElementById('branch-is-default').checked = branch.is_default == 1;
                document.getElementById('branch-active').value = branch.is_active ? '1' : '0';

                // Show modal
                document.getElementById('modal-overlay').classList.remove('hidden');
                document.getElementById('branch-modal').style.display = 'block';
                document.getElementById('employee-modal').style.display = 'none';
                document.getElementById('leave-request-modal').style.display = 'none';
            }
        });
}

function closeBranchModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('branch-modal').style.display = 'none';
    document.getElementById('branch-form').reset();
    currentBranchId = null;
}

function deleteBranch(branchId) {
    if (!confirm('คุณต้องการลบสาขานี้ใช่หรือไม่?')) {
        return;
    }

    const formData = new FormData();
    formData.append('id', branchId);

    fetch('api/admin.php?action=delete_branch', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('ลบข้อมูลสำเร็จ', 'success');
                loadBranchesSection();
            } else {
                showToast(data.message, 'error');
            }
        });
}

// Handle branch form submission
document.getElementById('branch-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    // Handle checkboxes explicitly
    data['allow_checkin_outside'] = document.getElementById('branch-checkin-outside').checked ? 1 : 0;
    data['allow_checkout_outside'] = document.getElementById('branch-checkout-outside').checked ? 1 : 0;
    data['is_default'] = document.getElementById('branch-is-default').checked ? 1 : 0;

    const url = currentBranchId
        ? 'api/admin.php?action=update_branch'
        : 'api/admin.php?action=add_branch';

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast(currentBranchId ? 'อัพเดทข้อมูลสำเร็จ' : 'เพิ่มสาขาสำเร็จ', 'success');
                closeBranchModal();
                loadBranchesSection();
            } else {
                showToast(response.message, 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
});

// Department Modal Functions
let currentDepartmentId = null;

function showAddDepartmentModal() {
    currentDepartmentId = null;
    document.getElementById('department-modal-title').textContent = 'เพิ่มแผนก';
    document.getElementById('department-form').reset();
    document.getElementById('department-id').value = '';

    // Populate manager dropdown with all employees
    fetch('api/admin.php?action=employees')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const managerSelect = document.getElementById('department-manager');
                managerSelect.innerHTML = '<option value="">-- ไม่มี --</option>';
                data.data.forEach(emp => {
                    const option = document.createElement('option');
                    option.value = emp.id;
                    option.textContent = `${emp.employee_code} - ${emp.first_name} ${emp.last_name}`;
                    managerSelect.appendChild(option);
                });
            }
        });

    // Show modal
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('department-modal').style.display = 'block';
    document.getElementById('employee-modal').style.display = 'none';
    document.getElementById('leave-request-modal').style.display = 'none';
    document.getElementById('branch-modal').style.display = 'none';
    document.getElementById('leavetype-modal').style.display = 'none';
}

function editDepartment(deptId) {
    currentDepartmentId = deptId;
    document.getElementById('department-modal-title').textContent = 'แก้ไขแผนก';

    // Fetch employees first for dropdown
    fetch('api/admin.php?action=employees')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const managerSelect = document.getElementById('department-manager');
                managerSelect.innerHTML = '<option value="">-- ไม่มี --</option>';
                data.data.forEach(emp => {
                    const option = document.createElement('option');
                    option.value = emp.id;
                    option.textContent = `${emp.employee_code} - ${emp.first_name} ${emp.last_name}`;
                    managerSelect.appendChild(option);
                });

                // Then fetch department data
                return fetch(`api/admin.php?action=departments`);
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const dept = data.data.find(d => d.id == deptId);
                if (dept) {
                    document.getElementById('department-id').value = dept.id;
                    document.getElementById('department-name').value = dept.name;
                    document.getElementById('department-manager').value = dept.manager_id || '';

                    // Show modal
                    document.getElementById('modal-overlay').classList.remove('hidden');
                    document.getElementById('department-modal').style.display = 'block';
                    document.getElementById('employee-modal').style.display = 'none';
                    document.getElementById('leave-request-modal').style.display = 'none';
                    document.getElementById('branch-modal').style.display = 'none';
                    document.getElementById('leavetype-modal').style.display = 'none';
                }
            }
        });
}

function closeDepartmentModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('department-modal').style.display = 'none';
    document.getElementById('department-form').reset();
    currentDepartmentId = null;
}

function deleteDepartment(deptId) {
    if (!confirm('คุณต้องการลบแผนกนี้ใช่หรือไม่?')) {
        return;
    }

    const formData = new FormData();
    formData.append('id', deptId);

    fetch('api/admin.php?action=delete_department', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('ลบแผนกสำเร็จ', 'success');
                loadDepartmentsSection();
            } else {
                showToast(data.message, 'error');
            }
        });
}

// Handle department form submission
document.getElementById('department-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value || null;
    });

    const url = currentDepartmentId
        ? 'api/admin.php?action=update_department'
        : 'api/admin.php?action=add_department';

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast(currentDepartmentId ? 'อัพเดทแผนกสำเร็จ' : 'เพิ่มแผนกสำเร็จ', 'success');
                closeDepartmentModal();
                loadDepartmentsSection();
            } else {
                showToast(response.message, 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
});

// Leave Type Modal Functions
let currentLeaveTypeId = null;

function showAddLeaveTypeModal() {
    currentLeaveTypeId = null;
    document.getElementById('leavetype-modal-title').textContent = 'เพิ่มประเภทการลา';
    document.getElementById('leavetype-form').reset();
    document.getElementById('leavetype-id').value = '';

    // Load employee types for dropdown
    loadEmployeeTypes('leavetype-employee-type');

    // Show modal
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('leavetype-modal').style.display = 'block';
    document.getElementById('employee-modal').style.display = 'none';
    document.getElementById('leave-request-modal').style.display = 'none';
    document.getElementById('branch-modal').style.display = 'none';
    document.getElementById('department-modal').style.display = 'none';
}

function editLeaveType(typeId) {
    currentLeaveTypeId = typeId;
    document.getElementById('leavetype-modal-title').textContent = 'แก้ไขประเภทการลา';

    // Load employee types for dropdown first
    loadEmployeeTypes('leavetype-employee-type');

    // Fetch leave type data
    fetch('api/admin.php?action=leave_types')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const type = data.data.find(t => t.id == typeId);
                if (type) {
                    document.getElementById('leavetype-id').value = type.id;
                    document.getElementById('leavetype-name').value = type.name;
                    document.getElementById('leavetype-employee-type').value = type.employee_type;
                    document.getElementById('leavetype-min-days').value = type.min_work_days;
                    document.getElementById('leavetype-max-days').value = type.max_days;
                    document.getElementById('leavetype-icon').value = type.icon || 'calendar';

                    // Show modal
                    document.getElementById('modal-overlay').classList.remove('hidden');
                    document.getElementById('leavetype-modal').style.display = 'block';
                    document.getElementById('employee-modal').style.display = 'none';
                    document.getElementById('leave-request-modal').style.display = 'none';
                    document.getElementById('branch-modal').style.display = 'none';
                    document.getElementById('department-modal').style.display = 'none';
                }
            }
        });
}

function closeLeaveTypeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('leavetype-modal').style.display = 'none';
    document.getElementById('leavetype-form').reset();
    currentLeaveTypeId = null;
}

function deleteLeaveType(typeId) {
    if (!confirm('คุณต้องการลบประเภทการลานี้ใช่หรือไม่?')) {
        return;
    }

    const formData = new FormData();
    formData.append('id', typeId);

    fetch('api/admin.php?action=delete_leave_type', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('ลบประเภทการลาสำเร็จ', 'success');
                loadLeaveTypesSection();
            } else {
                showToast(data.message, 'error');
            }
        });
}

// Handle leave type form submission
document.getElementById('leavetype-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    const url = currentLeaveTypeId
        ? 'api/admin.php?action=update_leave_type'
        : 'api/admin.php?action=add_leave_type';

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast(currentLeaveTypeId ? 'อัพเดทประเภทการลาสำเร็จ' : 'เพิ่มประเภทการลาสำเร็จ', 'success');
                closeLeaveTypeModal();
                loadLeaveTypesSection();
            } else {
                showToast(response.message, 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
});

// Handle edit leave request form submission
document.getElementById('edit-leave-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const leaveId = document.getElementById('edit-leave-id').value;
    const startDate = document.getElementById('edit-leave-start-date').value;
    const endDate = document.getElementById('edit-leave-end-date').value;
    const status = document.getElementById('edit-leave-status').value;

    // Custom total days
    const totalDays = parseFloat(document.getElementById('edit-leave-days-input').value) || 0;

    const data = {
        id: leaveId,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        status: status
    };

    fetch('api/admin.php?action=update_leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast('อัพเดทข้อมูลการลาสำเร็จ', 'success');
                closeEditLeaveModal();
                loadLeaveManagementSection();
            } else {
                showToast(response.message, 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาด', 'error'));
});

// Employee Photo Upload Handlers
function setupEmployeePhotoHandlers(employeeId) {
    // Profile photo handler
    const btnChangePhoto = document.getElementById('btn-emp-change-photo');
    const profilePhotoInput = document.getElementById('emp-profile-photo-input');

    // Remove old event listeners by cloning
    const newBtnChangePhoto = btnChangePhoto.cloneNode(true);
    btnChangePhoto.parentNode.replaceChild(newBtnChangePhoto, btnChangePhoto);

    const newProfilePhotoInput = profilePhotoInput.cloneNode(true);
    profilePhotoInput.parentNode.replaceChild(newProfilePhotoInput, profilePhotoInput);

    // Add new event listeners
    newBtnChangePhoto.addEventListener('click', () => {
        newProfilePhotoInput.click();
    });

    newProfilePhotoInput.addEventListener('change', (e) => {
        handleEmployeeProfilePhotoUpload(e, employeeId);
    });

    // ID card handler
    const idCardInput = document.getElementById('emp-id-card-input');
    const newIdCardInput = idCardInput.cloneNode(true);
    idCardInput.parentNode.replaceChild(newIdCardInput, idCardInput);

    newIdCardInput.addEventListener('change', (e) => {
        handleEmployeeIdCardUpload(e, employeeId);
    });
}

function handleEmployeeProfilePhotoUpload(e, employeeId) {
    const file = e.target.files[0];
    if (!file) return;

    // ตรวจสอบว่าเป็นไฟล์รูปภาพหรือไม่
    if (!file.type.startsWith('image/')) {
        showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
        return;
    }

    showToast('กำลังประมวลผลรูปภาพ...', 'info');

    // อ่านและย่อรูปภาพก่อนอัพโหลด (50%)
    resizeImageAdmin(file, 0.5).then(resizedBlob => {
        const formData = new FormData();
        formData.append('profile_photo', resizedBlob, file.name);
        formData.append('employee_id', employeeId);

        fetch('api/admin.php?action=upload_employee_photo', {
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const photoUrl = data.data.url || getAbsoluteUrl(data.data.path);
                    document.getElementById('emp-profile-photo').src = photoUrl;
                    showToast('อัพโหลดรูปภาพสำเร็จ', 'success');
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

function handleEmployeeIdCardUpload(e, employeeId) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
        return;
    }

    showToast('กำลังประมวลผลรูปภาพ...', 'info');

    resizeImageAdmin(file, 0.5).then(resizedBlob => {
        const formData = new FormData();
        formData.append('id_card', resizedBlob, file.name);
        formData.append('employee_id', employeeId);

        fetch('api/admin.php?action=upload_employee_id_card', {
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const idCardUrl = data.data.url || getAbsoluteUrl(data.data.path);
                    const idCardImg = document.getElementById('emp-id-card-preview');
                    idCardImg.src = idCardUrl;
                    idCardImg.style.display = 'block';
                    showToast('อัพโหลดรูปบัตรประชาชนสำเร็จ', 'success');
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

// ฟังก์ชันสำหรับย่อขนาดรูปภาพ (คัดลอกมาจาก app.js)
function resizeImageAdmin(file, scaleFactor) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const newWidth = Math.round(img.width * scaleFactor);
                const newHeight = Math.round(img.height * scaleFactor);

                canvas.width = newWidth;
                canvas.height = newHeight;

                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('ไม่สามารถสร้างรูปภาพได้'));
                    }
                }, file.type, 0.9);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Load shifts for employee selection
function loadShiftsForEmployee(selectedShiftId) {
    const shiftSelect = document.getElementById('emp-shift');
    shiftSelect.innerHTML = '<option value="">-- ไม่กำหนด --</option>';

    fetch('api/admin.php?action=shifts')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                data.data.forEach(shift => {
                    const option = document.createElement('option');
                    option.value = shift.id;
                    const isFlexible = shift.start_time === '00:00:00' && shift.end_time === '00:00:00';
                    option.textContent = shift.name + (isFlexible ? ' (ไม่จำกัดเวลา)' : ' (' + formatTime(shift.start_time) + ' - ' + formatTime(shift.end_time) + ')');
                    if (selectedShiftId && shift.id == selectedShiftId) {
                        option.selected = true;
                    }
                    shiftSelect.appendChild(option);
                });
            }
        })
        .catch(() => {
            console.error('Failed to load shifts');
        });
}

// Load branches for employee selection
function loadBranchesForEmployee(employeeId) {
    const branchesList = document.getElementById('emp-branches-list');
    branchesList.innerHTML = '<div style="text-align: center; padding: 10px;">กำลังโหลด...</div>';

    // โหลดสาขาทั้งหมด
    fetch('api/admin.php?action=branches')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const allBranches = data.data;

                // ถ้าเป็นการแก้ไขพนักงาน ให้โหลดสาขาที่เลือกไว้
                if (employeeId) {
                    fetch(`api/admin.php?action=get_employee_branches&employee_id=${employeeId}`)
                        .then(res => res.json())
                        .then(branchData => {
                            if (branchData.success) {
                                renderBranchesCheckboxes(allBranches, branchData.data);
                            } else {
                                renderBranchesCheckboxes(allBranches, []);
                            }
                        })
                        .catch(() => {
                            renderBranchesCheckboxes(allBranches, []);
                        });
                } else {
                    // ถ้าเป็นการเพิ่มพนักงานใหม่ ให้เลือกสาขาที่ active ทั้งหมดโดยอัตโนมัติ
                    const activeBranchIds = allBranches
                        .filter(b => b.is_active == 1)
                        .map(b => b.id);
                    renderBranchesCheckboxes(allBranches, activeBranchIds);
                }
            } else {
                branchesList.innerHTML = '<div style="color: red;">ไม่สามารถโหลดสาขาได้</div>';
            }
        })
        .catch(() => {
            branchesList.innerHTML = '<div style="color: red;">เกิดข้อผิดพลาด</div>';
        });
}

function renderBranchesCheckboxes(branches, selectedBranchIds) {
    const branchesList = document.getElementById('emp-branches-list');

    if (branches.length === 0) {
        branchesList.innerHTML = '<div style="color: #999;">ยังไม่มีสาขาในระบบ</div>';
        return;
    }

    branchesList.innerHTML = '';

    branches.forEach(branch => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.padding = '5px 0';
        label.style.cursor = 'pointer';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = branch.id;
        checkbox.id = `branch-${branch.id}`;
        checkbox.style.marginRight = '8px';
        checkbox.style.width = 'auto';

        // ถ้าสาขานี้อยู่ใน selectedBranchIds ให้ติ๊กไว้
        if (selectedBranchIds.includes(branch.id) || selectedBranchIds.includes(branch.id.toString())) {
            checkbox.checked = true;
        }

        const text = document.createElement('span');
        text.textContent = branch.name;

        // ถ้าสาขาไม่ active ให้แสดงสีเทา
        if (branch.is_active != 1) {
            text.style.color = '#999';
            text.textContent += ' (ปิดใช้งาน)';
        }

        label.appendChild(checkbox);
        label.appendChild(text);
        branchesList.appendChild(label);
    });
}

// Helper functions for formatting
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear() + 543; // Convert to Buddhist year
    return `${day}/${month}/${year}`;
}

function formatTime(timeStr) {
    if (!timeStr) return '-';
    // timeStr format: "HH:MM:SS" or "HH:MM"
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
}

function formatTimeOnly(dateTimeStr) {
    if (!dateTimeStr) return '-';
    
    // If it's already just time (HH:MM:SS format), return as is
    if (dateTimeStr.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
        const parts = dateTimeStr.split(':');
        return `${parts[0]}:${parts[1]}`;
    }
    
    // If it's a datetime string, extract the time part
    const dateObj = new Date(dateTimeStr);
    if (isNaN(dateObj.getTime())) {
        // If Date parsing fails, try to extract time from string
        const timeMatch = dateTimeStr.match(/(\d{1,2}:\d{2}(:\d{2})?)/);
        if (timeMatch) {
            const timeParts = timeMatch[1].split(':');
            return `${timeParts[0]}:${timeParts[1]}`;
        }
        return dateTimeStr;
    }
    
    // Extract time from Date object
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function getStatusText(status) {
    const statusMap = {
        'on_time': 'ตรงเวลา',
        'late': 'สาย',
        'early': 'ก่อนเวลา',
        'absent': 'ขาดงาน'
    };
    return statusMap[status] || status;
}

function getLeaveStatusClass(status) {
    if (status === 'อนุมัติ') return 'badge-active';
    if (status === 'ปฏิเสธการลา' || status === 'ไม่อนุมัติ') return 'badge-inactive';
    if (status === 'ยกเลิกโดยพนักงาน') return 'badge-inactive';
    if (status === 'รอหัวหน้าอนุมัติ') return 'badge-pending';
    if (status === 'รอHRอนุมัติ') return 'badge-warning';
    return 'badge-pending';
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '-';
    const date = new Date(dateTimeStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear() + 543;
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Function to view photo in popup
window.viewPhoto = function (photoFilename, type, employeeName, dateTime) {
    if (!photoFilename) return;

    console.log('Opening photo popup:', photoFilename); // Debug

    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.className = 'photo-popup-overlay';
    overlay.innerHTML = `
        <div class="photo-popup-container">
            <div class="photo-popup-header">
                <h3>รูปถ่าย${type}</h3>
                <button class="photo-popup-close">&times;</button>
            </div>
            <div class="photo-popup-body">
                <div class="photo-info">
                    <p><strong>พนักงาน:</strong> ${employeeName}</p>
                    <p><strong>เวลา:</strong> ${dateTime}</p>
                </div>
                <div class="photo-container">
                    <img src="uploads/checkins/${photoFilename}" alt="รูปถ่าย${type}" onerror="this.src='assets/images/no-image.png'; this.alt='ไม่พบรูปภาพ';">
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Add event listener for close button
    const closeBtn = overlay.querySelector('.photo-popup-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            window.closePhotoPopup();
        });
    }

    // Close on overlay click
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
            window.closePhotoPopup();
        }
    });

    // Close on ESC key
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            window.closePhotoPopup();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

window.closePhotoPopup = function () {
    const popup = document.querySelector('.photo-popup-overlay');
    if (popup) {
        popup.remove();
    }
}

// Load first section on page load - only if admin page is visible
document.addEventListener('DOMContentLoaded', () => {
    const adminPage = document.getElementById('admin-page');
    const adminContent = document.getElementById('admin-content');

    // Only load if admin page is currently active
    if (adminContent && adminPage && adminPage.classList.contains('active')) {
        // Check for URL parameters to determine which section to load
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const requestedSection = urlParams.get('section');

        // Load the requested section or default to employees
        if (requestedSection && ['employees', 'timelogs', 'leave-management', 'departments', 'branches', 'leave-types', 'shifts', 'company-settings', 'employee-types', 'user-roles', 'payslip-management', 'telegram-settings'].includes(requestedSection)) {
            loadAdminSection(requestedSection);
        } else {
            loadEmployeesSection();
        }
    }
});

// Import Employee Functions
function showModal(modalId) {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.classList.remove('hidden');
    }

    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal && modal.style) {
            modal.style.display = 'block';
        }
    }
}

function closeModal(modalId) {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.classList.add('hidden');
    }

    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal && modal.style) {
            modal.style.display = 'none';
        }
    }
}

// Handle Import Employee Form Submit
document.getElementById('import-employee-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const fileInput = document.getElementById('import-file-input');
    const file = fileInput.files[0];

    if (!file) {
        showToast('กรุณาเลือกไฟล์ Excel', 'error');
        return;
    }

    // Check file extension
    const fileName = file.name;
    const fileExt = fileName.split('.').pop().toLowerCase();
    if (fileExt !== 'xlsx') {
        showToast('กรุณาเลือกไฟล์ .xlsx เท่านั้น', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('excel_file', file);

    // Show loading
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span style="margin-right: 8px;">⏳</span>กำลังนำเข้าข้อมูล...';

    fetch('api/admin.php?action=import_employees', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                let message = `นำเข้าสำเร็จ ${response.data.success_count} รายการ`;
                if (response.data.skip_count > 0) {
                    message += `, ข้าม ${response.data.skip_count} รายการ`;
                }
                if (response.data.error_count > 0) {
                    message += `, ผิดพลาด ${response.data.error_count} รายการ`;
                }

                showToast(message, 'success');
                closeModal('import-employee-modal');
                loadEmployeesSection();

                // Show detailed report if there are skips or errors
                if (response.data.details && response.data.details.length > 0) {
                    let report = 'รายละเอียดการนำเข้า:\n';
                    response.data.details.forEach(detail => {
                        report += `- ${detail.message}\n`;
                    });
                    alert(report);
                }
            } else {
                showToast(response.message || 'เกิดข้อผิดพลาดในการนำเข้า', 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error'))
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            fileInput.value = ''; // Reset file input
        });
});

function showImportEmployeeModal() {
    showModal('import-employee-modal');
}

// ==================== Telegram Settings Section ====================

function loadTelegramSettingsSection(readOnly = false) {
    const content = document.getElementById('admin-content');

    const readOnlyIndicator = readOnly ? `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <strong style="color: #856404;">👁️ โหมดดูข้อมูลเท่านั้น</strong><br>
            <span style="color: #856404; font-size: 14px;">บัญชี IT Support สามารถดูการตั้งค่าได้ แต่ไม่สามารถแก้ไขได้</span>
        </div>
    ` : '';

    const disabledAttribute = readOnly ? 'disabled' : '';
    const disabledStyle = readOnly ? 'opacity: 0.6; cursor: not-allowed;' : '';

    content.innerHTML = `
        <div class="admin-section-header">
            <h2>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 10px;">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                ตั้งค่าแจ้งเตือน Telegram
            </h2>
        </div>
        
        ${readOnlyIndicator}
        
        <div style="max-width: 800px; margin: 0 auto;">
            <form id="telegram-settings-form" style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                
                <!-- คำอธิบาย -->
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                    <h4 style="margin: 0 0 10px 0; color: #1976d2;">📱 วิธีตั้งค่า Telegram Bot</h4>
                    <ol style="margin: 0; padding-left: 20px; color: #1565c0; font-size: 14px; line-height: 1.8;">
                        <li>ค้นหา <strong>@BotFather</strong> ใน Telegram แล้วสร้าง Bot ใหม่</li>
                        <li>คัดลอก Bot Token ที่ได้รับมากรอกด้านล่าง</li>
                        <li>สร้างกลุ่ม Telegram 2 กลุ่ม: กลุ่มแจ้งเตือนเข้างาน และ กลุ่มแจ้งเตือนการลา</li>
                        <li>เพิ่ม Bot เข้ากลุ่มทั้ง 2 กลุ่ม และให้สิทธิ์ส่งข้อความ</li>
                        <li>ดึง Chat ID ของแต่ละกลุ่มโดยใช้ <strong>@userinfobot</strong> หรือ <strong>@getidsbot</strong></li>
                        <li>กรอก Chat ID ของแต่ละกลุ่มในช่องด้านล่าง</li>
                    </ol>
                </div>
                
                <!-- เปิด/ปิดใช้งาน -->
                <div style="margin-bottom: 25px; padding: 20px; background: #f5f5f5; border-radius: 8px;">
                    <label style="display: flex; align-items: center; cursor: pointer; ${disabledStyle}">
                        <input type="checkbox" id="telegram_enabled" name="telegram_enabled" value="1" style="width: 20px; height: 20px; margin-right: 10px;" ${disabledAttribute}>
                        <span style="font-size: 16px; font-weight: 600;">เปิดใช้งานแจ้งเตือน Telegram</span>
                    </label>
                </div>
                
                <!-- Bot Token -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #333;">🤖 Bot Token</h4>
                    <div class="form-group">
                        <label>Telegram Bot Token <span style="color: red;">*</span></label>
                        <input type="text" id="telegram_bot_token" name="telegram_bot_token" class="form-control" 
                               placeholder="เช่น 123456789:ABCdefGHIjklMNOpqrsTUVwxyz" style="${disabledStyle}" ${disabledAttribute}>
                        <small style="color: #666; display: block; margin-top: 5px;">Token ที่ได้จาก @BotFather</small>
                    </div>
                </div>
                
                <!-- Chat IDs -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #333;">💬 Chat IDs</h4>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Chat ID กลุ่มแจ้งเตือนการเข้างาน <span style="color: red;">*</span></label>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding-right: 10px;">
                                    <input type="text" id="telegram_timelog_chat_id" name="telegram_timelog_chat_id" 
                                           placeholder="เช่น -1001234567890" 
                                           style="width: 100%; padding: 12px 15px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box; ${disabledStyle}" ${disabledAttribute}>
                                </td>
                                <td style="width: 100px;">
                                    <button type="button" class="btn-secondary" onclick="testTelegramConnection('timelog')" style="width: 100%;" ${disabledAttribute}>
                                        🔔 ทดสอบ
                                    </button>
                                </td>
                            </tr>
                        </table>
                        <small style="color: #666; display: block; margin-top: 5px;">กลุ่มสำหรับแจ้งเตือนเมื่อพนักงานเข้า/ออกงาน (ปกติขึ้นต้นด้วย -100)</small>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Chat ID กลุ่มแจ้งเตือนการลา <span style="color: red;">*</span></label>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding-right: 10px;">
                                    <input type="text" id="telegram_leave_chat_id" name="telegram_leave_chat_id" 
                                           placeholder="เช่น -1001234567890" 
                                           style="width: 100%; padding: 12px 15px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box; ${disabledStyle}" ${disabledAttribute}>
                                </td>
                                <td style="width: 100px;">
                                    <button type="button" class="btn-secondary" onclick="testTelegramConnection('leave')" style="width: 100%;" ${disabledAttribute}>
                                        🔔 ทดสอบ
                                    </button>
                                </td>
                            </tr>
                        </table>
                        <small style="color: #666; display: block; margin-top: 5px;">กลุ่มสำหรับแจ้งเตือนเมื่อพนักงานขอลา</small>
                    </div>
                </div>
                
                <!-- Preview -->
                <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                    <h4 style="margin: 0 0 10px 0; color: #e65100;">📋 ตัวอย่างข้อความที่จะส่ง</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div style="background: white; padding: 12px; border-radius: 6px; font-size: 13px;">
                            <strong style="color: #4caf50;">🟢 พนักงานเข้างาน</strong><br><br>
                            👤 ชื่อ: สมชาย ใจดี<br>
                            🏢 แผนก: IT<br>
                            📍 สาขา: สำนักงานใหญ่<br>
                            🕐 เวลา: 08:30 น.<br>
                            ✅ สถานะ: ตรงเวลา
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 6px; font-size: 13px;">
                            <strong style="color: #2196f3;">📋 คำขอลางานใหม่</strong><br><br>
                            👤 ชื่อ: สมหญิง รักงาน<br>
                            🏢 แผนก: HR<br>
                            📝 ประเภท: ลาป่วย<br>
                            📅 วันที่: 20/01/2026<br>
                            💬 เหตุผล: ไม่สบาย
                        </div>
                    </div>
                </div>
                
                <!-- Submit Button -->
                <div style="text-align: center;">
                    ${readOnly ?
            `<div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; color: #721c24;">
                        <strong>⚠️ ไม่สามารถบันทึกการตั้งค่าได้</strong><br>
                        บัญชี IT Support สามารถดูการตั้งค่าได้เท่านั้น กรุณาติดต่อผู้ดูแลระบบเพื่อแก้ไข
                    </div>` :
            `<button type="submit" class="btn-primary" style="padding: 12px 40px; font-size: 16px;">
                        💾 บันทึกการตั้งค่า
                    </button>`
        }
                </div>
            </form>
        </div>
    `;

    // Load current settings
    loadTelegramSettings();

    // Handle form submission only if not read-only
    if (!readOnly) {
        document.getElementById('telegram-settings-form').addEventListener('submit', function (e) {
            e.preventDefault();
            saveTelegramSettings();
        });
    }
}

function loadTelegramSettings() {
    fetch('api/admin.php?action=get_telegram_settings')
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                const data = response.data;

                document.getElementById('telegram_enabled').checked = data.telegram_enabled === '1';
                document.getElementById('telegram_bot_token').value = data.telegram_bot_token || '';
                document.getElementById('telegram_timelog_chat_id').value = data.telegram_timelog_chat_id || '';
                document.getElementById('telegram_leave_chat_id').value = data.telegram_leave_chat_id || '';
            }
        })
        .catch(err => {
            console.error('Error loading telegram settings:', err);
        });
}

function saveTelegramSettings() {
    const data = {
        telegram_enabled: document.getElementById('telegram_enabled').checked ? '1' : '0',
        telegram_bot_token: document.getElementById('telegram_bot_token').value.trim(),
        telegram_timelog_chat_id: document.getElementById('telegram_timelog_chat_id').value.trim(),
        telegram_leave_chat_id: document.getElementById('telegram_leave_chat_id').value.trim()
    };

    const submitBtn = document.querySelector('#telegram-settings-form button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ กำลังบันทึก...';

    fetch('api/admin.php?action=update_telegram_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast('บันทึกการตั้งค่า Telegram สำเร็จ', 'success');
            } else {
                showToast(response.message || 'เกิดข้อผิดพลาด', 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error'))
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
}

function testTelegramConnection(type) {
    const token = document.getElementById('telegram_bot_token').value.trim();
    const chatId = type === 'timelog'
        ? document.getElementById('telegram_timelog_chat_id').value.trim()
        : document.getElementById('telegram_leave_chat_id').value.trim();

    if (!token) {
        showToast('กรุณากรอก Bot Token ก่อน', 'error');
        return;
    }

    if (!chatId) {
        showToast('กรุณากรอก Chat ID ก่อน', 'error');
        return;
    }

    // Save settings first, then test
    const data = {
        telegram_enabled: '1',
        telegram_bot_token: token,
        telegram_timelog_chat_id: document.getElementById('telegram_timelog_chat_id').value.trim(),
        telegram_leave_chat_id: document.getElementById('telegram_leave_chat_id').value.trim()
    };

    showToast('กำลังทดสอบการเชื่อมต่อ...', 'info');

    // Save first
    fetch('api/admin.php?action=update_telegram_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(() => {
            // Then test
            return fetch('api/admin.php?action=test_telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: type })
            });
        })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                showToast('✅ ส่งข้อความทดสอบสำเร็จ! กรุณาตรวจสอบกลุ่ม Telegram', 'success');
            } else {
                showToast('❌ ' + (response.message || 'ไม่สามารถส่งข้อความได้'), 'error');
            }
        })
        .catch(() => showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error'));
}

// Export Functions
function exportEmployeesToCSV() {
    const currentData = adminPagination.sections.employees.data;

    if (!currentData || currentData.length === 0) {
        showToast('ไม่มีข้อมูลพนักงานให้ส่งออก', 'error');
        return;
    }

    // Create CSV content
    let csvContent = '\ufeff'; // BOM for UTF-8
    csvContent += 'รหัสพนักงาน,ชื่อ,นามสกุล,อีเมล,เบอร์โทร,แผนก,สาขา,ประเภทพนักงาน,สถานะ,กะการทำงาน (ชื่อ), กะเวลาเข้า, กะเวลาออก,วันที่เริ่มงาน\n';

    currentData.forEach(emp => {
        const row = [
            emp.employee_code || '',
            emp.first_name || '',
            emp.last_name || '',
            emp.email || '',
            emp.phone || '',
            emp.department_name || '',
            emp.branch_names || '',
            emp.employee_type || '',
            emp.is_active ? 'ใช้งาน' : 'ปิดใช้งาน',
            emp.shift_name || '',
            emp.shift_start_time || '',
            emp.shift_end_time || '',
            emp.start_date ? formatDate(emp.start_date) : ''
        ];
        csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'employees_' + new Date().toISOString().split('T')[0] + '.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function exportTimeLogsToCSV() {
    const currentData = adminPagination.sections.timelogs.data;

    if (!currentData || currentData.length === 0) {
        showToast('ไม่มีข้อมูลให้ส่งออก', 'error');
        return;
    }

    // Create CSV content
    let csvContent = '\ufeff'; // BOM for UTF-8
    csvContent += 'วันที่,รหัสพนักงาน,ชื่อ-นามสกุล,แผนก,กะการทำงาน,สาขาที่เข้างาน,วันที่เข้างาน,เวลาเข้างาน,วันที่ออกงาน,เวลาออกงาน,สถานะ\n';

    currentData.forEach(log => {
        const row = [
            formatDate(log.work_date),
            log.employee_code || '',
            `${log.first_name || ''} ${log.last_name || ''}`,
            log.department_name || '-',
            log.shift_name || 'กะปกติ',
            log.branch_name || '-',
            log.check_in_time ? formatDate(log.check_in_time) : '-',
            log.check_in_time ? formatTimeOnly(log.check_in_time) : '-',
            log.check_out_time ? formatDate(log.check_out_time) : '-',
            log.check_out_time ? formatTimeOnly(log.check_out_time) : '-',
            getStatusText(log.status)
        ];
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const fileName = `ประวัติการเข้าออกงาน_${formatDate(new Date())}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('ส่งออกข้อมูลสำเร็จ', 'success');
}

function exportLeavesToCSV() {
    const currentData = adminPagination.sections.leaves.data;

    if (!currentData || currentData.length === 0) {
        showToast('ไม่มีข้อมูลให้ส่งออก', 'error');
        return;
    }

    // Create CSV content
    let csvContent = '\ufeff'; // BOM for UTF-8
    csvContent += 'วันที่แจ้ง,รหัสพนักงาน,ชื่อ-นามสกุล,แผนก,ประเภทการลา,วันที่เริ่มลา,วันที่สิ้นสุด,จำนวนวัน,สถานะ,เหตุผล\n';

    currentData.forEach(leave => {
        const row = [
            formatDate(leave.created_at),
            leave.employee_code || '',
            `${leave.first_name || ''} ${leave.last_name || ''}`,
            leave.department_name || '-',
            leave.leave_type_name || '-',
            formatDate(leave.start_date),
            formatDate(leave.end_date),
            leave.total_days || '',
            getStatusText(leave.status),
            leave.reason || '-'
        ];
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const fileName = `ข้อมูลการลา_${formatDate(new Date())}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('ส่งออกข้อมูลสำเร็จ', 'success');
}

// Make loadAdminSection globally accessible for hash navigation
window.loadAdminSection = loadAdminSection;
// ➕ วางท่อนนี้ไว้บรรทัดล่างสุดของไฟล์ admin.js
window.openEditTimeLogModal = function(id, workDate, checkIn, checkOut, status, empName) {
    const overlay = document.createElement('div');
    overlay.id = 'edit-timelog-popup-overlay';
    overlay.style = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10000; font-family: sans-serif;';
    
    overlay.innerHTML = `
        <div style="background: white; padding: 25px; border-radius: 8px; width: 100%; max-width: 400px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
            <h3 style="margin-top: 0; color: #333; margin-bottom: 15px; border-bottom: 2px solid #f16e00; padding-bottom: 8px;">✏️ แก้ไขประวัติเวลา [${empName}]</h3>
            <form id="popup-edit-timelog-form">
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 5px;">วันที่ทำงาน (work_date)</label>
                    <input type="date" id="p-work-date" class="form-control" value="${workDate}" required style="width: 100%; box-sizing: border-box; height: 40px; padding: 5px 10px;">
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 5px;">เวลาเข้างาน (check_in_time)</label>
                    <input type="text" id="p-check-in" class="form-control" value="${checkIn}" placeholder="YYYY-MM-DD HH:MM:SS" required style="width: 100%; box-sizing: border-box; height: 40px; padding: 5px 10px;">
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 5px;">เวลาออกงาน (check_out_time)</label>
                    <input type="text" id="p-check-out" class="form-control" value="${checkOut}" placeholder="YYYY-MM-DD HH:MM:SS (เว้นว่างได้)" style="width: 100%; box-sizing: border-box; height: 40px; padding: 5px 10px;">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 5px;">สถานะ (status)</label>
                    <select id="p-status" class="form-control" style="width: 100%; box-sizing: border-box; height: 40px; padding: 5px 10px;">
                        <option value="on_time" ${status === 'on_time' ? 'selected' : ''}>ตรงเวลา (on_time)</option>
                        <option value="late" ${status === 'late' ? 'selected' : ''}>สาย (late)</option>
                        <option value="early" ${status === 'early' ? 'selected' : ''}>ก่อนเวลา (early)</option>
                        <option value="absent" ${status === 'absent' ? 'selected' : ''}>ขาดงาน (absent)</option>
                    </select>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" class="btn-secondary" onclick="document.getElementById('edit-timelog-popup-overlay').remove()" style="width: auto; padding: 8px 15px; height: auto;">ยกเลิก</button>
                    <button type="submit" class="btn-primary" style="width: auto; padding: 8px 20px; background: #f16e00; border: none; color: white; font-weight: bold; cursor: pointer; border-radius: 4px; height: auto;">บันทึก</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // ตั้งค่า Event ตอนกดยืนยันเซฟข้อมูล
    document.getElementById('popup-edit-timelog-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const payload = {
            log_id: id,
            work_date: document.getElementById('p-work-date').value,
            check_in_time: document.getElementById('p-check-in').value,
            check_out_time: document.getElementById('p-check-out').value || null,
            status: document.getElementById('p-status').value
        };
        
        fetch('api/timelog.php?action=update_log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('🎉 ' + data.message, 'success');
                overlay.remove();
                loadTimeLogsSection(); // รีโหลดอัปเดตตารางประวัติเวลาบนหน้าจอทันที
            } else {
                showToast('❌ ' + data.message, 'error');
            }
        })
        .catch(err => {
            console.error(err);
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        });
    });
};
