//public/js/admin-pricing.js

/**
 * ADMIN PRICING - SUNSHINE COWHIDES
 * JavaScript for price management integrated with Google Drive
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

    // ===== INITIALIZATION =====
    init() {
        console.log('💰 Initializing Price Management...');
        this.setupElements();
        this.setupEventListeners();
        this.checkSyncStatus();
        console.log('✅ Price Management initialized');
    }

    setupElements() {
        // Main container
        this.section = document.getElementById('section-pricing');
        if (!this.section) {
            console.warn('⚠️ Pricing section not found');
            return;
        }

        // Main elements
        this.syncStatusCard = document.getElementById('syncStatusCard');
        this.pricingStats = document.getElementById('pricingStats');
        this.pricingTable = document.getElementById('pricingTableBody');
        this.pricingPagination = document.getElementById('pricingPagination');

        // Modal
        this.priceModal = document.getElementById('priceModal');
        this.priceForm = document.getElementById('priceForm');

        // DEBUG LOG
        console.log('🔵 Modal found:', this.priceModal);

        // Loading
        this.loading = document.getElementById('loading');
    }

    setupEventListeners() {
        // Main buttons
        const btnSyncDrive = document.getElementById('btnSyncDrive');
        const btnForcSync = document.getElementById('btnForcSync');
        const btnPricingReport = document.getElementById('btnPricingReport');

        if (btnSyncDrive) btnSyncDrive.addEventListener('click', () => this.syncDrive(false));
        if (btnForcSync) btnForcSync.addEventListener('click', () => this.syncDrive(true));
        if (btnPricingReport) btnPricingReport.addEventListener('click', () => this.generateReport());

        // Filters
        const searchInput = document.getElementById('searchCategories');
        const filterPrice = document.getElementById('filterPriceStatus');
        const sortSelect = document.getElementById('sortCategories');
        const btnApplyFilters = document.getElementById('btnApplyPricingFilters');

        if (searchInput) searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        if (filterPrice) filterPrice.addEventListener('change', (e) => this.handlePriceFilter(e.target.value));
        if (sortSelect) sortSelect.addEventListener('change', (e) => this.handleSort(e.target.value));
        if (btnApplyFilters) btnApplyFilters.addEventListener('click', () => this.applyFilters());

        // Pagination
        const btnPrevPage = document.getElementById('btnPrevPage');
        const btnNextPage = document.getElementById('btnNextPage');

        if (btnPrevPage) btnPrevPage.addEventListener('click', () => this.previousPage());
        if (btnNextPage) btnNextPage.addEventListener('click', () => this.nextPage());

        // Modal
        if (this.priceForm) {
            this.priceForm.addEventListener('submit', (e) => this.handlePriceSubmit(e));
        }

        // Close modal by clicking outside
        if (this.priceModal) {
            this.priceModal.addEventListener('click', (e) => {
                if (e.target === this.priceModal || e.target.classList.contains('price-modal-overlay')) {
                    this.closePriceModal();
                }
            });
        }

        // NEW: Close modal with ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('priceModal');
                if (modal && (modal.style.display === 'flex' || modal.classList.contains('active'))) {
                    this.closePriceModal();
                }
            }
        });

        // NEW: Debug log
        console.log('🔵 Event listeners configured for modal');
    }

    // ===== GOOGLE DRIVE SYNCHRONIZATION =====
    async checkSyncStatus() {
        try {
            const response = await fetch('/api/pricing/sync/status', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.updateSyncStatus(data.syncStatus);
                this.updateStats(data.statistics);

                // Load categories if sync is ok
                if (!data.syncStatus.isOutdated) {
                    await this.loadCategories();
                }
            }

        } catch (error) {
            console.error('❌ Error checking sync status:', error);
            this.showSyncStatus('Error checking status', 'danger');
        }
    }

    async syncDrive(forceRefresh = false) {
        try {
            this.setLoading(true);
            this.showSyncStatus('Synchronizing with Google Drive...', 'warning');

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
                const message = `Sync completed: ${created} created, ${updated} updated, ${deactivated} removed, ${errors} errors`;

                this.showSyncStatus(message, errors > 0 ? 'warning' : 'success');

                // Reload data
                await Promise.all([
                    this.checkSyncStatus(),
                    this.loadCategories()
                ]);

                this.showNotification('Synchronization completed successfully!', 'success');

            } else {
                throw new Error(data.message || 'Synchronization error');
            }

        } catch (error) {
            console.error('❌ Synchronization error:', error);
            this.showSyncStatus(`Sync error: ${error.message}`, 'danger');
            this.showNotification('Synchronization error', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    updateSyncStatus(syncStatus) {
        if (!this.syncStatusCard) return;

        const { needingSyncCount, lastSyncDate, isOutdated, hoursOld } = syncStatus;

        if (isOutdated) {
            const message = `${needingSyncCount} categories need synchronization. Last sync: ${hoursOld}h ago`;
            this.showSyncStatus(message, 'warning');
        } else {
            const message = lastSyncDate ?
                `System synchronized. Last update: ${this.formatDate(lastSyncDate)}` :
                'System awaiting first synchronization';
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

    // ===== CATEGORY LOADING =====
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

                console.log(`✅ ${this.categories.length} categories loaded`);
            } else {
                throw new Error(data.message || 'Error loading categories');
            }

        } catch (error) {
            console.error('❌ Error loading categories:', error);
            this.showError('Error loading categories');
        }
    }

    // ===== TABLE RENDERING =====
    renderCategoriesTable() {
        if (!this.pricingTable) return;

        if (this.categories.length === 0) {
            this.pricingTable.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <i class="fas fa-inbox"></i>
                        No categories found
                        <br><small style="color: var(--text-muted);">Try synchronizing with Google Drive</small>
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
                    ${category.photoCount} photo${category.photoCount !== 1 ? 's' : ''}
                </td>
                <td class="price-cell ${category.basePrice > 0 ? 'has-price' : 'no-price'}">
                    ${category.basePrice > 0 ? `$${category.basePrice.toFixed(2)}` : 'No price'}
                </td>
                <td class="discounts-cell">
                    ${category.hasCustomRules ?
                `<span class="discount-badge">Custom</span>` :
                `<span class="no-discounts">None</span>`
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
                                <i class="fas fa-edit"></i> Edit
                            </button>` :
                `<button class="btn-pricing-action btn-set-price" 
                                     onclick="adminPricing.openPriceModal('${category._id}', 'create')">
                                <i class="fas fa-dollar-sign"></i> Set
                            </button>`
            }
                        <button class="btn-pricing-action btn-view-details" 
                                onclick="adminPricing.viewCategoryDetails('${category._id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.pricingTable.innerHTML = rows;
    }

    // ===== PRICE MODAL =====
    async openPriceModal(categoryId, mode = 'create') {
        try {
            // Fetch category details
            const response = await fetch(`/api/pricing/categories/${categoryId}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Category not found');
            }

            this.currentCategory = data.category;

            // Update modal
            this.updatePriceModal(mode);

            // Show modal
            if (this.priceModal) {
                const modal = document.getElementById('priceModal');
                if (modal) {
                    modal.style.display = 'flex';
                    modal.classList.add('active');
                } else {
                    console.error('🔴 Modal not found in DOM!');
                }

                // Focus on price field
                const priceInput = document.getElementById('newPrice');
                if (priceInput) {
                    setTimeout(() => priceInput.focus(), 100);
                }
            }

        } catch (error) {
            console.error('❌ Error opening price modal:', error);
            this.showNotification('Error loading category', 'error');
        }
    }

    updatePriceModal(mode) {
        if (!this.currentCategory) return;

        // Update titles
        const modalTitle = document.getElementById('priceModalTitle');
        const categoryName = document.getElementById('modalCategoryName');
        const categoryPath = document.getElementById('modalCategoryPath');
        const photoCount = document.getElementById('modalPhotoCount');
        const currentPrice = document.getElementById('modalCurrentPrice');

        if (modalTitle) {
            modalTitle.textContent = mode === 'edit' ? 'Edit Price' : 'Set Price';
        }

        if (categoryName) {
            categoryName.textContent = this.currentCategory.displayName;
        }

        if (categoryPath) {
            categoryPath.textContent = this.currentCategory.googleDrivePath;
        }

        if (photoCount) {
            photoCount.textContent = `${this.currentCategory.photoCount} photo${this.currentCategory.photoCount !== 1 ? 's' : ''}`;
        }

        if (currentPrice) {
            currentPrice.textContent = this.currentCategory.basePrice > 0 ?
                `Current price: $${this.currentCategory.basePrice.toFixed(2)}` :
                'No price set';
        }

        // Pre-fill form if editing
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

        // Clear form
        const priceInput = document.getElementById('newPrice');
        const reasonInput = document.getElementById('priceReason');
        if (priceInput) priceInput.value = '';
        if (reasonInput) reasonInput.value = '';

        this.currentCategory = null;
        console.log('🔵 Modal closed');
    }

    async handlePriceSubmit(e) {
        e.preventDefault();

        if (!this.currentCategory) return;

        try {
            const newPrice = parseFloat(document.getElementById('newPrice').value);
            const reason = document.getElementById('priceReason').value.trim();

            if (isNaN(newPrice) || newPrice < 0) {
                this.showNotification('Price must be a valid number', 'error');
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
                this.showNotification(data.message || 'Price saved successfully!', 'success');

                // Close modal BEFORE reloading
                this.closePriceModal();

                // Reload data
                await Promise.all([
                    this.loadCategories(),
                    this.checkSyncStatus()
                ]);
            } else {
                throw new Error(data.message || 'Error saving price');
            }

        } catch (error) {
            console.error('❌ Error saving price:', error);
            this.showNotification(`Error saving price: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // ===== FILTERS AND SEARCH =====
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

    // ===== PAGINATION =====
    updatePagination(pagination) {
        if (!this.pricingPagination) return;

        const { page, totalPages, hasNext, hasPrev } = pagination;

        const paginationInfo = document.getElementById('paginationInfo');
        const btnPrevPage = document.getElementById('btnPrevPage');
        const btnNextPage = document.getElementById('btnNextPage');

        if (paginationInfo) {
            paginationInfo.textContent = `Page ${page} of ${totalPages}`;
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

    // ===== STATISTICS =====
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

    // ===== REPORTS =====
    async generateReport() {
        try {
            this.setLoading(true);

            const response = await fetch('/api/pricing/reports/overview', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.downloadReport(data.report);
                this.showNotification('Report generated successfully!', 'success');
            } else {
                throw new Error(data.message || 'Error generating report');
            }

        } catch (error) {
            console.error('❌ Error generating report:', error);
            this.showNotification('Error generating report', 'error');
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
            link.setAttribute('download', `pricing_report_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    convertReportToCSV(reportData) {
        // Implement CSV conversion
        // For now, return basic data
        return 'Pricing Report - Sunshine Cowhides\n' +
            JSON.stringify(reportData, null, 2);
    }

    // ===== UTILITIES =====
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
        return new Date(dateString).toLocaleDateString('en-US', {
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
        // Integrate with existing notification system
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
        // TODO: Implement detailed view
        console.log('👁️ View category:', categoryId);
    }
}

// ===== GLOBAL INITIALIZATION =====
let adminPricing = null;

// Initialize when pricing section is activated
document.addEventListener('DOMContentLoaded', () => {
    // Observe changes in active section
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const section = document.getElementById('section-pricing');
                if (section && section.style.display !== 'none' && !adminPricing) {
                    // Pricing section was activated
                    adminPricing = new AdminPricing();
                }
            }
        });
    });

    const pricingSection = document.getElementById('section-pricing');
    if (pricingSection) {
        observer.observe(pricingSection, { attributes: true });

        // If already visible, initialize immediately
        if (pricingSection.style.display !== 'none') {
            adminPricing = new AdminPricing();
        }
    }
});

// Global functions for HTML usage
window.closePriceModal = function () {
    if (adminPricing) {
        adminPricing.closePriceModal();
    }
};

window.adminPricing = adminPricing;

// Global function to close modal (called by HTML)
window.closePriceModal = function () {
    if (adminPricing) {
        adminPricing.closePriceModal();
    } else {
        // Fallback if adminPricing is not available
        const modal = document.getElementById('priceModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }
};

// ===== PRICE MODAL TAB SYSTEM =====

/**
 * Initialize tab system when modal opens
 */
