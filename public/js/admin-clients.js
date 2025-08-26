//public/js/admin-clients.js

/**
 * ADMIN CLIENTS - SUNSHINE COWHIDES
 * Complete access code and client management
 */

class AdminClients {
    constructor() {
        this.clients = [];
        this.availableCategories = [];
        this.selectedCategories = [];
        this.isLoading = false;
        this.currentClient = null;

        // ADICIONE ESTAS DUAS LINHAS NOVAS:
        this.hasUnsavedChanges = false;
        this.originalFormData = null;

        this.filters = {
            search: '',
            status: 'all'
        };
        this.init();
    }

    // ===== INITIALIZATION =====
    init() {
        console.log('👥 Initializing Client Management...');
        this.setupElements();
        this.setupEventListeners();
        this.loadInitialData();
        console.log('✅ Client Management initialized');
    }

    // Função para mostrar modal de confirmação customizado
    showConfirmModal(message, onConfirm, onCancel) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const messageEl = modal.querySelector('.confirm-modal-message');
            const btnOk = document.getElementById('confirmOk');
            const btnCancel = document.getElementById('confirmCancel');

            // Define a mensagem
            messageEl.innerHTML = message || 'Do you really want to close without saving?<br>Click OK to discard changes or Cancel to continue editing.';

            // Mostra o modal
            modal.classList.add('active');

            // Handler para OK
            const handleOk = () => {
                modal.classList.remove('active');
                btnOk.removeEventListener('click', handleOk);
                btnCancel.removeEventListener('click', handleCancel);
                if (onConfirm) onConfirm();
                resolve(true);
            };

            // Handler para Cancel
            const handleCancel = () => {
                modal.classList.remove('active');
                btnOk.removeEventListener('click', handleOk);
                btnCancel.removeEventListener('click', handleCancel);
                if (onCancel) onCancel();
                resolve(false);
            };

            btnOk.addEventListener('click', handleOk);
            btnCancel.addEventListener('click', handleCancel);

