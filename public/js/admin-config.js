/**
 * ADMIN-CONFIG.JS - Configurações do Sistema
 * Interface para gerenciar configurações de email e notificações
 */

// ===== ESTADO GLOBAL =====
let currentConfig = null;
let isLoading = false;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Inicializando configurações...');
    
    // Verificar autenticação
    checkAuthentication();
    
    // Carregar configurações
    loadConfiguration();
    
    // Setup form handlers
    setupFormHandlers();
});

// ===== AUTENTICAÇÃO =====
function checkAuthentication() {
    const session = getSession();
    if (!session || !session.token) {
        console.warn('⚠️ Usuário não autenticado');
        window.location.href = '/admin';
        return;
    }
    
    // Atualizar nome do usuário
    const usernameEl = document.getElementById('adminUsername');
    if (usernameEl && session.user) {
        usernameEl.textContent = session.user.username || 'admin';
    }
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

// ===== CARREGAMENTO DE CONFIGURAÇÕES =====
async function loadConfiguration() {
    try {
        setLoading(true);
        
        console.log('📧 Carregando configurações de email...');
        
        const response = await fetch('/api/email-config', {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erro ao carregar configurações');
        }
        
        currentConfig = data.config;
        
        // Atualizar interface
        updateConfigInterface();
        
        // Carregar estatísticas
        await loadStats();
        
        // Mostrar conteúdo
        showContent();
        
        console.log('✅ Configurações carregadas');
        
    } catch (error) {
        console.error('❌ Erro ao carregar configurações:', error);
        showError(error.message);
    } finally {
        setLoading(false);
    }
}

// ===== INTERFACE =====
function updateConfigInterface() {
    if (!currentConfig) {
        // Configuração não existe, limpar formulário
        clearForm();
        return;
    }
    
    // Preencher formulário SMTP
    document.getElementById('smtpHost').value = currentConfig.smtp?.host || '';
    document.getElementById('smtpPort').value = currentConfig.smtp?.port || '';
    document.getElementById('smtpUser').value = currentConfig.smtp?.auth?.user || '';
    // Não preencher senha por segurança
    
    document.getElementById('senderName').value = currentConfig.sender?.name || '';
    document.getElementById('senderEmail').value = currentConfig.sender?.email || '';
    
    // Atualizar destinatários
    updateRecipientsList();
}

function updateRecipientsList() {
    const listEl = document.getElementById('recipientsList');
    
    if (!currentConfig?.notifications?.newSelection?.recipients) {
        listEl.innerHTML = '<p class="no-recipients">Nenhum destinatário configurado</p>';
        return;
    }
    
    const recipients = currentConfig.notifications.newSelection.recipients;
    
    listEl.innerHTML = recipients.map(recipient => `
        <div class="recipient-item">
            <div class="recipient-info">
                <strong>${recipient.name}</strong>
                <span>${recipient.email}</span>
            </div>
            <button onclick="removeRecipient('${recipient.email}')" class="btn-remove">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function clearForm() {
    document.getElementById('smtpConfigForm').reset();
    document.getElementById('recipientsList').innerHTML = '<p class="no-recipients">Nenhum destinatário configurado</p>';
}

// ===== SETUP DE FORMULÁRIOS =====
function setupFormHandlers() {
    // Form de SMTP
    const smtpForm = document.getElementById('smtpConfigForm');
    smtpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSmtpConfig();
    });
    
    // Enter no campo de teste
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
        
        console.log('💾 Salvando configuração SMTP...');
        
        const formData = new FormData(document.getElementById('smtpConfigForm'));
        
        const config = {
            smtp: {
                host: formData.get('host'),
                port: parseInt(formData.get('port')),
                secure: false, // Para porta 587
                auth: {
                    user: formData.get('user'),
                    pass: formData.get('pass')
                }
            },
            sender: {
                name: formData.get('senderName'),
                email: formData.get('senderEmail')
            },
            notifications: currentConfig?.notifications || {
                newSelection: {
                    enabled: true,
                    recipients: []
                },
                selectionConfirmed: {
                    enabled: true,
                    recipients: []
                },
                selectionCancelled: {
                    enabled: false,
                    recipients: []
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
            throw new Error(data.message || 'Erro ao salvar configuração');
        }
        
        currentConfig = data.config;
        
        showNotification('Configuração SMTP salva com sucesso!', 'success');
        
        console.log('✅ Configuração SMTP salva');
        
    } catch (error) {
        console.error('❌ Erro ao salvar SMTP:', error);
        showNotification(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// ===== TESTE DE CONEXÃO =====
async function testConnection() {
    try {
        setLoading(true);
        
        console.log('🔌 Testando conexão SMTP...');
        
        const response = await fetch('/api/email-config/test-connection', {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Conexão SMTP funcionando!', 'success');
            console.log('✅ Conexão SMTP OK');
        } else {
            showNotification(`Erro na conexão: ${data.message}`, 'error');
            console.log('❌ Conexão SMTP falhou:', data.error);
        }
        
    } catch (error) {
        console.error('❌ Erro ao testar conexão:', error);
        showNotification('Erro ao testar conexão', 'error');
    } finally {
        setLoading(false);
    }
}

// ===== TESTE DE EMAIL =====
async function sendTestEmail() {
    try {
        const testEmail = document.getElementById('testEmail').value;
        
        if (!testEmail) {
            showNotification('Digite um email para teste', 'warning');
            return;
        }
        
        setLoading(true);
        
        console.log(`📧 Enviando email de teste para: ${testEmail}`);
        
        const response = await fetch('/api/email-config/test', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ testEmail })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Email de teste enviado para ${testEmail}!`, 'success');
            console.log('✅ Email de teste enviado');
            
            // Atualizar estatísticas
            await loadStats();
        } else {
            showNotification(`Erro ao enviar teste: ${data.error}`, 'error');
            console.log('❌ Falha no teste de email:', data.error);
        }
        
    } catch (error) {
        console.error('❌ Erro no teste de email:', error);
        showNotification('Erro ao enviar email de teste', 'error');
    } finally {
        setLoading(false);
    }
}

