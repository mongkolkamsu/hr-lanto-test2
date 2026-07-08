// Thai Address Autocomplete for Registration Form
// ใช้ข้อมูลจาก GitHub API และมี fallback สำรองไว้

let provinceData = [];
let districtData = [];
let subdistrictData = [];

// Initialize Select2 and load data when modal opens
function initThaiAddressSelects() {
    // Initialize Select2 for all address selects
    $('#reg-province').select2({
        placeholder: 'เลือกหรือค้นหาจังหวัด',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#register-modal')
    });

    $('#reg-district').select2({
        placeholder: 'เลือกหรือค้นหาอำเภอ',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#register-modal')
    });

    $('#reg-sub-district').select2({
        placeholder: 'เลือกหรือค้นหาตำบล',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#register-modal')
    });

    // Load provinces
    loadProvinces();

    // Event handlers
    $('#reg-province').on('change', function () {
        const province = $(this).val();
        if (province) {
            loadDistricts(province);
        } else {
            resetDistricts();
            resetSubdistricts();
        }
    });

    $('#reg-district').on('change', function () {
        const province = $('#reg-province').val();
        const district = $(this).val();
        if (province && district) {
            loadSubdistricts(province, district);
        } else {
            resetSubdistricts();
        }
    });

    $('#reg-sub-district').on('change', function () {
        const subdistrict = $(this).val();
        if (subdistrict) {
            // หารหัสไปรษณีย์
            const selectedData = subdistrictData.find(item =>
                item.subdistrict === subdistrict
            );
            if (selectedData && selectedData.zipcode) {
                $('#reg-zipcode').val(selectedData.zipcode);
            }
        } else {
            $('#reg-zipcode').val('');
        }
    });
}

// Load provinces - รายชื่อจังหวัดทั้งหมด 77 จังหวัด
function loadProvinces() {
    const provinces = [
        'กระบี่', 'กรุงเทพมหานคร', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร',
        'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
        'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง',
        'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม',
        'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส',
        'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์',
        'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พังงา', 'พัทลุง',
        'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่',
        'พะเยา', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน',
        'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง',
        'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย',
        'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ',
        'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี',
        'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย',
        'หนองบัวลำภู', 'อ่างทอง', 'อุดรธานี', 'อุทัยธานี', 'อุตรดิตถ์',
        'อุบลราชธานี', 'อำนาจเจริญ'
    ];

    provinceData = provinces;

    // Populate select
    const select = document.getElementById('reg-province');
    select.innerHTML = '<option value="">เลือก จังหวัด</option>';

    provinces.forEach(province => {
        const option = document.createElement('option');
        option.value = province;
        option.textContent = province;
        select.appendChild(option);
    });

    console.log('✅ Loaded', provinces.length, 'provinces');

    // โหลดข้อมูลเต็มจาก API
    loadFullAddressData();
}

// โหลดข้อมูลที่อยู่แบบเต็มสำหรับอำเภอและตำบล
function loadFullAddressData(callback) {
    console.log('🔄 Loading Thai address data from local file...');

    fetch('assets/js/thai_address_db.json')
        .then(response => {
            if (!response.ok) throw new Error('Local data file not found');
            return response.json();
        })
        .then(data => {
            // ตรวจสอบว่าเป็น array
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('Invalid data format');
            }

            window.thaiAddressData = data;
            console.log('✅ Thai address data loaded:', data.length, 'records');
            if (callback) callback();
        })
        .catch(error => {
            console.warn('⚠️ Local data failed, trying API backup:', error);
            // ถ้า Local file มีปัญหา ให้ลองดึงจาก API
            loadFromApiBackup(callback);
        });
}

