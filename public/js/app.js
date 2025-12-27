//public/js/app.js

// DESREGISTRAR SERVICE WORKER - Migração para R2
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Desregistrar todos os service workers existentes
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
            for (let registration of registrations) {
                registration.unregister().then(function (success) {
                    if (success) {
                        console.log('🗑️ Service Worker removido com sucesso');
                    }
                });
            }
        });

        // Limpar todos os caches antigos
        if ('caches' in window) {
            caches.keys().then(function (names) {
                names.forEach(function (name) {
                    caches.delete(name);
                    console.log('🧹 Cache limpo:', name);
                });
            });
        }
    });
}

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
    // Verificar se estamos na página inicial 
    const adminBtn = document.getElementById('adminBtn');
    const clientBtn = document.getElementById('clientBtn');
    const directClientForm = document.getElementById('directClientForm');

    // Botões originais (se existirem - compatibilidade)
    if (adminBtn && clientBtn) {
        adminBtn.addEventListener('click', showAdminLogin);
        clientBtn.addEventListener('click', showClientLogin);
    }

    // NOVO: Formulário direto de acesso do cliente
    if (directClientForm) {
        directClientForm.addEventListener('submit', handleDirectClientLogin);
    }

    // Input de código direto com formatação
    const directClientCodeInput = document.getElementById('directClientCode');
    if (directClientCodeInput) {
        directClientCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        });
    }

    // Forms - verificar se existem antes de adicionar listeners
    if (elements.adminLoginForm) {
        elements.adminLoginForm.addEventListener('submit', handleAdminLogin);
    }

    if (elements.clientLoginForm) {
        // elements.clientLoginForm.addEventListener('submit', handleClientLogin); // COMENTADO - função não existe
    }

    // Input de código do cliente - verificar se existe
    const clientCodeInput = document.getElementById('clientCode');
    if (clientCodeInput) {
        clientCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        });
    }

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