// ===== GESTÃO DE DESTINATÁRIOS =====
async function addRecipient(type) {
    try {
        const name = document.getElementById('newRecipientName').value.trim();
        const email = document.getElementById('newRecipientEmail').value.trim();
        
        if (!name || !email) {
            showNotification('Nome e email são obrigatórios', 'warning');
            return;
        }
        
        setLoading(true);
        
        console.log(`👤 Adicionando destinatário: ${name} <${email}>`);
        
        const response = await fetch(`/api/email-config/recipients/${type}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, email })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erro ao adicionar destinatário');
        }
        
        currentConfig = data.config;
        
        // Limpar campos
        document.getElementById('newRecipientName').value = '';
        document.getElementById('newRecipientEmail').value = '';
        
        // Atualizar lista
        updateRecipientsList();
        
        showNotification('Destinatário adicionado com sucesso!', 'success');
        
        console.log('✅ Destinatário adicionado');
        
    } catch (error) {
        console.error('❌ Erro ao adicionar destinatário:', error);
        showNotification(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

async function removeRecipient(email) {
    try {
        if (!confirm(`Remover destinatário ${email}?`)) {
            return;
        }
        
        setLoading(true);
        
        console.log(`🗑️ Removendo destinatário: ${email}`);
        
        const response = await fetch(`/api/email-config/recipients/newSelection/${encodeURIComponent(email)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erro ao remover destinatário');
        }
        
        currentConfig = data.config;
        
        // Atualizar lista
        updateRecipientsList();
        
        showNotification('Destinatário removido com sucesso!', 'success');
        
        console.log('✅ Destinatário removido');
        
    } catch (error) {
        console.error('❌ Erro ao remover destinatário:', error);
        showNotification(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// ===== ESTATÍSTICAS =====
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
        console.error('❌ Erro ao carregar estatísticas:', error);
    }
}

function updateStatsDisplay(stats) {
    document.getElementById('totalEmailsSent').textContent = stats.totalEmailsSent || 0;
    
    const lastEmailEl = document.getElementById('lastEmailSent');
    if (stats.lastEmailSent) {
        const date = new Date(stats.lastEmailSent);
        lastEmailEl.textContent = date.toLocaleDateString('pt-BR');
    } else {
        lastEmailEl.textContent = 'Nunca';
    }
    
    const statusEl = document.getElementById('configStatus');
    if (stats.isConfigured) {
        statusEl.textContent = 'Configurado';
        statusEl.className = 'status-ok';
    } else {
        statusEl.textContent = 'Não configurado';
        statusEl.className = 'status-error';
    }
}

// ===== UTILITÁRIOS =====
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
    // Usar sistema de notificações do app.js se disponível
    if (window.showNotification) {
        window.showNotification(message, type);
    } else {
        alert(`[${type.toUpperCase()}] ${message}`);
    }
}

function logout() {
    localStorage.removeItem('sunshineSession');
    window.location.href = '/admin';
}

console.log('🔧 admin-config.js carregado');