function loadFromApiBackup(callback) {
    console.log('🔄 Loading Thai address data from API backup...');
    fetch('https://raw.githubusercontent.com/earthchie/jquery.Thailand.js/master/jquery.Thailand.js/database/raw_database/raw_database.json')
        .then(response => {
            if (!response.ok) throw new Error('API failed');
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data)) throw new Error('Invalid data format');
            
            // Map data to match our expected format
            const mappedData = data.map(item => ({
                province: item.province,
                district: item.amphoe,      // JSON amphoe -> Code district
                subdistrict: item.district, // JSON district -> Code subdistrict
                zipcode: String(item.zipcode)
            }));

            window.thaiAddressData = mappedData;
            console.log('✅ Thai address data loaded from API:', mappedData.length, 'records');
            if (callback) callback();
        })
        .catch(error => {
            console.warn('⚠️ API failed, using local fallback data:', error);
            useLocalFallback(callback);
        });
}

// ใช้ข้อมูล fallback local
function useLocalFallback(callback) {
    if (typeof generateComprehensiveThaiData === 'function') {
        window.thaiAddressData = generateComprehensiveThaiData();
        console.log('✅ Using local fallback data:', window.thaiAddressData.length, 'records');
        if (callback) callback();
    } else {
        console.error('❌ No fallback data available');
        window.thaiAddressData = [];
        if (callback) callback();
    }
}

// Load districts based on selected province
function loadDistricts(province) {
    if (!window.thaiAddressData || window.thaiAddressData.length === 0) {
        console.error('❌ Thai address data not loaded');
        alert('ข้อมูลที่อยู่ยังไม่พร้อม กรุณาลองใหม่อีกครั้ง');
        return;
    }

    // Filter districts by province
    const districts = [...new Set(
        window.thaiAddressData
            .filter(item => item.province === province)
            .map(item => item.district)
    )].sort((a, b) => a.localeCompare(b, 'th'));

    if (districts.length === 0) {
        console.warn('⚠️ No districts found for province:', province);
        // สร้างค่าเริ่มต้น
        districts.push(`เมือง${province}`);
    }

    districtData = districts;

    // Populate select
    const select = document.getElementById('reg-district');
    select.innerHTML = '<option value="">เลือกอำเภอ</option>';

    districts.forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        select.appendChild(option);
    });

    // Enable district select
    select.disabled = false;
    $('#reg-district').select2('destroy').select2({
        placeholder: 'เลือกหรือค้นหาอำเภอ',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#register-modal')
    });

    // Reset subdistrict
    resetSubdistricts();

    console.log('✅ Loaded', districts.length, 'districts for', province);
}

// Load subdistricts based on selected province and district
function loadSubdistricts(province, district) {
    if (!window.thaiAddressData || window.thaiAddressData.length === 0) {
        console.error('❌ Thai address data not loaded');
        return;
    }

    // Filter subdistricts by province and district
    const subdistricts = window.thaiAddressData
        .filter(item => item.province === province && item.district === district)
        .sort((a, b) => a.subdistrict.localeCompare(b.subdistrict, 'th'));

    if (subdistricts.length === 0) {
        console.warn('⚠️ No subdistricts found for:', province, district);
        // สร้างค่าเริ่มต้น
        subdistricts.push({
            province: province,
            district: district,
            subdistrict: district,
            zipcode: '00000'
        });
    }

    subdistrictData = subdistricts;

    // Populate select
    const select = document.getElementById('reg-sub-district');
    select.innerHTML = '<option value="">เลือกตำบล</option>';

    subdistricts.forEach(item => {
        const option = document.createElement('option');
        option.value = item.subdistrict;
        option.textContent = item.subdistrict;
        select.appendChild(option);
    });

    // Enable subdistrict select
    select.disabled = false;
    $('#reg-sub-district').select2('destroy').select2({
        placeholder: 'เลือกหรือค้นหาตำบล',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#register-modal')
    });

    console.log('✅ Loaded', subdistricts.length, 'subdistricts for', district);
}