// Mostrar modal de verificação de acesso
function showAccessModal() {
    console.trace('🔴 showAccessModal foi chamado de:'); // ADICIONE ESTA LINHA
    const modal = document.getElementById('accessModal');
    if (modal) {
        modal.style.display = 'flex';
    }
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
        showNotification('Please fill in all fields', 'error');
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

            // 🆕 LIMPAR dados de inatividade da sessão anterior
            localStorage.removeItem('lastActivityTime');
            localStorage.removeItem('sessionStartTime');

            AppState.isLoggedIn = true;
            AppState.userType = 'admin';
            AppState.currentUser = data.user;

            closeModal('adminModal');
            // Skip transition animation, redirect immediately
            redirectToAdmin();

        } else {
            showNotification(data.message || 'Credenciais inválidas', 'error');
        }

    } catch (error) {
        console.error('Erro no login:', error);
        showNotification('Connection error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle login direto do cliente (novo formulário elegante)
async function handleDirectClientLogin(e) {
    // Prevenir comportamento padrão
    if (e) e.preventDefault();

    // Pegar o valor do código
    const codeInput = document.getElementById('directClientCode');
    const code = codeInput ? codeInput.value.trim() : '';

    // PROTEÇÃO ABSOLUTA contra submit vazio/automático
    if (!code || code === '' || code.length === 0) {
        console.log('❌ Submit ignorado - campo vazio');
        return; // Para aqui se não há código
    }

    // Validar formato do código (4 dígitos numéricos)
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
        showNotification('Please enter a valid 4-digit code', 'error');
        return;
    }

    console.log('✅ Processando código:', code);
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
        console.log('Resposta do servidor:', data);  // <-- ADICIONE ESTA LINHA PARA DEBUG

        if (response.ok && data.success) {
            // Salvar sessão
            const session = {
                userType: 'client',
                user: data.client,
                accessCode: code,
                token: data.token,
                allowedCategories: data.allowedCategories,
                expiresAt: Date.now() + (8 * 60 * 60 * 1000) // 8 horas
            };

            localStorage.setItem('sunshineSession', JSON.stringify(session));

            // ✅ LIMPAR escolha de galeria anterior
            localStorage.removeItem('galleryMode');

            // 🆕 LIMPAR dados de inatividade da sessão anterior
            // Isso evita que o inactivity-monitor mostre "Session Expired"
            // ao calcular inatividade com timestamps antigos
            localStorage.removeItem('lastActivityTime');
            localStorage.removeItem('sessionStartTime');

            AppState.isLoggedIn = true;
            AppState.userType = 'client';
            AppState.accessCode = code;
            AppState.currentUser = data.client;

            // Show beautiful transition instead of simple notification
            showLoginTransition(data.client.name);

        } else {
            // Detectar se está bloqueado por diferentes mensagens
            if (data.status === 'blocked' ||
                data.message?.toLowerCase().includes('blocked') ||
                data.message?.toLowerCase().includes('desativado') ||
                data.message?.toLowerCase().includes('expirado') ||
                response.status === 403) {
                showAccessModal();
            } else {
                // Mostrar mensagem de erro apropriada
                showNotification(data.message || 'Invalid access code', 'error');
            }
        }

    } catch (error) {
        console.error('Error verifying access code:', error);
        showNotification('Connection error. Please try again.', 'error');
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
    // Verificar se estamos na página inicial (tem elementos de status)
    const statusElements = {
        systemStatus: document.getElementById('systemStatus'),
        apiStatus: document.getElementById('apiStatus'),
        driveStatus: document.getElementById('driveStatus'),
        dbStatus: document.getElementById('dbStatus')
    };

    // Se não temos os elementos de status, não fazer nada (provavelmente estamos em outra página)
    if (!statusElements.apiStatus || !statusElements.driveStatus || !statusElements.dbStatus) {
        console.log('ℹ️ Elementos de status não encontrados - página sem status dashboard');
        return;
    }

    console.log('🔍 Verificando status do sistema...');

    const statusChecks = [
        { name: 'api', endpoint: '/api/status', element: statusElements.apiStatus },
        { name: 'storage', endpoint: '/api/gallery/structure', element: statusElements.driveStatus },
        { name: 'db', endpoint: '/api/admin/db-status', element: statusElements.dbStatus }
    ];

    for (const check of statusChecks) {
        try {
            if (!check.element) {
                console.log(`⚠️ Elemento não encontrado para: ${check.name}`);
                continue;
            }

            check.element.textContent = 'Verificando...';
            check.element.className = 'status-value status-loading';

            const response = await fetch(check.endpoint);
            const data = await response.json();

            if (response.ok && (data.status === 'OK' || data.success)) {
                check.element.textContent = 'Online';
                check.element.className = 'status-value status-ok';
                console.log(`✅ ${check.name}: Online`);
            } else {
                throw new Error(data.message || 'Serviço indisponível');
            }

        } catch (error) {
            console.error(`❌ Erro ao verificar ${check.name}:`, error);
            if (check.element) {
                check.element.textContent = 'Offline';
                check.element.className = 'status-value status-error';
            }
        }
    }

    console.log('✅ Verificação de status concluída');
}

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

    // Adicionar ao body
    document.body.appendChild(notification);

    // Animação de entrada (de cima para baixo)
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Remover após 4 segundos
    setTimeout(() => {
        notification.classList.remove('show');
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

    //showNotification('Logout successful', 'success');

    setTimeout(() => {
        window.location.href = '/';
    }, 1000);
}

// ===== BEAUTIFUL LOGIN TRANSITION =====
function showLoginTransition(clientName) {
    const transition = document.getElementById('loginTransition');
    const nameElement = document.getElementById('transitionName');

    if (!transition) {
        // Fallback if transition element doesn't exist
        showNotification(`Welcome, ${clientName}!`, 'success');
        setTimeout(() => redirectToClient(), 1000);
        return;
    }

    // Set the client name
    if (nameElement) {
        nameElement.textContent = clientName;
    }

    // Show the transition overlay
    transition.classList.add('active');

    // Reset animations by removing and re-adding classes
    const content = transition.querySelector('.transition-content');
    const loaderBar = transition.querySelector('.loader-bar');

    if (loaderBar) {
        loaderBar.style.animation = 'none';
        loaderBar.offsetHeight; // Trigger reflow
        loaderBar.style.animation = 'loadProgress 1.5s ease forwards 0.2s';
    }

    // Redirect after animation completes - 2 seconds max
    setTimeout(() => {
        redirectToClient();
    }, 2000);
}

// ===== BEAUTIFUL ADMIN LOGIN TRANSITION - DARK THEME =====
function showAdminTransition(adminName) {
    // Create the transition overlay dynamically - Dark gold theme
    const transitionHTML = `
        <div id="adminTransition" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #1a1a1a;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: adminFadeIn 0.4s ease forwards;
        ">
            <div style="
                text-align: center;
                animation: adminSlideUp 0.5s ease 0.1s forwards;
                opacity: 0;
                transform: translateY(10px);
            ">
                <img src="https://images.sunshinecowhides-gallery.com/_assets/LogoToca.png" alt="Sunshine Cowhides" style="
                    width: 140px;
                    height: 140px;
                    border-radius: 50%;
                    margin-bottom: 24px;
                ">
                <div style="margin-bottom: 8px;">
                    <span style="
                        display: block;
                        font-size: 1rem;
                        color: #888;
                        margin-bottom: 4px;
                        font-weight: 400;
                    ">Welcome,</span>
                    <span style="
                        display: block;
                        font-size: 1.8rem;
                        font-weight: 600;
                        color: #d4af37;
                    ">${adminName}</span>
                </div>
                <span style="
                    display: block;
                    font-size: 0.85rem;
                    color: #666;
                    margin-bottom: 28px;
                    font-weight: 500;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                ">Admin Portal</span>
                <div style="
                    width: 180px;
                    height: 3px;
                    background: #333;
                    border-radius: 3px;
                    margin: 0 auto;
                    overflow: hidden;
                ">
                    <div style="
                        width: 0%;
                        height: 100%;
                        background: linear-gradient(90deg, #d4af37, #f4d03f);
                        border-radius: 3px;
                        animation: adminLoadProgress 2.5s ease forwards 0.3s;
                        box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
                    "></div>
                </div>
            </div>
        </div>
        <style>
            @keyframes adminFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes adminSlideUp {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes adminLoadProgress {
                0% { width: 0%; }
                100% { width: 100%; }
            }
        </style>
    `;

    document.body.insertAdjacentHTML('beforeend', transitionHTML);

    // Redirect after animation completes
    setTimeout(() => {
        redirectToAdmin();
    }, 3200);
}

// Expor funções globais necessárias
window.showAdminLogin = showAdminLogin;
window.showClientLogin = showClientLogin;
window.closeModal = closeModal;
window.logout = logout;
window.showLoginTransition = showLoginTransition;