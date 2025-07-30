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
                        New Code
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
                            <th>Categories</th>
                            <th>Usage</th>
                            <th>Expires</th>
                            <th>Status</th>
                            <th>Actions</th>
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
                                               placeholder="Ex: John Silva" required>
                                    </div>
                                    <div class="form-group-clients">
                                        <label class="form-label-clients">Email</label>
                                        <input type="email" id="clientEmail" class="form-input-clients" 
                                               placeholder="john@email.com">
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
                                        <label class="form-label-clients">Status</label>
                                        <select id="clientStatus" class="form-input-clients">
                                            <option value="true">Active</option>
                                            <option value="false">Inactive</option>
                                        </select>
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

        // Close modal by clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
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
            const response = await fetch('/api/drive/folders');
            const data = await response.json();

            if (data.success) {
                this.availableCategories = data.folders.map(folder => ({
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
                        <br><small style="color: var(--text-muted);">Click "New Code" to create the first one</small>
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
                <td class="client-categories-cell">
                    <div class="categories-preview">
                        ${this.renderCategoriesPreview(client.allowedCategories)}
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
                        <button class="btn-action btn-view" onclick="adminClients.viewClient('${client._id || client.code}')">
                            <i class="fas fa-eye"></i>
                            View
                        </button>
                        <button class="btn-action btn-edit" onclick="adminClients.editClient('${client._id || client.code}')">
                            <i class="fas fa-edit"></i>
                            Edit
                        </button>
                        <button class="btn-action btn-toggle ${client.isActive ? '' : 'activate'}" 
                                onclick="adminClients.toggleClientStatus('${client._id || client.code}')">
                            <i class="fas fa-${client.isActive ? 'ban' : 'check'}"></i>
                            ${client.isActive ? 'Deactivate' : 'Activate'}
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
        document.getElementById('expireDays').value = '30';
        document.getElementById('clientStatus').value = 'true';

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

    closeModal() {
        this.modal.classList.remove('active');
        this.currentClient = null;
        this.selectedCategories = [];
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
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        const formData = {
            clientName: document.getElementById('clientName').value.trim(),
            clientEmail: document.getElementById('clientEmail').value.trim(),
            allowedCategories: this.selectedCategories,
            expiresInDays: parseInt(document.getElementById('expireDays').value),
            isActive: document.getElementById('clientStatus').value === 'true'
        };

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

        // Validate categories
        if (!formData.allowedCategories || formData.allowedCategories.length === 0) {
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
        if (client) {
            // TODO: Implement view modal
            console.log('👁️ View client:', client);
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

        // Fill form
        document.getElementById('clientName').value = client.clientName;
        document.getElementById('clientEmail').value = client.clientEmail || '';
        document.getElementById('expireDays').value = this.calculateDaysUntilExpiry(client.expiresAt);
        document.getElementById('clientStatus').value = client.isActive.toString();
        document.getElementById('codePreview').textContent = client.code;

        // Update titles
        document.getElementById('modalTitle').textContent = 'Edit Access Code';
        document.getElementById('saveButtonText').textContent = 'Save Changes';

        // Render categories
        this.renderCategoriesSelection();

        // Show modal
        this.modal.classList.add('active');
    }

    async toggleClientStatus(clientId) {
        const client = this.clients.find(c => c._id === clientId || c.code === clientId);
        if (!client) return;

        const action = client.isActive ? 'deactivate' : 'activate';
        const confirmed = await this.confirmAction(action, client.clientName);

        if (!confirmed) return;

        try {
            // Use the new updateClientStatus function
            const newStatus = !client.isActive;
            await this.updateClientStatus(clientId, newStatus);

            // Update local state
            client.isActive = newStatus;
            this.renderClientsTable();

            this.showSuccess(`Code ${newStatus ? 'activated' : 'deactivated'} successfully!`);

        } catch (error) {
            console.error('❌ Error changing status:', error);
            this.showError(`Error ${client.isActive ? 'deactivating' : 'activating'} code: ` + error.message);
        }
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
            this.showSuccess('Data updated successfully!');
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
        if (this.loading) {
            this.loading.classList.toggle('hidden', !show);
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
        alert('Error: ' + message);
    }

    showSuccess(message) {
        console.log('✅ Success:', message);
        // TODO: Implement better notification system
        alert('Success: ' + message);
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
        }
    }
});

// Expose globally for HTML usage
window.adminClients = adminClients;