// Reset districts
function resetDistricts() {
    const select = document.getElementById('reg-district');
    select.innerHTML = '<option value="">เลือกอำเภอ</option>';
    select.disabled = true;
    $('#reg-district').val(null).trigger('change');
}

// Reset subdistricts
function resetSubdistricts() {
    const select = document.getElementById('reg-sub-district');
    select.innerHTML = '<option value="">เลือกตำบล</option>';
    select.disabled = true;
    $('#reg-sub-district').val(null).trigger('change');
    document.getElementById('reg-zipcode').value = '';
}

// Reset all address fields
function resetAllAddressFields() {
    $('#reg-province').val(null).trigger('change');
    resetDistricts();
    resetSubdistricts();
}

// Initialize Thai address dropdowns for Account page
function initializeAccountAddressDropdowns(currentProvince, currentDistrict, currentSubDistrict) {
    console.log('🔧 Initializing account address dropdowns with:', {
        province: currentProvince,
        district: currentDistrict,
        subdistrict: currentSubDistrict
    });
    
    // Convert input fields to select if they are still input elements
    if ($('#account-province').is('input')) {
        console.log('🔄 Converting account-province from input to select');
        $('#account-province').replaceWith('<select id="account-province" name="account-province" class="form-control" style="width: 100%;"><option value="">เลือกจังหวัด</option></select>');
    }
    if ($('#account-district').is('input')) {
        console.log('🔄 Converting account-district from input to select');
        $('#account-district').replaceWith('<select id="account-district" name="account-district" class="form-control" style="width: 100%;" disabled><option value="">เลือกอำเภอ</option></select>');
    }
    if ($('#account-sub-district').is('input')) {
        console.log('🔄 Converting account-sub-district from input to select');
        $('#account-sub-district').replaceWith('<select id="account-sub-district" name="account-sub-district" class="form-control" style="width: 100%;" disabled><option value="">เลือกตำบล</option></select>');
    }

    // Initialize Select2 for account address fields
    $('#account-province').select2({
        placeholder: 'เลือกหรือค้นหาจังหวัด',
        allowClear: true,
        width: '100%'
    });

    $('#account-district').select2({
        placeholder: 'เลือกหรือค้นหาอำเภอ',
        allowClear: true,
        width: '100%'
    });

    $('#account-sub-district').select2({
        placeholder: 'เลือกหรือค้นหาตำบล',
        allowClear: true,
        width: '100%'
    });

    // Load provinces
    loadAccountProvinces(currentProvince, currentDistrict, currentSubDistrict);

    // Event handlers for account page
    $('#account-province').on('change', function () {
        const province = $(this).val();
        console.log('📍 Province changed to:', province);
        if (province) {
            loadAccountDistricts(province);
        } else {
            resetAccountDistricts();
            resetAccountSubdistricts();
        }
    });

    $('#account-district').on('change', function () {
        const province = $('#account-province').val();
        const district = $(this).val();
        console.log('📍 District changed to:', district);
        if (province && district) {
            loadAccountSubdistricts(province, district);
        } else {
            resetAccountSubdistricts();
        }
    });
}

// Initialize Thai address dropdowns for Admin Employee Management page
function initializeEmployeeAddressDropdowns(currentProvince, currentDistrict, currentSubDistrict) {
    console.log('🔧 Initializing employee address dropdowns with:', {
        province: currentProvince,
        district: currentDistrict,
        subdistrict: currentSubDistrict
    });
    
    // Check if elements exist
    if (!$('#emp-province').length) {
        console.warn('⚠️ emp-province element not found');
        return;
    }
    
    // Initialize Select2 for employee address fields
    $('#emp-province').select2({
        placeholder: 'เลือกหรือค้นหาจังหวัด',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#employee-modal')
    });

    $('#emp-district').select2({
        placeholder: 'เลือกหรือค้นหาอำเภอ',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#employee-modal')
    });

    $('#emp-sub-district').select2({
        placeholder: 'เลือกหรือค้นหาตำบล',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#employee-modal')
    });

    // Load provinces
    loadEmployeeProvinces(currentProvince, currentDistrict, currentSubDistrict);

    // Event handlers for employee page
    $('#emp-province').on('change', function () {
        const province = $(this).val();
        console.log('📍 Employee province changed to:', province);
        if (province) {
            loadEmployeeDistricts(province);
        } else {
            resetEmployeeDistricts();
            resetEmployeeSubdistricts();
        }
    });

    $('#emp-district').on('change', function () {
        const province = $('#emp-province').val();
        const district = $(this).val();
        console.log('📍 Employee district changed to:', district);
        if (province && district) {
            loadEmployeeSubdistricts(province, district);
        } else {
            resetEmployeeSubdistricts();
        }
    });
}

