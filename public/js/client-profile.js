// public/js/client-profile.js
/**
 * CLIENT-PROFILE.JS - SUNSHINE COWHIDES
 * Handles profile dropdown, profile modal, and access code change
 */

// ===== PROFILE DROPDOWN =====
window.toggleProfileDropdown = function() {
    const dropdown = document.getElementById('profileDropdown');
    const button = document.querySelector('.profile-dropdown-btn');

    if (!dropdown || !button) return;

    const isOpen = dropdown.classList.contains('show');

    if (isOpen) {
        dropdown.classList.remove('show');
        button.classList.remove('active');
    } else {
        dropdown.classList.add('show');
        button.classList.add('active');
        updateDropdownUserInfo();
    }
};

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('profileDropdown');
    const container = document.querySelector('.profile-dropdown-container');

    if (!dropdown || !container) return;

    if (!event.target.closest('.profile-dropdown-container')) {
        dropdown.classList.remove('show');
        const button = document.querySelector('.profile-dropdown-btn');
        if (button) button.classList.remove('active');
    }
});

// ===== UPDATE DROPDOWN USER INFO =====
window.updateDropdownUserInfo = function() {
    const savedSession = localStorage.getItem('sunshineSession');
    if (!savedSession) return;

    const session = JSON.parse(savedSession);
    const user = session.user || {};

    const nameEl = document.getElementById('dropdownUserName');
    const emailEl = document.getElementById('dropdownUserEmail');

    if (nameEl) {
        nameEl.textContent = user.name || 'Client';
    }
    if (emailEl) {
        emailEl.textContent = user.email || 'No email registered';
    }
};

// ===== PROFILE MODAL =====
window.openProfileModal = async function() {
    // Close dropdown first
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) dropdown.classList.remove('show');

    const modal = document.getElementById('profileModal');
    if (!modal) return;

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Load current profile data
    await loadProfileData();
};

window.closeProfileModal = function() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

