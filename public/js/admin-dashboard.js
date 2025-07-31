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

    async verifyToken(token) {
        try {
            const response = await fetch('/api/auth/verify-token', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success && data.user) {
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
        console.log(`👤 Usuário logado: ${user.username}`);

        // Atualizar avatar com primeira letra
        if (this.userAvatar) {
            this.userAvatar.textContent = user.username.charAt(0).toUpperCase();
        }

        // Atualizar nome
        if (this.userName) {
            this.userName.textContent = user.username;
        }
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

        // Atualizar título da página
        const titles = {
            dashboard: 'Dashboard',
            clients: 'Client Management',
            pricing: 'Price Management',
            selections: 'Selection Management',
            'special-selections': 'Special Selections', // NOVO
            reports: 'Reports',
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
                if (typeof AdminSpecialSelections !== 'undefined') {
                    if (!window.adminSpecialSelections) {
                        window.adminSpecialSelections = new AdminSpecialSelections();
                    }
                } else if (typeof window.initSpecialSelections === 'function') {
                    window.adminSpecialSelections = window.initSpecialSelections();
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

    // ===== DASHBOARD DATA =====
    async loadDashboardData() {
        console.log('📊 Carregando dados do dashboard...');

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
            this.updateSidebarBadges(stats);

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
            const session = JSON.parse(sessionData);
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
            this.updateSidebarBadges(stats);
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
}

// ===== LOGOUT FUNCTION =====
function logout() {
    console.log('🚪 Fazendo logout...');
    localStorage.removeItem('adminToken');
    window.location.href = '/';
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
    }
});

// ===== EXPORTS =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminDashboard;
}