// Load provinces for employee management
function loadEmployeeProvinces(currentProvince, currentDistrict, currentSubDistrict) {
    // Ensure address data is loaded first
    if (!window.thaiAddressData || window.thaiAddressData.length === 0) {
        console.log('🔄 Loading address data for employee management...');
        loadFullAddressData(function() {
            console.log('✅ Address data loaded, now loading provinces');
            loadEmployeeProvinces(currentProvince, currentDistrict, currentSubDistrict);
        });
        return;
    }

    // Load ALL provinces like registration form, not just from thaiAddressDataSimple
    const provinces = [
        'กระบี่', 'กรุงเทพมหานคร', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร',
        'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
        'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง',
        'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม',
        'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส',
        'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์',
        'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พังงา', 'พัทลุง',
        'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่',
        'พะเยา', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน',
        'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง',
        'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย',
        'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ',
        'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี',
        'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย',
        'หนองบัวลำภู', 'อ่างทอง', 'อุดรธานี', 'อุทัยธานี', 'อุตรดิตถ์',
        'อุบลราชธานี', 'อำนาจเจริญ'
    ];
    
    console.log('🔍 Loading', provinces.length, 'provinces for employee management');

    const select = document.getElementById('emp-province');
    select.innerHTML = '<option value="">เลือกจังหวัด</option>';

    provinces.forEach(province => {
        const option = document.createElement('option');
        option.value = province;
        option.textContent = province;
        select.appendChild(option);
    });

    console.log('✅ Loaded', provinces.length, 'provinces for employee management');
    
    // Set current values after loading provinces
    console.log('🎯 Setting current employee values:', {
        province: currentProvince,
        district: currentDistrict,
        subdistrict: currentSubDistrict
    });
    
    if (currentProvince) {
        setTimeout(() => {
            console.log('⏰ Setting employee province to:', currentProvince);
            $('#emp-province').val(currentProvince).trigger('change');
            if (currentDistrict) {
                setTimeout(() => {
                    console.log('⏰ Setting employee district to:', currentDistrict);
                    $('#emp-district').val(currentDistrict).trigger('change');
                    if (currentSubDistrict) {
                        setTimeout(() => {
                            console.log('⏰ Setting employee subdistrict to:', currentSubDistrict);
                            $('#emp-sub-district').val(currentSubDistrict).trigger('change');
                        }, 300);
                    }
                }, 300);
            }
        }, 300);
    } else {
        console.log('⚠️ No current employee province to set');
    }
}

// Load districts for employee management
function loadEmployeeDistricts(province) {
    // Use full address data like registration form (array format)
    if (!window.thaiAddressData || window.thaiAddressData.length === 0) {
        console.warn('⚠️ No address data found for employee province:', province);
        const districts = [`เมือง${province}`];
        populateEmployeeDistricts(districts);
        return;
    }

    // Filter districts by province (same as registration form)
    const districts = [...new Set(
        window.thaiAddressData
            .filter(item => item.province === province)
            .map(item => item.district)
    )].sort((a, b) => a.localeCompare(b, 'th'));

    if (districts.length === 0) {
        console.warn('⚠️ No districts found for province:', province);
        districts.push(`เมือง${province}`);
    }

    populateEmployeeDistricts(districts);
}

