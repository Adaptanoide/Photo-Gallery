//public/js/admin-special-selections.js

/**
 * ADMIN SPECIAL SELECTIONS - SUNSHINE COWHIDES
 * Gerenciamento completo de seleções especiais
 * VERSÃO CORRIGIDA - Bugs nos event listeners resolvidos
 */

class AdminSpecialSelections {
    constructor() {
        this.specialSelections = [];
        this.availableClients = [];
        this.currentSelection = null;
        this.isLoading = false;
        this.currentPage = 1;
        this.totalPages = 1;
        this.filters = {
            status: 'all',
            clientCode: '',
            isActive: 'all',
            search: ''
        };
        this.stats = {
            totalSpecialSelections: 0,
            activeSpecialSelections: 0,
            inactiveSpecialSelections: 0,
            clientsWithSpecialAccess: 0
        };

        this.init();
    }

    // ===== INICIALIZAÇÃO =====
    init() {
        console.log('⭐ Inicializando Admin Special Selections...');
        this.setupElements();
        this.setupEventListeners();
        this.loadInitialData();
        console.log('✅ Admin Special Selections inicializado');
    }

    setupElements() {
        this.section = document.getElementById('section-special-selections');
        this.loading = document.getElementById('specialSelectionsLoading');
        this.error = document.getElementById('specialSelectionsError');
        this.content = document.getElementById('specialSelectionsContent');
        this.badge = document.getElementById('specialSelectionsBadge');
    }

    setupEventListeners() {
        // Event listeners serão configurados após criar o HTML
        console.log('🔗 Event listeners configurados para Special Selections');
    }

    // ===== CARREGAMENTO INICIAL =====
    async loadInitialData() {
        try {
            this.showLoading(true);

            // Carregar dados paralelos
            await Promise.all([
                this.loadStatistics(),
                this.loadAvailableClients(),
                this.loadSpecialSelections()
            ]);

            this.createInterface();
            this.showContent();

        } catch (error) {
            console.error('❌ Erro ao carregar dados iniciais:', error);
            this.showError('Erro ao carregar dados das seleções especiais');
        } finally {
            this.showLoading(false);
        }
    }

