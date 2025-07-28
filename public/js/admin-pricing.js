/**
 * ADMIN PRICING - SUNSHINE COWHIDES
 * JavaScript para gestão de preços integrada ao Google Drive
 */

class AdminPricing {
    constructor() {
        this.categories = [];
        this.currentCategory = null;
        this.isLoading = false;
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.filters = {
            search: '',
            priceStatus: 'all',
            sortBy: 'name'
        };

        this.init();
    }

    // ===== INICIALIZAÇÃO =====
    init() {
        console.log('💰 Inicializando Gestão de Preços...');
        this.setupElements();
        this.setupEventListeners();
        this.checkSyncStatus();
        console.log('✅ Gestão de Preços inicializada');
    }

    setupElements() {
        // Container principal
        this.section = document.getElementById('section-pricing');
        if (!this.section) {
            console.warn('⚠️ Seção de preços não encontrada');
            return;
        }

        // Elementos principais
        this.syncStatusCard = document.getElementById('syncStatusCard');
        this.pricingStats = document.getElementById('pricingStats');
        this.pricingTable = document.getElementById('pricingTableBody');
        this.pricingPagination = document.getElementById('pricingPagination');

        // Modal
        this.priceModal = document.getElementById('priceModal');
        this.priceForm = document.getElementById('priceForm');

        // LOG PARA DEBUG ← ADICIONAR ESTA LINHA
        console.log('🔵 Modal encontrado:', this.priceModal);

        // Loading
        this.loading = document.getElementById('loading');
    }