function populateEmployeeDistricts(districts) {
    const select = document.getElementById('emp-district');
    select.innerHTML = '<option value="">เลือกอำเภอ</option>';

    districts.forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        select.appendChild(option);
    });

    select.disabled = false;
    $('#emp-district').select2('destroy').select2({
        placeholder: 'เลือกหรือค้นหาอำเภอ',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#employee-modal')
    });

    resetEmployeeSubdistricts();
    console.log('✅ Loaded', districts.length, 'employee districts');
}

// Load subdistricts for employee management
function loadEmployeeSubdistricts(province, district) {
    // Use full address data like registration form (array format)
    if (!window.thaiAddressData || window.thaiAddressData.length === 0) {
        console.warn('⚠️ No address data found for employee:', province, district);
        const subdistricts = [district];
        populateEmployeeSubdistricts(subdistricts);
        return;
    }

    // Filter subdistricts by province and district (same as registration form)
    const subdistricts = window.thaiAddressData
        .filter(item => item.province === province && item.district === district)
        .sort((a, b) => a.subdistrict.localeCompare(b.subdistrict, 'th'));

    if (subdistricts.length === 0) {
        console.warn('⚠️ No subdistricts found for:', province, district);
        subdistricts.push({
            province: province,
            district: district,
            subdistrict: district,
            zipcode: '00000'
        });
    }

    populateEmployeeSubdistricts(subdistricts);
}

function populateEmployeeSubdistricts(subdistricts) {
    const select = document.getElementById('emp-sub-district');
    select.innerHTML = '<option value="">เลือกตำบล</option>';

    subdistricts.forEach(item => {
        const option = document.createElement('option');
        option.value = typeof item === 'string' ? item : item.subdistrict;
        option.textContent = typeof item === 'string' ? item : item.subdistrict;
        select.appendChild(option);
    });

    select.disabled = false;
    $('#emp-sub-district').select2('destroy').select2({
        placeholder: 'เลือกหรือค้นหาตำบล',
        allowClear: true,
        width: '100%',
        dropdownParent: $('#employee-modal')
    });

    console.log('✅ Loaded', subdistricts.length, 'employee subdistricts');
}

function resetEmployeeDistricts() {
    const select = document.getElementById('emp-district');
    select.innerHTML = '<option value="">เลือกอำเภอ</option>';
    select.disabled = true;
    $('#emp-district').val(null).trigger('change');
}

function resetEmployeeSubdistricts() {
    const select = document.getElementById('emp-sub-district');
    select.innerHTML = '<option value="">เลือกตำบล</option>';
    select.disabled = true;
    $('#emp-sub-district').val(null).trigger('change');
}
function loadAccountProvinces(currentProvince, currentDistrict, currentSubDistrict) {
    const provinces = [
        'กระบี่', 'กรุงเทพมหานคร', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร',
        'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
        'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง',
        'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม',
        'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส',
        'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์',
        'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พังงา', 'พัทลุง',
        'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่',
        'พะเยา', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน',
        'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง',
        'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย',
        'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ',
        'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี',
        'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย',
        'หนองบัวลำภู', 'อ่างทอง', 'อุดรธานี', 'อุทัยธานี', 'อุตรดิตถ์',
        'อุบลราชธานี', 'อำนาจเจริญ'
    ];

    // Populate select
    const select = document.getElementById('account-province');
    select.innerHTML = '<option value="">เลือกจังหวัด</option>';

    provinces.forEach(province => {
        const option = document.createElement('option');
        option.value = province;
        option.textContent = province;
        select.appendChild(option);
    });

    // Set current values after loading provinces
    if (currentProvince) {
        setTimeout(() => {
            $('#account-province').val(currentProvince).trigger('change');
            if (currentDistrict) {
                setTimeout(() => {
                    $('#account-district').val(currentDistrict).trigger('change');
                    if (currentSubDistrict) {
                        setTimeout(() => {
                            $('#account-sub-district').val(currentSubDistrict).trigger('change');
                        }, 300);
                    }
                }, 300);
            }
        }, 300);
    }
}

