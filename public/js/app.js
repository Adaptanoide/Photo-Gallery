// Estado da aplicação
const AppState = {
    isLoggedIn: false,
    userType: null, // 'admin' ou 'client'
    accessCode: null,
    currentUser: null
};

// Elementos DOM
const elements = {
    adminModal: document.getElementById('adminModal'),
    clientModal: document.getElementById('clientModal'),
    loading: document.getElementById('loading'),
    adminLoginForm: document.getElementById('adminLoginForm'),
    clientLoginForm: document.getElementById('clientLoginForm'),
    systemStatus: document.getElementById('systemStatus'),
    apiStatus: document.getElementById('apiStatus'),
    driveStatus: document.getElementById('driveStatus'),
    dbStatus: document.getElementById('dbStatus')
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    checkSystemStatus();
});

// Configurar event listeners
function setupEventListeners() {
    // Botões principais
    document.getElementById('adminBtn').addEventListener('click', showAdminLogin);
    document.getElementById('clientBtn').addEventListener('click', showClientLogin);
    
    // Forms
    elements.adminLoginForm.addEventListener('submit', handleAdminLogin);
    elements.clientLoginForm.addEventListener('submit', handleClientLogin);
    
    // Input de código do cliente (apenas números)
    const clientCodeInput = document.getElementById('clientCode');
    clientCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });
    
    // Fechar modal clicando fora
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
    
    // ESC para fechar modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// Inicializar aplicação
function initializeApp() {
    console.log('🚀 Sunshine Cowhides - Sistema iniciado');
    
    // Verificar se há sessão ativa
    const savedSession = localStorage.getItem('sunshineSession');
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            if (session.expiresAt > Date.now()) {
                AppState.isLoggedIn = true;
                AppState.userType = session.userType;
                AppState.currentUser = session.user;
                AppState.accessCode = session.accessCode;
                
                // Redirecionar para área apropriada
                if (session.userType === 'admin') {
                    //redirectToAdmin(); //Temporario
                } else {
                    //redirectToClient(); //Temporario
                }
            } else {
                localStorage.removeItem('sunshineSession');
            }
        } catch (error) {
            console.error('Erro ao restaurar sessão:', error);
            localStorage.removeItem('sunshineSession');
        }
    }
}

// Mostrar modal de login admin
function showAdminLogin() {
    elements.adminModal.style.display = 'block';
    document.getElementById('adminUser').focus();
}

// Mostrar modal de login cliente
function showClientLogin() {
    elements.clientModal.style.display = 'block';
    document.getElementById('clientCode').focus();
}

// Fechar modal específico
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fechar todos os modais
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Mostrar/ocultar loading
function showLoading(show = true) {
    elements.loading.classList.toggle('hidden', !show);
}

// Handle login admin
async function handleAdminLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;
    
    if (!username || !password) {
        showNotification('Por favor, preencha todos os campos', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/auth/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Salvar sessão
            const session = {
                userType: 'admin',
                user: data.user,
                token: data.token,
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
            };
            
            localStorage.setItem('sunshineSession', JSON.stringify(session));
            
            AppState.isLoggedIn = true;
            AppState.userType = 'admin';
            AppState.currentUser = data.user;
            
            showNotification('Login realizado com sucesso!', 'success');
            closeModal('adminModal');
            
            setTimeout(() => {
                redirectToAdmin();
            }, 1000);
            
        } else {
            showNotification(data.message || 'Credenciais inválidas', 'error');
        }
        
    } catch (error) {
        console.error('Erro no login:', error);
        showNotification('Erro de conexão. Tente novamente.', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle login cliente
async function handleClientLogin(e) {
    e.preventDefault();
    
    const code = document.getElementById('clientCode').value.trim();
    
    if (!code || code.length !== 4) {
        showNotification('Digite um código válido de 4 dígitos', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/auth/client/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Salvar sessão
            const session = {
                userType: 'client',
                user: data.client,
                accessCode: code,
                allowedCategories: data.allowedCategories,
                expiresAt: Date.now() + (8 * 60 * 60 * 1000) // 8 horas
            };
            
            localStorage.setItem('sunshineSession', JSON.stringify(session));
            
            AppState.isLoggedIn = true;
            AppState.userType = 'client';
            AppState.accessCode = code;
            AppState.currentUser = data.client;
            
            showNotification(`Bem-vindo, ${data.client.name}!`, 'success');
            closeModal('clientModal');
            
            setTimeout(() => {
                redirectToClient();
            }, 1000);
            
        } else {
            showNotification(data.message || 'Código inválido ou expirado', 'error');
        }
        
    } catch (error) {
        console.error('Erro na verificação:', error);
        showNotification('Erro de conexão. Tente novamente.', 'error');
    } finally {
        showLoading(false);
    }
}

// Redirecionar para admin
function redirectToAdmin() {
    window.location.href = '/admin';
}

// Redirecionar para cliente
function redirectToClient() {
    window.location.href = '/client';
}

// Verificar status do sistema
async function checkSystemStatus() {
    const statusChecks = [
        { name: 'api', endpoint: '/api/status', element: elements.apiStatus },
        { name: 'drive', endpoint: '/api/drive/status', element: elements.driveStatus },
        { name: 'db', endpoint: '/api/admin/db-status', element: elements.dbStatus }
    ];
    
    for (const check of statusChecks) {
        try {
            check.element.textContent = 'Verificando...';
            check.element.className = 'status-value status-loading';
            
            const response = await fetch(check.endpoint);
            const data = await response.json();
            
            if (response.ok && data.status === 'OK') {
                check.element.textContent = 'Online';
                check.element.className = 'status-value status-ok';
            } else {
                throw new Error(data.message || 'Serviço indisponível');
            }
            
        } catch (error) {
            console.error(`Erro ao verificar ${check.name}:`, error);
            check.element.textContent = 'Offline';
            check.element.className = 'status-value status-error';
        }
    }
}

// Sistema de notificações
function showNotification(message, type = 'info') {
    // Remover notificação existente
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    // Criar nova notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Adicionar estilos inline (temporário)
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    // Cores por tipo
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Remover após 4 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 4000);
}

// Ícones para notificações
function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || icons.info;
}

// Logout
function logout() {
    localStorage.removeItem('sunshineSession');
    AppState.isLoggedIn = false;
    AppState.userType = null;
    AppState.accessCode = null;
    AppState.currentUser = null;
    
    showNotification('Logout realizado com sucesso', 'success');
    
    setTimeout(() => {
        window.location.href = '/';
    }, 1000);
}

// Expor funções globais necessárias
window.showAdminLogin = showAdminLogin;
window.showClientLogin = showClientLogin;
window.closeModal = closeModal;
window.logout = logout;