    async loadStatistics() {
        try {
            console.log('📊 Carregando estatísticas...');

            const response = await fetch('/api/special-selections/stats/overview', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.stats = { ...this.stats, ...data.data };
                this.updateBadge();
                console.log('✅ Estatísticas carregadas:', this.stats);
            } else {
                throw new Error(data.message || 'Erro ao carregar estatísticas');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar estatísticas:', error);
            // Manter stats zeradas se der erro
        }
    }

    async loadAvailableClients() {
        try {
            console.log('👥 Carregando clientes disponíveis...');

            const response = await fetch('/api/admin/access-codes', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.availableClients = data.codes || [];
                console.log(`✅ ${this.availableClients.length} clientes carregados`);
                console.log('🔍 Clientes encontrados:', this.availableClients.map(c => `${c.clientName} (${c.code})`));
            } else {
                throw new Error(data.message || 'Erro ao carregar clientes');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar clientes:', error);
            this.availableClients = [];
        }
    }

    async loadSpecialSelections() {
        try {
            console.log('📋 Carregando seleções especiais...');

            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 20,
                ...this.filters
            });

            const response = await fetch(`/api/special-selections?${params}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.specialSelections = data.data || [];
                this.currentPage = data.pagination?.page || 1;
                this.totalPages = data.pagination?.pages || 1;
                console.log(`✅ ${this.specialSelections.length} seleções especiais carregadas`);
            } else {
                throw new Error(data.message || 'Erro ao carregar seleções especiais');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar seleções especiais:', error);
            this.specialSelections = [];
        }
    }

    // ===== CRIAÇÃO DA INTERFACE =====
    createInterface() {
        console.log('🎨 Criando interface das seleções especiais...');

        const html = `
            <!-- Cabeçalho da Seção -->
            <div class="special-selections-section-header">
                <div>
                    <h2 class="special-selections-title">
                        <i class="fas fa-star"></i>
                        Special Selections
                    </h2>
                </div>
                <div class="special-selections-actions">
                    <button id="btnRefreshSpecialSelections" class="btn btn-outline">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                    <button id="btnCreateSpecialSelection" class="btn btn-primary">
                        <i class="fas fa-plus"></i> Create Special Selection
                    </button>
                </div>
            </div>

            <!-- Estatísticas -->
            <div class="special-selections-stats-grid">
                <div class="special-stat-card">
                    <div class="special-stat-header">
                        <div class="special-stat-icon">
                            <i class="fas fa-star"></i>
                        </div>
                    </div>
                    <div class="special-stat-value" id="statTotalSpecial">${this.stats.totalSpecialSelections}</div>
                    <div class="special-stat-label">Total Special Selections</div>
                    <div class="special-stat-trend neutral">
                        <i class="fas fa-info-circle"></i> All time
                    </div>
                </div>

                <div class="special-stat-card">
                    <div class="special-stat-header">
                        <div class="special-stat-icon active">
                            <i class="fas fa-check-circle"></i>
                        </div>
                    </div>
                    <div class="special-stat-value" id="statActiveSpecial">${this.stats.activeSpecialSelections}</div>
                    <div class="special-stat-label">Active Selections</div>
                    <div class="special-stat-trend positive">
                        <i class="fas fa-arrow-up"></i> Currently active
                    </div>
                </div>

                <div class="special-stat-card">
                    <div class="special-stat-header">
                        <div class="special-stat-icon inactive">
                            <i class="fas fa-pause-circle"></i>
                        </div>
                    </div>
                    <div class="special-stat-value" id="statInactiveSpecial">${this.stats.inactiveSpecialSelections}</div>
                    <div class="special-stat-label">Inactive Selections</div>
                    <div class="special-stat-trend neutral">
                        <i class="fas fa-minus"></i> Paused or expired
                    </div>
                </div>

                <div class="special-stat-card">
                    <div class="special-stat-header">
                        <div class="special-stat-icon pending">
                            <i class="fas fa-users"></i>
                        </div>
                    </div>
                    <div class="special-stat-value" id="statClientsSpecial">${this.stats.clientsWithSpecialAccess}</div>
                    <div class="special-stat-label">Clients with Special Access</div>
                    <div class="special-stat-trend positive">
                        <i class="fas fa-key"></i> Special access granted
                    </div>
                </div>
            </div>

            <!-- Filtros -->
            <div class="special-selections-filters">
                <div class="special-filters-row">
                    <div class="special-filter-group">
                        <label class="special-filter-label">Status</label>
                        <select id="filterSpecialStatus" class="special-filter-select">
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Active</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div class="special-filter-group">
                        <label class="special-filter-label">Active State</label>
                        <select id="filterSpecialActive" class="special-filter-select">
                            <option value="all">All States</option>
                            <option value="true">Active Only</option>
                            <option value="false">Inactive Only</option>
                        </select>
                    </div>
                    <div class="special-filter-group">
                        <label class="special-filter-label">Client Code</label>
                        <input type="text" id="filterSpecialClient" class="special-filter-input" placeholder="Enter client code...">
                    </div>
                    <div class="special-filter-group">
                        <label class="special-filter-label">Search</label>
                        <input type="text" id="filterSpecialSearch" class="special-filter-input" placeholder="Search selections...">
                    </div>
                    <div class="special-filter-group">
                        <label class="special-filter-label">&nbsp;</label>
                        <button id="btnApplySpecialFilters" class="btn btn-outline">
                            <i class="fas fa-filter"></i> Apply Filters
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tabela de Seleções -->
            <div class="special-selections-table-container">
                <table class="special-selections-table">
                    <thead>
                        <tr>
                            <th>Selection Name</th>
                            <th>Client</th>
                            <th>Code</th>
                            <th>Status</th>
                            <th>Categories</th>
                            <th>Photos</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="specialSelectionsTableBody">
                        ${this.renderTableRows()}
                    </tbody>
                </table>
            </div>

            <!-- Paginação -->
            ${this.renderPagination()}

            <!-- Modal para Criar/Editar Seleção Especial -->
            <div id="specialSelectionModal" class="special-selection-modal">
                <div class="special-modal-content">
                    <div class="special-modal-header">
                        <h3 class="special-modal-title">
                            <i class="fas fa-star"></i>
                            <span id="modalTitle">Create Special Selection</span>
                        </h3>
                        <button id="specialModalCloseBtn" class="special-modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="special-modal-body">
                        <form id="specialSelectionForm">
                            <div class="special-form-row">
                                <div class="special-form-group">
                                    <label class="special-form-label required">Selection Name</label>
                                    <input type="text" id="selectionName" class="special-form-input" placeholder="Enter selection name..." required>
                                    <div class="special-form-help">A descriptive name for this special selection</div>
                                </div>
                                <div class="special-form-group">
                                    <label class="special-form-label required">Client</label>
                                    <select id="clientCode" class="special-form-select" required>
                                        <option value="">Select a client...</option>
                                        ${this.renderClientOptions()}
                                    </select>
                                    <div class="special-form-help">Client who will have access to this selection</div>
                                </div>
                            </div>

                            <div class="special-form-row single">
                                <div class="special-form-group">
                                    <label class="special-form-label">Description</label>
                                    <textarea id="selectionDescription" class="special-form-textarea" placeholder="Optional description for this selection..."></textarea>
                                    <div class="special-form-help">Internal notes about this selection</div>
                                </div>
                            </div>

                            <div class="special-form-row">
                                <div class="special-form-group">
                                    <div class="special-checkbox-group">
                                        <div class="special-switch active" id="showPricesSwitch">
                                            <input type="hidden" id="showPrices" value="true">
                                        </div>
                                        <label class="special-switch-label">Show Prices to Client</label>
                                    </div>
                                    <div class="special-form-help">Whether the client can see product prices</div>
                                </div>
                                <div class="special-form-group">
                                    <div class="special-checkbox-group">
                                        <div class="special-switch" id="allowDiscountSwitch">
                                            <input type="hidden" id="allowGlobalDiscount" value="false">
                                        </div>
                                        <label class="special-switch-label">Allow Global Discount</label>
                                    </div>
                                    <div class="special-form-help">Enable percentage discounts for this selection</div>
                                </div>
                            </div>

                            <div class="special-form-row" id="discountRow" style="display: none;">
                                <div class="special-form-group">
                                    <label class="special-form-label">Global Discount (%)</label>
                                    <input type="number" id="globalDiscountPercent" class="special-form-input" min="0" max="100" value="0" placeholder="0">
                                    <div class="special-form-help">Percentage discount applied to all products</div>
                                </div>
                                <div class="special-form-group">
                                    <label class="special-form-label">Expiration Date</label>
                                    <input type="datetime-local" id="expiresAt" class="special-form-input">
                                    <div class="special-form-help">When this selection expires (optional)</div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="special-modal-footer">
                        <button type="button" id="specialModalCancelBtn" class="btn btn-outline">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                        <button type="button" id="btnSaveSpecialSelection" class="btn btn-primary">
                            <i class="fas fa-save"></i> Create Selection
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.content.innerHTML = html;

        // CORREÇÃO: Configurar event listeners APÓS criar HTML
        this.setupAllEventListeners();
    }

    renderTableRows() {
        if (this.specialSelections.length === 0) {
            return `
                <tr>
                    <td colspan="8" class="special-selections-empty">
                        <div class="special-empty-icon">
                            <i class="fas fa-star"></i>
                        </div>
                        <h3 class="special-empty-title">No Special Selections Yet</h3>
                        <p class="special-empty-description">
                            Create your first special selection to provide personalized experiences for your clients.
                        </p>
                        <button id="btnCreateFirstSelection" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Create First Selection
                        </button>
                    </td>
                </tr>
            `;
        }

        return this.specialSelections.map(selection => `
            <tr>
                <td>
                    <strong>${selection.selectionName || 'Unnamed Selection'}</strong>
                </td>
                <td>${selection.clientName}</td>
                <td><code>${selection.clientCode}</code></td>
                <td>
                    <span class="special-status-badge ${selection.isActive ? 'active' : 'inactive'}">
                        <i class="fas fa-${selection.isActive ? 'check-circle' : 'pause-circle'}"></i>
                        ${selection.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${selection.totalCustomCategories || 0} categories</td>
                <td>${selection.totalCustomPhotos || 0} photos</td>
                <td>${this.formatDate(selection.createdAt)}</td>
                <td>
                    <div class="special-actions-group">
                        <button class="special-btn-icon special-tooltip" data-tooltip="View Details" data-action="view" data-id="${selection.selectionId}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="special-btn-icon edit special-tooltip" data-tooltip="Edit Selection" data-action="edit" data-id="${selection.selectionId}">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${selection.isActive ?
                `<button class="special-btn-icon special-tooltip" data-tooltip="Deactivate" data-action="deactivate" data-id="${selection.selectionId}">
                                <i class="fas fa-pause"></i>
                            </button>` :
                `<button class="special-btn-icon activate special-tooltip" data-tooltip="Activate" data-action="activate" data-id="${selection.selectionId}">
                                <i class="fas fa-play"></i>
                            </button>`
            }
                        <button class="special-btn-icon delete special-tooltip" data-tooltip="Delete Selection" data-action="delete" data-id="${selection.selectionId}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderClientOptions() {
        if (this.availableClients.length === 0) {
            return '<option value="" disabled>No clients available</option>';
        }

        return this.availableClients.map(client =>
            `<option value="${client.code}">${client.clientName} (${client.code})</option>`
        ).join('');
    }

    renderPagination() {
        if (this.totalPages <= 1) return '';

        const pages = [];
        const start = Math.max(1, this.currentPage - 2);
        const end = Math.min(this.totalPages, this.currentPage + 2);

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        return `
            <div class="special-pagination">
                <button class="special-pagination-btn" data-page="${this.currentPage - 1}" ${this.currentPage <= 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
                
                ${pages.map(page => `
                    <button class="special-pagination-btn ${page === this.currentPage ? 'active' : ''}" data-page="${page}">
                        ${page}
                    </button>
                `).join('')}
                
                <button class="special-pagination-btn" data-page="${this.currentPage + 1}" ${this.currentPage >= this.totalPages ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
                
                <div class="special-pagination-info">
                    Page ${this.currentPage} of ${this.totalPages}
                </div>
            </div>
        `;
    }

    // ===== EVENT LISTENERS CORRIGIDOS =====
    setupAllEventListeners() {
        console.log('🔗 Configurando todos os event listeners...');

        // Modal event listeners
        this.setupModalEventListeners();

        // Botões principais
        this.setupMainButtonListeners();

        // Filtros
        this.setupFilterEventListeners();

        // Ações da tabela
        this.setupTableActionListeners();

        // Paginação
        this.setupPaginationListeners();

        console.log('✅ Todos os event listeners configurados');
    }

    setupModalEventListeners() {
        // Botões de fechar modal
        const closeBtn = document.getElementById('specialModalCloseBtn');
        const cancelBtn = document.getElementById('specialModalCancelBtn');

        closeBtn?.addEventListener('click', () => this.closeModal());
        cancelBtn?.addEventListener('click', () => this.closeModal());

        // Fechar modal clicando fora
        const modal = document.getElementById('specialSelectionModal');
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Switch toggles
        const showPricesSwitch = document.getElementById('showPricesSwitch');
        const allowDiscountSwitch = document.getElementById('allowDiscountSwitch');

        showPricesSwitch?.addEventListener('click', () => this.toggleSwitch('showPrices'));
        allowDiscountSwitch?.addEventListener('click', () => this.toggleSwitch('allowGlobalDiscount'));

        // Save button
        document.getElementById('btnSaveSpecialSelection')?.addEventListener('click', () => this.saveSpecialSelection());
    }

    setupMainButtonListeners() {
        // Botão refresh
        document.getElementById('btnRefreshSpecialSelections')?.addEventListener('click', () => this.refreshData());

        // Botão criar (cabeçalho)
        document.getElementById('btnCreateSpecialSelection')?.addEventListener('click', () => this.openCreateModal());

        // Botão criar (tabela vazia)
        document.getElementById('btnCreateFirstSelection')?.addEventListener('click', () => this.openCreateModal());
    }

    setupFilterEventListeners() {
        document.getElementById('btnApplySpecialFilters')?.addEventListener('click', () => this.applyFilters());

        // Enter key nos inputs de filtro
        ['filterSpecialClient', 'filterSpecialSearch'].forEach(id => {
            document.getElementById(id)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.applyFilters();
            });
        });
    }

    setupTableActionListeners() {
        // Event delegation para botões da tabela
        const tableBody = document.getElementById('specialSelectionsTableBody');
        tableBody?.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;

            switch (action) {
                case 'view':
                    this.viewSelection(id);
                    break;
                case 'edit':
                    this.editSelection(id);
                    break;
                case 'activate':
                    this.activateSelection(id);
                    break;
                case 'deactivate':
                    this.deactivateSelection(id);
                    break;
                case 'delete':
                    this.deleteSelection(id);
                    break;
            }
        });
    }

    setupPaginationListeners() {
        // Event delegation para paginação
        const pagination = document.querySelector('.special-pagination');
        pagination?.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-page]');
            if (!button) return;

            const page = parseInt(button.dataset.page);
            if (!isNaN(page)) {
                this.goToPage(page);
            }
        });
    }

    // ===== MODAL FUNCTIONS =====
    openCreateModal() {
        console.log('🎨 Abrindo modal de criação...');
        document.getElementById('modalTitle').textContent = 'Create Special Selection';
        document.getElementById('btnSaveSpecialSelection').innerHTML = '<i class="fas fa-save"></i> Create Selection';
        this.resetForm();
        this.showModal();
    }

    openEditModal(selectionId) {
        // TODO: Implementar edição
        console.log('Editar seleção:', selectionId);
        this.showNotification('Edit functionality coming soon!', 'info');
    }

    showModal() {
        const modal = document.getElementById('specialSelectionModal');
        modal?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        console.log('🔒 Fechando modal...');
        const modal = document.getElementById('specialSelectionModal');
        modal?.classList.remove('active');
        document.body.style.overflow = '';
    }

    resetForm() {
        const form = document.getElementById('specialSelectionForm');
        form?.reset();

        document.getElementById('showPrices').value = 'true';
        document.getElementById('allowGlobalDiscount').value = 'false';

        // Reset switches
        document.getElementById('showPricesSwitch')?.classList.add('active');
        document.getElementById('allowDiscountSwitch')?.classList.remove('active');
        document.getElementById('discountRow').style.display = 'none';

        // Atualizar opções de clientes
        const clientSelect = document.getElementById('clientCode');
        if (clientSelect) {
            clientSelect.innerHTML = '<option value="">Select a client...</option>' + this.renderClientOptions();
        }
    }

    toggleSwitch(fieldName) {
        const switchEl = document.getElementById(fieldName + 'Switch');
        const hiddenInput = document.getElementById(fieldName);

        if (!switchEl || !hiddenInput) return;

        const isActive = switchEl.classList.contains('active');
        const newValue = !isActive;

        if (newValue) {
            switchEl.classList.add('active');
        } else {
            switchEl.classList.remove('active');
        }

        hiddenInput.value = newValue.toString();

        // Mostrar/esconder linha de desconto
        if (fieldName === 'allowGlobalDiscount') {
            const discountRow = document.getElementById('discountRow');
            if (discountRow) {
                discountRow.style.display = newValue ? 'grid' : 'none';
            }
        }
    }

    // ===== CRUD OPERATIONS =====
    async saveSpecialSelection() {
        try {
            const formData = this.getFormData();

            if (!this.validateForm(formData)) {
                return;
            }

            this.setLoading('btnSaveSpecialSelection', true);

            const response = await fetch('/api/special-selections', {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Basic info saved! Opening selection builder...', 'success');
                this.closeModal();

                // Salvar dados para o builder
                localStorage.setItem('builderSelectionName', formData.selectionName);
                localStorage.setItem('builderClientCode', formData.clientCode);
                localStorage.setItem('builderClientName', this.getClientName(formData.clientCode));

                // Redirecionar para o builder
                setTimeout(() => {
                    window.location.href = `/special-selection-builder.html?name=${encodeURIComponent(formData.selectionName)}&client=${formData.clientCode}&clientName=${encodeURIComponent(this.getClientName(formData.clientCode))}`;
                }, 1000);
            } else {
                throw new Error(data.message || 'Failed to create special selection');
            }

        } catch (error) {
            console.error('❌ Erro ao salvar seleção especial:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        } finally {
            this.setLoading('btnSaveSpecialSelection', false);
        }
    }

    getFormData() {
        return {
            clientCode: document.getElementById('clientCode')?.value || '',
            selectionName: document.getElementById('selectionName')?.value || '',
            description: document.getElementById('selectionDescription')?.value || '',
            showPrices: document.getElementById('showPrices')?.value === 'true',
            allowGlobalDiscount: document.getElementById('allowGlobalDiscount')?.value === 'true',
            globalDiscountPercent: parseFloat(document.getElementById('globalDiscountPercent')?.value) || 0,
            expiresAt: document.getElementById('expiresAt')?.value || null
        };
    }

    validateForm(data) {
        if (!data.clientCode) {
            this.showNotification('Please select a client', 'error');
            return false;
        }
        if (!data.selectionName.trim()) {
            this.showNotification('Please enter a selection name', 'error');
            return false;
        }
        return true;
    }

    // ===== ACTION FUNCTIONS =====
    async viewSelection(selectionId) {
        console.log('Ver seleção:', selectionId);
        this.showNotification('View functionality coming soon!', 'info');
    }

    async editSelection(selectionId) {
        console.log('Editar seleção:', selectionId);
        this.showNotification('Edit functionality coming soon!', 'info');
    }

    async activateSelection(selectionId) {
        if (!confirm('Are you sure you want to activate this special selection? The client will immediately gain access to it.')) {
            return;
        }

        try {
            const response = await fetch(`/api/special-selections/${selectionId}/activate`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Special selection activated successfully!', 'success');
                await this.refreshData();
            } else {
                throw new Error(data.message || 'Failed to activate selection');
            }

        } catch (error) {
            console.error('❌ Erro ao ativar seleção:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    async deactivateSelection(selectionId) {
        if (!confirm('Are you sure you want to deactivate this special selection? The client will lose access to it.')) {
            return;
        }

        try {
            const response = await fetch(`/api/special-selections/${selectionId}/deactivate`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ returnPhotos: false })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Special selection deactivated successfully!', 'success');
                await this.refreshData();
            } else {
                throw new Error(data.message || 'Failed to deactivate selection');
            }

        } catch (error) {
            console.error('❌ Erro ao desativar seleção:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    async deleteSelection(selectionId) {
        if (!confirm('Are you sure you want to delete this special selection? This action cannot be undone. All photos will be returned to the original stock.')) {
            return;
        }

        try {
            const response = await fetch(`/api/special-selections/${selectionId}?returnPhotos=true`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Special selection deleted successfully!', 'success');
                await this.refreshData();
            } else {
                throw new Error(data.message || 'Failed to delete selection');
            }

        } catch (error) {
            console.error('❌ Erro ao deletar seleção:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    // ===== UTILITY FUNCTIONS =====
    async refreshData() {
        console.log('🔄 Atualizando dados...');
        await this.loadInitialData();
        this.updateTable();
        this.showNotification('Data refreshed successfully!', 'success');
    }

    applyFilters() {
        this.filters = {
            status: document.getElementById('filterSpecialStatus')?.value || 'all',
            clientCode: document.getElementById('filterSpecialClient')?.value || '',
            isActive: document.getElementById('filterSpecialActive')?.value || 'all',
            search: document.getElementById('filterSpecialSearch')?.value || ''
        };

        this.currentPage = 1;
        this.loadSpecialSelections().then(() => this.updateTable());
    }

    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.loadSpecialSelections().then(() => this.updateTable());
    }

    updateTable() {
        const tbody = document.getElementById('specialSelectionsTableBody');
        if (tbody) {
            tbody.innerHTML = this.renderTableRows();
            // Reconfigurar event listeners da tabela
            this.setupTableActionListeners();
        }

        // Atualizar paginação
        const paginationContainer = document.querySelector('.special-pagination');
        if (paginationContainer) {
            paginationContainer.outerHTML = this.renderPagination();
            // Reconfigurar event listeners da paginação
            this.setupPaginationListeners();
        }
    }

    updateBadge() {
        if (this.badge) {
            this.badge.textContent = this.stats.totalSpecialSelections;
        }
    }

    // ===== HELPER FUNCTIONS =====
    getAuthHeaders() {
        const session = JSON.parse(localStorage.getItem('sunshineSession') || '{}');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`
        };
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showLoading(show) {
        this.isLoading = show;
        if (this.loading) {
            this.loading.style.display = show ? 'flex' : 'none';
        }
    }

    showContent() {
        if (this.content) {
            this.content.style.display = 'block';
        }
        if (this.error) {
            this.error.style.display = 'none';
        }
    }

    showError(message) {
        if (this.error) {
            this.error.style.display = 'block';
            const errorMsg = this.error.querySelector('#specialSelectionsErrorMessage');
            if (errorMsg) {
                errorMsg.textContent = message;
            }
        }
        if (this.content) {
            this.content.style.display = 'none';
        }
    }

    setLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = loading;
            if (loading) {
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                button.dataset.originalText = originalText;
            } else {
                const originalText = button.dataset.originalText || '<i class="fas fa-save"></i> Create Selection';
                button.innerHTML = originalText;
            }
        }
    }

    showNotification(message, type = 'info') {
        // Implementar sistema de notificações
        console.log(`${type.toUpperCase()}: ${message}`);

        // Fallback para alert por enquanto
        if (type === 'error') {
            alert(`Error: ${message}`);
        } else if (type === 'success') {
            alert(`Success: ${message}`);
        } else {
            alert(message);
        }
    }

    getClientName(clientCode) {
    const client = this.availableClients.find(c => c.code === clientCode);
    return client ? client.clientName : 'Unknown Client';
}

}

// ===== INICIALIZAÇÃO GLOBAL =====
let adminSpecialSelections = null;

// Função para inicialização externa
if (typeof window !== 'undefined') {
    window.initSpecialSelections = function () {
        if (!adminSpecialSelections) {
            adminSpecialSelections = new AdminSpecialSelections();
        }
        return adminSpecialSelections;
    };

    // Disponibilizar globalmente para debugging
    window.adminSpecialSelections = null;
}

// Inicializar quando a seção for carregada
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (document.getElementById('section-special-selections')) {
            console.log('🌟 Preparando inicialização do Admin Special Selections...');
        }
    }, 1000);
});

console.log('⭐ admin-special-selections.js carregado - aguardando inicialização...');