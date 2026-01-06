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
    if (!session || !session.token) {
        console.warn('⚠️ Session not available yet');
        return {
            'Content-Type': 'application/json'
        };
    }
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

        // Carregar contagem de clientes
        loadClientsWithEmailCount();

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

// ===================================
// EXPORTAR CLIENTES CSV
// ===================================

// Exportar clientes CSV
async function exportClientsCSV() {
    try {
        showNotification('Generating CSV...', 'info');

        const response = await fetch('/api/admin/export-clients-csv', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Error downloading CSV');
        }

        // Converter para blob
        const blob = await response.blob();

        // Criar link de download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sunshine-clients.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showNotification('CSV downloaded successfully!', 'success');

    } catch (error) {
        console.error('Error exporting CSV:', error);
        showNotification('Error exporting CSV: ' + error.message, 'error');
    }
}

// Carregar estatística de clientes com email
async function loadClientsWithEmailCount() {
    try {
        const response = await fetch('/api/admin/clients-with-email-count', {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success && document.getElementById('clientsWithEmail')) {
            document.getElementById('clientsWithEmail').textContent = data.count;
        }
    } catch (error) {
        console.error('Error loading clients count:', error);
    }
}

// ===== SYSTEM HEALTH MONITOR =====

// Carregar status do sistema
async function loadSystemHealth() {
    const container = document.getElementById('healthStatusContainer');
    if (!container) return;

    // Verificar se tem sessão válida antes de tentar carregar
    const session = getSession();
    if (!session || !session.token) {
        console.log('⏳ Aguardando autenticação para carregar System Health...');
        container.innerHTML = `
            <div class="health-loading">
                <i class="fas fa-clock"></i>
                <p>Waiting for authentication...</p>
            </div>
        `;
        return;
    }

    // Mostrar loading
    container.innerHTML = `
        <div class="health-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Checking system health...</p>
        </div>
    `;

    try {
        const response = await fetch('/api/system/health', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to fetch system health');
        }

        const health = await response.json();

        // Renderizar cards de status
        renderHealthCards(health);

        // Atualizar timestamp
        updateHealthTimestamp(health.timestamp);

    } catch (error) {
        console.error('Error loading system health:', error);
        container.innerHTML = `
            <div class="health-loading">
                <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
                <p>Failed to load system health</p>
            </div>
        `;
    }
}

// Renderizar cards de status
function renderHealthCards(health) {
    const container = document.getElementById('healthStatusContainer');

    const serviceIcons = {
        mongodb: 'fas fa-database',
        slack: 'fab fa-slack',
        r2: 'fas fa-cloud',
        cde: 'fas fa-server',
        googleDrive: 'fab fa-google-drive'
    };

    const serviceNames = {
        mongodb: 'MongoDB',
        slack: 'Slack Chat',
        r2: 'R2 Storage',
        cde: 'CDE Database',
        googleDrive: 'Google Drive'
    };

    let html = '';

    for (const [serviceName, serviceData] of Object.entries(health.services)) {
        const statusClass = serviceData.status;
        const icon = serviceIcons[serviceName] || 'fas fa-circle';
        const name = serviceNames[serviceName] || serviceName;

        html += `
            <div class="health-card">
                <div class="health-card-header">
                    <div class="health-card-title">
                        <i class="${icon} health-card-icon"></i>
                        ${name}
                    </div>
                    <span class="health-status-badge ${statusClass}">
                        ${statusClass}
                    </span>
                </div>
                <div class="health-card-body">
                    <p class="health-card-message">${serviceData.message}</p>
                    ${renderHealthDetails(serviceData)}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Renderizar detalhes do serviço
function renderHealthDetails(serviceData) {
    let detailsHtml = '<div class="health-card-details">';

    // Response Time
    if (serviceData.responseTime) {
        detailsHtml += `
            <div class="health-card-detail">
                <span class="health-card-detail-label">Response Time:</span>
                <span class="health-card-detail-value">${serviceData.responseTime}</span>
            </div>
        `;
    }

    // Database/Bucket Name
    if (serviceData.database) {
        detailsHtml += `
            <div class="health-card-detail">
                <span class="health-card-detail-label">Database:</span>
                <span class="health-card-detail-value">${serviceData.database}</span>
            </div>
        `;
    }

    if (serviceData.bucket) {
        detailsHtml += `
            <div class="health-card-detail">
                <span class="health-card-detail-label">Bucket:</span>
                <span class="health-card-detail-value">${serviceData.bucket}</span>
            </div>
        `;
    }

    // Team/User info (Slack)
    if (serviceData.data) {
        if (serviceData.data.team) {
            detailsHtml += `
                <div class="health-card-detail">
                    <span class="health-card-detail-label">Workspace:</span>
                    <span class="health-card-detail-value">${serviceData.data.team}</span>
                </div>
            `;
        }
        if (serviceData.data.user) {
            detailsHtml += `
                <div class="health-card-detail">
                    <span class="health-card-detail-label">Bot User:</span>
                    <span class="health-card-detail-value">${serviceData.data.user}</span>
                </div>
            `;
        }
    }

    // Error message
    if (serviceData.error && serviceData.status === 'error') {
        detailsHtml += `
            <div class="health-card-detail">
                <span class="health-card-detail-label">Error:</span>
                <span class="health-card-detail-value" style="color: #ef4444;">${serviceData.error}</span>
            </div>
        `;
    }

    // Note
    if (serviceData.note) {
        detailsHtml += `
            <div class="health-card-detail">
                <span class="health-card-detail-label">Note:</span>
                <span class="health-card-detail-value">${serviceData.note}</span>
            </div>
        `;
    }

    detailsHtml += '</div>';

    return detailsHtml;
}

// Atualizar timestamp da última verificação
function updateHealthTimestamp(timestamp) {
    const element = document.getElementById('healthLastCheck');
    const timeElement = document.getElementById('healthLastCheckTime');

    if (element && timeElement) {
        const date = new Date(timestamp);
        timeElement.textContent = date.toLocaleString();
        element.style.display = 'block';
    }
}

// Refresh system health
async function refreshSystemHealth() {
    const button = document.getElementById('refreshHealthBtn');
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
    }

    await loadSystemHealth();

    if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-sync"></i> Refresh Status';
    }
}

// Função auxiliar para tentar carregar health com retry
function tryLoadSystemHealth(maxAttempts = 5, delay = 1000) {
    let attempts = 0;

    const attemptLoad = () => {
        attempts++;
        const session = getSession();

        if (session && session.token) {
            console.log('✅ Session disponível, carregando System Health...');
            loadSystemHealth();
        } else if (attempts < maxAttempts) {
            console.log(`⏳ Tentativa ${attempts}/${maxAttempts} - aguardando sessão...`);
            setTimeout(attemptLoad, delay);
        } else {
            console.warn('⚠️ Timeout: sessão não disponível após', maxAttempts, 'tentativas');
        }
    };

    attemptLoad();
}

// Carregar health status quando abrir a seção Settings
const originalLoadConfigSection = window.loadConfigSection;
window.loadConfigSection = function() {
    if (typeof originalLoadConfigSection === 'function') {
        originalLoadConfigSection();
    }

    // Tentar carregar system health com retry automático
    setTimeout(() => {
        tryLoadSystemHealth();
    }, 500);
};

// MutationObserver para detectar quando a seção Settings fica visível
const settingsSection = document.getElementById('section-settings');
if (settingsSection) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' &&
                (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {

                const isVisible = settingsSection.classList.contains('active') ||
                                 settingsSection.style.display !== 'none';

                if (isVisible) {
                    console.log('🔍 Settings section ficou visível - carregando System Health...');
                    // Aguardar 1 segundo e então tentar carregar
                    setTimeout(() => {
                        tryLoadSystemHealth();
                    }, 1000);
                }
            }
        });
    });

    observer.observe(settingsSection, {
        attributes: true,
        attributeFilter: ['class', 'style']
    });

    console.log('👁️ MutationObserver configurado para section-settings');
}

console.log('🔧 Configuration observer configured');
console.log('💚 System Health Monitor configured');