function initializePriceTabs() {
    const tabButtons = document.querySelectorAll('.price-tab-btn');
    const tabPanels = document.querySelectorAll('.price-tab-panel');

    // Event listeners for tab buttons
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            switchPriceTab(targetTab);
        });
    });

    // Initialize tab-specific functionalities
    initializeClientPricesTab();
    initializeQuantityDiscountsTab();

    console.log('🔖 Price modal tab system initialized');
}

/**
 * Switch active tab
 */
function switchPriceTab(targetTab) {
    const tabButtons = document.querySelectorAll('.price-tab-btn');
    const tabPanels = document.querySelectorAll('.price-tab-panel');

    // Remove active classes
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabPanels.forEach(panel => panel.classList.remove('active'));

    // Activate selected tab
    const activeButton = document.querySelector(`[data-tab="${targetTab}"]`);
    const activePanel = document.getElementById(`tab-${targetTab}`);

    if (activeButton && activePanel) {
        activeButton.classList.add('active');
        activePanel.classList.add('active');

        // Load tab-specific data if needed
        loadTabData(targetTab);
    }
}

/**
 * Load tab-specific data
 */
function loadTabData(tabName) {
    switch (tabName) {
        case 'client-prices':
            loadClientRules();
            loadAvailableClients();
            break;
        case 'quantity-discounts':
            loadQuantityRules();
            break;
    }
}

