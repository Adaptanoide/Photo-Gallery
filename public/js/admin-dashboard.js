//public/js/admin-dashboard.js

/**
 * ADMIN DASHBOARD - SUNSHINE COWHIDES
 * JavaScript principal para área administrativa
 */

class AdminDashboard {
    constructor() {
        this.currentSection = 'dashboard';
        this.isLoading = false;
        this.stats = {};
        this.init();
    }

    // ===== INICIALIZAÇÃO =====
    init() {
        console.log('🎛️ Inicializando Admin Dashboard...');
        this.setupElements();
        this.setupEventListeners();
        this.checkAuthentication();
        this.loadDashboardData();

        // 🆕 Verificar pending requests após 3 segundos
        setTimeout(() => this.checkPendingRequestsAlert(), 3000);

        console.log('✅ Admin Dashboard inicializado');
    }

    setupElements() {
        // Elementos principais
        this.sidebar = document.getElementById('adminSidebar');
        this.sidebarOverlay = document.getElementById('sidebarOverlay');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.adminMain = document.getElementById('adminMain');
        this.pageTitle = document.getElementById('pageTitle');

        // Elementos de usuário
        this.userAvatar = document.getElementById('userAvatar');
        this.userName = document.getElementById('userName');

        // Elementos de navegação
        this.navLinks = document.querySelectorAll('.nav-link');
        this.contentSections = document.querySelectorAll('.content-section');

        // Elementos de loading
        this.loading = document.getElementById('loading');
    }

