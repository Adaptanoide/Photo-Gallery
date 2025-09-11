//public/js/admin-config.js - English Translation

/**
 * ADMIN-CONFIG.JS - System Configuration
 * Interface for managing email and notification settings
 */

// ===== GLOBAL STATE =====
let currentConfig = null;
let isLoading = false;

// ===== AUTHENTICATION =====
function checkAuthentication() {
    const session = getSession();
    if (!session || !session.token) {
        console.warn('⚠️ User not authenticated');
        // window.location.href = '/admin';  // COMENTAR
        return false;
    }
    return true;
}

function getSession() {
    const saved = localStorage.getItem('sunshineSession');
    return saved ? JSON.parse(saved) : null;
}

function getAuthHeaders() {
    const session = getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
    };
}

// ===== CONFIGURATION LOADING =====
async function loadConfiguration() {
    try {
        setLoading(true);

        console.log('📧 Loading email configuration...');

        const response = await fetch('/api/email-config', {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error loading configuration');
        }

        currentConfig = data.config;

        // Update interface
        updateConfigInterface();

        // Load statistics
        await loadStats();

        // Show content
        showContent();

        console.log('✅ Configuration loaded');

    } catch (error) {
        console.error('❌ Error loading configuration:', error);
        showError(error.message);
    } finally {
        setLoading(false);
    }
}

// ===== INTERFACE =====
function updateConfigInterface() {
    if (!currentConfig) {
        // Configuration doesn't exist, clear form
        clearForm();
        return;
    }

    // Fill SMTP form
    document.getElementById('smtpHost').value = currentConfig.smtp?.host || '';
    document.getElementById('smtpPort').value = currentConfig.smtp?.port || '';
    document.getElementById('smtpUser').value = currentConfig.smtp?.auth?.user || '';
    // Don't fill password for security

    document.getElementById('senderName').value = currentConfig.sender?.name || '';
    document.getElementById('senderEmail').value = currentConfig.sender?.email || '';

    // Update recipients list
    updateRecipientsList();
}

function updateRecipientsList() {
    const listEl = document.getElementById('recipientsList');

    if (!currentConfig?.notifications?.newSelection?.recipients) {
        listEl.innerHTML = '<p class="no-recipients">No recipients configured</p>';
        return;
    }

    const recipients = currentConfig.notifications.newSelection.recipients;

    listEl.innerHTML = recipients.map(recipient => `
        <div class="recipient-item">
            <div class="recipient-info">
                <strong>${recipient.name}</strong>
                <span>${recipient.email}</span>
            </div>
            <button onclick="removeRecipient('${recipient.email}')" class="btn-remove" title="Remove recipient">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function clearForm() {
    document.getElementById('smtpConfigForm').reset();
    document.getElementById('recipientsList').innerHTML = '<p class="no-recipients">No recipients configured</p>';
}

// ===== FORM SETUP =====
function setupFormHandlers() {
    // SMTP form
    const smtpForm = document.getElementById('smtpConfigForm');
    smtpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSmtpConfig();
    });

    // Enter key in test field
    const testEmailField = document.getElementById('testEmail');
    testEmailField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendTestEmail();
        }
    });
}

// ===== SMTP CONFIGURATION =====
async function saveSmtpConfig() {
    try {
        setLoading(true);

        console.log('💾 Saving SMTP configuration...');

        const formData = new FormData(document.getElementById('smtpConfigForm'));

        const config = {
            smtp: {
                host: formData.get('host'),
                port: parseInt(formData.get('port')),
                secure: false, // For port 587
                auth: {
                    user: formData.get('user'),
                    pass: formData.get('pass')
                }
            },
            sender: {
                name: formData.get('senderName'),
                email: formData.get('senderEmail')
            },
            notifications: {
                newSelection: {
                    enabled: true,
                    recipients: currentConfig?.notifications?.newSelection?.recipients || []
                },
                selectionConfirmed: {
                    enabled: true,
                    recipients: currentConfig?.notifications?.selectionConfirmed?.recipients || []
                },
                selectionCancelled: {
                    enabled: false,
                    recipients: currentConfig?.notifications?.selectionCancelled?.recipients || []
                }
            }
        };

        const response = await fetch('/api/email-config', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(config)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error saving configuration');
        }

        currentConfig = data.config;

        showNotification('SMTP configuration saved successfully!', 'success');

        console.log('✅ SMTP configuration saved');

    } catch (error) {
        console.error('❌ Error saving SMTP:', error);
        showNotification(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// ===== CONNECTION TEST =====
async function testConnection() {
    try {
        setLoading(true);

        console.log('🔌 Testing SMTP connection...');

        const response = await fetch('/api/email-config/test-connection', {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showNotification('SMTP connection working!', 'success');
            console.log('✅ SMTP connection OK');
        } else {
            showNotification(`Connection error: ${data.message}`, 'error');
            console.log('❌ SMTP connection failed:', data.error);
        }

    } catch (error) {
        console.error('❌ Error testing connection:', error);
        showNotification('Error testing connection', 'error');
    } finally {
        setLoading(false);
    }
}

// ===== EMAIL TEST =====
async function sendTestEmail() {
    try {
        const testEmail = document.getElementById('testEmail').value;

        if (!testEmail) {
            showNotification('Enter an email for testing', 'warning');
            return;
        }

        setLoading(true);

        console.log(`📧 Sending test email to: ${testEmail}`);

        const response = await fetch('/api/email-config/test', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ testEmail })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`Test email sent to ${testEmail}!`, 'success');
            console.log('✅ Test email sent');

            // Update statistics
            await loadStats();
        } else {
            showNotification(`Error sending test: ${data.error}`, 'error');
            console.log('❌ Test email failed:', data.error);
        }

    } catch (error) {
        console.error('❌ Error in email test:', error);
        showNotification('Error sending test email', 'error');
    } finally {
        setLoading(false);
    }
}

// ===== RECIPIENT MANAGEMENT =====
async function addRecipient(type) {
    try {
        const name = document.getElementById('newRecipientName').value.trim();
        const email = document.getElementById('newRecipientEmail').value.trim();

        if (!name || !email) {
            showNotification('Name and email are required', 'warning');
            return;
        }

        setLoading(true);

        console.log(`👤 Adding recipient: ${name} <${email}>`);

        const response = await fetch(`/api/email-config/recipients/${type}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, email })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error adding recipient');
        }

        currentConfig = data.config;

        // Clear fields
        document.getElementById('newRecipientName').value = '';
        document.getElementById('newRecipientEmail').value = '';

        // Update list
        updateRecipientsList();

        showNotification('Recipient added successfully!', 'success');

        console.log('✅ Recipient added');

    } catch (error) {
        console.error('❌ Error adding recipient:', error);
        showNotification(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

async function removeRecipient(email) {
    try {
        if (!confirm(`Remove recipient ${email}?`)) {
            return;
        }

        setLoading(true);

        console.log(`🗑️ Removing recipient: ${email}`);

        const response = await fetch(`/api/email-config/recipients/newSelection/${encodeURIComponent(email)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error removing recipient');
        }

        currentConfig = data.config;

        // Update list
        updateRecipientsList();

        showNotification('Recipient removed successfully!', 'success');

        console.log('✅ Recipient removed');

    } catch (error) {
        console.error('❌ Error removing recipient:', error);
        showNotification(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// ===== STATISTICS =====
async function loadStats() {
    try {
        const response = await fetch('/api/email-config/stats', {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            updateStatsDisplay(data.stats);
        }

    } catch (error) {
        console.error('❌ Error loading statistics:', error);
    }
}

function updateStatsDisplay(stats) {
    document.getElementById('totalEmailsSent').textContent = stats.totalEmailsSent || 0;

    const lastEmailEl = document.getElementById('lastEmailSent');
    if (stats.lastEmailSent) {
        const date = new Date(stats.lastEmailSent);
        lastEmailEl.textContent = date.toLocaleDateString('en-US');
    } else {
        lastEmailEl.textContent = 'Never';
    }

    const statusEl = document.getElementById('configStatus');
    if (stats.isConfigured) {
        statusEl.textContent = 'Configured';
        statusEl.className = 'status-ok';
    } else {
        statusEl.textContent = 'Not configured';
        statusEl.className = 'status-error';
    }
}

// ===== UTILITIES =====
function setLoading(loading) {
    isLoading = loading;

    const loadingEl = document.getElementById('configLoading');
    const contentEl = document.getElementById('configContent');

    if (loading) {
        loadingEl.style.display = 'block';
        contentEl.style.display = 'none';
    } else {
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
    }
}

function showContent() {
    document.getElementById('configLoading').style.display = 'none';
    document.getElementById('configError').style.display = 'none';
    document.getElementById('configContent').style.display = 'block';
}

function showError(message) {
    document.getElementById('configLoading').style.display = 'none';
    document.getElementById('configContent').style.display = 'none';
    document.getElementById('configError').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function showNotification(message, type = 'info') {
    // Use app.js notification system if available
    if (window.showNotification && window.showNotification !== showNotification) {
        window.showNotification(message, type);
    } else {
        // Simple fallback
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(`[${type.toUpperCase()}] ${message}`);
    }
}

function logout() {
    localStorage.removeItem('sunshineSession');
    localStorage.removeItem('adminToken');  // Adicionar esta linha também
    window.location.href = '/admin';  // DESCOMENTAR esta linha
}

console.log('🔧 admin-config.js loaded');

// ===== GLOBAL INITIALIZATION =====
let adminConfig = null;

// Initialize when settings section is activated
document.addEventListener('DOMContentLoaded', () => {
    // Observe changes in active section
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const section = document.getElementById('section-settings');
                if (section && section.style.display !== 'none' && !adminConfig) {
                    // Settings section was activated
                    console.log('🔧 Settings section activated - initializing...');
                    adminConfig = true;

                    // Remove original DOMContentLoaded event listener and execute initialization
                    checkAuthentication();
                    loadConfiguration();
                    setupFormHandlers();
                }
            }
        });
    });

    // Inicializar Settings quando ficar visível
    const settingsSection = document.getElementById('section-settings');
    if (settingsSection) {
        if (settingsSection.style.display !== 'none') {
            // Verificar se tem QUALQUER sessão
            const hasSession = localStorage.getItem('sunshineSession') ||
                localStorage.getItem('adminToken');

            if (hasSession) {
                console.log('🔧 Settings section already visible - initializing...');
                // NÃO chamar checkAuthentication - causa problemas
                loadConfiguration();
                setupFormHandlers();
            }
        }
    }
});

console.log('🔧 Configuration observer configured');