// ===== TAB: CLIENT PRICES =====

/**
 * Initialize client prices tab functionality
 */
function initializeClientPricesTab() {
    // Event listener for discount type
    const discountType = document.getElementById('discountType');
    if (discountType) {
        discountType.addEventListener('change', handleDiscountTypeChange);
    }

    // Event listener for client rule form
    const clientRuleForm = document.getElementById('clientRuleForm');
    if (clientRuleForm) {
        clientRuleForm.addEventListener('submit', handleClientRuleSubmit);
    }
}

/**
 * Handle discount type change
 */
function handleDiscountTypeChange(e) {
    const value = e.target.value;
    const percentageGroup = document.getElementById('percentageGroup');
    const customPriceGroup = document.getElementById('customPriceGroup');

    // Hide all groups
    percentageGroup.style.display = 'none';
    customPriceGroup.style.display = 'none';

    // Show relevant group
    if (value === 'percentage') {
        percentageGroup.style.display = 'block';
    } else if (value === 'custom') {
        customPriceGroup.style.display = 'block';
    }
}

/**
 * Load existing client rules
 */
async function loadClientRules() {
    if (!adminPricing.currentCategory) return;

    const rulesContainer = document.getElementById('clientRulesList');
    if (!rulesContainer) return;

    try {
        console.log('🏷️ Loading discount rules...');

        const response = await fetch(`/api/pricing/categories/${adminPricing.currentCategory._id}/discount-rules`, {
            headers: adminPricing.getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            renderClientRules(data.discountRules);
            console.log(`✅ ${data.totalRules} rules loaded`);
        } else {
            throw new Error(data.message || 'Error fetching rules');
        }
    } catch (error) {
        console.error('❌ Error loading client rules:', error);
        rulesContainer.innerHTML = '<div class="error">Error loading rules</div>';
    }
}

/**
 * Render client rules
 */
function renderClientRules(rules) {
    const container = document.getElementById('clientRulesList');
    if (!container) return;

    if (rules.length === 0) {
        container.innerHTML = `
            <div class="empty-rules">
                <i class="fas fa-info-circle"></i>
                <p>No custom rules configured</p>
            </div>
        `;
        return;
    }

    const rulesHTML = rules.filter(rule => rule.isActive).map(rule => `
        <div class="client-rule-item">
            <div class="rule-info">
                <strong>${rule.clientName}</strong>
                <span class="client-code">(${rule.clientCode})</span>
            </div>
            <div class="rule-details">
                ${rule.customPrice ?
            `Price: $${rule.customPrice.toFixed(2)}` :
            `Discount: ${rule.discountPercent}%`
        }
            </div>
            <div class="rule-actions">
                <button class="btn-sm btn-danger" onclick="removeClientRule('${rule.clientCode}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = rulesHTML;
}

/**
 * Load available clients
 */
async function loadAvailableClients() {
    const clientSelect = document.getElementById('clientSelect');
    if (!clientSelect) return;

    try {
        console.log('👥 Loading active clients...');

        const response = await fetch('/api/pricing/clients/active', {
            headers: adminPricing.getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            const optionsHTML = data.clients.map(client =>
                `<option value="${client.code}">${client.name} (${client.code})</option>`
            ).join('');

            clientSelect.innerHTML = `
                <option value="">Select a client...</option>
                ${optionsHTML}
            `;

            console.log(`✅ ${data.clients.length} clients loaded in dropdown`);
        } else {
            throw new Error(data.message || 'Error fetching clients');
        }

    } catch (error) {
        console.error('❌ Error loading clients:', error);
        clientSelect.innerHTML = '<option value="">Error loading clients</option>';
    }
}

/**
 * Handle client rule form submit
 */
async function handleClientRuleSubmit(e) {
    e.preventDefault();

    if (!adminPricing.currentCategory) return;

    const formData = new FormData(e.target);
    const clientCode = document.getElementById('clientSelect').value;
    const discountType = document.getElementById('discountType').value;

    if (!clientCode || !discountType) {
        adminPricing.showNotification('Please fill all required fields', 'error');
        return;
    }

    try {
        const clientSelect = document.getElementById('clientSelect');
        const selectedOption = clientSelect.selectedOptions[0];

        if (!selectedOption) {
            adminPricing.showNotification('Please select a valid client', 'error');
            return;
        }

        const requestData = {
            clientCode,
            clientName: selectedOption.text.split(' (')[0], // Extract name without code
            discountPercent: discountType === 'percentage' ?
                parseInt(document.getElementById('discountPercent').value) || 0 : 0,
            customPrice: discountType === 'custom' ?
                parseFloat(document.getElementById('customPrice').value) || null : null
        };

        console.log('📝 Sending rule to API:', requestData);

        // Call real API to add rule
        const response = await fetch(`/api/pricing/categories/${adminPricing.currentCategory._id}/discount-rules`, {
            method: 'POST',
            headers: {
                ...adminPricing.getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error adding rule');
        }

        if (result.success) {
            console.log('✅ Rule added successfully:', result);
            adminPricing.showNotification('Rule added successfully!', 'success');

            // Clear form
            e.target.reset();
            handleDiscountTypeChange({ target: { value: '' } });

            // Reload rules to show the new one
            await loadClientRules();
        } else {
            throw new Error(result.message || 'Unknown error');
        }

    } catch (error) {
        console.error('❌ Error adding rule:', error);
        adminPricing.showNotification(`Error: ${error.message}`, 'error');
    }
}

// ===== TAB: QUANTITY DISCOUNTS =====

/**
 * Initialize quantity discounts tab functionality
 */
function initializeQuantityDiscountsTab() {
    console.log('📦 Quantity discounts tab initialized');

    // Event listener to add new rule
    const addRuleBtn = document.querySelector('#tab-quantity-discounts .btn.btn-secondary');
    if (addRuleBtn) {
        addRuleBtn.addEventListener('click', showAddQuantityRuleForm);
    }
}

/**
 * Load quantity rules from backend
 */
async function loadQuantityRules() {
    try {
        console.log('📦 Loading quantity rules...');

        const response = await fetch('/api/pricing/quantity-discounts', {
            headers: adminPricing.getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            renderQuantityRules(data.rules);
            console.log(`✅ ${data.rules.length} quantity rules loaded`);
        } else {
            throw new Error(data.message || 'Error fetching rules');
        }

    } catch (error) {
        console.error('❌ Error loading quantity rules:', error);
        renderQuantityRulesError();
    }
}

/**
 * Render quantity rules in interface
 */
function renderQuantityRules(rules) {
    const container = document.querySelector('#tab-quantity-discounts .quantity-rules');
    if (!container) return;

    if (rules.length === 0) {
        container.innerHTML = `
            <div class="empty-rules">
                <i class="fas fa-info-circle"></i>
                <p>No quantity discount rules configured</p>
                <small>Configure automatic discounts based on photo quantity</small>
            </div>
        `;
        return;
    }

    const rulesHTML = rules.map(rule => {
        const rangeText = rule.maxQuantity ?
            `${rule.minQuantity}-${rule.maxQuantity} photos` :
            `${rule.minQuantity}+ photos`;

        return `
            <div class="quantity-rule" data-rule-id="${rule._id}">
                <div class="rule-range">${rangeText}</div>
                <div class="rule-discount">${rule.discountPercent}% discount</div>
                <div class="rule-description">${rule.description}</div>
                <div class="rule-actions">
                    <button class="btn-sm btn-warning" onclick="editQuantityRule('${rule._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-sm btn-danger" onclick="removeQuantityRule('${rule._id}')">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = rulesHTML;
}

/**
 * Render loading error
 */
function renderQuantityRulesError() {
    const container = document.querySelector('#tab-quantity-discounts .quantity-rules');
    if (container) {
        container.innerHTML = `
            <div class="error-rules">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading discount rules</p>
                <button class="btn btn-secondary" onclick="loadQuantityRules()">
                    <i class="fas fa-sync"></i> Try Again
                </button>
            </div>
        `;
    }
}

/**
 * Show form to add new rule
 */
function showAddQuantityRuleForm() {
    const container = document.querySelector('#tab-quantity-discounts .quantity-discounts-section');
    if (!container) return;

    // Check if form already exists
    if (document.getElementById('addQuantityRuleForm')) {
        return; // Already open
    }

    const formHTML = `
        <div id="addQuantityRuleForm" class="add-quantity-rule-form">
            <h6><i class="fas fa-plus"></i> New Quantity Discount Rule</h6>
            
            <form id="quantityRuleForm" class="quantity-rule-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Minimum Quantity</label>
                        <input type="number" id="minQuantity" name="minQuantity" class="form-input" 
                            min="1" step="1" placeholder="5" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Maximum Quantity</label>
                        <input type="number" id="maxQuantity" name="maxQuantity" class="form-input" 
                            min="1" step="1" placeholder="10 (leave empty for ∞)">
                        <small class="form-help">Leave blank for "or more" (ex: 21+)</small>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Discount (%)</label>
                        <input type="number" id="discountPercent" name="discountPercent" class="form-input" 
                            min="0" max="100" step="1" placeholder="5" required>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="cancelAddQuantityRule()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Save Rule
                    </button>
                </div>
            </form>
        </div>
    `;

    // Insert form after existing rules
    const rulesContainer = container.querySelector('.quantity-rules');
    if (rulesContainer) {
        rulesContainer.insertAdjacentHTML('afterend', formHTML);

        // Event listener for form
        const form = document.getElementById('quantityRuleForm');
        if (form) {
            form.addEventListener('submit', handleQuantityRuleSubmit);
        }

        // Focus on first field
        const firstInput = document.getElementById('minQuantity');
        if (firstInput) {
            firstInput.focus();
        }

        console.log('📦 New rule form displayed');
    }
}

/**
 * Cancel rule addition
 */
function cancelAddQuantityRule() {
    const form = document.getElementById('addQuantityRuleForm');
    if (form) {
        form.remove();
        console.log('📦 Form cancelled');
    }
}

/**
 * Handle quantity rule form submit
 */
async function handleQuantityRuleSubmit(e) {
    e.preventDefault();

    const form = e.target; // The submitted form
    const formData = new FormData(form);

    const minQty = parseInt(formData.get('minQuantity')) || 0;
    const maxQty = formData.get('maxQuantity') ? parseInt(formData.get('maxQuantity')) : null;
    const discount = parseInt(formData.get('discountPercent')) || 0;

    // ===== DEBUG LOGS =====
    console.log('🔍 DEBUG VALUES:');
    console.log('minQty:', minQty, typeof minQty);
    console.log('maxQty:', maxQty, typeof maxQty);
    console.log('discount:', discount, typeof discount);
    const discountElement = document.getElementById('discountPercent');
    console.log('🔍 discountPercent field:', discountElement);
    console.log('🔍 Raw value:', discountElement ? discountElement.value : 'ELEMENT DOES NOT EXIST');
    console.log('🔍 Value as string:', `"${discountElement?.value}"`);
    console.log('isNaN(discount):', isNaN(discount));
    console.log('discount < 0:', discount < 0);
    console.log('discount > 100:', discount > 100);
    // ===== END DEBUG =====

    // Validations
    if (!minQty || minQty < 1) {
        console.log('❌ Failed minQty validation');
        adminPricing.showNotification('Minimum quantity must be greater than 0', 'error');
        return;
    }

    if (maxQty && maxQty <= minQty) {
        console.log('❌ Failed maxQty validation');
        adminPricing.showNotification('Maximum quantity must be greater than minimum', 'error');
        return;
    }

    if (isNaN(discount) || discount < 0 || discount > 100) {
        console.log('❌ Failed discount validation');
        adminPricing.showNotification('Discount must be between 0 and 100%', 'error');
        return;
    }

    console.log('✅ All validations passed');

    // Generate description automatically
    const rangeText = maxQty ? `${minQty}-${maxQty} photos` : `${minQty}+ photos`;
    const description = `${rangeText}: ${discount}% discount`;

    try {
        console.log('📦 Creating new quantity rule...');

        const requestData = {
            minQuantity: minQty,
            maxQuantity: maxQty,
            discountPercent: discount,
            description: description
        };

        const response = await fetch('/api/pricing/quantity-discounts', {
            method: 'POST',
            headers: {
                ...adminPricing.getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (result.success) {
            adminPricing.showNotification('Rule created successfully!', 'success');
            cancelAddQuantityRule(); // Close form
            loadQuantityRules(); // Reload list
        } else {
            throw new Error(result.message || 'Error creating rule');
        }

    } catch (error) {
        console.error('❌ Error creating rule:', error);
        adminPricing.showNotification(`Error: ${error.message}`, 'error');
    }
}

// Make function global
window.cancelAddQuantityRule = cancelAddQuantityRule;

/**
 * Edit quantity rule
 */
async function editQuantityRule(ruleId) {
    try {
        console.log('📦 Loading rule for editing:', ruleId);

        // Fetch current rule data
        const response = await fetch('/api/pricing/quantity-discounts', {
            headers: adminPricing.getAuthHeaders()
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error('Error fetching rules');
        }

        // Find specific rule
        const rule = data.rules.find(r => r._id === ruleId);
        if (!rule) {
            throw new Error('Rule not found');
        }

        // Show edit form with filled data
        showEditQuantityRuleForm(rule);

    } catch (error) {
        console.error('❌ Error loading rule for editing:', error);
        adminPricing.showNotification(`Error: ${error.message}`, 'error');
    }
}

/**
 * Show edit form with filled data
 */
function showEditQuantityRuleForm(rule) {
    // Remove existing form if any
    const existingForm = document.getElementById('addQuantityRuleForm');
    if (existingForm) {
        existingForm.remove();
    }

    const container = document.querySelector('#tab-quantity-discounts .quantity-discounts-section');
    if (!container) return;

    const formHTML = `
        <div id="addQuantityRuleForm" class="add-quantity-rule-form edit-mode">
            <h6><i class="fas fa-edit"></i> Edit Quantity Discount Rule</h6>
            
            <form id="quantityRuleForm" class="quantity-rule-form">
                <input type="hidden" id="editingRuleId" value="${rule._id}">
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Minimum Quantity</label>
                        <input type="number" id="minQuantity" name="minQuantity" class="form-input" 
                            min="1" step="1" value="${rule.minQuantity}" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Maximum Quantity</label>
                        <input type="number" id="maxQuantity" name="maxQuantity" class="form-input" 
                            min="1" step="1" value="${rule.maxQuantity || ''}" 
                            placeholder="Leave empty for ∞">
                        <small class="form-help">Leave blank for "or more" (ex: 21+)</small>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Discount (%)</label>
                        <input type="number" id="discountPercent" name="discountPercent" class="form-input" 
                            min="0" max="100" step="1" value="${rule.discountPercent}" required>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="cancelAddQuantityRule()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Update Rule
                    </button>
                </div>
            </form>
        </div>
    `;

    // Insert form
    const rulesContainer = container.querySelector('.quantity-rules');
    if (rulesContainer) {
        rulesContainer.insertAdjacentHTML('afterend', formHTML);

        // Event listener for form
        const form = document.getElementById('quantityRuleForm');
        if (form) {
            form.addEventListener('submit', handleQuantityRuleUpdate);
        }

        // Focus on first field
        const firstInput = document.getElementById('minQuantity');
        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        }

        console.log('📦 Edit form displayed for rule:', rule._id);
    }
}

/**
 * Handle existing rule update
 */
async function handleQuantityRuleUpdate(e) {
    e.preventDefault();

    const ruleId = document.getElementById('editingRuleId').value;
    if (!ruleId) {
        adminPricing.showNotification('Rule ID not found', 'error');
        return;
    }

    const form = e.target;
    const formData = new FormData(form);

    const minQty = parseInt(formData.get('minQuantity')) || 0;
    const maxQty = formData.get('maxQuantity') ? parseInt(formData.get('maxQuantity')) : null;
    const discount = parseInt(formData.get('discountPercent')) || 0;

    // Validations (same as create)
    if (!minQty || minQty < 1) {
        adminPricing.showNotification('Minimum quantity must be greater than 0', 'error');
        return;
    }

    if (maxQty && maxQty <= minQty) {
        adminPricing.showNotification('Maximum quantity must be greater than minimum', 'error');
        return;
    }

    if (isNaN(discount) || discount < 0 || discount > 100) {
        adminPricing.showNotification('Discount must be between 0 and 100%', 'error');
        return;
    }

    try {
        console.log('📦 Updating quantity rule:', ruleId);

        const requestData = {
            minQuantity: minQty,
            maxQuantity: maxQty,
            discountPercent: discount
        };

        const response = await fetch(`/api/pricing/quantity-discounts/${ruleId}`, {
            method: 'PUT',
            headers: {
                ...adminPricing.getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (result.success) {
            adminPricing.showNotification('Rule updated successfully!', 'success');
            cancelAddQuantityRule(); // Close form
            loadQuantityRules(); // Reload list
        } else {
            throw new Error(result.message || 'Error updating rule');
        }

    } catch (error) {
        console.error('❌ Error updating rule:', error);
        adminPricing.showNotification(`Error: ${error.message}`, 'error');
    }
}

/**
 * Remove quantity rule
 */
async function removeQuantityRule(ruleId) {
    const confirmMessage = 'Are you sure you want to remove this quantity discount rule?';
    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        console.log('📦 Removing rule:', ruleId);

        const response = await fetch(`/api/pricing/quantity-discounts/${ruleId}`, {
            method: 'DELETE',
            headers: adminPricing.getAuthHeaders()
        });

        const result = await response.json();

        if (result.success) {
            adminPricing.showNotification('Rule removed successfully!', 'success');
            loadQuantityRules(); // Reload list
        } else {
            throw new Error(result.message || 'Error removing rule');
        }

    } catch (error) {
        console.error('❌ Error removing rule:', error);
        adminPricing.showNotification(`Error: ${error.message}`, 'error');
    }
}

// Make functions global
window.editQuantityRule = editQuantityRule;
window.removeQuantityRule = removeQuantityRule;

// ===== AUTOMATIC MODAL INTEGRATION =====

/**
 * Detect when price modal opens and initialize tabs automatically
 */
function setupModalAutoInitialization() {
    const modal = document.getElementById('priceModal');
    if (!modal) return;

    // Observer to detect when modal becomes visible
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const isVisible = modal.style.display === 'flex';

                if (isVisible) {
                    console.log('🔧 Price modal detected as open - initializing tabs...');

                    // Wait a bit for DOM to be ready
                    setTimeout(() => {
                        initializePriceTabs();
                        switchPriceTab('base-price');
                        console.log('✅ Tabs initialized automatically');
                    }, 200);
                }
            }
        });
    });

    // Observe changes in modal style attribute
    observer.observe(modal, {
        attributes: true,
        attributeFilter: ['style']
    });

    console.log('👁️ Modal observer configured for auto-initialization');
}

// Configure observer when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupModalAutoInitialization, 500);
});

// Fallback: also try when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupModalAutoInitialization);
} else {
    setupModalAutoInitialization();
}

// ===== CLIENT RULE REMOVAL =====

/**
 * Remove discount rule for specific client
 */
async function removeClientRule(clientCode) {
    if (!adminPricing.currentCategory) return;

    // Confirm removal
    const confirmMessage = `Are you sure you want to remove the discount rule for client ${clientCode}?`;
    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        console.log(`🗑️ Removing rule for client: ${clientCode}`);

        const response = await fetch(`/api/pricing/categories/${adminPricing.currentCategory._id}/discount-rules/${clientCode}`, {
            method: 'DELETE',
            headers: adminPricing.getAuthHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error removing rule');
        }

        if (result.success) {
            console.log('✅ Rule removed successfully');
            adminPricing.showNotification('Rule removed successfully!', 'success');

            // Reload rules list
            await loadClientRules();
        } else {
            throw new Error(result.message || 'Unknown error');
        }

    } catch (error) {
        console.error('❌ Error removing rule:', error);
        adminPricing.showNotification(`Error: ${error.message}`, 'error');
    }
}

// Make function global for HTML usage
window.removeClientRule = removeClientRule;

console.log('🔖 Tab system loaded with auto-initialization');