            // ESC para cancelar
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    handleCancel();
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    }

    setupElements() {
        // Main container
        this.section = document.getElementById('section-clients');

        // Elements we'll create dynamically
        this.clientsContainer = null;
        this.modal = null;
        this.form = null;
        this.table = null;

        // Loading
        this.loading = document.getElementById('loading');
    }

    setupEventListeners() {
        // Event listeners will be configured after creating HTML
        console.log('🔗 Event listeners configured');
    }

    // ===== INITIAL RENDERING =====
    async loadInitialData() {
        if (!this.section) {
            console.log('⚠️ Clients section not found');
            return;
        }

        this.showLoading(true);

        try {
            // Create interface HTML
            this.renderClientInterface();

            // Load data in parallel
            await Promise.all([
                this.loadClients(),
                this.loadAvailableCategories()
            ]);

            // Render table
            this.renderClientsTable();

            // Setup event listeners after creating HTML
            this.setupEventListenersAfterRender();

        } catch (error) {
            console.error('❌ Error loading initial data:', error);
            this.showError('Error loading client data');
        } finally {
            this.showLoading(false);
        }
    }

    renderClientInterface() {
        // ✅ OCULTAR LOADING INICIAL ANTES DE CRIAR INTERFACE
        const initialLoading = document.getElementById('clientsInitialLoading');
        if (initialLoading) {
            initialLoading.style.display = 'none';
        }

        this.section.innerHTML = `
            <!-- Section Header -->
            <div class="clients-section-header">
                <h2 class="clients-title">
                    <i class="fas fa-users"></i>
                    Client Management
                </h2>
                <div class="clients-actions">
                    <button id="btnRefreshClients" class="btn btn-secondary">
                        <i class="fas fa-sync-alt"></i>
                        Refresh
                    </button>
                    <button id="btnNewClient" class="btn btn-primary">
                        <i class="fas fa-plus"></i>
                        New Client
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div class="clients-filters">
                <div class="filters-row">
                    <div class="filter-group">
                        <label class="filter-label">Search Client</label>
                        <input type="text" id="searchClients" class="filter-input" 
                            placeholder="Name, code or email...">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Status</label>
                        <select id="filterStatus" class="filter-select">
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Sort by</label>
                        <select id="sortClients" class="filter-select">
                            <option value="recent">Most Recent</option>
                            <option value="name">Name A-Z</option>
                            <option value="code">Code</option>
                            <option value="usage">Most Used</option>
                        </select>
                    </div>
                    <button id="btnApplyFilters" class="btn-filter">
                        <i class="fas fa-filter"></i>
                        Filter
                    </button>
                </div>
            </div>

            <!-- Codes Table -->
            <div class="clients-table-container">
                <table class="clients-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Client</th>
                            <th>Access Type</th>
                            <th>Usage</th>
                            <th>Expires</th>
                            <th>Status</th>
                            <th style="text-align: center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="clientsTableBody">
                        <tr>
                            <td colspan="7" class="text-center">
                                <i class="fas fa-spinner fa-spin"></i>
                                Loading codes...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Client Modal -->
            <div id="clientModal" class="client-modal">
                <div class="client-modal-content">
                    <div class="client-modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-user-plus"></i>
                            <span id="modalTitle">New Access Code</span>
                        </h3>
                        <button class="modal-close" onclick="adminClients.closeModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="client-modal-body">
                        <form id="clientForm" class="client-form">
                            <!-- Client Information -->
                                        <div class="form-section-clients">
                                            <h4 class="form-section-title-clients">
                                                <i class="fas fa-user"></i>
                                                Client Information
                                            </h4>
                                            <div class="form-grid">
                                                <div class="form-group-clients">
                                                    <label class="form-label-clients required">Full Name</label>
                                                    <input type="text" id="clientName" class="form-input-clients" 
                                                        placeholder="e.g. John Smith" required>
                                                </div>
                                                <div class="form-group-clients">
                                                    <label class="form-label-clients">Company Name</label>
                                                    <input type="text" id="companyName" class="form-input-clients" 
                                                        placeholder="e.g. ABC Industries LLC">
                                                </div>
                                                <div class="form-group-clients">
                                                    <label class="form-label-clients">Email</label>
                                                    <input type="email" id="clientEmail" class="form-input-clients" 
                                                        placeholder="e.g. contact@company.com">
                                                </div>
                                                <div class="form-group-clients">
                                                    <label class="form-label-clients">Phone Number</label>
                                                    <input type="tel" id="clientPhone" class="form-input-clients" 
                                                        placeholder="e.g. (555) 123-4567">
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Address Information -->
                                        <div class="form-section-clients">
                                            <h4 class="form-section-title-clients">
                                                <i class="fas fa-map-marker-alt"></i>
                                                Address Information
                                            </h4>
                                            <div class="form-grid">
                                                <div class="form-group-clients full-width">
                                                    <label class="form-label-clients">Address Line 1</label>
                                                    <input type="text" id="addressLine1" class="form-input-clients" 
                                                        placeholder="e.g. 123 Main Street">
                                                </div>
                                                <div class="form-group-clients full-width">
                                                    <label class="form-label-clients">Address Line 2</label>
                                                    <input type="text" id="addressLine2" class="form-input-clients" 
                                                        placeholder="e.g. Suite 100 (Optional)">
                                                </div>
                                                <div class="form-group-clients">
                                                    <label class="form-label-clients">City</label>
                                                    <input type="text" id="city" class="form-input-clients" 
                                                        placeholder="e.g. New York">
                                                </div>
                                                <div class="form-group-clients">
                                                    <label class="form-label-clients">State</label>
                                                    <input type="text" id="state" class="form-input-clients" 
                                                        placeholder="e.g. NY, CA, TX" maxlength="20">
                                                </div>
                                                <div class="form-group-clients">
                                                    <label class="form-label-clients">ZIP Code</label>
                                                    <input type="text" id="zipCode" class="form-input-clients" 
                                                        placeholder="e.g. 10001 or 10001-1234" maxlength="15">
                                                </div>
                                            </div>
                                        </div>

                            <!-- Access Code -->
                            <div class="form-section-clients">
                                <h4 class="form-section-title-clients">
                                    <i class="fas fa-key"></i>
                                    Access Code
                                </h4>
                                <div class="form-group-clients">
                                    <div id="codePreview" class="code-preview">
                                        ----
                                    </div>
                                    <small style="color: var(--text-muted); text-align: center; display: block; margin-top: 0.5rem;">
                                        Code will be generated automatically
                                    </small>
                                </div>
                            </div>

                            <!-- Settings -->
                            <div class="form-section-clients">
                                <h4 class="form-section-title-clients">
                                    <i class="fas fa-cog"></i>
                                    Settings
                                </h4>
                                <div class="form-grid">
                                    <div class="form-group-clients">
                                        <label class="form-label-clients">Expires in (days)</label>
                                        <input type="number" id="expireDays" class="form-input-clients" 
                                            value="30" min="1" max="365">
                                    </div>
                                    <div class="form-group-clients">
                                        <label class="form-label-clients">Show Prices to Client</label>
                                        <div class="toggle-item">
                                            <label class="toggle-switch">
                                                <input type="checkbox" id="showPrices">
                                                <span class="toggle-slider"></span>
                                            </label>
                                            <span id="showPricesLabel" style="margin-left: 10px; color: var(--text-muted);">Enabled</span>
                                        </div>
                                        <small style="color: var(--text-muted); margin-top: 5px; display: block;">
                                            When disabled, client will see "Contact for Price"
                                        </small>
                                    </div>
                                </div>
                            </div>

                            <!-- Allowed Categories -->
                            <div class="form-section-clients">
                                <h4 class="form-section-title-clients">
                                    <i class="fas fa-folder-open"></i>
                                    Allowed Categories
                                </h4>
                                <div class="form-group-clients full-width">
                                    <div id="categoriesSelection" class="categories-selection">
                                        <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                                            <i class="fas fa-spinner fa-spin"></i>
                                            Loading categories...
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                        
                        <!-- Loading Overlay -->
                        <div id="modalLoading" class="loading-overlay">
                            <div class="loading-spinner-modal">
                                <div class="spinner-modal"></div>
                                <p>Processing...</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="client-modal-footer">
                        <button type="button" class="btn-modal btn-cancel" onclick="adminClients.closeModal()">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                        <button type="submit" form="clientForm" class="btn-modal btn-save" id="btnSaveClient">
                            <i class="fas fa-save"></i>
                            <span id="saveButtonText">Create Code</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Client View Modal -->
            <div id="clientViewModal" class="client-view-modal">
                <div class="client-view-content">
                    <div class="client-view-header">
                        <h3 class="client-view-title">
                            <i class="fas fa-eye"></i>
                            <span id="viewModalTitle">Client Details</span>
                        </h3>
                        <button class="client-view-close" onclick="adminClients.closeViewModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="client-view-body">
                        <!-- Seção: Informações Básicas -->
                        <div class="view-section">
                            <h4 class="view-section-title">
                                <i class="fas fa-user"></i>
                                Basic Information
                            </h4>
                            <div class="view-info-grid">
                                <div class="view-info-item">
                                    <div class="view-info-label">Full Name</div>
                                    <div class="view-info-value" id="viewClientName">-</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Company</div>
                                    <div class="view-info-value" id="viewClientCompany">-</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Email</div>
                                    <div class="view-info-value" id="viewClientEmail">-</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Phone</div>
                                    <div class="view-info-value" id="viewClientPhone">-</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Address</div>
                                    <div class="view-info-value" id="viewClientAddress">-</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Access Code</div>
                                    <div class="view-info-value" id="viewClientCode">-</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Current Status</div>
                                    <div class="view-info-value" id="viewClientStatus">-</div>
                                </div>
                            </div>
                        </div>

                        <!-- Seção: Configuração de Acesso -->
                        <div class="view-section">
                            <h4 class="view-section-title">
                                <i class="fas fa-key"></i>
                                Access Configuration
                            </h4>
                            <div class="view-info-grid">
                                <div class="view-info-item">
                                    <div class="view-info-label">Access Type</div>
                                    <div class="view-info-value" id="viewAccessType">-</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Expiration Date</div>
                                    <div class="view-info-value" id="viewExpirationDate">-</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Created On</div>
                                    <div class="view-info-value" id="viewCreatedDate">-</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Days Until Expiry</div>
                                    <div class="view-info-value" id="viewDaysLeft">-</div>
                                </div>
                            </div>
                            
                            <!-- Categorias Permitidas -->
                            <div style="margin-top: 1.5rem;">
                                <div class="view-info-label">Allowed Categories</div>
                                <div class="view-categories-list" id="viewAllowedCategories">
                                    <!-- Categories will be populated here -->
                                </div>
                            </div>
                        </div>

                        <!-- Seção: Estatísticas de Uso -->
                        <div class="view-section">
                            <h4 class="view-section-title">
                                <i class="fas fa-chart-bar"></i>
                                Usage Statistics
                            </h4>
                            <div class="view-stats-grid">
                                <div class="view-stat-card">
                                    <span class="view-stat-number" id="viewTotalLogins">-</span>
                                    <div class="view-stat-label">Total Logins</div>
                                </div>
                                <div class="view-stat-card">
                                    <span class="view-stat-number" id="viewDaysActive">-</span>
                                    <div class="view-stat-label">Days Active</div>
                                </div>
                                <div class="view-stat-card">
                                    <span class="view-stat-number" id="viewLastAccess">-</span>
                                    <div class="view-stat-label">Days Since Last Access</div>
                                </div>
                            </div>
                        </div>

                        <!-- Seção: Informações de Segurança -->
                        <div class="view-section">
                            <h4 class="view-section-title">
                                <i class="fas fa-shield-alt"></i>
                                Security & Audit
                            </h4>
                            <div class="view-info-grid">
                                <div class="view-info-item">
                                    <div class="view-info-label">Last IP Address</div>
                                    <div class="view-info-value" id="viewLastIP">Not tracked</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Last Device</div>
                                    <div class="view-info-value" id="viewLastDevice">Not tracked</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Account Type</div>
                                    <div class="view-info-value" id="viewAccountType">Standard</div>
                                </div>
                                <div class="view-info-item">
                                    <div class="view-info-label">Risk Level</div>
                                    <div class="view-info-value" id="viewRiskLevel">Low</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal de Confirmação Luxury -->
            <div id="luxuryConfirmModal" class="luxury-confirm-modal">
                <div class="luxury-confirm-content">
                    <div class="luxury-confirm-header">
                        <div class="luxury-confirm-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3 class="luxury-confirm-title" id="confirmTitle">Confirm Action</h3>
                    </div>
                    <div class="luxury-confirm-body">
                        <p class="luxury-confirm-message" id="confirmMessage">Are you sure?</p>
                        <div class="luxury-confirm-details" id="confirmDetails" style="display: none;">
                            Additional details here
                        </div>
                        <div class="luxury-confirm-actions">
                            <button class="luxury-confirm-btn luxury-confirm-btn-cancel" onclick="adminClients.closeLuxuryConfirm()">
                                <i class="fas fa-times"></i>
                                Cancel
                            </button>
                            <button class="luxury-confirm-btn luxury-confirm-btn-confirm" id="confirmActionBtn">
                                <i class="fas fa-trash"></i>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Store element references
        this.clientsContainer = this.section;
        this.modal = document.getElementById('clientModal');
        this.form = document.getElementById('clientForm');
        this.table = document.getElementById('clientsTableBody');
    }

    setupEventListenersAfterRender() {
        // Main buttons
        document.getElementById('btnNewClient').addEventListener('click', () => this.openCreateModal());
        document.getElementById('btnRefreshClients').addEventListener('click', () => this.refreshData());

        // Filters
        document.getElementById('searchClients').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('filterStatus').addEventListener('change', (e) => this.handleStatusFilter(e.target.value));
        document.getElementById('sortClients').addEventListener('change', (e) => this.handleSort(e.target.value));
        document.getElementById('btnApplyFilters').addEventListener('click', () => this.applyFilters());

        // Form
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Form inputs
        document.getElementById('clientName').addEventListener('input', () => this.generateCodePreview());

        // Toggle Show Prices listener
        const showPricesToggle = document.getElementById('showPrices');
        if (showPricesToggle) {
            showPricesToggle.addEventListener('change', function () {
                const label = document.getElementById('showPricesLabel');
                if (label) {
                    label.textContent = this.checked ? 'Enabled' : 'Disabled';
                }
            });
        }

        // Close modal by clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal(); // Agora vai verificar mudanças
            }
        });

        console.log('🔗 Event listeners configured after rendering');
    }

    // ===== DATA LOADING =====
    async loadClients() {
        try {
            const token = this.getAdminToken();
            const response = await fetch('/api/admin/access-codes', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.clients = data.codes || [];
                console.log(`✅ ${this.clients.length} codes loaded`);
            } else {
                throw new Error(data.message || 'Error loading codes');
            }

        } catch (error) {
            console.error('❌ Error loading clients:', error);
            // Fallback data for development
            this.clients = [
                {
                    _id: '1',
                    code: '7064',
                    clientName: 'John Silva',
                    clientEmail: 'john@email.com',
                    allowedCategories: ['1. Colombian Cowhides', '2. Brazil Best Sellers'],
                    isActive: true,
                    usageCount: 3,
                    lastUsed: new Date(),
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    createdAt: new Date()
                }
            ];
        }
    }

    async loadAvailableCategories() {
        try {
            const response = await fetch('/api/gallery/structure');
            const data = await response.json();

            if (data.success) {
                // CORREÇÃO: Acessar structure.folders em vez de folders direto
                const folders = data.structure?.folders || data.folders || [];

                // Filtrar _thumbnails e mapear corretamente
                this.availableCategories = folders
                    .filter(folder => !folder.name.startsWith('_'))  // Remove _thumbnails
                    .map(folder => ({
                        id: folder.id,
                        name: folder.name,
                        modifiedTime: folder.modifiedTime
                    }));
                console.log(`✅ ${this.availableCategories.length} categories loaded`);
            } else {
                throw new Error(data.message || 'Error loading categories');
            }

        } catch (error) {
            console.error('❌ Error loading categories:', error);
            // Fallback
            this.availableCategories = [
                { id: '1', name: '1. Colombian Cowhides' },
                { id: '2', name: '2. Brazil Best Sellers' },
                { id: '3', name: '3. Premium Selection' }
            ];
        }
    }

    // ===== TABLE RENDERING =====
    renderClientsTable() {
        if (!this.table) return;

        if (this.clients.length === 0) {
            this.table.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <i class="fas fa-inbox"></i>
                        No codes found
                        <br><small style="color: var(--text-muted);">Click "New Client" to create the first one</small>
                    </td>
                </tr>
            `;
            return;
        }

        const rows = this.clients.map(client => `
            <tr onclick="adminClients.viewClient('${client._id || client.code}')">
                <td class="client-code-cell">${client.code}</td>
                <td class="client-name-cell">
                    <div>${client.clientName}</div>
                    <div class="client-email-cell">${client.clientEmail || 'No email'}</div>
                </td>
                <td class="client-access-type-cell">
                    <div class="access-type-preview">
                        ${this.renderAccessType(client)}
                    </div>
                </td>
                <td class="client-usage-cell">
                    <div class="usage-count">${client.usageCount || 0}x</div>
                    <div class="usage-last">${this.formatDate(client.lastUsed, 'Never used')}</div>
                </td>
                <td>${this.formatDate(client.expiresAt)}</td>
                <td class="client-status-cell">
                    ${this.renderStatusBadge(client)}
                </td>
                <td class="client-actions-cell" onclick="event.stopPropagation();">
                    <div class="action-buttons">
                        <button class="special-btn-icon" onclick="adminClients.viewClient('${client._id || client.code}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="special-btn-icon edit" onclick="adminClients.editClient('${client._id || client.code}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="special-btn-icon ${client.isActive ? 'deactivate' : 'activate'}" 
                                onclick="adminClients.toggleClientStatus('${client._id || client.code}')" 
                                title="${client.isActive ? 'Deactivate' : 'Activate'}">
                            <i class="fas fa-${client.isActive ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="special-btn-icon delete" onclick="adminClients.deleteClient('${client._id || client.code}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.table.innerHTML = rows;
    }

    renderCategoriesPreview(categories) {
        if (!categories || categories.length === 0) {
            return '<span style="color: var(--text-muted); font-style: italic;">No categories</span>';
        }

        const maxShow = 2;
        let html = '';

        categories.slice(0, maxShow).forEach(category => {
            html += `<span class="category-tag">${this.truncateText(category, 15)}</span>`;
        });

        if (categories.length > maxShow) {
            html += `<span class="categories-more">+${categories.length - maxShow}</span>`;
        }

        return html;
    }

    renderAccessType(client) {
        // Detectar tipo de acesso
        const accessType = client.accessType || 'normal'; // fallback para clients antigos

        if (accessType === 'special') {
            return '<span class="access-type-badge access-special">Special</span>';
        } else {
            return '<span class="access-type-badge access-normal">Regular</span>';
        }
    }

    renderStatusBadge(client) {
        const now = new Date();
        const isExpired = client.expiresAt && new Date(client.expiresAt) < now;

        if (isExpired) {
            return '<span class="status-badge-client status-expired">Expired</span>';
        } else if (client.isActive) {
            return '<span class="status-badge-client status-active">Active</span>';
        } else {
            return '<span class="status-badge-client status-inactive">Inactive</span>';
        }
    }

    // ===== MODAL AND FORM =====
    openCreateModal() {
        this.currentClient = null;
        this.selectedCategories = [];

        // Reset form
        this.form.reset();

        // Reset all fields explicitly
        document.getElementById('clientName').value = '';
        document.getElementById('clientEmail').value = '';
        document.getElementById('clientPhone').value = '';
        document.getElementById('companyName').value = '';
        document.getElementById('addressLine1').value = '';
        document.getElementById('addressLine2').value = '';
        document.getElementById('city').value = '';
        document.getElementById('state').value = '';
        document.getElementById('zipCode').value = '';
        document.getElementById('expireDays').value = '30';
        document.getElementById('showPrices').checked = true;
        document.getElementById('showPricesLabel').textContent = 'Enabled';

        // Update titles
        document.getElementById('modalTitle').textContent = 'New Access Code';
        document.getElementById('saveButtonText').textContent = 'Create Code';

        // Generate code preview
        this.generateCodePreview();

        // Render categories
        this.renderCategoriesSelection();

        // Show modal
        this.modal.classList.add('active');
        document.getElementById('clientName').focus();
    }

    async closeModal() {
        // NOVA PROTEÇÃO com modal customizado
        if (this.hasUnsavedChanges) {
            const shouldClose = await this.showConfirmModal(
                'Do you really want to close without saving?<br>' +
                'Click <strong>OK</strong> to discard changes or <strong>Cancel</strong> to continue editing.'
            );

            if (!shouldClose) {
                return; // Não fecha o modal
            }
        }

        // Código original para fechar
        this.modal.classList.remove('active');
        this.currentClient = null;
        this.selectedCategories = [];

        // Limpa flags de controle
        this.hasUnsavedChanges = false;
        this.originalFormData = null;
    }

    generateCodePreview() {
        // Generate unique 4-digit code
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        document.getElementById('codePreview').textContent = code;
    }

    renderCategoriesSelection() {
        const container = document.getElementById('categoriesSelection');

        if (this.availableCategories.length === 0) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No categories available</p>
                </div>
            `;
            return;
        }

        const html = this.availableCategories.map(category => `
            <div class="category-item">
                <input type="checkbox" 
                       class="category-checkbox" 
                       id="cat_${category.id}" 
                       value="${category.name}"
                       ${this.selectedCategories.includes(category.name) ? 'checked' : ''}
                       onchange="adminClients.handleCategoryChange('${category.name}', this.checked)">
                <div class="category-info">
                    <div class="category-name">${category.name}</div>
                    <div class="category-details">Updated: ${this.formatDate(category.modifiedTime)}</div>
                </div>
                <div class="category-preview">
                    <i class="fas fa-folder"></i>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    handleCategoryChange(categoryName, isChecked) {
        if (isChecked) {
            if (!this.selectedCategories.includes(categoryName)) {
                this.selectedCategories.push(categoryName);
            }
        } else {
            this.selectedCategories = this.selectedCategories.filter(cat => cat !== categoryName);
        }
        console.log('📝 Selected categories:', this.selectedCategories);

        // ADICIONE ESTAS DUAS LINHAS NOVAS:
        if (this.originalFormData) {
            this.hasUnsavedChanges = this.checkForChanges();
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        const formData = {
            clientName: document.getElementById('clientName').value.trim(),
            clientEmail: document.getElementById('clientEmail').value.trim(),
            clientPhone: document.getElementById('clientPhone').value.trim(),
            companyName: document.getElementById('companyName').value.trim(),
            addressLine1: document.getElementById('addressLine1').value.trim(),
            addressLine2: document.getElementById('addressLine2').value.trim(),
            city: document.getElementById('city').value.trim(),
            state: document.getElementById('state').value.trim().toUpperCase(),
            zipCode: document.getElementById('zipCode').value.trim(),
            allowedCategories: this.selectedCategories,
            expiresInDays: parseInt(document.getElementById('expireDays').value),
            showPrices: document.getElementById('showPrices').checked,
            accessType: this.currentClient?.accessType || 'normal',
            isActive: true
        };

        // DEBUG - Ver o que está sendo enviado
        console.log('🔍 DEBUG FormData sendo enviado:', {
            showPrices: formData.showPrices,
            clientName: formData.clientName,
            todo: formData
        });

        // ENHANCED VALIDATIONS
        const validationErrors = this.validateFormData(formData);
        if (validationErrors.length > 0) {
            this.showError('Form errors:\n' + validationErrors.join('\n'));
            return;
        }

        try {
            this.showModalLoading(true);

            if (this.currentClient) {
                // EDITING existing client
                console.log('✏️ Editing client:', this.currentClient._id || this.currentClient.code);
                await this.updateClient(this.currentClient._id || this.currentClient.code, formData);
                this.showSuccess('Code updated successfully!');
            } else {
                // CREATING new client
                console.log('➕ Creating new client');
                await this.createClient(formData);
                this.showSuccess('Code created successfully!');
            }

            this.closeModal();
            this.hasUnsavedChanges = false; // ADICIONE ESTA LINHA
            this.originalFormData = null;    // ADICIONE ESTA LINHA
            await this.refreshData();

        } catch (error) {
            console.error('❌ Error saving:', error);
            this.showError(error.message || 'Error saving code');
        } finally {
            this.showModalLoading(false);
        }
    }

    async createClient(formData) {
        const token = this.getAdminToken();
        const response = await fetch('/api/admin/access-codes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error creating code');
        }

        return data.accessCode;
    }

    // ===== UPDATE CLIENT FUNCTION =====
    async updateClient(clientId, formData) {
        const token = this.getAdminToken();

        console.log('✏️ Updating client:', clientId, formData);

        const response = await fetch(`/api/admin/access-codes/${clientId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error updating code');
        }

        console.log('✅ Client updated successfully');
        return data.accessCode;
    }

    // ===== DELETE CLIENT FUNCTION =====
    async deleteClient(clientId) {
        const token = this.getAdminToken();

        console.log('🗑️ Deleting client:', clientId);

        const response = await fetch(`/api/admin/access-codes/${clientId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error deleting code');
        }

        console.log('✅ Client deleted successfully');
        return true;
    }

    // ===== IMPROVED STATUS TOGGLE FUNCTION =====
    async updateClientStatus(clientId, isActive) {
        const token = this.getAdminToken();

        console.log(`🔄 ${isActive ? 'Activating' : 'Deactivating'} client:`, clientId);

        const response = await fetch(`/api/admin/access-codes/${clientId}/toggle`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isActive })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error changing code status');
        }

        console.log(`✅ Client ${isActive ? 'activated' : 'deactivated'} successfully`);
        return data.accessCode;
    }

    // ===== ADVANCED FORM VALIDATION =====
    validateFormData(formData) {
        const errors = [];

        // Validate name
        if (!formData.clientName || formData.clientName.length < 2) {
            errors.push('Name must have at least 2 characters');
        }

        // Validate email (if provided)
        if (formData.clientEmail && !this.isValidEmail(formData.clientEmail)) {
            errors.push('Invalid email address');
        }

        // Debug
        console.log('🔍 DEBUG validateEditForm:');
        console.log('  formData.accessType:', formData.accessType);
        console.log('  formData.allowedCategories:', formData.allowedCategories);

        // Só validar categorias se NÃO for Special Selection
        const isSpecialSelection = formData.accessType === 'special';

        if (!isSpecialSelection && (!formData.allowedCategories || formData.allowedCategories.length === 0)) {
            errors.push('Select at least one category');
        }

        // Validate expiration days
        if (!formData.expiresInDays || formData.expiresInDays < 1 || formData.expiresInDays > 365) {
            errors.push('Expiration days must be between 1 and 365');
        }

        return errors;
    }

    // ===== VALIDATE EMAIL =====
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // ===== CHECK UNIQUE CODE FUNCTION =====
    async checkCodeUnique(code, excludeId = null) {
        try {
            const token = this.getAdminToken();
            const response = await fetch(`/api/admin/access-codes/check-unique?code=${code}&exclude=${excludeId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            return data.isUnique;

        } catch (error) {
            console.error('❌ Error checking unique code:', error);
            return true; // In case of error, assume it's unique
        }
    }

    // ===== GENERATE GUARANTEED UNIQUE CODE =====
    async generateUniqueCode() {
        let attempts = 0;
        let code;
        let isUnique = false;

        while (!isUnique && attempts < 50) {
            code = Math.floor(1000 + Math.random() * 9000).toString();
            isUnique = await this.checkCodeUnique(code);
            attempts++;
        }

        if (!isUnique) {
            throw new Error('Unable to generate unique code. Please try again.');
        }

        return code;
    }

    // ===== DUPLICATE CODE FUNCTION =====
    duplicateClient(clientId) {
        const client = this.clients.find(c => c._id === clientId || c.code === clientId);
        if (!client) return;

        this.currentClient = null; // Reset to create new
        this.selectedCategories = [...client.allowedCategories];

        // Fill form with existing client data
        document.getElementById('clientName').value = client.clientName + ' (Copy)';
        document.getElementById('clientEmail').value = client.clientEmail || '';
        document.getElementById('expireDays').value = this.calculateDaysUntilExpiry(client.expiresAt);
        document.getElementById('clientStatus').value = 'true'; // Always active for copy

        // Generate new code
        this.generateCodePreview();

        // Update titles
        document.getElementById('modalTitle').textContent = 'Duplicate Access Code';
        document.getElementById('saveButtonText').textContent = 'Create Copy';

        // Render categories
        this.renderCategoriesSelection();

        // Show modal
        this.modal.classList.add('active');
        document.getElementById('clientName').focus();
        document.getElementById('clientName').select();
    }

    // ===== CRITICAL ACTION CONFIRMATION =====
    async confirmAction(action, clientName) {
        const messages = {
            delete: `Are you sure you want to DELETE the code for client "${clientName}"?\n\nThis action cannot be undone.`,
            deactivate: `Deactivate the code for client "${clientName}"?\n\nThe client will no longer be able to log in.`,
            activate: `Activate the code for client "${clientName}"?\n\nThe client will be able to log in again.`
        };

        return confirm(messages[action] || 'Confirm action?');
    }

    // ===== EXPORT DATA FUNCTION =====
    exportClientsData() {
        try {
            const dataToExport = this.clients.map(client => ({
                code: client.code,
                name: client.clientName,
                email: client.clientEmail || '',
                categories: client.allowedCategories.join('; '),
                status: client.isActive ? 'Active' : 'Inactive',
                usage: client.usageCount || 0,
                last_used: client.lastUsed ? this.formatDate(client.lastUsed) : 'Never',
                expires_on: this.formatDate(client.expiresAt),
                created_on: this.formatDate(client.createdAt)
            }));

            const csvContent = this.convertToCSV(dataToExport);
            this.downloadCSV(csvContent, `sunshine_clients_${new Date().toISOString().split('T')[0]}.csv`);

            this.showSuccess('Data exported successfully!');

        } catch (error) {
            console.error('❌ Error exporting:', error);
            this.showError('Error exporting data');
        }
    }

    // ===== CONVERT TO CSV =====
    convertToCSV(data) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvRows = [];

        // Add headers
        csvRows.push(headers.join(','));

        // Add data
        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                // Escape quotes and line breaks
                return `"${String(value).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });

        return csvRows.join('\n');
    }

    // ===== DOWNLOAD CSV =====
    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // ===== CLIENT STATISTICS =====
    getClientsStatistics() {
        const now = new Date();

        const stats = {
            total: this.clients.length,
            active: this.clients.filter(c => c.isActive && new Date(c.expiresAt) > now).length,
            inactive: this.clients.filter(c => !c.isActive).length,
            expired: this.clients.filter(c => new Date(c.expiresAt) <= now).length,
            mostUsedCategory: null,
            totalUsage: this.clients.reduce((sum, c) => sum + (c.usageCount || 0), 0),
            averageUsage: 0
        };

        // Calculate usage average
        if (stats.total > 0) {
            stats.averageUsage = Math.round(stats.totalUsage / stats.total * 100) / 100;
        }

        // Find most used category
        const categoryCount = {};
        this.clients.forEach(client => {
            client.allowedCategories.forEach(category => {
                categoryCount[category] = (categoryCount[category] || 0) + (client.usageCount || 0);
            });
        });

        if (Object.keys(categoryCount).length > 0) {
            stats.mostUsedCategory = Object.keys(categoryCount).reduce((a, b) =>
                categoryCount[a] > categoryCount[b] ? a : b
            );
        }

        return stats;
    }

    // ===== ADVANCED SEARCH FUNCTION =====
    performAdvancedSearch(query) {
        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);

        return this.clients.filter(client => {
            const searchableText = [
                client.clientName,
                client.clientEmail || '',
                client.code,
                ...client.allowedCategories
            ].join(' ').toLowerCase();

            return searchTerms.every(term => searchableText.includes(term));
        });
    }

    // ===== TABLE ACTIONS =====
    viewClient(clientId) {
        const client = this.clients.find(c => c._id === clientId || c.code === clientId);
        if (!client) {
            this.showError('Client not found');
            return;
        }

        console.log('👁️ Opening view modal for client:', client.clientName);

        // Preencher dados básicos
        document.getElementById('viewModalTitle').textContent = `${client.clientName} - Details`;
        document.getElementById('viewClientName').textContent = client.clientName;
        document.getElementById('viewClientEmail').textContent = client.clientEmail || 'No email provided';
        document.getElementById('viewClientCode').textContent = client.code;

        // Dados adicionais (se os elementos existirem no HTML)
        const phoneElement = document.getElementById('viewClientPhone');
        const companyElement = document.getElementById('viewClientCompany');
        const addressElement = document.getElementById('viewClientAddress');

        if (phoneElement) phoneElement.textContent = client.clientPhone || 'Not provided';
        if (companyElement) companyElement.textContent = client.companyName || 'Not provided';
        if (addressElement) {
            const addressParts = [
                client.addressLine1,
                client.addressLine2,
                client.city,
                client.state,
                client.zipCode
            ].filter(part => part && part.trim());

            addressElement.textContent = addressParts.length > 0 ? addressParts.join(', ') : 'Not provided';
        }

        // Status com badge
        const statusEl = document.getElementById('viewClientStatus');
        const now = new Date();
        const isExpired = client.expiresAt && new Date(client.expiresAt) < now;

        if (isExpired) {
            statusEl.innerHTML = '<span style="color: #ef4444;">⚠️ Expired</span>';
        } else if (client.isActive) {
            statusEl.innerHTML = '<span style="color: #22c55e;">✅ Active</span>';
        } else {
            statusEl.innerHTML = '<span style="color: #f59e0b;">⏸️ Inactive</span>';
        }

        // Configuração de acesso
        document.getElementById('viewAccessType').textContent = client.accessType || 'Regular';
        document.getElementById('viewExpirationDate').textContent = this.formatDate(client.expiresAt);
        document.getElementById('viewCreatedDate').textContent = this.formatDate(client.createdAt);
        document.getElementById('viewDaysLeft').textContent = this.calculateDaysUntilExpiry(client.expiresAt) + ' days';

        // Categorias permitidas
        const categoriesContainer = document.getElementById('viewAllowedCategories');
        if (client.allowedCategories && client.allowedCategories.length > 0) {
            categoriesContainer.innerHTML = client.allowedCategories.map(category =>
                `<span class="view-category-tag">${category}</span>`
            ).join('');
        } else {
            categoriesContainer.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">No categories assigned</span>';
        }

        // Estatísticas de uso
        document.getElementById('viewTotalLogins').textContent = client.usageCount || 0;
        document.getElementById('viewDaysActive').textContent = this.calculateDaysActive(client.createdAt);
        document.getElementById('viewLastAccess').textContent = this.calculateDaysSinceLastAccess(client.lastUsed);

        // Informações de segurança (placeholder para futuras implementações)
        document.getElementById('viewLastIP').textContent = client.lastIP || 'Not tracked';
        document.getElementById('viewLastDevice').textContent = client.lastDevice || 'Not tracked';
        document.getElementById('viewAccountType').textContent = client.accessType === 'special' ? 'Special Access' : 'Standard';
        document.getElementById('viewRiskLevel').textContent = isExpired ? 'Medium' : 'Low';

        // Mostrar modal
        document.getElementById('clientViewModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    editClient(clientId) {
        const client = this.clients.find(c => c._id === clientId || c.code === clientId);
        if (!client) return;

        this.currentClient = client;

        // FIX: Normalize categories to match with Google Drive
        this.selectedCategories = client.allowedCategories.map(category => {
            // Find corresponding category in Google Drive
            const matchingCategory = this.availableCategories.find(available => {
                const normalize = (str) => str.toLowerCase().replace(/^\d+\.?\s*/, '').trim();
                return normalize(available.name) === normalize(category);
            });

            // Return Google Drive name if found, otherwise keep original
            return matchingCategory ? matchingCategory.name : category;
        }).filter((cat, index, arr) => arr.indexOf(cat) === index); // Remove duplicates

        console.log('🔧 Original categories:', client.allowedCategories);
        console.log('🔧 Normalized categories:', this.selectedCategories);

        // Fill form - Basic Info
        document.getElementById('clientName').value = client.clientName;
        document.getElementById('clientEmail').value = client.clientEmail || '';
        document.getElementById('clientPhone').value = client.clientPhone || '';
        document.getElementById('companyName').value = client.companyName || '';

        // Fill form - Address Info  
        document.getElementById('addressLine1').value = client.addressLine1 || '';
        document.getElementById('addressLine2').value = client.addressLine2 || '';
        document.getElementById('city').value = client.city || '';
        document.getElementById('state').value = client.state || '';
        document.getElementById('zipCode').value = client.zipCode || '';

        // Fill form - Settings
        document.getElementById('expireDays').value = this.calculateDaysUntilExpiry(client.expiresAt);
        document.getElementById('codePreview').textContent = client.code;

        // Fill Show Prices toggle
        document.getElementById('showPrices').checked = client.showPrices !== false;
        document.getElementById('showPricesLabel').textContent = client.showPrices !== false ? 'Enabled' : 'Disabled';

        // Update titles
        document.getElementById('modalTitle').textContent = 'Edit Access Code';
        document.getElementById('saveButtonText').textContent = 'Save Changes';

        // Render categories
        this.renderCategoriesSelection();

        // Show modal
        this.modal.classList.add('active');

        // ADICIONE ESTE BLOCO NOVO NO FINAL DA FUNÇÃO:
        // Salva estado original e configura detecção de mudanças
        setTimeout(() => {
            this.saveOriginalFormState();
            this.setupChangeDetection();
        }, 100);
    }

    // ===== NOVAS FUNÇÕES DE PROTEÇÃO DE DADOS =====
    saveOriginalFormState() {
        this.originalFormData = {
            clientName: document.getElementById('clientName').value,
            clientEmail: document.getElementById('clientEmail').value,
            clientPhone: document.getElementById('clientPhone').value,
            companyName: document.getElementById('companyName').value,
            addressLine1: document.getElementById('addressLine1').value,
            addressLine2: document.getElementById('addressLine2').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zipCode: document.getElementById('zipCode').value,
            expireDays: document.getElementById('expireDays').value,
            showPrices: document.getElementById('showPrices').checked,
            selectedCategories: [...this.selectedCategories]
        };
        this.hasUnsavedChanges = false;
    }

    setupChangeDetection() {
        // Remove listeners antigos se existirem
        const inputs = document.querySelectorAll('#clientForm input, #clientForm select');

        inputs.forEach(input => {
            // Remove listener antigo
            input.removeEventListener('input', this.detectChange);
            input.removeEventListener('change', this.detectChange);

            // Adiciona novo listener
            const detectChange = () => {
                this.hasUnsavedChanges = this.checkForChanges();
            };

            if (input.type === 'checkbox') {
                input.addEventListener('change', detectChange);
            } else {
                input.addEventListener('input', detectChange);
            }
        });
    }

    checkForChanges() {
        if (!this.originalFormData) return false;

        const currentData = {
            clientName: document.getElementById('clientName').value,
            clientEmail: document.getElementById('clientEmail').value,
            clientPhone: document.getElementById('clientPhone').value,
            companyName: document.getElementById('companyName').value,
            addressLine1: document.getElementById('addressLine1').value,
            addressLine2: document.getElementById('addressLine2').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zipCode: document.getElementById('zipCode').value,
            expireDays: document.getElementById('expireDays').value,
            showPrices: document.getElementById('showPrices').checked,
            selectedCategories: [...this.selectedCategories]
        };

        // Compara cada campo
        for (let key in currentData) {
            if (key === 'selectedCategories') {
                if (JSON.stringify(currentData[key]) !== JSON.stringify(this.originalFormData[key])) {
                    return true;
                }
            } else {
                if (currentData[key] !== this.originalFormData[key]) {
                    return true;
                }
            }
        }

        return false;
    }

    async toggleClientStatus(clientId) {
        const client = this.clients.find(c => c._id === clientId || c.code === clientId);
        if (!client) return;

        const isActivating = !client.isActive;

        // ✅ MODAL LUXURY EM VEZ DE CONFIRM FEIO
        this.showLuxuryConfirm({
            title: isActivating ? 'Activate Client Code' : 'Deactivate Client Code',
            message: `${isActivating ? 'Activate' : 'Deactivate'} the access code for "${client.clientName}"?`,
            details: isActivating
                ? 'The client will be able to log in and access the system.'
                : 'The client will lose access to the system immediately.',
            icon: isActivating ? 'fas fa-play' : 'fas fa-pause',
            actionText: isActivating ? 'Activate' : 'Deactivate',
            buttonClass: isActivating ? 'btn-activate' : 'btn-deactivate',
            onConfirm: async () => {
                try {
                    await this.updateClientStatus(clientId, isActivating);
                    client.isActive = isActivating;
                    this.renderClientsTable();
                    console.log(`✅ Client ${isActivating ? 'activated' : 'deactivated'}: ${client.clientName}`);
                } catch (error) {
                    console.error('❌ Error changing status:', error);
                    this.showError(`Error ${isActivating ? 'activating' : 'deactivating'} code: ` + error.message);
                }
            }
        });
    }

    // ===== FILTERS AND SEARCH =====
    handleSearch(query) {
        this.filters.search = query.toLowerCase();
        this.applyFilters();
    }

    handleStatusFilter(status) {
        this.filters.status = status;
        this.applyFilters();
    }

    handleSort(sortBy) {
        this.filters.sortBy = sortBy;
        this.applyFilters();
    }

    applyFilters() {
        let filteredClients = [...this.clients];

        // Apply search
        if (this.filters.search) {
            filteredClients = filteredClients.filter(client =>
                client.clientName.toLowerCase().includes(this.filters.search) ||
                client.code.includes(this.filters.search) ||
                (client.clientEmail && client.clientEmail.toLowerCase().includes(this.filters.search))
            );
        }

        // Apply status filter
        if (this.filters.status !== 'all') {
            filteredClients = filteredClients.filter(client => {
                const now = new Date();
                const isExpired = client.expiresAt && new Date(client.expiresAt) < now;

                switch (this.filters.status) {
                    case 'active':
                        return client.isActive && !isExpired;
                    case 'inactive':
                        return !client.isActive;
                    case 'expired':
                        return isExpired;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        if (this.filters.sortBy) {
            filteredClients.sort((a, b) => {
                switch (this.filters.sortBy) {
                    case 'name':
                        return a.clientName.localeCompare(b.clientName);
                    case 'code':
                        return a.code.localeCompare(b.code);
                    case 'usage':
                        return (b.usageCount || 0) - (a.usageCount || 0);
                    case 'recent':
                    default:
                        return new Date(b.createdAt) - new Date(a.createdAt);
                }
            });
        }

        // Update array temporarily for rendering
        const originalClients = this.clients;
        this.clients = filteredClients;
        this.renderClientsTable();
        this.clients = originalClients;
    }

    async refreshData() {
        this.showLoading(true);
        try {
            await Promise.all([
                this.loadClients(),
                this.loadAvailableCategories()
            ]);
            this.renderClientsTable();
            console.log('✅ Client data refreshed successfully'); // ✅ SÓ LOG, SEM ALERT
        } catch (error) {
            this.showError('Error updating data');
        } finally {
            this.showLoading(false);
        }
    }

    // ===== UTILITIES =====
    getAdminToken() {
        const sessionData = localStorage.getItem('sunshineSession');
        if (sessionData) {
            const session = JSON.parse(sessionData);
            return session.token;
        }
        return null;
    }

    formatDate(date, fallback = '-') {
        if (!date) return fallback;
        return new Date(date).toLocaleDateString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    calculateDaysUntilExpiry(expiresAt) {
        if (!expiresAt) return 30;
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
    }

    truncateText(text, length) {
        if (!text || text.length <= length) return text;
        return text.substring(0, length) + '...';
    }

    // ===== LOADING AND FEEDBACK =====
    showLoading(show) {
        // ✅ LOADING INTELIGENTE: Só na área de dados, não na sidebar
        const tableContainer = this.section?.querySelector('.clients-table-container');

        if (!tableContainer) return; // Se não existe tabela, não fazer loading

        let dataLoading = tableContainer.querySelector('.luxury-loading');

        if (!dataLoading && show) {
            // Criar loading apenas na área dos dados
            dataLoading = document.createElement('div');
            dataLoading.className = 'luxury-loading';
            dataLoading.style.position = 'absolute';
            dataLoading.style.borderRadius = '8px';
            dataLoading.innerHTML = `
            <div class="luxury-loading-spinner"></div>
            <div class="luxury-loading-text">Updating data...</div>
        `;

            // Tornar container relativo para o loading absoluto
            tableContainer.style.position = 'relative';
            tableContainer.appendChild(dataLoading);
        }

        if (dataLoading) {
            dataLoading.style.display = show ? 'flex' : 'none';
        }
    }

    showModalLoading(show) {
        const modalLoading = document.getElementById('modalLoading');
        if (modalLoading) {
            modalLoading.classList.toggle('active', show);
        }
    }

    showError(message) {
        console.error('❌ Error:', message);
        // TODO: Implement better notification system
        UISystem.showToast('error', message);
    }

    showSuccess(message) {
        console.log('✅ Success:', message);
        // TODO: Implement better notification system
        UISystem.showToast('success', message);
    }

    closeViewModal() {
        document.getElementById('clientViewModal').classList.remove('active');
        document.body.style.overflow = '';
    }

    // Funções auxiliares para estatísticas
    calculateDaysActive(createdAt) {
        if (!createdAt) return 0;
        const now = new Date();
        const created = new Date(createdAt);
        const diffTime = Math.abs(now - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    calculateDaysSinceLastAccess(lastUsed) {
        if (!lastUsed) return 'Never';
        const now = new Date();
        const lastAccess = new Date(lastUsed);
        const diffTime = Math.abs(now - lastAccess);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays === 1 ? '1 day' : `${diffDays} days`;
    }

    async deleteClient(clientId) {
        const client = this.clients.find(c => c._id === clientId || c.code === clientId);
        if (!client) {
            this.showError('Client not found');
            return;
        }

        const confirmed = await UISystem.confirm(
            'Delete Client',
            `Are you sure you want to DELETE the access code for "${client.clientName}"?<br><br>This action cannot be undone and will remove the client completely from the system.`,
            'Delete',
            'Cancel'
        );

        if (!confirmed) return;

        try {
            const token = this.getAdminToken();
            const response = await fetch(`/api/admin/access-codes/${clientId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Error deleting client');
            }

            this.showSuccess('Client deleted successfully!');
            await this.refreshData();

        } catch (error) {
            console.error('❌ Error deleting client:', error);
            this.showError(`Error deleting client: ${error.message}`);
        }
    }

    // ===== SISTEMA DE CONFIRMAÇÃO LUXURY =====
    showLuxuryConfirm(options) {
        const modal = document.getElementById('luxuryConfirmModal');
        const title = document.getElementById('confirmTitle');
        const message = document.getElementById('confirmMessage');
        const details = document.getElementById('confirmDetails');
        const actionBtn = document.getElementById('confirmActionBtn');

        // Configurar conteúdo do modal
        title.textContent = options.title || 'Confirm Action';
        message.textContent = options.message || 'Are you sure?';

        if (options.details) {
            details.textContent = options.details;
            details.style.display = 'block';
        } else {
            details.style.display = 'none';
        }

        // Configurar botão de ação
        actionBtn.innerHTML = `<i class="${options.icon || 'fas fa-check'}"></i> ${options.actionText || 'Confirm'}`;
        actionBtn.className = `luxury-confirm-btn luxury-confirm-btn-confirm ${options.buttonClass || ''}`;

        // Configurar ação do botão
        actionBtn.onclick = () => {
            this.closeLuxuryConfirm();
            if (options.onConfirm) {
                options.onConfirm();
            }
        };

        // Mostrar modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeLuxuryConfirm() {
        const modal = document.getElementById('luxuryConfirmModal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

}


// ===== GLOBAL INITIALIZATION =====
let adminClients = null;

// Initialize when clients section is activated
document.addEventListener('DOMContentLoaded', () => {
    // Observe changes in active section
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const section = document.getElementById('section-clients');
                if (section && section.style.display !== 'none' && !adminClients) {
                    // Clients section was activated
                    adminClients = new AdminClients();
                    window.adminClients = adminClients; // ✅ ADICIONAR ESTA LINHA
                }
            }
        });
    });

    const clientsSection = document.getElementById('section-clients');
    if (clientsSection) {
        observer.observe(clientsSection, { attributes: true });

        // If already visible, initialize immediately
        if (clientsSection.style.display !== 'none') {
            adminClients = new AdminClients();
            window.adminClients = adminClients; // ✅ EXPOSIÇÃO GLOBAL CORRETA
        }
    }
});