function loadAccountDistricts(province) {
    // Ensure address data is loaded first
    if (!window.thaiAddressData || window.thaiAddressData.length === 0) {
        loadFullAddressData(function() {
            loadAccountDistricts(province);
        });
        return;
    }

    // Use full address data like other pages
    if (!window.thaiAddressData || window.thaiAddressData.length === 0) {
        // Use fallback
        const districts = [`เมือง${province}`];
        populateAccountDistricts(districts);
        return;
    }

    // Filter districts by province (same as other pages)
    const districts = [...new Set(
        window.thaiAddressData
            .filter(item => item.province === province)
            .map(item => item.district)
    )].sort((a, b) => a.localeCompare(b, 'th'));

    if (districts.length === 0) {
        districts.push(`เมือง${province}`);
    }

    populateAccountDistricts(districts);
}

function populateAccountDistricts(districts) {
    // Populate select
    const select = document.getElementById('account-district');
    select.innerHTML = '<option value="">เลือกอำเภอ</option>';

    districts.forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        select.appendChild(option);
    });

    // Enable district select
    select.disabled = false;
    $('#account-district').select2('destroy').select2({
        placeholder: 'เลือกหรือค้นหาอำเภอ',
        allowClear: true,
        width: '100%'
    });

    // Reset subdistrict
    resetAccountSubdistricts();
}

function loadAccountSubdistricts(province, district) {
    // Ensure address data is loaded first
    if (!window.thaiAddressData || window.thaiAddressData.length === 0) {
        loadFullAddressData(function() {
            loadAccountSubdistricts(province, district);
        });
        return;
    }

    // Use full address data like other pages
    if (!window.thaiAddressData || window.thaiAddressData.length === 0) {
        // Use fallback
        const subdistricts = [district];
        populateAccountSubdistricts(subdistricts);
        return;
    }

    // Filter subdistricts by province and district (same as other pages)
    const subdistricts = window.thaiAddressData
        .filter(item => item.province === province && item.district === district)
        .sort((a, b) => a.subdistrict.localeCompare(b.subdistrict, 'th'));

    if (subdistricts.length === 0) {
        subdistricts.push({
            province: province,
            district: district,
            subdistrict: district,
            zipcode: '00000'
        });
    }

    populateAccountSubdistricts(subdistricts);
}

function populateAccountSubdistricts(subdistricts) {
    // Populate select
    const select = document.getElementById('account-sub-district');
    select.innerHTML = '<option value="">เลือกตำบล</option>';

    subdistricts.forEach(item => {
        const option = document.createElement('option');
        option.value = typeof item === 'string' ? item : item.subdistrict;
        option.textContent = typeof item === 'string' ? item : item.subdistrict;
        select.appendChild(option);
    });

    // Enable subdistrict select
    select.disabled = false;
    $('#account-sub-district').select2('destroy').select2({
        placeholder: 'เลือกหรือค้นหาตำบล',
        allowClear: true,
        width: '100%'
    });

    console.log('✅ Loaded', subdistricts.length, 'subdistricts');
}

function resetAccountDistricts() {
    const select = document.getElementById('account-district');
    select.innerHTML = '<option value="">เลือกอำเภอ</option>';
    select.disabled = true;
    $('#account-district').val(null).trigger('change');
}

function resetAccountSubdistricts() {
    const select = document.getElementById('account-sub-district');
    select.innerHTML = '<option value="">เลือกตำบล</option>';
    select.disabled = true;
    $('#account-sub-district').val(null).trigger('change');
}