// Load profile data from backend
async function loadProfileData() {
    try {
        const savedSession = localStorage.getItem('sunshineSession');
        if (!savedSession) return;

        const session = JSON.parse(savedSession);
        const accessCode = session.accessCode;

        if (!accessCode) return;

        // Fetch full profile data
        const response = await fetchWithAuth(`/api/client/profile?code=${encodeURIComponent(accessCode)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error('Error loading profile:', data.message);
            // Use cached data if API fails
            populateFormFromSession(session);
            return;
        }

        // Populate form
        const profile = data.profile;
        document.getElementById('profileName').value = profile.clientName || '';
        document.getElementById('profileEmail').value = profile.clientEmail || '';
        document.getElementById('profilePhone').value = profile.clientPhone || '';
        document.getElementById('profileCompany').value = profile.companyName || '';
        document.getElementById('profileAddress1').value = profile.addressLine1 || '';
        document.getElementById('profileAddress2').value = profile.addressLine2 || '';
        document.getElementById('profileCity').value = profile.city || '';
        document.getElementById('profileState').value = profile.state || '';
        document.getElementById('profileZipCode').value = profile.zipCode || '';

    } catch (error) {
        console.error('Error loading profile:', error);
        // Use cached data if request fails
        const savedSession = localStorage.getItem('sunshineSession');
        if (savedSession) {
            populateFormFromSession(JSON.parse(savedSession));
        }
    }
}

function populateFormFromSession(session) {
    const user = session.user || {};
    document.getElementById('profileName').value = user.name || '';
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profilePhone').value = user.phone || '';
    document.getElementById('profileCompany').value = user.companyName || '';
}

// ===== SAVE PROFILE =====
window.saveProfile = async function() {
    const saveBtn = document.querySelector('.btn-profile-save');
    const originalText = saveBtn.innerHTML;

    try {
        // Validate required fields
        const name = document.getElementById('profileName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();

        if (!name) {
            showProfileError('Name is required');
            return;
        }

        if (!email) {
            showProfileError('Email is required');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showProfileError('Please enter a valid email address');
            return;
        }

        // Show loading
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const savedSession = localStorage.getItem('sunshineSession');
        if (!savedSession) {
            showProfileError('Session not found. Please login again.');
            return;
        }

        const session = JSON.parse(savedSession);

        // Prepare data
        const profileData = {
            code: session.accessCode,
            clientName: name,
            clientEmail: email,
            clientPhone: document.getElementById('profilePhone').value.trim(),
            companyName: document.getElementById('profileCompany').value.trim(),
            addressLine1: document.getElementById('profileAddress1').value.trim(),
            addressLine2: document.getElementById('profileAddress2').value.trim(),
            city: document.getElementById('profileCity').value.trim(),
            state: document.getElementById('profileState').value.trim(),
            zipCode: document.getElementById('profileZipCode').value.trim()
        };

        // Send to API
        const response = await fetchWithAuth('/api/client/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error saving profile');
        }

        // Update local session
        session.user = {
            ...session.user,
            name: profileData.clientName,
            email: profileData.clientEmail,
            phone: profileData.clientPhone,
            companyName: profileData.companyName
        };
        localStorage.setItem('sunshineSession', JSON.stringify(session));

        // Update header welcome
        const headerWelcome = document.getElementById('headerWelcome');
        if (headerWelcome) {
            headerWelcome.textContent = `Welcome, ${profileData.clientName}!`;
        }

        // Update dropdown info
        updateDropdownUserInfo();

        // Show success and close
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        saveBtn.style.background = '#28a745';

        setTimeout(() => {
            closeProfileModal();
            saveBtn.innerHTML = originalText;
            saveBtn.style.background = '';
            saveBtn.disabled = false;
        }, 1500);

    } catch (error) {
        console.error('Error saving profile:', error);
        showProfileError(error.message || 'Error saving profile. Please try again.');
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
};

function showProfileError(message) {
    // Create or update error element
    let errorEl = document.querySelector('.profile-error-message');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'profile-error-message';
        errorEl.style.cssText = `
            background: #fee2e2;
            color: #dc2626;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        const modalBody = document.querySelector('#profileModal .profile-modal-body');
        if (modalBody) {
            modalBody.insertBefore(errorEl, modalBody.firstChild);
        }
    }

    errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    errorEl.style.display = 'flex';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

// ===== CHANGE ACCESS CODE MODAL =====
window.openChangeCodeModal = function() {
    // Close dropdown first
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) dropdown.classList.remove('show');

    const modal = document.getElementById('changeCodeModal');
    if (!modal) return;

    // Clear form
    document.getElementById('currentCode').value = '';
    document.getElementById('newCode').value = '';
    document.getElementById('confirmCode').value = '';

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Focus on first field
    setTimeout(() => {
        document.getElementById('currentCode').focus();
    }, 100);
};

window.closeChangeCodeModal = function() {
    const modal = document.getElementById('changeCodeModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

// ===== CHANGE ACCESS CODE =====
window.changeAccessCode = async function() {
    const saveBtn = document.querySelector('#changeCodeModal .btn-profile-save');
    const originalText = saveBtn.innerHTML;

    try {
        const currentCode = document.getElementById('currentCode').value.trim();
        const newCode = document.getElementById('newCode').value.trim();
        const confirmCode = document.getElementById('confirmCode').value.trim();

        // Validations
        if (!currentCode || !newCode || !confirmCode) {
            showChangeCodeError('All fields are required');
            return;
        }

        if (!/^\d{4}$/.test(currentCode)) {
            showChangeCodeError('Current code must be a 4-digit number');
            return;
        }

        if (!/^\d{4}$/.test(newCode)) {
            showChangeCodeError('New code must be a 4-digit number');
            return;
        }

        if (newCode !== confirmCode) {
            showChangeCodeError('New codes do not match');
            return;
        }

        if (currentCode === newCode) {
            showChangeCodeError('New code must be different from current code');
            return;
        }

        const savedSession = localStorage.getItem('sunshineSession');
        if (!savedSession) {
            showChangeCodeError('Session not found. Please login again.');
            return;
        }

        const session = JSON.parse(savedSession);

        // Verify current code matches
        if (currentCode !== session.accessCode) {
            showChangeCodeError('Current code is incorrect');
            return;
        }

        // Show loading
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...';

        // Send to API
        const response = await fetchWithAuth('/api/client/change-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentCode: currentCode,
                newCode: newCode
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error changing access code');
        }

        // Update local session with new code
        session.accessCode = newCode;
        localStorage.setItem('sunshineSession', JSON.stringify(session));

        // 🆕 MIGRAR LOCALSTORAGE DO CARRINHO: copiar sessionId do código antigo para o novo
        const oldCartKey = `cartSessionId_${currentCode}`;
        const newCartKey = `cartSessionId_${newCode}`;
        const oldSessionId = localStorage.getItem(oldCartKey);
        if (oldSessionId) {
            localStorage.setItem(newCartKey, oldSessionId);
            localStorage.removeItem(oldCartKey);
            console.log(`🛒 localStorage migrado: ${oldCartKey} → ${newCartKey}`);
        }

        // Show success
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Changed!';
        saveBtn.style.background = '#28a745';

        // 🆕 Mostrar mensagem diferente se carrinho foi migrado
        const cartMessage = data.cartMigrated ? ' Cart items preserved!' : '';

        // Fechar modal primeiro
        setTimeout(() => {
            closeChangeCodeModal();
            saveBtn.innerHTML = originalText;
            saveBtn.style.background = '';
            saveBtn.disabled = false;

            // 🆕 Mostrar toast de sucesso (ao invés de alert)
            if (window.UISystem && typeof UISystem.showToast === 'function') {
                UISystem.showToast('success', `Code changed to ${newCode}!${cartMessage}`, 3000);
            }

            // 🆕 Recarregar página após toast aparecer
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }, 1000);

    } catch (error) {
        console.error('Error changing code:', error);
        showChangeCodeError(error.message || 'Error changing access code. Please try again.');
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
};

function showChangeCodeError(message) {
    let errorEl = document.querySelector('#changeCodeModal .change-code-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'change-code-error';
        errorEl.style.cssText = `
            background: #fee2e2;
            color: #dc2626;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        const form = document.getElementById('changeCodeForm');
        if (form) {
            form.parentNode.insertBefore(errorEl, form);
        }
    }

    errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    errorEl.style.display = 'flex';

    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

// ===== MOBILE PROFILE MENU =====
window.openMobileProfileMenu = function() {
    const menu = document.getElementById('mobileProfileMenu');
    if (!menu) return;

    // Update user info in mobile menu
    updateMobileMenuUserInfo();

    menu.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeMobileProfileMenu = function() {
    const menu = document.getElementById('mobileProfileMenu');
    if (menu) {
        menu.style.display = 'none';
        document.body.style.overflow = '';
    }
};

function updateMobileMenuUserInfo() {
    const savedSession = localStorage.getItem('sunshineSession');
    if (!savedSession) return;

    const session = JSON.parse(savedSession);
    const user = session.user || {};

    const nameEl = document.getElementById('mobileMenuUserName');
    const emailEl = document.getElementById('mobileMenuUserEmail');

    if (nameEl) {
        nameEl.textContent = user.name || 'Client';
    }
    if (emailEl) {
        emailEl.textContent = user.email || 'No email registered';
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Client Profile module loaded');

    // Update dropdown info on load
    setTimeout(() => {
        updateDropdownUserInfo();
    }, 500);

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProfileModal();
            closeChangeCodeModal();
            closeMobileProfileMenu();
        }
    });

    // Restrict code inputs to numbers only
    const codeInputs = document.querySelectorAll('#currentCode, #newCode, #confirmCode');
    codeInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
        });
    });

    // Initialize dark mode from localStorage
    initDarkMode();
});

// ===== DARK MODE =====
window.toggleDarkMode = function() {
    const isDark = document.body.classList.toggle('dark-mode');

    // Save preference
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');

    // Update UI
    updateDarkModeUI(isDark);

    console.log(`🌙 Dark mode ${isDark ? 'enabled' : 'disabled'}`);
};

function initDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    const isDark = savedMode === 'enabled';

    if (isDark) {
        document.body.classList.add('dark-mode');
    }

    updateDarkModeUI(isDark);
}

function updateDarkModeUI(isDark) {
    // Desktop
    const iconDesktop = document.getElementById('darkModeIcon');
    const textDesktop = document.getElementById('darkModeText');

    if (iconDesktop) {
        iconDesktop.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
    if (textDesktop) {
        textDesktop.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }

    // Mobile
    const iconMobile = document.getElementById('darkModeIconMobile');
    const textMobile = document.getElementById('darkModeTextMobile');

    if (iconMobile) {
        iconMobile.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
    if (textMobile) {
        textMobile.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }
}

console.log('📦 client-profile.js loaded');
