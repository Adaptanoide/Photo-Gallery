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
        this.selectedFolders = [];

        this.hasUnsavedChanges = false;
        this.originalFormData = null;

        this.currentPage = 1;
        this.totalPages = 1;
        this.totalClients = 0;
        this.itemsPerPage = 25;

        this.filters = {
            search: '',
            status: 'all',
            sortBy: 'recent'
        };
        this.init();
    }

    // ===== INITIALIZATION =====
    init() {
        console.log('👥 Initializing Client Management...');
        this.setupElements();
        this.setupEventListeners();
        this.loadInitialData();
        this.startDateUpdateTimer();
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

        //this.showLoading(true);

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
                            placeholder="Name, company or email...">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Status</label>
                        <select id="filterStatus" class="filter-select">
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Sort by</label>
                            <select id="sortClients" class="filter-select">
                                <option value="recent">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="last-access">Recently Accessed</option>
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
                            <th>Company</th>
                            <th>Sales Rep</th>
                            <th>Usage</th>
                            <th>Created</th>
                            <th style="text-align: center;">Status</th>
                            <th style="text-align: center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="clientsTableBody">
                        <tr>
                            <td colspan="9" class="text-center">
                                <i class="fas fa-spinner fa-spin"></i>
                                Loading codes...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Paginação -->
            <div id="clientsPagination" class="pricing-pagination" style="display: flex;">
                <button id="btnPrevPage" class="btn btn-secondary" onclick="adminClients.goToPage(adminClients.currentPage - 1)">
                    <i class="fas fa-chevron-left"></i>
                    Previous
                </button>
                
                <div id="paginationNumbers" class="pagination-numbers" style="display: flex; gap: 5px; margin: 0 15px;">
                    <!-- Números aqui -->
                </div>
                
                <button id="btnNextPage" class="btn btn-secondary" onclick="adminClients.goToPage(adminClients.currentPage + 1)">
                    Next
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>

            <!-- Client Modal (EDIT) - SEM FOLDERS -->
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
                                        <label class="form-label-clients">Phone</label>
                                        <input type="tel" id="clientPhone" class="form-input-clients" 
                                            placeholder="(555) 123-4567">
                                    </div>
                                    <div class="form-group-clients">
                                        <label class="form-label-clients required">Sales Rep</label>
                                        <select id="salesRep" class="form-input-clients" required>
                                            <option value="">Select Sales Rep...</option>
                                            
                                            <!-- Individuais -->
                                            <option value="Keith">Keith</option>
                                            <option value="Karen">Karen</option>
                                            <option value="Eddie">Eddie</option>
                                            <option value="Andy">Andy</option>
                                            <option value="Vicky">Vicky</option>
                                            <option value="Eduarda">Eduarda</option>
                                            
                                            <!-- Duplas do Grupo Principal -->
                                            <option value="Eddie / Keith">Eddie / Keith</option>
                                            <option value="Eddie / Karen">Eddie / Karen</option>
                                            <option value="Eddie / Andy">Eddie / Andy</option>
                                            <option value="Keith / Karen">Keith / Karen</option>
                                            <option value="Keith / Andy">Keith / Andy</option>
                                            <option value="Karen / Andy">Karen / Andy</option>
                                            
                                            <!-- Trios do Grupo Principal -->
                                            <option value="Eddie / Keith / Karen">Eddie / Keith / Karen</option>
                                            <option value="Eddie / Keith / Andy">Eddie / Keith / Andy</option>
                                            <option value="Eddie / Karen / Andy">Eddie / Karen / Andy</option>
                                            <option value="Keith / Karen / Andy">Keith / Karen / Andy</option>
                                            
                                            <!-- Todos do Grupo Principal -->
                                            <option value="Eddie / Keith / Karen / Andy">Eddie / Keith / Karen / Andy</option>
                                            
                                            <!-- Dupla Especial -->
                                            <option value="Vicky / Eduarda">Vicky / Eduarda</option>
                                        </select>
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

                            <!-- Access Settings (SEM FOLDERS) -->
                            <div class="form-section-clients">
                                <h4 class="form-section-title-clients">
                                    <i class="fas fa-cog"></i>
                                    Access Settings
                                </h4>
                                <div class="form-grid">
                                    <div class="form-group-clients">
                                        <label class="form-label-clients">Access Code</label>
                                        <div class="code-input-group">
                                            <div id="codePreview" class="code-preview-compact">----</div>
                                            <button type="button" class="btn-copy-code" onclick="adminClients.copyAccessInfo()" title="Copy access info">
                                                <i class="fas fa-copy"></i>
                                            </button>
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

            <!-- Client View Modal (MANTÉM COMO ESTÁ) -->
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
                                    <div class="view-info-label">Created On</div>
                                    <div class="view-info-value" id="viewCreatedDate">-</div>
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

                        <!-- 🛒 NEW SECTION: Current Shopping Cart -->
                        <div class="view-section">
                            <h4 class="view-section-title">
                                <i class="fas fa-shopping-cart"></i>
                                Current Shopping Cart
                            </h4>
                            <div id="viewClientCart" class="view-cart-container">
                                <!-- Cart will be loaded here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal de FOLDERS (APENAS FOLDERS) -->
            <div id="clientSettingsModal" class="client-modal">
                <div class="client-modal-content">
                    <div class="client-modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-folder-open"></i>
                            <span id="settingsModalTitle">Allowed Categories</span>
                        </h3>
                        <button class="modal-close" onclick="adminClients.closeSettingsModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="client-modal-body">
                        <!-- Show Prices Toggle PRIMEIRO -->
                        <div class="form-group-clients" style="margin: 0 0 2rem 0; padding: 1.5rem; background: var(--luxury-dark); border-radius: 8px; border: 1px solid var(--border-subtle);">
                            <label class="form-label-clients">Show Prices to Client</label>
                            <div class="toggle-item">
                                <label class="toggle-switch">
                                    <input type="checkbox" id="showPricesSettings" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                                <span id="showPricesSettingsLabel" style="margin-left: 10px;">Enabled</span>
                            </div>
                            <small style="color: var(--text-muted); margin-top: 5px; display: block;">
                                When disabled, client will see "Contact for Price"
                            </small>
                        </div>

                        <!-- Allowed Folders DEPOIS -->
                        <div class="form-section-clients">
                            <h4 class="form-section-title-clients">
                                <i class="fas fa-sitemap"></i>
                                Select Categories to Allow
                            </h4>
                            
                            <!-- Tree View Container -->
                            <div id="treeViewContainer" style="display: block; margin: 0.5rem 0; border: 1px solid var(--border-subtle); border-radius: 4px; background: var(--luxury-dark); padding: 1rem;">
                                <div id="treeViewContent" class="tree-view-content">
                                    <!-- Tree será carregado aqui -->
                                </div>
                            </div>

                            <div class="selected-folders-container">
                                <label class="form-label-clients">Selected Categories (<span id="settingsSelectedCount">0</span>)</label>
                                <div id="settingsSelectedFoldersList" class="selected-folders-list">
                                    <div class="empty-state">No categories selected</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="client-modal-footer">
                        <button type="button" class="btn-modal btn-cancel" onclick="adminClients.closeSettingsModal()">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                        <button type="button" class="btn-modal btn-save" onclick="adminClients.saveSettings()">
                            <i class="fas fa-save"></i>
                            Save Categories
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal Cart Control -->
            <div id="cartControlModal" class="client-modal">
                <div class="client-modal-content">
                    <div class="client-modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-shopping-cart"></i>
                            <span id="cartControlTitle">Cart Control</span>
                        </h3>
                        <button class="modal-close" onclick="adminClients.closeCartControl()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="client-modal-body">
                        <!-- Cart Summary -->
                        <div class="form-section-clients">
                            <h4 class="form-section-title-clients">
                                <i class="fas fa-chart-bar"></i>
                                Cart Summary
                            </h4>
                            <div id="cartSummary" class="cart-summary-grid">
                                <!-- Será preenchido via JS -->
                            </div>
                        </div>

                        <!-- Time Control -->
                        <div class="form-section-clients">
                            <h4 class="form-section-title-clients">
                                <i class="fas fa-clock"></i>
                                Time Control
                            </h4>
                            <div id="cartTimeControl" class="cart-time-control">
                                <!-- Será preenchido via JS -->
                            </div>
                        </div>

                        <!-- Cart Items -->
                        <div class="form-section-clients">
                            <h4 class="form-section-title-clients">
                                <i class="fas fa-images"></i>
                                Cart Items
                            </h4>
                            <div id="cartItemsList" class="cart-items-list">
                                <!-- Será preenchido via JS -->
                            </div>
                        </div>
                    </div>

                    <div class="client-modal-footer">
                        <button type="button" class="btn-modal btn-cancel" onclick="adminClients.closeCartControl()">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                        <button type="button" class="btn-modal btn-save" onclick="adminClients.saveCartChanges()">
                            <i class="fas fa-save"></i>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal de Confirmação Luxury (MANTÉM) -->
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

        // Toggle Show Prices no Settings Modal  
        const showPricesSettingsToggle = document.getElementById('showPricesSettings');
        if (showPricesSettingsToggle) {
            showPricesSettingsToggle.addEventListener('change', function () {
                const label = document.getElementById('showPricesSettingsLabel');
                label.textContent = this.checked ? 'Enabled' : 'Disabled';
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
    async loadClients(page = 1, showLoading = false) {
        try {
            // Mostrar loading só quando solicitado
            if (showLoading && this.table) {
                this.table.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center">
                        <i class="fas fa-spinner fa-spin"></i>
                        Loading codes...
                    </td>
                </tr>
            `;
            }

            console.log(`🔄 Atualizando clientes - ${new Date().toLocaleTimeString()}`);

            const token = this.getAdminToken();

            // NOVO: Enviar TODOS os filtros para o backend
            const params = new URLSearchParams({
                page: page,
                limit: this.itemsPerPage,
                search: this.filters.search || '',
                status: this.filters.status || 'all',
                sortBy: this.filters.sortBy || 'recent'
            });

            // Buscar com todos os parâmetros
            const response = await fetch(`/api/admin/access-codes?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.clients = data.codes || [];

                if (data.pagination) {
                    this.currentPage = data.pagination.page;
                    this.totalPages = data.pagination.totalPages;
                    this.totalClients = data.pagination.totalCount;

                    // Atualizar UI da paginação
                    //document.getElementById('paginationInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
                    document.getElementById('btnPrevPage').disabled = (this.currentPage === 1);
                    document.getElementById('btnNextPage').disabled = (this.currentPage === this.totalPages);
                    this.renderPaginationNumbers();
                }

                console.log(`✅ Página ${this.currentPage}/${this.totalPages} - Total: ${this.totalClients} clientes (Filtrados)`);
            } else {
                throw new Error(data.message || 'Error loading codes');
            }

        } catch (error) {
            console.error('❌ Error loading clients:', error);
            this.clients = [];
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
                    <td colspan="9" class="text-center">
                        <i class="fas fa-inbox"></i>
                        No codes found
                        <br><small style="color: var(--text-muted);">Click "New Client" to create the first one</small>
                    </td>
                </tr>
            `;
            return;
        }

        const rows = this.clients.map(client => {
            // Badge do carrinho temporário
            let cartBadge = '';
            if (client.cartInfo && client.cartInfo.itemCount > 0) {
                cartBadge = `
                    <div class="cart-indicator" title="${client.cartInfo.itemCount} items in cart">
                        <i class="fas fa-clock"></i>
                        <span class="cart-badge-count">${client.cartInfo.itemCount}</span>
                    </div>
                `;
            }

            return `
                <tr>
                    <td class="client-code-cell">
                        <div class="code-with-cart">
                            <span class="code-text">${client.code}</span>
                            ${cartBadge}
                        </div>
                    </td>
                    <td class="client-name-cell">
                        <div>${client.clientName}</div>
                        <div class="client-email-cell">${client.clientEmail || 'No email'}</div>
                    </td>
                    <td class="client-company-cell">
                        <div class="company-name">${client.companyName || '-'}</div>
                    </td>
                    <td class="client-sales-rep-cell">
                        <div class="sales-rep-name">
                            ${client.salesRep || 'Unassigned'}
                        </div>
                    </td>
                    <td class="client-usage-cell">
                        <div class="usage-count">${client.usageCount || 0}x</div>
                        <div class="usage-last">${this.formatDate(client.lastUsed, 'Never used')}</div>
                    </td>
                    <td class="client-created-cell">
                        <div style="font-weight: 500;">${this.formatDate(client.createdAt)}</div>
                        <div style="font-size: 0.85em; color: var(--text-muted);">${this.getDaysAgo(client.createdAt)}</div>
                    </td>
                    <td class="client-status-cell">
                        ${this.renderStatusBadge(client)}
                    </td>
                    <td class="client-actions-cell">
                        <div class="action-buttons">
                            <button class="special-btn-icon cart" onclick="adminClients.openCartControl('${client._id || client.code}')" title="Cart Control">
                                <i class="fas fa-shopping-cart"></i>
                            </button>
                            <button class="special-btn-icon settings" onclick="adminClients.openSettingsModal('${client._id || client.code}')" title="Permissions">
                                <i class="fas fa-key"></i>
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
            `;
        }).join('');

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
        if (client.isActive) {
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
        document.getElementById('salesRep').value = '';
        // showPrices removido - agora está em Permissions
        //document.getElementById('showPricesLabel').textContent = 'Enabled';

        // Update titles
        document.getElementById('modalTitle').textContent = 'New Access Code';
        document.getElementById('saveButtonText').textContent = 'Create Code';

        // Generate code preview
        this.generateCodePreview();

        this.selectedFolders = [];

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

    copyAccessInfo() {
        const code = document.getElementById('codePreview').textContent;
        const clientName = document.getElementById('clientName').value || 'Client';

        const accessInfo = `Hello ${clientName},\n\nHere is your exclusive access to Sunshine Cowhides Gallery:\n\n🌐 Website: https://sunshinecowhides-gallery.com\n🔑 Access Code: ${code}\n\nInstructions:\n1. Visit the website above\n2. Enter your 4-digit access code: ${code}\n3. Browse and select your preferred cowhides\n4. Your selections will be saved for 24 hours\n\nNeed assistance? Contact us anytime.\n\nBest regards,\nSunshine Cowhides Team`;

        navigator.clipboard.writeText(accessInfo).then(() => {
            // Pegar o botão sem usar event
            const button = document.querySelector('.btn-copy-code');
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.classList.add('copied');

            UISystem.showToast('success', 'Access information copied!');

            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            UISystem.showToast('error', 'Failed to copy');
        });
    }

    async handleFolderSearch(query) {
        if (query.length < 2) {
            document.getElementById('folderSearchResults').innerHTML = '';
            return;
        }

        try {
            // Usar token da sessão atual
            const token = this.getAdminToken();

            // Chamar rota real do backend
            const response = await fetch(`/api/admin/folders-search?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                console.log(`🔍 Encontrados ${data.results.length} resultados para: ${query}`);
                this.displaySearchResults(data.results);
            } else {
                console.error('❌ Erro na busca:', data.message);
                document.getElementById('folderSearchResults').innerHTML = '<div class="no-results">Erro na busca</div>';
            }
        } catch (error) {
            console.error('❌ Search error:', error);
            document.getElementById('folderSearchResults').innerHTML = '<div class="no-results">Erro na conexão</div>';
        }
    }

    displaySearchResults(results) {
        const container = document.getElementById('folderSearchResults');

        if (results.length === 0) {
            container.innerHTML = '<div class="no-results">No folders found</div>';
            return;
        }

        // Filtrar resultados que já foram selecionados
        const filteredResults = results.filter(item =>
            !this.selectedFolders.find(f => f.path === item.path)
        );

        if (filteredResults.length === 0) {
            container.innerHTML = '<div class="no-results">All matching folders already selected</div>';
            return;
        }

        container.innerHTML = filteredResults.map(item => `
            <div class="search-result-item" onclick="adminClients.addFolder('${item.qbItem}', '${item.path.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">
                <span class="folder-qb">${item.qbItem}</span>
                <span class="folder-path">${item.path}</span>
                <span class="folder-count">${item.photoCount} photos</span>
            </div>
        `).join('');
    }

    async addFolder(qbItem, path) {
        if (this.selectedFolders.find(f => f.path === path)) {
            UISystem.showToast('warning', 'Folder already selected');
            return;
        }

        this.selectedFolders.push({
            qbItem,
            path: path.replace(/"/g, '&quot;')
        });
        this.updateSettingsFoldersList(); // MUDANÇA: usar updateSettingsFoldersList ao invés de updateSelectedFoldersList

        // Carregar árvore se necessário
        const treeContainer = document.getElementById('treeViewContent'); // MUDANÇA: usar treeViewContent
        if (!treeContainer || !treeContainer.innerHTML || treeContainer.innerHTML.trim() === '' || treeContainer.innerHTML.includes('Loading categories')) {
            await this.loadTreeView(); // MUDANÇA: usar loadTreeView
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Marcar checkbox na árvore
        setTimeout(() => {
            const checkbox = document.querySelector(`.tree-checkbox[data-qbitem="${qbItem}"]`);
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                this.updateParentCheckboxes();
            }
        }, 100);

        // Manter o valor do input mas refazer a busca
        const searchInput = document.getElementById('folderSearchInput');
        const currentQuery = searchInput.value;

        // Re-executar a busca para atualizar os resultados
        if (currentQuery && currentQuery.length >= 2) {
            this.handleFolderSearch(currentQuery);
        }

        UISystem.showToast('success', `Added: ${qbItem}`);
    }

    removeFolder(path) {
        this.selectedFolders = this.selectedFolders.filter(f => f.path !== path);
        this.updateSettingsFoldersList(); // MUDOU AQUI
    }

    updateSelectedFoldersList() {
        const container = document.getElementById('selectedFoldersList');
        const count = document.getElementById('selectedCount');

        // Proteção: se elementos não existem, sair
        if (!container || !count) {
            return;
        }

        count.textContent = this.selectedFolders.length;

        if (this.selectedFolders.length === 0) {
            container.innerHTML = '<div class="empty-state">No folders selected</div>';
            return;
        }

        container.innerHTML = this.selectedFolders.map(folder => `
            <div class="selected-folder-item">
                <span class="folder-qb">${folder.qbItem}</span>
                <span class="folder-path">${folder.path}</span>
                <button class="btn-remove-folder" onclick="adminClients.removeFolder('${folder.path}')">×</button>
            </div>
        `).join('');
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
            salesRep: document.getElementById('salesRep').value.trim(),
            allowedCategories: this.selectedCategories.length > 0 ? this.selectedCategories : [],
            showPrices: this.currentClient ? (this.currentClient.showPrices || false) : false,
            accessType: this.currentClient?.accessType || 'normal',
            isActive: true,
            code: this.currentClient ? this.currentClient.code : document.getElementById('codePreview').textContent
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
                // EDITING existing client - comportamento normal
                console.log('✏️ Editing client:', this.currentClient._id || this.currentClient.code);
                await this.updateClient(this.currentClient._id || this.currentClient.code, formData);
                this.showSuccess('Code updated successfully!');

                this.hasUnsavedChanges = false;
                this.originalFormData = null;
                this.closeModal();
                await this.refreshData();

            } else {
                // CREATING new client - vai abrir permissões depois
                console.log('➕ Creating new client');
                const newClientData = await this.createClient(formData);
                this.showSuccess('Code created successfully!');

                // Guardar código do cliente criado
                const createdCode = formData.code;

                // Limpar e fechar modal de criação
                this.hasUnsavedChanges = false;
                this.originalFormData = null;
                this.closeModal();

                // Atualizar lista de clientes
                await this.refreshData();

                // Aguardar um pouco e abrir modal de permissões
                setTimeout(() => {
                    // Encontrar o cliente recém criado
                    const newClient = this.clients.find(c => c.code === createdCode);
                    if (newClient) {
                        // Mostrar mensagem
                        this.showSuccess('Now configure permissions for the new client');
                        // Abrir modal de permissões
                        this.openSettingsModal(newClient._id || newClient.code);
                    }
                }, 500);
            }

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

        // Validar nome (obrigatório)
        if (!formData.clientName || formData.clientName.length < 2) {
            errors.push('Name must have at least 2 characters');
        }

        // Validar Sales Rep (obrigatório)
        if (!formData.salesRep || formData.salesRep.trim().length === 0) {
            errors.push('Sales Rep is required');
        }

        // Validar email SE fornecido
        if (formData.clientEmail && !this.isValidEmail(formData.clientEmail)) {
            errors.push('Invalid email address');
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

        this.updateSelectedFoldersList();

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
        document.getElementById('viewClientPhone').textContent = client.clientPhone || 'Not provided';
        document.getElementById('viewClientCompany').textContent = client.companyName || 'Not provided';

        // Address
        const addressParts = [
            client.addressLine1,
            client.addressLine2,
            client.city,
            client.state,
            client.zipCode
        ].filter(part => part && part.trim());
        document.getElementById('viewClientAddress').textContent =
            addressParts.length > 0 ? addressParts.join(', ') : 'Not provided';

        // Status
        const statusEl = document.getElementById('viewClientStatus');
        const now = new Date();
        const isExpired = client.expiresAt && new Date(client.expiresAt) < now;

        if (isExpired) {
            statusEl.innerHTML = '<span class="status-badge status-expired">⚠️ Expired</span>';
        } else if (client.isActive) {
            statusEl.innerHTML = '<span class="status-badge status-active">✅ Active</span>';
        } else {
            statusEl.innerHTML = '<span class="status-badge status-inactive">⏸️ Inactive</span>';
        }

        // Access Configuration
        document.getElementById('viewAccessType').textContent = client.accessType || 'Regular';

        // Allowed Categories - COLLAPSIBLE VERSION
        const categoriesContainer = document.getElementById('viewAllowedCategories');
        const categoriesCount = client.allowedCategories ? client.allowedCategories.length : 0;

        if (categoriesCount > 0) {
            // Cria uma versão que colapsa/expande
            categoriesContainer.innerHTML = `
                <div class="categories-collapsible">
                    <div class="categories-header" onclick="adminClients.toggleCategoriesView()">
                        <span class="categories-summary">
                            <i class="fas fa-folder-tree"></i>
                            <strong>${categoriesCount}</strong> categories allowed
                        </span>
                        <span class="categories-toggle">
                            <i class="fas fa-chevron-down" id="categoriesToggleIcon"></i>
                        </span>
                    </div>
                    <div class="categories-content" id="categoriesContent" style="display: none;">
                        <div class="categories-grid">
                            ${client.allowedCategories.map(category =>
                `<div class="category-item">
                                    <i class="fas fa-tag"></i>
                                    <span>${category}</span>
                                </div>`
            ).join('')}
                        </div>
                    </div>
                </div>
            `;
        } else {
            categoriesContainer.innerHTML = `
                <div class="categories-empty">
                    <i class="fas fa-folder-open"></i>
                    <span>No categories assigned</span>
                </div>
            `;
        }

        // Usage Statistics
        document.getElementById('viewTotalLogins').textContent = client.usageCount || 0;
        document.getElementById('viewDaysActive').textContent = this.calculateDaysActive(client.createdAt);
        document.getElementById('viewLastAccess').textContent = this.calculateDaysSinceLastAccess(client.lastUsed);

        // Security Info
        document.getElementById('viewLastIP').textContent = client.lastIP || 'Not tracked';
        document.getElementById('viewLastDevice').textContent = client.lastDevice || 'Not tracked';
        document.getElementById('viewAccountType').textContent = client.accessType === 'special' ? 'Special Access' : 'Standard';
        document.getElementById('viewRiskLevel').textContent = isExpired ? 'Medium' : 'Low';

        // 🛒 NOVA PARTE: Carregar carrinho
        this.loadClientCart(client.code);

        // Mostrar modal com classe wide para ser mais largo
        const modal = document.getElementById('clientViewModal');
        modal.classList.add('active', 'modal-wide');
        document.body.style.overflow = 'hidden';
    }

    // 🛒 NEW FUNCTION: Load and display client cart
    async loadClientCart(clientCode) {
        const cartContainer = document.getElementById('viewClientCart');

        // Show loading
        cartContainer.innerHTML = `
            <div class="cart-loading">
                <i class="fas fa-spinner fa-spin"></i> Loading cart...
            </div>
        `;

        try {
            const token = this.getAdminToken();
            const response = await fetch(`/api/admin/client/${clientCode}/cart`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!data.success || !data.cart || data.cart.items.length === 0) {
                cartContainer.innerHTML = `
                    <div class="cart-empty">
                        <i class="fas fa-shopping-cart" style="font-size: 2rem; color: var(--text-muted);"></i>
                        <p style="margin-top: 0.5rem;">No items in cart</p>
                    </div>
                `;
                return;
            }

            const cart = data.cart;

            // Render cart
            cartContainer.innerHTML = `
                <div class="cart-summary">
                    <div class="cart-summary-stats">
                        <div class="stat">
                            <span class="stat-label">Total Items:</span>
                            <span class="stat-value">${cart.totalItems}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Last Activity:</span>
                            <span class="stat-value">${this.formatDate(cart.lastActivity)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="cart-items-list">
                    ${cart.items.map((item, index) => {
                const statusClass = item.isExpired ? 'item-expired' : 'item-active';
                const statusText = item.isExpired ?
                    '<span class="expired-badge">Expired</span>' :
                    `<span class="timer">${item.expiresInMinutes}min remaining</span>`;

                return `
                            <div class="cart-item ${statusClass}">
                                <div class="item-number">${index + 1}</div>
                                <div class="item-info">
                                    <div class="item-name">${item.name}</div>
                                    <div class="item-path">
                                        <i class="fas fa-folder-open"></i> 
                                        ${item.category}${item.subcategory ? ' / ' + item.subcategory : ''}
                                    </div>
                                </div>
                                <div class="item-status">${statusText}</div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;

        } catch (error) {
            console.error('Error loading cart:', error);
            cartContainer.innerHTML = `
                <div class="cart-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading cart data</p>
                </div>
            `;
        }
    }

    // Toggle categories view (expand/collapse)
    toggleCategoriesView() {
        const content = document.getElementById('categoriesContent');
        const icon = document.getElementById('categoriesToggleIcon');

        if (content.style.display === 'none') {
            // Expandir
            content.style.display = 'block';
            icon.className = 'fas fa-chevron-up';
        } else {
            // Colapsar
            content.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
        }
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
        document.getElementById('salesRep').value = client.salesRep || '';

        // Fill form - Settings
        document.getElementById('codePreview').textContent = client.code;

        // Fill Show Prices toggle
        // showPrices removido - agora está em Permissions

        // Update titles
        document.getElementById('modalTitle').textContent = 'Edit Access Code';
        document.getElementById('saveButtonText').textContent = 'Save Changes';

        // Carregar folders selecionados do cliente (temporariamente vazio até implementar)
        this.selectedFolders = [];

        // Show modal
        this.modal.classList.add('active');

        // ADICIONE ESTE BLOCO NOVO NO FINAL DA FUNÇÃO:
        // Salva estado original e configura detecção de mudanças
        setTimeout(() => {
            this.saveOriginalFormState();
            this.setupChangeDetection();
        }, 100);
    }

    async openCartControl(clientId) {
        console.log('🛒 Opening Cart Control for client:', clientId);

        try {
            const modal = document.getElementById('cartControlModal');
            if (!modal) return;

            // Buscar dados do cliente
            const client = this.clients.find(c => c._id === clientId || c.code === clientId);
            if (!client) {
                console.error('Client not found');
                return;
            }

            // Abrir modal
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Atualizar título
            document.getElementById('cartControlTitle').textContent = `Cart Control - ${client.clientName}`;

            // Salvar cliente atual para uso posterior
            this.currentCartClient = client;

            // Usar a mesma API que já funciona
            const token = this.getAdminToken();
            const response = await fetch(`/api/admin/client/${client.code}/cart`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!data.success || !data.cart || data.cart.items.length === 0) {
                document.getElementById('cartSummary').innerHTML = '<p>No items in cart</p>';
                document.getElementById('cartTimeControl').innerHTML = '<p>No cart to manage</p>';
                document.getElementById('cartItemsList').innerHTML = '<p>No items</p>';
                return;
            }

            const cart = data.cart;

            // Cart Summary
            document.getElementById('cartSummary').innerHTML = `
            <div class="cart-summary-stats">
                <div class="stat">
                    <span class="stat-label">Total Items:</span>
                    <span class="stat-value">${cart.totalItems}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Last Activity:</span>
                    <span class="stat-value">${this.formatDate(cart.lastActivity)}</span>
                </div>
            </div>
        `;

            // Adicionar botões de controle de tempo
            document.getElementById('cartTimeControl').innerHTML = `
            <div class="time-control-buttons">
                <button class="time-btn" onclick="adminClients.extendTime(0.0167)">1min</button>
                <button class="time-btn" onclick="adminClients.extendTime(0.5)">30min</button>
                <button class="time-btn" onclick="adminClients.extendTime(1)">1h</button>
                <button class="time-btn" onclick="adminClients.extendTime(2)">2h</button>
                <button class="time-btn" onclick="adminClients.extendTime(6)">6h</button>
                <button class="time-btn" onclick="adminClients.extendTime(12)">12h</button>
                <button class="time-btn" onclick="adminClients.extendTime(24)">1 day</button>
                <button class="time-btn" onclick="adminClients.extendTime(48)">2 days</button>
                <button class="time-btn" onclick="adminClients.extendTime(72)">3 days</button>
                <button class="time-btn" onclick="adminClients.extendTime(96)">4 days</button>
                <button class="time-btn" onclick="adminClients.extendTime(120)">5 days</button>
            </div>
        `;

            // Marcar botão da última extensão como ativo
            if (this.lastTimeExtension) {
                setTimeout(() => {
                    const buttons = document.querySelectorAll('.time-btn');
                    buttons.forEach(btn => {
                        if ((this.lastTimeExtension === 0.5 && btn.textContent === '30min') ||
                            (this.lastTimeExtension === 1 && btn.textContent === '1h') ||
                            (this.lastTimeExtension === 2 && btn.textContent === '2h') ||
                            (this.lastTimeExtension === 6 && btn.textContent === '6h') ||
                            (this.lastTimeExtension === 12 && btn.textContent === '12h') ||
                            (this.lastTimeExtension === 24 && btn.textContent === '1 day') ||
                            (this.lastTimeExtension === 48 && btn.textContent === '2 days') ||
                            (this.lastTimeExtension === 72 && btn.textContent === '3 days') ||
                            (this.lastTimeExtension === 96 && btn.textContent === '4 days') ||
                            (this.lastTimeExtension === 120 && btn.textContent === '5 days')) {
                            btn.classList.add('active');
                        }
                    });
                }, 100);
            }

            // Listar items - USAR item.name como no modal original
            document.getElementById('cartItemsList').innerHTML = cart.items.map((item, index) => {
                const statusClass = item.isExpired ? 'item-expired' : 'item-active';
                const statusText = item.isExpired ?
                    '<span class="expired-badge">Expired</span>' :
                    `<span class="timer" style="color: #ea580c;">${this.formatTimeRemaining(item.expiresInMinutes)}</span>`;

                return `
                <div class="cart-item ${statusClass}" style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div class="item-number" style="width: 30px; font-weight: bold;">${index + 1}.</div>
                    <div class="item-info" style="flex: 1;">
                        <div class="item-name" style="font-weight: bold;">${item.name}</div>
                        <div class="item-path" style="font-size: 0.9em; color: #999;">
                            <i class="fas fa-folder-open"></i> 
                            ${item.category}${item.subcategory ? ' / ' + item.subcategory : ''}
                        </div>
                    </div>
                    <div class="item-status" style="width: 150px; text-align: right;">${statusText}</div>
                </div>
            `;
            }).join('');

        } catch (error) {
            console.error('Error:', error);
        }
    }

    formatTimeRemaining(minutes) {
        if (!minutes || minutes <= 0) return 'Expired';

        const days = Math.floor(minutes / (24 * 60));
        const hours = Math.floor((minutes % (24 * 60)) / 60);
        const mins = minutes % 60;

        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ${hours}h ${mins}min`;
        } else if (hours > 0) {
            return `${hours}h ${mins}min`;
        } else {
            return `${mins}min`;
        }
    }

    async extendTime(hours) {
        if (!this.currentCartClient) {
            console.error('No client selected');
            return;
        }

        try {
            console.log(`Extending time by ${hours} hours for ${this.currentCartClient.clientName}`);

            const response = await fetch(`/api/admin/client/${this.currentCartClient.code}/cart/extend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAdminToken()}`
                },
                body: JSON.stringify({ hours: hours })
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess('Cart time extended successfully');

                // Guardar última extensão aplicada
                this.lastTimeExtension = hours;

                // Marcar botão IMEDIATAMENTE (sem esperar reload)
                const buttons = document.querySelectorAll('.time-btn');
                buttons.forEach(btn => {
                    btn.classList.remove('active');
                    if ((hours < 24 && btn.textContent === hours + 'h') ||
                        (hours === 24 && btn.textContent === '1 day') ||
                        (hours === 48 && btn.textContent === '2 days') ||
                        (hours === 72 && btn.textContent === '3 days') ||
                        (hours === 96 && btn.textContent === '4 days') ||
                        (hours === 120 && btn.textContent === '5 days')) {
                        btn.classList.add('active');
                    }
                });

                // Recarregar MAIS RÁPIDO - apenas 300ms
                setTimeout(() => {
                    this.openCartControl(this.currentCartClient._id);
                }, 300);
            } else {
                this.showError(data.message || 'Failed to extend time');
            }
        } catch (error) {
            console.error('Error extending time:', error);
            this.showError('Error extending time');
        }
    }

    closeCartControl() {
        const modal = document.getElementById('cartControlModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    saveCartChanges() {
        console.log('Saving cart changes...');
        this.showSuccess('Cart changes saved successfully');
        setTimeout(() => {
            this.closeCartControl();
        }, 500);
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
            salesRep: document.getElementById('salesRep').value,
            showPrices: this.currentClient?.showPrices !== false,
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
            salesRep: document.getElementById('salesRep').value,
            showPrices: this.currentClient ? (this.currentClient.showPrices || false) : false,
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

                    // Se for erro de selection pendente, mostrar modal explicativo
                    if (error.message.includes('pending')) {
                        await UISystem.confirm(
                            'Cannot activate client',
                            error.message + '\n\nGo to Selection Management to resolve this first.'
                        );
                    } else {
                        this.showError(`Error: ${error.message}`);
                    }
                }
            }
        });
    }

    // ===== FILTERS AND SEARCH =====
    handleSearch(query) {
        this.filters.search = query.toLowerCase();
        this.currentPage = 1; // Voltar para página 1
        this.loadClients(1).then(() => {
            this.renderClientsTable();
        });
    }

    handleStatusFilter(status) {
        this.filters.status = status;
        this.currentPage = 1; // Voltar para página 1
        this.loadClients(1).then(() => {
            this.renderClientsTable();
        });
    }

    handleSort(sortBy) {
        this.filters.sortBy = sortBy;
        this.currentPage = 1; // Voltar para página 1
        this.loadClients(1).then(() => {
            this.renderClientsTable();
        });
    }

    applyFilters() {
        this.currentPage = 1; // Sempre volta para página 1
        this.loadClients(1).then(() => {
            this.renderClientsTable();
        });
    }

    async refreshData() {
        //this.showLoading(true);
        try {
            await Promise.all([
                this.loadClients(this.currentPage, true),  // MODIFICADO
                this.loadAvailableCategories()
            ]);
            this.renderClientsTable();
            console.log('✅ Client data refreshed successfully');
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

    getDaysAgo(date) {
        if (!date) return '';

        // Criar datas sem horário para comparação correta
        const inputDate = new Date(date);
        const today = new Date();

        // Zerar horários para comparar apenas datas
        inputDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        // Calcular diferença em milissegundos
        const diffTime = today - inputDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // Retornar descrição baseada na diferença
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays === 2) return '2 days ago';
        if (diffDays === 3) return '3 days ago';
        if (diffDays === 4) return '4 days ago';
        if (diffDays === 5) return '5 days ago';
        if (diffDays === 6) return '6 days ago';
        if (diffDays < 14) return `${diffDays} days ago`;
        if (diffDays < 21) return '2 weeks ago';
        if (diffDays < 30) return '3 weeks ago';
        if (diffDays < 45) return '1 month ago';
        if (diffDays < 60) return '1.5 months ago';
        if (diffDays < 90) return '2 months ago';
        if (diffDays < 180) return '3+ months ago';
        if (diffDays < 365) return '6+ months ago';
        return 'Over 1 year ago';
    }

    // Atualizar datas automaticamente a cada minuto
    startDateUpdateTimer() {
        // Atualizar a cada 60 segundos
        setInterval(() => {
            // Só atualizar se a aba estiver visível
            if (!document.hidden) {
                console.log('🔄 Updating relative dates...');
                this.renderClientsTable();
            }
        }, 60000); // 60 segundos
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

    // ===== NOVO MODAL DE SETTINGS =====
    async openSettingsModal(clientId) {
        const client = this.clients.find(c => c._id === clientId || c.code === clientId);
        if (!client) {
            this.showError('Client not found');
            return;
        }

        console.log('⚙️ Opening settings for:', client.clientName);

        this.currentSettingsClient = client;

        // Atualizar título
        document.getElementById('settingsModalTitle').textContent = `Allowed Categories - ${client.clientName}`;

        // Limpar seleção anterior
        this.selectedFolders = [];

        // Carregar categorias salvas com dados reais
        if (client.allowedCategories && Array.isArray(client.allowedCategories)) {
            try {
                const token = this.getAdminToken();

                // Separar QB items de outros itens
                const qbItems = [];
                const otherItems = [];

                client.allowedCategories.forEach(cat => {
                    // QB items são códigos alfanuméricos (5302B BW, 5375SP, etc)
                    if (/^[0-9]/.test(cat)) {
                        qbItems.push(cat);
                    } else {
                        otherItems.push(cat);
                    }
                });

                // QB items TAMBÉM precisam de mapeamento para pegar o path correto!
                if (qbItems.length > 0) {
                    const qbResponse = await fetch('/api/admin/map-categories', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            items: qbItems
                        })
                    });

                    const qbData = await qbResponse.json();
                    if (qbData.success) {
                        qbData.mapped.forEach(item => {
                            this.selectedFolders.push({
                                qbItem: item.qbItem || item.original,
                                path: item.displayName || item.original
                            });
                        });
                        console.log(`✅ Mapeados ${qbItems.length} QB items com paths reais`);
                    } else {
                        // Fallback se falhar
                        qbItems.forEach(qb => {
                            this.selectedFolders.push({
                                qbItem: qb,
                                path: qb
                            });
                        });
                    }
                }

                // Mapear apenas itens que NÃO são QB (se houver)
                if (otherItems.length > 0) {
                    const response = await fetch('/api/admin/map-categories', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            items: otherItems
                        })
                    });

                    const data = await response.json();
                    if (data.success) {
                        data.mapped.forEach(item => {
                            this.selectedFolders.push({
                                qbItem: item.qbItem || item.original,
                                path: item.displayName || item.original
                            });
                        });
                    }
                }

                console.log(`📁 Loaded ${this.selectedFolders.length} categories (${qbItems.length} QB items, ${otherItems.length} mapped)`);

            } catch (error) {
                console.error('Error loading saved categories:', error);
                // Fallback
                client.allowedCategories.forEach(cat => {
                    this.selectedFolders.push({
                        qbItem: cat,
                        path: cat
                    });
                });
            }
        }

        this.updateSettingsFoldersList();

        // Carregar tree
        if (!this.treeLoaded) {
            this.loadTreeView();
        }

        // Marcar checkboxes das categorias salvas
        setTimeout(() => {
            this.markSavedCheckboxes();
        }, 500);

        // Carregar valor do showPrices
        const showPricesSettings = document.getElementById('showPricesSettings');
        if (showPricesSettings && client) {
            showPricesSettings.checked = client.showPrices !== false;
            document.getElementById('showPricesSettingsLabel').textContent = client.showPrices !== false ? 'Enabled' : 'Disabled';
        }

        // Mostrar modal
        document.getElementById('clientSettingsModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Nova função para marcar checkboxes
    markSavedCheckboxes() {
        const checkboxes = document.querySelectorAll('.tree-checkbox');

        // ✅ CORREÇÃO: PRIMEIRO LIMPAR TODOS
        console.log('🧹 Limpando todos os checkboxes antes de marcar...');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            checkbox.indeterminate = false;
        });

        // Agora marcar apenas os que devem estar marcados
        console.log(`✅ Marcando ${this.selectedFolders.length} checkboxes salvos...`);
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Agora marcar apenas os que devem estar marcados
        checkboxes.forEach(checkbox => {
            const qbItem = checkbox.dataset.qbitem;
            const path = checkbox.dataset.path;

            // Verificar se está na lista de selecionados
            const isSelected = this.selectedFolders.some(f =>
                f.qbItem === qbItem || f.path === path || f.qbItem === path
            );

            if (isSelected) {
                checkbox.checked = true;
            }
        });

        // Atualizar estados dos pais após marcar os salvos
        this.updateParentCheckboxes();
    }

    async closeSettingsModal() {
        // Verificar se tem algo selecionado
        if (this.selectedFolders.length === 0 && this.currentSettingsClient) {
            const confirmed = await this.showConfirmModal(
                '<i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> Warning: No permissions selected!<br><br>' +
                'The client will have <strong>FULL ACCESS</strong> to all categories.<br>' +
                'This may be a security risk.<br><br>' +
                'Are you sure you want to close without selecting any permissions?'
            );

            if (!confirmed) {
                return; // Não fecha o modal
            }
        }

        document.body.style.overflow = '';
        document.getElementById('clientSettingsModal').classList.remove('active');
        this.currentSettingsClient = null;
        this.selectedFolders = [];
    }

    // Atualizar lista no modal settings
    updateSettingsFoldersList() {
        const container = document.getElementById('settingsSelectedFoldersList');
        const count = document.getElementById('settingsSelectedCount');

        // Verificar se elementos existem
        if (!container || !count) {
            console.warn('Settings elements not found');
            return;
        }

        count.textContent = this.selectedFolders.length;

        if (this.selectedFolders.length === 0) {
            container.innerHTML = '<div class="empty-state">No categories selected</div>';
            return;
        }

        container.innerHTML = this.selectedFolders.map(folder => `
            <div class="selected-folder-item">
                <span class="folder-qb">${folder.qbItem}</span>
                <span class="folder-path">${folder.path}</span>
            <button class="btn-remove-folder" onclick="adminClients.removeSettingsFolder('${folder.path.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">×</button>
            </div>
        `).join('');
    }

    // Remover folder no modal settings
    removeSettingsFolder(path) {
        this.selectedFolders = this.selectedFolders.filter(f => f.path !== path);
        this.updateSettingsFoldersList();

        // Desmarcar checkbox na árvore
        const checkboxes = document.querySelectorAll('.tree-checkbox');
        checkboxes.forEach(checkbox => {
            if (checkbox.dataset.path === path) {
                checkbox.checked = false;
            }
        });
        // Atualizar estado dos pais
        this.updateParentCheckboxes();
    }

    // Toggle Tree View
    async toggleTreeView() {
        const container = document.getElementById('treeViewContainer');
        const toggleBtn = document.getElementById('treeToggleText');
        const searchContainer = document.getElementById('settingsFolderSearchInput').parentElement;

        if (container.style.display === 'none') {
            // Mostrar tree
            container.style.display = 'block';
            toggleBtn.textContent = 'Hide Tree';

            // Carregar tree se ainda não foi carregada
            if (!this.treeLoaded) {
                await this.loadTreeView();
            }
        } else {
            // Esconder tree
            container.style.display = 'none';
            toggleBtn.textContent = 'Show Tree';
        }
    }

    // Carregar Tree View
    async loadTreeView() {
        console.log('🌳 Loading tree view...');

        // Limpar loading message
        const container = document.getElementById('treeViewContent');
        container.innerHTML = '<div style="text-align: center; padding: 1rem;"><i class="fas fa-spinner fa-spin"></i> Loading categories...</div>';

        try {
            const token = this.getAdminToken();
            const response = await fetch('/api/admin/categories-tree', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.renderTreeView(data.tree);
                this.treeLoaded = true;
            } else {
                container.innerHTML = '<div style="text-align: center; color: var(--danger);">Failed to load categories</div>';
            }
        } catch (error) {
            console.error('Error loading tree:', error);
            container.innerHTML = '<div style="text-align: center; color: var(--danger);">Error loading categories</div>';
        }
    }

    // Renderizar Tree View
    renderTreeView(tree) {
        const container = document.getElementById('treeViewContent');

        if (Object.keys(tree).length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted);">No categories found</div>';
            return;
        }

        let html = '<div class="tree-view">';

        Object.keys(tree).forEach(key => {
            html += this.renderTreeNode(tree[key], key, 0);
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // Renderizar nó da árvore
    renderTreeNode(node, key, level) {
        const hasChildren = node.children && Object.keys(node.children).length > 0;
        const indent = level * 20;
        const nodeId = `tree-${node.fullPath || key}`.replace(/[^a-zA-Z0-9]/g, '-');

        // ✅ VERIFICAR SE TEM FOTOS DISPONÍVEIS
        const hasStock = node.photoCount > 0;
        const emptyClass = !hasStock && !hasChildren ? 'category-empty' : '';
        const emptyWarning = !hasStock && !hasChildren ? '<span class="no-stock-warning">⚠️ No stock</span>' : '';

        let html = `
            <div class="tree-node ${emptyClass}" data-node-id="${nodeId}" style="margin-left: ${indent}px;">
                <div class="tree-node-content">
                    ${hasChildren ?
                `<span class="tree-toggle" onclick="adminClients.toggleTreeNode('${nodeId}')">
                            <i class="fas fa-chevron-right"></i>
                        </span>` :
                '<span class="tree-spacer"></span>'
            }
                    <label class="tree-label">
                        <input type="checkbox" 
                            class="tree-checkbox" 
                            data-path="${(node.fullPath || key).replace(/"/g, '&quot;')}"
                            data-qbitem="${node.qbItem || ''}"
                            data-node-id="${nodeId}"
                            onchange="adminClients.handleTreeCheckbox(this)">
                        ${node.qbItem ? `<span class="tree-qb-code">${node.qbItem}</span>` : ''}
                        <span class="tree-name">${key}</span>
                        <span class="tree-count ${!hasStock ? 'count-zero' : ''}">(${node.photoCount || 0})</span>
                        ${emptyWarning}
                        <span class="tree-selection-badge" id="badge-${nodeId}" style="display:none;"></span>
                    </label>
                </div>
                ${hasChildren ?
                `<div id="${nodeId}" class="tree-children" style="display: none;">
                        ${Object.keys(node.children).map(childKey =>
                    this.renderTreeNode(node.children[childKey], childKey, level + 1)
                ).join('')}
                    </div>` : ''
            }
            </div>
        `;

        return html;
    }

    // Toggle nó da árvore
    toggleTreeNode(nodeId) {
        const children = document.getElementById(nodeId);
        const toggleBtn = document.querySelector(`[onclick="adminClients.toggleTreeNode('${nodeId}')"]`);

        if (!children || !toggleBtn) {
            console.error('Tree node elements not found:', nodeId);
            return;
        }

        const icon = toggleBtn.querySelector('i');

        if (children.style.display === 'none') {
            children.style.display = 'block';
            icon.className = 'fas fa-chevron-down';
        } else {
            children.style.display = 'none';
            icon.className = 'fas fa-chevron-right';
        }
    }

    // Handle checkbox da tree
    handleTreeCheckbox(checkbox) {
        const path = checkbox.dataset.path;
        const qbItem = checkbox.dataset.qbitem || 'NO-QB';

        if (checkbox.checked) {
            // Só adicionar se tem QB item válido (não é NO-QB ou vazio)
            if (qbItem && qbItem !== 'NO-QB' && qbItem !== '') {
                if (!this.selectedFolders.find(f => f.path === path)) {
                    this.selectedFolders.push({
                        qbItem: qbItem,
                        path: path
                    });
                }
            }

            // Marcar todos os filhos (eles serão adicionados se tiverem QB)
            this.checkAllChildren(checkbox, true);
        } else {
            // Remover pasta
            this.selectedFolders = this.selectedFolders.filter(f => f.path !== path);

            // Desmarcar todos os filhos
            this.checkAllChildren(checkbox, false);
        }

        this.updateSettingsFoldersList();
        // Atualizar estados dos pais
        setTimeout(() => {
            this.updateParentCheckboxes();
        }, 50);
    }

    // Função para marcar/desmarcar todos os filhos
    checkAllChildren(parentCheckbox, checked) {
        const parentNode = parentCheckbox.closest('.tree-node');
        const childrenContainer = parentNode.querySelector('.tree-children');

        if (childrenContainer) {
            const childCheckboxes = childrenContainer.querySelectorAll('.tree-checkbox');
            childCheckboxes.forEach(child => {
                child.checked = checked;

                const childPath = child.dataset.path;
                const childQbItem = child.dataset.qbitem || 'NO-QB';

                if (checked) {
                    // Só adicionar se tem QB item válido
                    if (childQbItem && childQbItem !== 'NO-QB' && childQbItem !== '') {
                        if (!this.selectedFolders.find(f => f.path === childPath)) {
                            this.selectedFolders.push({
                                qbItem: childQbItem,
                                path: childPath
                            });
                        }
                    }
                } else {
                    // Remover
                    this.selectedFolders = this.selectedFolders.filter(f => f.path !== childPath);
                }
            });
        }
    }

    // Atualizar estado dos checkboxes pais baseado nos filhos
    updateParentCheckboxes() {
        // Começar dos nós mais profundos e subir
        const allNodes = document.querySelectorAll('.tree-node');

        // Processar de baixo para cima (reverse)
        const nodesArray = Array.from(allNodes).reverse();

        nodesArray.forEach(node => {
            const childrenContainer = node.querySelector('.tree-children');
            if (childrenContainer) {
                const checkbox = node.querySelector('.tree-checkbox');
                const childCheckboxes = childrenContainer.querySelectorAll('.tree-checkbox');

                if (childCheckboxes.length > 0) {
                    const checkedCount = Array.from(childCheckboxes).filter(cb => cb.checked).length;
                    const indeterminateCount = Array.from(childCheckboxes).filter(cb => cb.indeterminate).length;

                    const badge = node.querySelector('.tree-selection-badge');
                    const nodeElement = checkbox.closest('.tree-node');

                    if (checkedCount === 0 && indeterminateCount === 0) {
                        // Nenhum filho selecionado
                        checkbox.checked = false;
                        checkbox.indeterminate = false;
                        nodeElement.classList.remove('partial-selected');
                        if (badge) badge.style.display = 'none';

                    } else if (checkedCount === childCheckboxes.length && indeterminateCount === 0) {
                        // Todos os filhos selecionados
                        checkbox.checked = true;
                        checkbox.indeterminate = false;
                        nodeElement.classList.remove('partial-selected');
                        if (badge) badge.style.display = 'none';

                    } else {
                        // Parcialmente selecionado
                        checkbox.checked = false;
                        checkbox.indeterminate = false;  // <-- FORÇAR FALSE
                        nodeElement.classList.add('partial-selected');
                        if (badge) {
                            badge.textContent = `${checkedCount}/${childCheckboxes.length}`;
                            badge.style.display = 'inline';
                        }
                    }
                }
            }
        });
    }

    // Salvar configurações
    async saveSettings() {
        console.log('💾 Saving folder permissions...');

        if (!this.currentSettingsClient) {
            this.showError('No client selected');
            return;
        }

        // NOVA VALIDAÇÃO - Aviso se não selecionou nada
        if (this.selectedFolders.length === 0) {
            const confirmed = await this.showConfirmModal(
                '<i class="fas fa-exclamation-triangle" style="color: #d4af37;"></i> <strong style="color: #d4af37;">No permissions selected</strong><br><br>' +
                'Saving with no selections means the client will have <strong>FULL ACCESS</strong> to all categories.<br><br>' +
                'Are you sure you want to continue?'
            );

            if (!confirmed) {
                return; // Não salva
            }
        }

        try {
            const token = this.getAdminToken();

            // Extrair QB items ou nomes de categorias principais
            const allowedCategories = this.selectedFolders.map(f => {
                // Se tem QB item válido, usar ele
                if (f.qbItem && f.qbItem !== 'NO-QB' && f.qbItem !== 'SAVED' && f.qbItem !== 'TREE') {
                    return f.qbItem;
                }
                // Senão, usar o nome da categoria principal (primeiro segmento do path)
                const parts = f.path.split(' → ');
                return parts[0];
            });

            // Remover duplicatas
            const uniqueCategories = [...new Set(allowedCategories)];

            // ⚠️ NOVO - Pegar valor do Show Prices
            const showPrices = document.getElementById('showPricesSettings') ?
                document.getElementById('showPricesSettings').checked : true;
            console.log('📁 Saving categories/QB items:', uniqueCategories);
            console.log('💰 Show Prices:', showPrices);

            const response = await fetch(`/api/admin/clients/${this.currentSettingsClient._id}/categories`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    allowedCategories: uniqueCategories,
                    showPrices: showPrices  // ⚠️ NOVO - Adicionar showPrices aqui
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess(`Saved ${uniqueCategories.length} permissions for ${this.currentSettingsClient.clientName}`);

                // Atualizar cliente local
                const clientIndex = this.clients.findIndex(c => c._id === this.currentSettingsClient._id);
                if (clientIndex > -1) {
                    this.clients[clientIndex].allowedCategories = uniqueCategories;
                    this.clients[clientIndex].showPrices = showPrices;  // ⚠️ NOVO - Atualizar showPrices local
                }

                this.closeSettingsModal();
                this.renderClientsTable();
            } else {
                this.showError(data.message || 'Failed to save categories');
            }
        } catch (error) {
            console.error('Save error:', error);
            this.showError('Error saving categories');
        }
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

    // Função para ir para uma página específica
    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;

        this.currentPage = page;
        //this.showLoading(true);

        this.loadClients(page).then(() => {
            this.renderClientsTable();

            // Atualizar texto e botões
            //document.getElementById('paginationInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
            document.getElementById('btnPrevPage').disabled = (this.currentPage === 1);
            document.getElementById('btnNextPage').disabled = (this.currentPage === this.totalPages);
            this.renderPaginationNumbers();
            this.showLoading(false);
        });
    }

    // ===== RENDER PAGINATION NUMBERS =====
    renderPaginationNumbers() {
        const container = document.getElementById('paginationNumbers');
        if (!container) return;

        let html = '';
        const maxButtons = 5; // Máximo de botões numéricos
        let startPage = 1;
        let endPage = this.totalPages;

        // Lógica para mostrar apenas 5 botões
        if (this.totalPages > maxButtons) {
            const halfButtons = Math.floor(maxButtons / 2);

            if (this.currentPage <= halfButtons + 1) {
                endPage = maxButtons;
            } else if (this.currentPage >= this.totalPages - halfButtons) {
                startPage = this.totalPages - maxButtons + 1;
            } else {
                startPage = this.currentPage - halfButtons;
                endPage = this.currentPage + halfButtons;
            }
        }

        // Adicionar botões
        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === this.currentPage ? 'active' : '';
            html += `
            <button class="btn-page-number ${isActive}" 
                    onclick="adminClients.goToPage(${i})"
                    ${i === this.currentPage ? 'disabled' : ''}>
                ${i}
            </button>
        `;
        }

        // Adicionar elipses se necessário
        if (endPage < this.totalPages) {
            html += `<span class="pagination-dots">...</span>`;
        }

        container.innerHTML = html;
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