    setupEventListeners() {
        // Toggle da sidebar (mobile)
        this.sidebarToggle?.addEventListener('click', () => this.toggleSidebar());
        this.sidebarOverlay?.addEventListener('click', () => this.closeSidebar());

        // Navegação da sidebar
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                if (section) {
                    this.navigateToSection(section);
                }
            });
        });

        // Responsive
        window.addEventListener('resize', () => this.handleResize());

        // Atualização automática (a cada 30 segundos)
        setInterval(() => this.refreshStats(), 30000);
    }

    // ===== AUTENTICAÇÃO =====
    checkAuthentication() {
        const sessionData = localStorage.getItem('sunshineSession');
        if (!sessionData) {
            console.log('❌ Sessão não encontrada, redirecionando...');
            window.location.href = '/';
            return;
        }

        try {
            const session = JSON.parse(sessionData);

            // Verificar se sessão não expirou
            if (session.expiresAt <= Date.now()) {
                console.log('❌ Sessão expirada, redirecionando...');
                localStorage.removeItem('sunshineSession');
                window.location.href = '/';
                return;
            }

            // Verificar se é admin
            if (session.userType !== 'admin') {
                console.log('❌ Acesso negado - não é admin, redirecionando...');
                window.location.href = '/';
                return;
            }

            // Verificar se tem token
            if (!session.token) {
                console.log('❌ Token não encontrado na sessão, redirecionando...');
                window.location.href = '/';
                return;
            }

            console.log('✅ Sessão admin válida encontrada');
            this.verifyToken(session.token);

        } catch (error) {
            console.error('❌ Erro ao ler sessão:', error);
            localStorage.removeItem('sunshineSession');
            window.location.href = '/';
        }
    }

    // SUBSTITUA as funções verifyToken e setUserInfo no admin-dashboard.js por estas:

    async verifyToken(token) {
        try {
            const response = await fetch('/api/auth/verify-token', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success && data.user) {
                // Salva o role na sessão também
                const sessionData = JSON.parse(localStorage.getItem('sunshineSession'));
                if (sessionData) {
                    sessionData.user.role = data.user.role;
                    localStorage.setItem('sunshineSession', JSON.stringify(sessionData));
                }

                this.setUserInfo(data.user);
            } else {
                throw new Error('Token inválido');
            }

        } catch (error) {
            console.error('❌ Erro na verificação do token:', error);
            localStorage.removeItem('adminToken');
            window.location.href = '/';
        }
    }

    setUserInfo(user) {
        console.log(`👤 Usuário logado: ${user.username} (Role: ${user.role})`);

        // Atualizar avatar com primeira letra
        if (this.userAvatar) {
            this.userAvatar.textContent = user.username.charAt(0).toUpperCase();
        }

        // Atualizar nome
        if (this.userName) {
            this.userName.textContent = user.username;
        }
        // FIM - removido verificação de super_admin
    }

    // ===== NAVEGAÇÃO =====
    navigateToSection(section) {
        console.log(`📍 Navegando para: ${section}`);

        // Atualizar link ativo
        this.navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.section === section) {
                link.classList.add('active');
            }
        });

        // Atualizar seção de conteúdo
        this.contentSections.forEach(contentSection => {
            contentSection.style.display = 'none';
            if (contentSection.id === `section-${section}`) {
                contentSection.style.display = 'block';
            }
        });

        // ===== CORREÇÃO: REFRESH AUTOMÁTICO COM RETRY INTELIGENTE =====
        if (section === 'clients') {
            const doRefresh = () => {
                let attempts = 0;
                const maxAttempts = 10; // 10 tentativas = 5 segundos total

                const tryRefresh = () => {
                    attempts++;

                    if (window.adminClients && window.adminClients.refreshData) {
                        console.log('🔄 Auto-refresh: Client Management data...');
                        window.adminClients.refreshData();
                        return; // ✅ SUCESSO
                    }

                    if (attempts < maxAttempts) {
                        console.log(`⏳ Auto-refresh attempt ${attempts}/${maxAttempts} - waiting for adminClients...`);
                        setTimeout(tryRefresh, 500); // Tentar novamente em 500ms
                    } else {
                        console.warn('⚠️ Auto-refresh failed - adminClients not available after 5 seconds');
                    }
                };

                tryRefresh();
            };

            setTimeout(doRefresh, 100); // ✅ INICIAR MAIS CEDO
        }

        // Fechar sidebar em mobile após navegação

        // Load feedback when navigating to feedback section
        if (section === 'feedback' && window.initFeedbackSection) {
            setTimeout(() => window.initFeedbackSection(), 100);
        }

        // Atualizar título da página
        const titles = {
            dashboard: 'Dashboard',
            clients: 'Client Management',
            pricing: 'Price Management',
            selections: 'Selection Management',
            'special-selections': 'Special Selections', // NOVO
            reports: 'Reports',
            marketing: 'Email Marketing',
            'inventoryMonitor': 'Inventory Status Monitor',
            feedback: 'Client Feedback',
            settings: 'Settings'
        };

        if (this.pageTitle) {
            this.pageTitle.textContent = titles[section] || 'Dashboard';
        }

        // Atualizar URL sem recarregar
        history.pushState(null, '', `/admin#${section}`);

        // Fechar sidebar em mobile
        if (window.innerWidth <= 1024) {
            this.closeSidebar();
        }

        // Carregar dados específicos da seção
        this.loadSectionData(section);
        this.currentSection = section;
    }

    async loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'clients':
                // TODO: Implementar carregamento de dados de clientes
                break;
            case 'pricing': // ← NOVA SEÇÃO
                // A inicialização do AdminPricing é automática via observer
                console.log('💰 Seção de preços ativada');
                break;
            case 'products':
                // TODO: Implementar carregamento de dados de produtos
                break;
            case 'selections':
                // TODO: Implementar carregamento de dados de seleções
                break;
            case 'special-selections':
                console.log('⭐ Seção de seleções especiais ativada');
                if (window.adminSpecialSelections) {
                    console.log('✅ AdminSpecialSelections já existe, usando instância atual');
                    window.adminSpecialSelections.refreshData();  // ← LINHA NOVA AQUI
                } else if (typeof window.initSpecialSelections === 'function') {
                    console.log('🎯 Inicializando AdminSpecialSelections via função global');
                    window.adminSpecialSelections = window.initSpecialSelections();
                } else {
                    console.warn('⚠️ AdminSpecialSelections não disponível');
                }
                break;
            case 'inventoryMonitor':
                console.log('📊 Inventory Monitor ativado - disparando scan...');
                if (window.monitor) {
                    await window.monitor.scan();
                } else {
                    console.warn('⚠️ Monitor não disponível');
                }
                break;
            default:
                break;
        }
    }

    // ===== SIDEBAR MOBILE =====
    toggleSidebar() {
        if (this.sidebar.classList.contains('open')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar() {
        this.sidebar.classList.add('open');
        this.sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeSidebar() {
        this.sidebar.classList.remove('open');
        this.sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    handleResize() {
        if (window.innerWidth > 1024) {
            this.closeSidebar();
        }
    }

    async loadDashboardData() {
        // FLAG TEMPORÁRIA - mude para false quando quiser ver o dashboard real
        const IN_DEVELOPMENT = true;

        if (IN_DEVELOPMENT) {
            // Pega a div do dashboard e substitui temporariamente o conteúdo
            const dashboardSection = document.getElementById('section-dashboard');
            if (dashboardSection) {
                // Guarda o HTML original (opcional, caso queira restaurar via console)
                dashboardSection.dataset.originalHtml = dashboardSection.innerHTML;

                // Mostra a mensagem de desenvolvimento
                dashboardSection.innerHTML = `
                <h2>Dashboard - In Development</h2>
                <p>This section will be implemented in the next phase.</p>
            `;
            }
            return; // Para aqui, não executa o resto
        }

        // TODO O SEU CÓDIGO ORIGINAL CONTINUA AQUI (não mude nada)
        try {
            this.showLoading();

            // Carregar estatísticas em paralelo
            const [stats, recentSelections, popularProducts] = await Promise.all([
                this.fetchStats(),
                this.fetchRecentSelections(),
                this.fetchPopularProducts()
            ]);

            // Atualizar cards de estatísticas
            this.updateStatsCards(stats);

            // Atualizar tabelas
            this.updateRecentSelectionsTable(recentSelections);
            this.updatePopularProductsTable(popularProducts);

            // Atualizar badges na sidebar
            //this.updateSidebarBadges(stats);

            console.log('✅ Dados do dashboard carregados');

        } catch (error) {
            console.error('❌ Erro ao carregar dashboard:', error);
            this.showError('Erro ao carregar dados do dashboard');
        } finally {
            this.hideLoading();
        }
    }

    async fetchStats() {
        try {
            const sessionData = localStorage.getItem('sunshineSession');
            if (!sessionData) {
                return null; // ✅ Retorna null se não há sessão
            }
            const session = JSON.parse(sessionData);
            if (!session || !session.token) {
                return null; // ✅ Retorna null se sessão inválida
            }
            const token = session.token;
            const response = await fetch('/api/cart/stats/system', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.stats = data.data;
                return data.data;
            } else {
                throw new Error(data.message || 'Erro ao buscar estatísticas');
            }

        } catch (error) {
            console.error('❌ Erro ao buscar estatísticas:', error);

            // Dados de fallback para desenvolvimento
            return {
                activeCarts: 0,
                inactiveCarts: 0,
                availableProducts: 0,
                reservedProducts: 0,
                soldProducts: 0,
                totalItemsInCarts: 0
            };
        }
    }

    async fetchRecentSelections() {
        try {
            const token = localStorage.getItem('adminToken');
            // TODO: Implementar API de seleções recentes
            // const response = await fetch('/api/admin/recent-selections', {
            //     headers: { 'Authorization': `Bearer ${token}` }
            // });

            // Dados de exemplo para desenvolvimento
            return [
                {
                    clientName: 'João Silva',
                    clientCode: '7064',
                    totalItems: 3,
                    createdAt: new Date(),
                    status: 'pending'
                }
            ];

        } catch (error) {
            console.error('❌ Erro ao buscar seleções recentes:', error);
            return [];
        }
    }

    async fetchPopularProducts() {
        try {
            const token = localStorage.getItem('adminToken');
            // TODO: Implementar API de produtos populares

            // Dados de exemplo para desenvolvimento
            return [
                {
                    fileName: 'couro_001.jpg',
                    category: 'Colombian Cowhides',
                    reservations: 5,
                    lastReservation: new Date(),
                    status: 'available'
                }
            ];

        } catch (error) {
            console.error('❌ Erro ao buscar produtos populares:', error);
            return [];
        }
    }

    // ===== ATUALIZAÇÃO DE UI =====
    updateStatsCards(stats) {
        // Total de clientes ativos (aproximação)
        const totalClientsEl = document.getElementById('totalClients');
        if (totalClientsEl) {
            totalClientsEl.textContent = stats.activeCarts || '0';
        }

        // Produtos disponíveis
        const availableProductsEl = document.getElementById('availableProducts');
        if (availableProductsEl) {
            availableProductsEl.textContent = stats.availableProducts || '0';
        }

        // Produtos reservados
        const reservedProductsEl = document.getElementById('reservedProducts');
        if (reservedProductsEl) {
            reservedProductsEl.textContent = stats.reservedProducts || '0';
        }

        // Seleções pendentes (aproximação)
        const pendingSelectionsEl = document.getElementById('pendingSelections');
        if (pendingSelectionsEl) {
            pendingSelectionsEl.textContent = stats.activeCarts || '0';
        }
    }

    updateRecentSelectionsTable(selections) {
        const tableBody = document.getElementById('recentSelectionsTable');
        if (!tableBody) return;

        if (selections.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <i class="fas fa-inbox"></i>
                        Nenhuma seleção encontrada
                    </td>
                </tr>
            `;
            return;
        }

        const rows = selections.map(selection => `
            <tr>
                <td>${selection.clientName}</td>
                <td><strong>${selection.clientCode}</strong></td>
                <td>${selection.totalItems} itens</td>
                <td>${this.formatDate(selection.createdAt)}</td>
                <td>
                    <span class="status-badge status-${selection.status}">
                        ${this.getStatusText(selection.status)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;">
                        <i class="fas fa-eye"></i>
                        Ver
                    </button>
                </td>
            </tr>
        `).join('');

        tableBody.innerHTML = rows;
    }

    updatePopularProductsTable(products) {
        const tableBody = document.getElementById('popularProductsTable');
        if (!tableBody) return;

        if (products.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <i class="fas fa-inbox"></i>
                        Nenhum produto encontrado
                    </td>
                </tr>
            `;
            return;
        }

        const rows = products.map(product => `
            <tr>
                <td><strong>${product.fileName}</strong></td>
                <td>${product.category}</td>
                <td>${product.reservations} vezes</td>
                <td>${this.formatDate(product.lastReservation)}</td>
                <td>
                    <span class="status-badge status-${product.status}">
                        ${this.getStatusText(product.status)}
                    </span>
                </td>
            </tr>
        `).join('');

        tableBody.innerHTML = rows;
    }

    updateSidebarBadges(stats) {
        // Badge de clientes (se houver novos)
        const clientsBadge = document.getElementById('clientsBadge');
        if (clientsBadge && stats.activeCarts > 0) {
            clientsBadge.textContent = stats.activeCarts;
            clientsBadge.style.display = 'block';
        }

        // Badge de seleções (se houver pendentes)
        const selectionsBadge = document.getElementById('selectionsBadge');
        if (selectionsBadge && stats.activeCarts > 0) {
            selectionsBadge.textContent = stats.activeCarts;
            selectionsBadge.style.display = 'block';
        }
    }

    // ===== UTILITÁRIOS =====
    formatDate(date) {
        if (!date) return '-';

        const d = new Date(date);
        return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getStatusText(status) {
        const statusTexts = {
            available: 'Disponível',
            reserved: 'Reservado',
            sold: 'Vendido',
            pending: 'Pendente',
            confirmed: 'Confirmado',
            finalized: 'Finalizado'
        };

        return statusTexts[status] || status;
    }

    async refreshStats() {
        if (this.currentSection === 'dashboard' && !this.isLoading) {
            console.log('🔄 Atualizando estatísticas...');
            const stats = await this.fetchStats();
            this.updateStatsCards(stats);
            //this.updateSidebarBadges(stats);
        }
    }

    // ===== LOADING E FEEDBACK =====
    showLoading() {
        this.isLoading = true;
        if (this.loading) {
            this.loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        this.isLoading = false;
        if (this.loading) {
            this.loading.classList.add('hidden');
        }
    }

    showError(message) {
        console.error('❌ Erro:', message);
        // TODO: Implementar toast/notification system
        alert(message);
    }

    showSuccess(message) {
        console.log('✅ Sucesso:', message);
        // TODO: Implementar toast/notification system
        alert(message);
    }

    // ===== PENDING REQUESTS ALERT =====
    async checkPendingRequestsAlert() {
        try {
            // Buscar token de admin (mesmo método que admin-clients.js)
            const sessionData = localStorage.getItem('sunshineSession');
            if (!sessionData) return;

            const session = JSON.parse(sessionData);
            const token = session.token;
            if (!token) return;

            console.log('🔔 Checking for pending requests...');

            // Buscar contagem de pending requests
            const response = await fetch('/api/register/admin/count', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            console.log('🔔 Pending requests response:', data);

            if (data.success && data.count > 0) {
                console.log(`🔔 Found ${data.count} pending request(s)! Showing alert...`);
                this.showPendingRequestsAlert(data.count);
            } else {
                console.log('🔔 No pending requests found');
            }
        } catch (error) {
            console.error('❌ Error checking pending requests:', error);
        }
    }

    showPendingRequestsAlert(count) {
        // Evitar mostrar múltiplos alertas
        if (document.getElementById('pendingRequestsAlertOverlay')) return;

        const plural = count > 1 ? 's' : '';
        const alertHtml = `
            <div id="pendingRequestsAlertOverlay" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            ">
                <div style="
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 450px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 100px rgba(245, 158, 11, 0.3);
                    border: 2px solid #f59e0b;
                    animation: bounceIn 0.5s ease;
                ">
                    <div style="
                        width: 80px;
                        height: 80px;
                        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 20px;
                        animation: pulse 2s infinite;
                    ">
                        <i class="fas fa-user-clock" style="font-size: 36px; color: white;"></i>
                    </div>

                    <h2 style="
                        color: #fff;
                        font-size: 24px;
                        margin-bottom: 10px;
                        font-weight: 600;
                    ">New Client Request${plural}!</h2>

                    <p style="
                        color: #94a3b8;
                        font-size: 16px;
                        margin-bottom: 25px;
                        line-height: 1.5;
                    ">
                        You have <span style="color: #f59e0b; font-weight: bold; font-size: 20px;">${count}</span> pending client registration${plural} waiting for review.
                    </p>

                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button onclick="window.adminDashboard.dismissPendingAlert()" style="
                            background: transparent;
                            border: 2px solid #475569;
                            color: #94a3b8;
                            padding: 12px 24px;
                            border-radius: 10px;
                            font-size: 14px;
                            cursor: pointer;
                            transition: all 0.2s;
                        " onmouseover="this.style.borderColor='#64748b'; this.style.color='#fff';"
                           onmouseout="this.style.borderColor='#475569'; this.style.color='#94a3b8';">
                            Later
                        </button>

                        <button onclick="window.adminDashboard.goToPendingRequests()" style="
                            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                            border: none;
                            color: white;
                            padding: 12px 28px;
                            border-radius: 10px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            transition: all 0.2s;
                            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
                        " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(245, 158, 11, 0.6)';"
                           onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 15px rgba(245, 158, 11, 0.4)';">
                            <i class="fas fa-arrow-right"></i>
                            View Requests
                        </button>
                    </div>
                </div>
            </div>

            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes bounceIn {
                    0% { transform: scale(0.3); opacity: 0; }
                    50% { transform: scale(1.05); }
                    70% { transform: scale(0.95); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
                    70% { box-shadow: 0 0 0 20px rgba(245, 158, 11, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', alertHtml);
        console.log(`🔔 Showing pending requests alert: ${count} request${plural}`);
    }

    dismissPendingAlert() {
        const overlay = document.getElementById('pendingRequestsAlertOverlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => overlay.remove(), 300);
        }
    }

    goToPendingRequests() {
        // Fechar alerta
        this.dismissPendingAlert();

        // Navegar para seção de clientes
        this.navigateToSection('clients');

        // Aguardar carregamento e abrir modal de pending requests
        setTimeout(() => {
            if (window.adminClients && typeof window.adminClients.openPendingRequestsModal === 'function') {
                window.adminClients.openPendingRequestsModal();
            } else {
                // Fallback: clicar no botão de pending requests
                const btn = document.getElementById('btnPendingRequests');
                if (btn) btn.click();
            }
        }, 500);
    }
}

// ===== LOGOUT FUNCTION =====
function logout() {
    console.log('🚪 Fazendo logout...');
    localStorage.removeItem('adminToken');
    window.location.href = '/';
}

function openProfileModal() {
    console.log('Opening profile modal...');

    // Get username from header
    const userName = document.getElementById('userName').textContent;

    // Update in modal
    const modalUsername = document.getElementById('modalUsername');
    if (modalUsername) {
        modalUsername.textContent = userName;
    }

    // Open modal
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeProfileModal() {
    console.log('Closing profile modal...');

    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Clear form
    const form = document.getElementById('changePasswordForm');
    if (form) {
        form.reset();
    }
}

// ===== FUNCTION TO PROCESS PASSWORD CHANGE =====
function handleChangePassword(event) {
    event.preventDefault();

    console.log('Processing password change...');

    // Get field values
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Simple validations
    if (!currentPassword || !newPassword || !confirmPassword) {
        UISystem.showToast('error', 'Please fill all fields');
        return;
    }

    if (newPassword !== confirmPassword) {
        UISystem.showToast('error', 'New password and confirmation do not match');
        return;
    }

    if (currentPassword === newPassword) {
        UISystem.showToast('warning', 'New password must be different from current password');
        return;
    }

    // If all validations pass, call API function
    console.log('Validations OK! Sending to backend...');
    changePasswordAPI(currentPassword, newPassword);
}

// ===== FUNCTION TO CALL API =====
async function changePasswordAPI(currentPassword, newPassword) {
    try {
        // Get token from session
        const sessionData = localStorage.getItem('sunshineSession');
        if (!sessionData) {
            UISystem.showToast('error', 'Session not found. Please login again.');
            return;
        }

        const session = JSON.parse(sessionData);
        const token = session.token;

        console.log('Sending request to backend...');

        // Show processing toast
        UISystem.showToast('info', 'Processing password change...', 0);

        // Make API call
        const response = await fetch('/api/admin/profile/change-password', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword: currentPassword,
                newPassword: newPassword
            })
        });

        const data = await response.json();

        // Remove processing toast
        const existingToast = document.querySelector('.ui-toast');
        if (existingToast) existingToast.remove();

        if (!data.success) {
            throw new Error(data.message || 'Error changing password');
        }

        console.log('Password changed successfully!');

        // Show success
        UISystem.showToast('success', 'Password changed successfully!');

        // Clear form
        document.getElementById('changePasswordForm').reset();

        // Close modal after 2 seconds
        setTimeout(() => {
            closeProfileModal();
        }, 2000);

    } catch (error) {
        console.error('Error:', error);

        // Remove processing toast
        const existingToast = document.querySelector('.ui-toast');
        if (existingToast) existingToast.remove();

        // Show error
        UISystem.showToast('error', error.message || 'Error processing request');
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se estamos na página admin
    if (document.body.classList.contains('admin-body')) {
        window.adminDashboard = new AdminDashboard();

        // Detectar seção da URL
        const hash = window.location.hash.substring(1);
        if (hash) {
            setTimeout(() => {
                window.adminDashboard.navigateToSection(hash);
            }, 100);
        }

        // Conectar formulário de senha
        const changePasswordForm = document.getElementById('changePasswordForm');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', handleChangePassword);
            console.log('✅ Formulário de senha conectado');
        }
    }
});

// ===== EXPORTS =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminDashboard;
}