    setupEventListeners() {
        // Botões principais
        const btnSyncDrive = document.getElementById('btnSyncDrive');
        const btnForcSync = document.getElementById('btnForcSync');
        const btnPricingReport = document.getElementById('btnPricingReport');

        if (btnSyncDrive) btnSyncDrive.addEventListener('click', () => this.syncDrive(false));
        if (btnForcSync) btnForcSync.addEventListener('click', () => this.syncDrive(true));
        if (btnPricingReport) btnPricingReport.addEventListener('click', () => this.generateReport());

        // Filtros
        const searchInput = document.getElementById('searchCategories');
        const filterPrice = document.getElementById('filterPriceStatus');
        const sortSelect = document.getElementById('sortCategories');
        const btnApplyFilters = document.getElementById('btnApplyPricingFilters');

        if (searchInput) searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        if (filterPrice) filterPrice.addEventListener('change', (e) => this.handlePriceFilter(e.target.value));
        if (sortSelect) sortSelect.addEventListener('change', (e) => this.handleSort(e.target.value));
        if (btnApplyFilters) btnApplyFilters.addEventListener('click', () => this.applyFilters());

        // Paginação
        const btnPrevPage = document.getElementById('btnPrevPage');
        const btnNextPage = document.getElementById('btnNextPage');

        if (btnPrevPage) btnPrevPage.addEventListener('click', () => this.previousPage());
        if (btnNextPage) btnNextPage.addEventListener('click', () => this.nextPage());

        // Modal
        if (this.priceForm) {
            this.priceForm.addEventListener('submit', (e) => this.handlePriceSubmit(e));
        }

        // Fechar modal clicando fora
        if (this.priceModal) {
            this.priceModal.addEventListener('click', (e) => {
                if (e.target === this.priceModal || e.target.classList.contains('price-modal-overlay')) {
                    this.closePriceModal();
                }
            });
        }

        // NOVO: Fechar modal com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('priceModal');
                if (modal && (modal.style.display === 'flex' || modal.classList.contains('active'))) {
                    this.closePriceModal();
                }
            }
        });

        // NOVO: Log para debug
        console.log('🔵 Event listeners configurados para modal');
    }

    // ===== SINCRONIZAÇÃO COM GOOGLE DRIVE =====
    async checkSyncStatus() {
        try {
            const response = await fetch('/api/pricing/sync/status', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.updateSyncStatus(data.syncStatus);
                this.updateStats(data.statistics);

                // Carregar categorias se sync está ok
                if (!data.syncStatus.isOutdated) {
                    await this.loadCategories();
                }
            }

        } catch (error) {
            console.error('❌ Erro ao verificar status de sync:', error);
            this.showSyncStatus('Erro ao verificar status', 'danger');
        }
    }

    async syncDrive(forceRefresh = false) {
        try {
            this.setLoading(true);
            this.showSyncStatus('Sincronizando com Google Drive...', 'warning');

            const response = await fetch('/api/pricing/sync', {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ forceRefresh })
            });

            const data = await response.json();

            if (data.success) {
                const { created, updated, deactivated, errors } = data.summary;
                const message = `Sincronização concluída: ${created} criadas, ${updated} atualizadas, ${deactivated} removidas, ${errors} erros`;

                this.showSyncStatus(message, errors > 0 ? 'warning' : 'success');

                // Recarregar dados
                await Promise.all([
                    this.checkSyncStatus(),
                    this.loadCategories()
                ]);

                this.showNotification('Sincronização concluída com sucesso!', 'success');

            } else {
                throw new Error(data.message || 'Erro na sincronização');
            }

        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
            this.showSyncStatus(`Erro na sincronização: ${error.message}`, 'danger');
            this.showNotification('Erro na sincronização', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    updateSyncStatus(syncStatus) {
        if (!this.syncStatusCard) return;

        const { needingSyncCount, lastSyncDate, isOutdated, hoursOld } = syncStatus;

        if (isOutdated) {
            const message = `${needingSyncCount} categorias precisam de sincronização. Última sincronização: ${hoursOld}h atrás`;
            this.showSyncStatus(message, 'warning');
        } else {
            const message = lastSyncDate ?
                `Sistema sincronizado. Última atualização: ${this.formatDate(lastSyncDate)}` :
                'Sistema aguardando primeira sincronização';
            this.showSyncStatus(message, lastSyncDate ? 'success' : 'warning');
        }
    }

    showSyncStatus(message, type = 'warning') {
        if (!this.syncStatusCard) return;

        const messageEl = document.getElementById('syncStatusMessage');
        if (messageEl) {
            messageEl.textContent = message;
        }

        this.syncStatusCard.className = `sync-status-card ${type}`;
        this.syncStatusCard.style.display = 'block';
    }

    // ===== CARREGAMENTO DE CATEGORIAS =====
    async loadCategories() {
        try {
            const params = new URLSearchParams({
                search: this.filters.search,
                hasPrice: this.filters.priceStatus === 'all' ? '' : this.filters.priceStatus === 'with-price' ? 'true' : 'false',
                page: this.currentPage,
                limit: this.itemsPerPage
            });

            const response = await fetch(`/api/pricing/categories?${params}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.categories = data.categories;
                this.renderCategoriesTable();
                this.updatePagination(data.pagination);

                console.log(`✅ ${this.categories.length} categorias carregadas`);
            } else {
                throw new Error(data.message || 'Erro ao carregar categorias');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar categorias:', error);
            this.showError('Erro ao carregar categorias');
        }
    }

    // ===== RENDERIZAÇÃO DA TABELA =====
    renderCategoriesTable() {
        if (!this.pricingTable) return;

        if (this.categories.length === 0) {
            this.pricingTable.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <i class="fas fa-inbox"></i>
                        Nenhuma categoria encontrada
                        <br><small style="color: #666;">Tente sincronizar com o Google Drive</small>
                    </td>
                </tr>
            `;
            return;
        }

        const rows = this.categories.map(category => `
            <tr onclick="adminPricing.viewCategoryDetails('${category._id}')">
                <td class="category-name-cell">
                    <strong>${category.displayName}</strong>
                </td>
                <td class="category-path-cell" title="${category.googleDrivePath}">
                    ${category.googleDrivePath}
                </td>
                <td class="photos-count-cell">
                    ${category.photoCount} foto${category.photoCount !== 1 ? 's' : ''}
                </td>
                <td class="price-cell ${category.basePrice > 0 ? 'has-price' : 'no-price'}">
                    ${category.basePrice > 0 ? `R$ ${category.basePrice.toFixed(2)}` : 'Sem preço'}
                </td>
                <td class="discounts-cell">
                    ${category.hasCustomRules ?
                `<span class="discount-badge">Personalizado</span>` :
                `<span class="no-discounts">Nenhum</span>`
            }
                </td>
                <td class="last-update-cell">
                    ${this.formatDate(category.updatedAt)}
                </td>
                <td class="pricing-actions-cell" onclick="event.stopPropagation();">
                    <div class="pricing-action-buttons">
                        ${category.basePrice > 0 ?
                `<button class="btn-pricing-action btn-edit-price" 
                                     onclick="adminPricing.openPriceModal('${category._id}', 'edit')">
                                <i class="fas fa-edit"></i> Editar
                            </button>` :
                `<button class="btn-pricing-action btn-set-price" 
                                     onclick="adminPricing.openPriceModal('${category._id}', 'create')">
                                <i class="fas fa-dollar-sign"></i> Definir
                            </button>`
            }
                        <button class="btn-pricing-action btn-view-details" 
                                onclick="adminPricing.viewCategoryDetails('${category._id}')">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.pricingTable.innerHTML = rows;
    }

    // ===== MODAL DE PREÇOS =====
    async openPriceModal(categoryId, mode = 'create') {
        try {
            // Buscar detalhes da categoria
            const response = await fetch(`/api/pricing/categories/${categoryId}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Categoria não encontrada');
            }

            this.currentCategory = data.category;

            // Atualizar modal
            this.updatePriceModal(mode);

            // Mostrar modal
            if (this.priceModal) {
                const modal = document.getElementById('priceModal');
                if (modal) {
                    modal.style.display = 'flex';
                    modal.classList.add('active');
                } else {
                    console.error('🔴 Modal não encontrado no DOM!');
                }

                // Focar no campo de preço
                const priceInput = document.getElementById('newPrice');
                if (priceInput) {
                    setTimeout(() => priceInput.focus(), 100);
                }
            }

        } catch (error) {
            console.error('❌ Erro ao abrir modal de preço:', error);
            this.showNotification('Erro ao carregar categoria', 'error');
        }
    }

    updatePriceModal(mode) {
        if (!this.currentCategory) return;

        // Atualizar títulos
        const modalTitle = document.getElementById('priceModalTitle');
        const categoryName = document.getElementById('modalCategoryName');
        const categoryPath = document.getElementById('modalCategoryPath');
        const photoCount = document.getElementById('modalPhotoCount');
        const currentPrice = document.getElementById('modalCurrentPrice');

        if (modalTitle) {
            modalTitle.textContent = mode === 'edit' ? 'Editar Preço' : 'Definir Preço';
        }

        if (categoryName) {
            categoryName.textContent = this.currentCategory.displayName;
        }

        if (categoryPath) {
            categoryPath.textContent = this.currentCategory.googleDrivePath;
        }

        if (photoCount) {
            photoCount.textContent = `${this.currentCategory.photoCount} foto${this.currentCategory.photoCount !== 1 ? 's' : ''}`;
        }

        if (currentPrice) {
            currentPrice.textContent = this.currentCategory.basePrice > 0 ?
                `Preço atual: R$ ${this.currentCategory.basePrice.toFixed(2)}` :
                'Sem preço definido';
        }

        // Pré-preencher formulário se editando
        const newPriceInput = document.getElementById('newPrice');
        const reasonInput = document.getElementById('priceReason');

        if (newPriceInput) {
            newPriceInput.value = mode === 'edit' ? this.currentCategory.basePrice.toFixed(2) : '';
        }

        if (reasonInput) {
            reasonInput.value = '';
        }
    }

    closePriceModal() {
        const modal = document.getElementById('priceModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }

        // Limpar formulário
        const priceInput = document.getElementById('newPrice');
        const reasonInput = document.getElementById('priceReason');
        if (priceInput) priceInput.value = '';
        if (reasonInput) reasonInput.value = '';

        this.currentCategory = null;
        console.log('🔵 Modal fechado');
    }

    async handlePriceSubmit(e) {
        e.preventDefault();

        if (!this.currentCategory) return;

        try {
            const newPrice = parseFloat(document.getElementById('newPrice').value);
            const reason = document.getElementById('priceReason').value.trim();

            if (isNaN(newPrice) || newPrice < 0) {
                this.showNotification('Preço deve ser um número válido', 'error');
                return;
            }

            this.setLoading(true);

            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/price`, {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    price: newPrice,
                    reason: reason
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(data.message || 'Preço salvo com sucesso!', 'success');

                // Fechar modal ANTES de recarregar
                this.closePriceModal();

                // Recarregar dados
                await Promise.all([
                    this.loadCategories(),
                    this.checkSyncStatus()
                ]);
            } else {
                throw new Error(data.message || 'Erro ao salvar preço');
            }

        } catch (error) {
            console.error('❌ Erro ao salvar preço:', error);
            this.showNotification(`Erro ao salvar preço: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // ===== FILTROS E BUSCA =====
    handleSearch(value) {
        this.filters.search = value;
        this.debounceSearch();
    }

    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.currentPage = 1;
            this.loadCategories();
        }, 300);
    }

    handlePriceFilter(value) {
        this.filters.priceStatus = value;
        this.applyFilters();
    }

    handleSort(value) {
        this.filters.sortBy = value;
        this.applyFilters();
    }

    applyFilters() {
        this.currentPage = 1;
        this.loadCategories();
    }

    // ===== PAGINAÇÃO =====
    updatePagination(pagination) {
        if (!this.pricingPagination) return;

        const { page, totalPages, hasNext, hasPrev } = pagination;

        const paginationInfo = document.getElementById('paginationInfo');
        const btnPrevPage = document.getElementById('btnPrevPage');
        const btnNextPage = document.getElementById('btnNextPage');

        if (paginationInfo) {
            paginationInfo.textContent = `Página ${page} de ${totalPages}`;
        }

        if (btnPrevPage) {
            btnPrevPage.disabled = !hasPrev;
        }

        if (btnNextPage) {
            btnNextPage.disabled = !hasNext;
        }

        this.pricingPagination.style.display = totalPages > 1 ? 'flex' : 'none';
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadCategories();
        }
    }

    nextPage() {
        this.currentPage++;
        this.loadCategories();
    }

    // ===== ESTATÍSTICAS =====
    updateStats(statistics) {
        if (!this.pricingStats || !statistics) return;

        const elements = {
            totalCategoriesCount: statistics.totalCategories,
            categoriesWithPriceCount: statistics.categoriesWithPrice,
            categoriesWithoutPriceCount: statistics.categoriesWithoutPrice,
            totalPhotosCount: statistics.totalPhotos
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value || 0;
            }
        });

        this.pricingStats.style.display = 'block';
    }

    // ===== RELATÓRIOS =====
    async generateReport() {
        try {
            this.setLoading(true);

            const response = await fetch('/api/pricing/reports/overview', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.downloadReport(data.report);
                this.showNotification('Relatório gerado com sucesso!', 'success');
            } else {
                throw new Error(data.message || 'Erro ao gerar relatório');
            }

        } catch (error) {
            console.error('❌ Erro ao gerar relatório:', error);
            this.showNotification('Erro ao gerar relatório', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    downloadReport(reportData) {
        const csvContent = this.convertReportToCSV(reportData);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `relatorio_precos_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    convertReportToCSV(reportData) {
        // Implementar conversão para CSV
        // Por enquanto, retornar dados básicos
        return 'Relatório de Preços - Sunshine Cowhides\n' +
            JSON.stringify(reportData, null, 2);
    }

    // ===== UTILITÁRIOS =====
    getAuthHeaders() {
        const sessionData = localStorage.getItem('sunshineSession');
        if (sessionData) {
            const session = JSON.parse(sessionData);
            return {
                'Authorization': `Bearer ${session.token}`
            };
        }
        return {};
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    setLoading(loading) {
        this.isLoading = loading;
        if (this.loading) {
            this.loading.classList.toggle('hidden', !loading);
        }
    }

    showNotification(message, type = 'info') {
        // Integrar com sistema de notificações existente
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    viewCategoryDetails(categoryId) {
        // TODO: Implementar visualização detalhada
        console.log('👁️ Visualizar categoria:', categoryId);
    }
}

// ===== INICIALIZAÇÃO GLOBAL =====
let adminPricing = null;

// Inicializar quando a seção de preços for ativada
document.addEventListener('DOMContentLoaded', () => {
    // Observar mudanças na seção ativa
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const section = document.getElementById('section-pricing');
                if (section && section.style.display !== 'none' && !adminPricing) {
                    // Seção de preços foi ativada
                    adminPricing = new AdminPricing();
                }
            }
        });
    });

    const pricingSection = document.getElementById('section-pricing');
    if (pricingSection) {
        observer.observe(pricingSection, { attributes: true });

        // Se já estiver visível, inicializar imediatamente
        if (pricingSection.style.display !== 'none') {
            adminPricing = new AdminPricing();
        }
    }
});

// Funções globais para uso no HTML
window.closePriceModal = function () {
    if (adminPricing) {
        adminPricing.closePriceModal();
    }
};

window.adminPricing = adminPricing;

// Função global para fechar modal (chamada pelo HTML)
window.closePriceModal = function () {
    if (adminPricing) {
        adminPricing.closePriceModal();
    } else {
        // Fallback caso adminPricing não esteja disponível
        const modal = document.getElementById('priceModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }
};