// public/js/admin-pricing.js
// VERSÃO SIMPLIFICADA PARA R2 - SEM GOOGLE DRIVE

/**
 * ADMIN PRICING - SUNSHINE COWHIDES
 * Sistema de gestão de preços integrado com R2
 * Versão simplificada: ~1500 linhas (antes: 2785)
 */

class AdminPricing {
    constructor() {
        this.categories = [];
        this.currentCategory = null;
        this.isLoading = false;
        this.currentPage = 1;
        this.itemsPerPage = 100;
        this.clientRates = {};
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
        this.loadInitialData();
        console.log('✅ Price Management initialized');
    }

    setupElements() {
        this.section = document.getElementById('section-pricing');
        if (!this.section) {
            console.warn('⚠️ Pricing section not found');
            return;
        }

        this.syncStatusBanner = document.getElementById('syncStatusBanner');
        this.syncStatusText = document.getElementById('syncStatusText');
        this.syncLastUpdate = document.getElementById('syncLastUpdate');
        this.pricingTable = document.getElementById('pricingTableBody');
        this.pricingPagination = document.getElementById('pricingPagination');
        this.priceModal = document.getElementById('priceModal');
        this.priceForm = document.getElementById('priceForm');
        this.loading = document.getElementById('loading');
    }

    setupEventListeners() {
        // Main buttons
        const btnRefreshR2 = document.getElementById('btnSyncDrive');
        const btnBulkEdit = document.getElementById('btnBulkEdit');

        if (btnRefreshR2) {
            // Trocar texto do botão
            btnRefreshR2.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh from R2';
            btnRefreshR2.addEventListener('click', () => this.refreshFromR2());
        }

        if (btnBulkEdit) {
            btnBulkEdit.addEventListener('click', () => this.openBulkEditModal());
        }

        // Filters
        const searchInput = document.getElementById('searchCategories');
        const filterPrice = document.getElementById('filterPriceStatus');
        const sortSelect = document.getElementById('sortCategories');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
        if (filterPrice) {
            filterPrice.addEventListener('change', (e) => this.handlePriceFilter(e.target.value));
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => this.handleSort(e.target.value));
        }

        // Pagination
        const btnPrevPage = document.getElementById('btnPrevPage');
        const btnNextPage = document.getElementById('btnNextPage');

        if (btnPrevPage) btnPrevPage.addEventListener('click', () => this.previousPage());
        if (btnNextPage) btnNextPage.addEventListener('click', () => this.nextPage());

        // Form submit
        if (this.priceForm) {
            this.priceForm.addEventListener('submit', (e) => this.handlePriceSubmit(e));
        }

        // Close modal with ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.priceModal) {
                this.closePriceModal();
            }
        });
    }

    // ===== INITIAL DATA LOADING =====
    async loadInitialData() {
        try {
            await this.checkR2Status();
            await this.loadCategories();
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
            this.showError('Error loading pricing data');
        }
    }

    // ===== R2 SYNCHRONIZATION (SIMPLIFIED) =====
    async checkR2Status() {
        try {
            const response = await fetch('/api/pricing/sync/status', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.updateSyncStatus(data.statistics);
            }

        } catch (error) {
            console.error('❌ Error checking R2 status:', error);
        }
    }

    async refreshFromR2() {
        try {
            this.showSyncLoading(true);
            this.updateSyncProgress('Connecting to R2 Storage...', 20);

            const response = await fetch('/api/pricing/sync', {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ forceRefresh: true })
            });

            this.updateSyncProgress('Processing categories...', 60);
            const data = await response.json();

            if (data.success) {
                const { created, updated, deactivated } = data.summary || data.data || {};
                const message = `R2 Sync: ${created || 0} new, ${updated || 0} updated, ${deactivated || 0} removed`;

                this.showSyncStatus(message, 'success');
                this.updateSyncProgress('Sync complete!', 100);

                // Reload categories
                await this.loadCategories();

                this.showNotification('Categories refreshed from R2!', 'success');

            } else {
                throw new Error(data.message || 'Sync error');
            }

        } catch (error) {
            console.error('❌ R2 sync error:', error);
            this.showNotification('Error syncing with R2', 'error');
        } finally {
            setTimeout(() => this.showSyncLoading(false), 2000);
        }
    }

    updateSyncStatus(statistics) {
        if (!this.syncStatusBanner) return;

        const { categoriesWithoutPrice = 0, totalCategories = 0 } = statistics;

        if (categoriesWithoutPrice > 0) {
            this.syncStatusBanner.className = 'sync-status-banner warning';
            this.syncStatusText.textContent = `${categoriesWithoutPrice} categories need pricing`;
        } else {
            this.syncStatusBanner.className = 'sync-status-banner success';
            this.syncStatusText.textContent = `All ${totalCategories} categories have prices`;
        }

        this.syncStatusBanner.style.display = 'block';
    }

    showSyncStatus(message, type = 'info') {
        if (!this.syncStatusText) return;

        this.syncStatusText.textContent = message;
        this.syncStatusBanner.className = `sync-status-banner ${type}`;
        this.syncStatusBanner.style.display = 'block';
    }

    showSyncLoading(show = true) {
        const loadingEl = document.getElementById('pricingSyncLoading');
        if (loadingEl) {
            loadingEl.style.display = show ? 'block' : 'none';
        }
    }

    updateSyncProgress(message, percentage = 0) {
        const progressBar = document.getElementById('syncProgressBar');
        const progressText = document.getElementById('syncProgressText');

        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = message;
    }

    // ===== CATEGORY MANAGEMENT =====
    async loadCategories() {
        try {
            const params = new URLSearchParams({
                search: this.filters.search,
                priceStatus: this.filters.priceStatus === 'all' ? '' :
                    this.filters.priceStatus === 'with' ? 'with' : 'without',
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
                this.updateStatistics(data.categories);

                console.log(`✅ ${this.categories.length} categories loaded`);
            } else {
                throw new Error(data.message || 'Error loading categories');
            }

        } catch (error) {
            console.error('❌ Error loading categories:', error);
            this.showError('Error loading categories');
        }
    }

    renderCategoriesTable() {
        if (!this.pricingTable) return;

        if (this.categories.length === 0) {
            this.pricingTable.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <i class="fas fa-inbox"></i>
                        No categories found
                        <br><small>Try refreshing from R2</small>
                    </td>
                </tr>
            `;
            return;
        }

        const rows = this.categories.map(category => `
            <tr onclick="adminPricing.viewCategoryDetails('${category._id}')">
                <td class="qb-item-cell">
                    <div class="qb-item-container">
                        <span class="qb-item-display">${category.qbItem || 'Not set'}</span>
                        <button class="btn-edit-qb" 
                            onclick="event.stopPropagation(); adminPricing.editQBItem('${category._id}', '${(category.qbItem || '').replace(/'/g, '&#39;')}')" 
                            title="Edit QB Item">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
                <td class="category-description-cell">
                    <strong>${this.cleanCategoryName(category.displayName)}</strong>
                    <small class="text-muted">${category.folderName}</small>
                </td>
                <td class="photos-count-cell">
                    <span class="photo-count-badge">${category.photoCount}</span>
                    <small>photo${category.photoCount !== 1 ? 's' : ''}</small>
                </td>
                <td class="price-cell ${category.basePrice > 0 ? 'has-price' : 'no-price'}">
                    ${category.basePrice > 0 ?
                `<span class="price-value">$${category.basePrice.toFixed(2)}</span>` :
                '<span class="no-price-text">No price</span>'}
                </td>
                <td class="pricing-actions-cell" onclick="event.stopPropagation();">
                    <button class="btn-pricing-action btn-edit-price" 
                        onclick="adminPricing.openPriceModal('${category._id}')"
                        title="Edit Price">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        this.pricingTable.innerHTML = rows;
    }

    updateStatistics(categories) {
        // Update stats cards
        const totalCount = categories.length;
        const withPrice = categories.filter(c => c.basePrice > 0).length;
        const withoutPrice = totalCount - withPrice;
        const totalPhotos = categories.reduce((sum, c) => sum + c.photoCount, 0);

        // Update DOM elements if they exist
        const elements = {
            'totalCategoriesCount': totalCount,
            'categoriesWithPriceCount': withPrice,
            'categoriesWithoutPriceCount': withoutPrice,
            'totalPhotosCount': totalPhotos
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    // ===== PRICE MODAL =====
    async openPriceModal(categoryId) {
        try {
            const response = await fetch(`/api/pricing/categories/${categoryId}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Category not found');
            }

            this.currentCategory = data.category;
            this.updatePriceModal();
            this.showModal();

        } catch (error) {
            console.error('❌ Error opening price modal:', error);
            this.showNotification('Error loading category', 'error');
        }
    }

    updatePriceModal() {
        if (!this.currentCategory) return;

        // Update modal content
        const modalTitle = document.getElementById('priceModalTitle');
        const categoryName = document.getElementById('modalCategoryName');
        const photoCount = document.getElementById('modalPhotoCount');
        const currentPrice = document.getElementById('modalCurrentPrice');
        const newPriceInput = document.getElementById('newPrice');
        const qbItemInput = document.getElementById('qbItem');

        if (modalTitle) modalTitle.textContent = 'Edit Price & Settings';
        if (categoryName) categoryName.textContent = this.cleanCategoryName(this.currentCategory.displayName);
        if (photoCount) photoCount.textContent = `${this.currentCategory.photoCount} photos`;

        if (currentPrice) {
            currentPrice.textContent = this.currentCategory.basePrice > 0 ?
                `Current: $${this.currentCategory.basePrice.toFixed(2)}` : 'No price set';
        }

        if (newPriceInput) newPriceInput.value = this.currentCategory.basePrice || '';
        if (qbItemInput) qbItemInput.value = this.currentCategory.qbItem || '';

        // Load discount rules
        this.loadCategoryDiscounts();
        // Carregar volume rules também
        this.loadVolumeRules();
        // Carregar clientes no dropdown
        this.loadAvailableClients();
    }

    showModal() {
        if (this.priceModal) {
            this.priceModal.style.display = 'flex';
            this.priceModal.classList.add('active');

            // Focus on price input
            setTimeout(() => {
                const priceInput = document.getElementById('newPrice');
                if (priceInput) priceInput.focus();
            }, 100);
        }
    }

    closePriceModal() {
        // Fechar APENAS o priceModal (não todos os modais)
        const modal = document.getElementById('priceModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }

        this.currentCategory = null;
    }

    async saveAllPricing() {
        if (!this.currentCategory) return;

        try {
            const newPrice = parseFloat(document.getElementById('newPrice').value) || 0;
            const reason = 'Price update via modal';
            const qbItem = document.getElementById('qbItem')?.value || this.currentCategory.qbItem || '';

            if (newPrice < 0) {
                this.showNotification('Price must be positive', 'error');
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
                    qbItem: qbItem,
                    reason: reason
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Price saved successfully!', 'success');

                // USAR O MÉTODO closePriceModal QUE JÁ FAZ TUDO
                this.closePriceModal();

                // Recarregar categorias
                await this.loadCategories();
            } else {
                throw new Error(data.message || 'Error saving price');
            }

        } catch (error) {
            console.error('Error saving:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async handlePriceSubmit(e) {
        e.preventDefault();

        if (!this.currentCategory) return;

        try {
            const newPrice = parseFloat(document.getElementById('newPrice').value) || 0;
            const qbItem = document.getElementById('qbItem')?.value || this.currentCategory.qbItem || '';
            const reason = document.getElementById('priceReason')?.value || 'Price update';

            if (newPrice < 0) {
                this.showNotification('Price must be positive', 'error');
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
                    qbItem: qbItem,
                    reason: reason
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Price updated successfully!', 'success');
                this.closePriceModal();
                await this.loadCategories();
            } else {
                throw new Error(data.message || 'Error saving price');
            }

        } catch (error) {
            console.error('❌ Error saving price:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // ===== DISCOUNT MANAGEMENT =====
    async loadCategoryDiscounts() {
        if (!this.currentCategory) return;

        try {
            // Load client-specific rules
            await this.loadClientRules();

            // Load volume rules
            await this.loadVolumeRules();

        } catch (error) {
            console.error('❌ Error loading discounts:', error);
        }
    }

    async togglePricingMode(newMode) {
        if (!this.currentCategory) return;

        try {
            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/pricing-mode`, {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pricingMode: newMode })
            });

            const data = await response.json();

            if (data.success) {
                this.currentCategory.pricingMode = newMode;
                this.updateDiscountSections(newMode);
                this.showNotification(`Pricing mode changed to ${newMode}`, 'success');
            }

        } catch (error) {
            console.error('❌ Error changing pricing mode:', error);
            this.showNotification('Error changing pricing mode', 'error');
        }
    }

    // ===== CLIENT RULES =====
    async loadClientRules() {
        try {
            console.log('=== LOAD CLIENT RULES ===');
            console.log('Category ID:', this.currentCategory._id);

            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/discount-rules`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            console.log('Dados recebidos do backend:', data);

            if (data.success) {
                console.log('Regras a renderizar:', data.discountRules);
                this.renderClientRules(data.discountRules || []);
            }

        } catch (error) {
            console.error('❌ Error loading client rules:', error);
        }
    }

    renderClientRules(rules) {
        console.log('=== RENDER CLIENT RULES ===');
        console.log('Rules recebidas:', rules);

        const container = document.getElementById('clientRulesList');
        if (!container) return;

        // FILTRAR: remover regra VOLUME (ela vai em outro lugar!)
        const clientOnlyRules = rules.filter(rule => rule.clientCode !== 'VOLUME');

        if (clientOnlyRules.length === 0) {
            container.innerHTML = '<p class="text-muted">No client rules configured</p>';
            return;
        }

        // DEBUG CADA REGRA
        clientOnlyRules.forEach((rule, index) => {
            console.log(`Regra ${index}:`, {
                clientName: rule.clientName,
                clientCode: rule.clientCode,
                priceRanges: rule.priceRanges
            });
        });

        container.innerHTML = clientOnlyRules.map(rule => {
            let priceText = '';

            // Se tem faixas, mostrar
            if (rule.priceRanges && rule.priceRanges.length > 0) {
                priceText = rule.priceRanges.map(range => {
                    const rangeText = range.max ? `${range.min}-${range.max}` : `${range.min}+`;
                    return `${rangeText}: $${range.price}`;
                }).join(' | ');
            }
            // Senão, mostrar formato antigo
            else if (rule.customPrice) {
                priceText = `$${rule.customPrice.toFixed(2)} fixed`;
            }
            else if (rule.discountPercent) {
                priceText = `${rule.discountPercent}% off`;
            }

            return `
                <div class="rule-item">
                    <span><strong>${rule.clientName}:</strong> ${priceText}</span>
                    <button class="btn-icon" onclick="adminPricing.deleteClientRule('${rule.clientCode}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    async addClientRule(priceRanges = []) {
        console.log('=== ADDCLIENTRULE CHAMADO ===');
        console.log('priceRanges recebido:', priceRanges);

        const clientCode = document.getElementById('clientRuleSelect')?.value;
        console.log('clientCode:', clientCode);

        if (!clientCode) {
            this.showNotification('Please select a client', 'error');
            return;
        }

        try {
            const clientName = document.querySelector(`#clientRuleSelect option[value="${clientCode}"]`)?.text || clientCode;

            const data = {
                clientCode,
                clientName,
                priceRanges: priceRanges,
                isActive: true
            };

            console.log('Enviando para backend:', JSON.stringify(data, null, 2));

            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/discount-rules`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            console.log('Resposta do backend:', result);

            if (result.success) {
                this.showNotification('Client rates saved!', 'success');
                await this.loadClientRules();

                // Limpar rates temporários
                if (this.clientRates[this.currentCategory._id]) {
                    delete this.clientRates[this.currentCategory._id][clientCode];
                }
            } else {
                this.showNotification(result.message || 'Error saving', 'error');
            }
        } catch (error) {
            console.error('❌ Error saving client rule:', error);
            this.showNotification('Error saving client rates', 'error');
        }
    }

    async deleteClientRule(clientCode) {
        if (!confirm('Remove this client rule?')) return;

        try {
            const response = await fetch(
                `/api/pricing/categories/${this.currentCategory._id}/discount-rules/${clientCode}`,
                {
                    method: 'DELETE',
                    headers: this.getAuthHeaders()
                }
            );

            const data = await response.json();

            if (data.success) {
                this.showNotification('Rule removed', 'success');
                await this.loadClientRules();
            }

        } catch (error) {
            console.error('❌ Error deleting rule:', error);
            this.showNotification('Error removing rule', 'error');
        }
    }

    // ===== QUANTITY RULES =====
    async loadQuantityRules() {
        try {
            const response = await fetch('/api/pricing/quantity-discounts', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.renderQuantityRules(data.rules || []);
            }

        } catch (error) {
            console.error('❌ Error loading quantity rules:', error);
        }
    }

    renderQuantityRules(rules) {
        // Renderizar na lista
        const container = document.getElementById('quantityRulesList') ||
            document.getElementById('volumeRulesList');

        if (container) {
            if (rules.length === 0) {
                container.innerHTML = '<p class="text-muted">No volume rules configured</p>';
            } else {
                container.innerHTML = rules.map(rule => {
                    const priceText = rule.fixedPrice ?
                        `$${rule.fixedPrice.toFixed(2)}` :
                        `${rule.discountPercent}% off`;

                    return `
                        <div class="rule-item">
                            <span>${rule.minQuantity}${rule.maxQuantity ? `-${rule.maxQuantity}` : '+'} photos: ${priceText}</span>
                            <button class="btn-icon" onclick="adminPricing.deleteQuantityRule('${rule._id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                }).join('');
            }
        }

    }

    async addQuantityRule() {
        const minQty = parseInt(document.getElementById('quantityMin').value);
        const maxQty = document.getElementById('quantityMax').value ?
            parseInt(document.getElementById('quantityMax').value) : null;
        const discount = parseFloat(document.getElementById('quantityDiscount').value);

        if (!minQty || !discount) {
            this.showNotification('Please fill all required fields', 'error');
            return;
        }

        try {
            const response = await fetch('/api/pricing/quantity-discounts', {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    minQuantity: minQty,
                    maxQuantity: maxQty,
                    discountPercent: discount,
                    description: `${minQty}${maxQty ? `-${maxQty}` : '+'} photos: ${discount}% off`
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Quantity rule added!', 'success');
                await this.loadQuantityRules();
            }

        } catch (error) {
            console.error('❌ Error adding quantity rule:', error);
            this.showNotification('Error adding rule', 'error');
        }
    }

    async deleteQuantityRule(ruleId) {
        // Guardar o ID para usar depois
        this.pendingDeleteRuleId = ruleId;

        // Mostrar modal customizado
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    async confirmDelete() {
        if (!this.pendingDeleteRuleId) return;

        try {
            const response = await fetch(`/api/pricing/quantity-discounts/${this.pendingDeleteRuleId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Rule removed', 'success');
                await this.loadQuantityRules();
            }
        } catch (error) {
            console.error('❌ Error deleting rule:', error);
            this.showNotification('Error removing rule', 'error');
        } finally {
            this.cancelDelete();
        }
    }

    cancelDelete() {
        this.pendingDeleteRuleId = null;
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async getQuantityDiscount(quantity) {
        try {
            const response = await fetch(`/api/pricing/quantity-discounts/calculate/${quantity}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            return data.discount?.discountPercent || 0;

        } catch (error) {
            return 0;
        }
    }


    async editQBItem(categoryId, currentQBItem = '') {
        // Guardar o ID da categoria sendo editada
        this.currentEditingCategoryId = categoryId;

        // Abrir o modal
        const modal = document.getElementById('qbItemModal');
        const input = document.getElementById('qbItemModalInput');

        if (modal && input) {
            input.value = currentQBItem || '';
            modal.style.display = 'flex';
            setTimeout(() => input.focus(), 100);
        }
    }

    closeQBItemModal() {
        const modal = document.getElementById('qbItemModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async saveQBItemFromModal() {
        const newQBItem = document.getElementById('qbItemModalInput')?.value || '';

        if (!this.currentEditingCategoryId) return;

        try {
            const category = this.categories.find(c => c._id === this.currentEditingCategoryId);
            const currentPrice = category ? category.basePrice : 0;

            const response = await fetch(`/api/pricing/categories/${this.currentEditingCategoryId}/price`, {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    price: currentPrice,
                    qbItem: newQBItem.trim(),
                    reason: 'QB Item updated'
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('QB Item updated!', 'success');
                this.closeQBItemModal();
                await this.loadCategories();
            }
        } catch (error) {
            console.error('❌ Error updating QB Item:', error);
            this.showNotification('Error updating QB Item', 'error');
        }
    }

    async loadVolumeRules() {
        try {
            // Buscar regras VOLUME do endpoint CORRETO
            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/volume-rules`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success && data.data && data.data.volumeRules) {
                // Renderizar as regras
                this.renderVolumeRules(data.data.volumeRules);
            } else {
                // Se não tem regras, mostrar mensagem
                const container = document.getElementById('volumeRulesList');
                if (container) {
                    container.innerHTML = '<p class="text-muted">No volume rules configured</p>';
                }
            }

        } catch (error) {
            console.error('Error loading volume rules:', error);
            const container = document.getElementById('volumeRulesList');
            if (container) {
                container.innerHTML = '<p class="text-muted">No volume rules configured</p>';
            }
        }
    }

    renderVolumeRules(rules) {
        const container = document.getElementById('volumeRulesList');
        if (!container) return;

        if (!rules || rules.length === 0) {
            container.innerHTML = '<p class="text-muted">No volume rules configured</p>';
            return;
        }

        container.innerHTML = rules.map(rule => `
        <div class="rule-item">
            <span class="rule-range">
                ${rule.min}${rule.max ? '-' + rule.max : '+'} photos: 
                <strong>$${rule.price}</strong>
            </span>
            <button class="btn-icon" onclick="adminPricing.deleteVolumeRule('${rule.min}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    }

    async deleteVolumeRule(minToDelete) {
        if (!confirm('Remove this volume rule?')) return;

        try {
            // Buscar regras atuais
            const getResponse = await fetch(`/api/pricing/categories/${this.currentCategory._id}/volume-rules`, {
                headers: this.getAuthHeaders()
            });

            if (!getResponse.ok) {
                throw new Error('Failed to get current rules');
            }

            const getData = await getResponse.json();
            let currentRanges = getData.data?.volumeRules || [];

            // Remover a regra específica
            currentRanges = currentRanges.filter(rule => rule.min !== parseInt(minToDelete));

            // Salvar regras atualizadas (ou deletar todas se vazio)
            if (currentRanges.length > 0) {
                // Ainda tem regras, salvar
                const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/volume-rules`, {
                    method: 'POST',
                    headers: {
                        ...this.getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        priceRanges: currentRanges
                    })
                });

                if (response.ok) {
                    this.showNotification('Volume rule removed!', 'success');
                    await this.loadVolumeRules();
                }
            } else {
                // Não tem mais regras, deletar tudo
                const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/volume-rules`, {
                    method: 'DELETE',
                    headers: this.getAuthHeaders()
                });

                if (response.ok) {
                    this.showNotification('All volume rules removed!', 'success');
                    await this.loadVolumeRules();
                }
            }

        } catch (error) {
            console.error('Error deleting volume rule:', error);
            this.showNotification('Error removing rule', 'error');
        }
    }

    // ===== MODAL MANAGEMENT METHODS =====
    openVolumeRulesManager() {
        console.log('Opening volume rules manager...');

        // Usar o modal que JÁ EXISTE no HTML
        const modal = document.getElementById('volumeRulesModal');
        if (modal) {
            modal.style.display = 'flex';

            // Focar no primeiro input
            setTimeout(() => {
                const firstInput = modal.querySelector('input[type="number"]');
                if (firstInput) firstInput.focus();
            }, 100);
        } else {
            console.error('volumeRulesModal não encontrado!');
        }
    }

    closeVolumeRulesModal() {
        const modal = document.getElementById('volumeRulesModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }


    async saveVolumeRuleFromModal() {
        const minQty = document.getElementById('volumeMinQty')?.value;
        const maxQty = document.getElementById('volumeMaxQty')?.value;
        const price = document.getElementById('volumePrice')?.value;

        if (!minQty || !price || !this.currentCategory) {
            this.showNotification('Please fill required fields', 'error');
            return;
        }

        try {
            // PRIMEIRO: Buscar regras existentes
            let existingRanges = [];
            const getResponse = await fetch(`/api/pricing/categories/${this.currentCategory._id}/volume-rules`, {
                headers: this.getAuthHeaders()
            });

            if (getResponse.ok) {
                const getData = await getResponse.json();
                if (getData.data?.volumeRules) {
                    existingRanges = getData.data.volumeRules;
                }
            }

            // SEGUNDO: Adicionar nova regra às existentes
            existingRanges.push({
                min: parseInt(minQty),
                max: (maxQty && maxQty.trim() !== '') ? parseInt(maxQty) : null,  // ← CORREÇÃO AQUI!
                price: parseFloat(price)
            });

            // TERCEIRO: Ordenar por min
            existingRanges.sort((a, b) => a.min - b.min);

            // QUARTO: Salvar TODAS as regras
            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/volume-rules`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    priceRanges: existingRanges
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Volume rule added!', 'success');

                document.getElementById('volumeMinQty').value = '';
                document.getElementById('volumeMaxQty').value = '';
                document.getElementById('volumePrice').value = '';

                this.closeVolumeRulesModal();
                await this.loadVolumeRules();
            }

        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error saving', 'error');
        }
    }

    async addVolumeRule(minQty, maxQty, fixedPrice) {
        try {
            const response = await fetch('/api/pricing/quantity-discounts', {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    minQuantity: minQty,
                    maxQuantity: maxQty,
                    fixedPrice: fixedPrice,
                    ruleType: 'fixed',
                    description: `${minQty}${maxQty ? `-${maxQty}` : '+'}: $${fixedPrice}`,
                    createdBy: 'admin'
                })
            });

            const data = await response.json();
            if (data.success) {
                this.showNotification('Volume rule added!', 'success');
                await this.loadQuantityRules();
            }
        } catch (error) {
            console.error('❌ Error adding volume rule:', error);
        }
    }

    showAddClientRule() {
        console.log('Opening client rule modal...');
        // Primeiro carregar os clientes disponíveis
        this.loadAvailableClients();
    }

    openClientRatesModal() {
        const modal = document.getElementById('clientRuleModal');
        if (modal) {
            modal.style.display = 'flex';
            this.loadAvailableClients();
        }
    }

    closeClientRuleModal() {
        console.log('=== FECHANDO MODAL ===');

        const modal = document.getElementById('clientRuleModal');
        if (modal) {
            modal.style.display = 'none';
        }

        const clientCode = document.getElementById('clientRuleSelect').value;
        console.log('ClientCode ao fechar:', clientCode);
        console.log('ClientRates:', this.clientRates);

        // Se tem ranges não salvos, salvar
        if (clientCode && this.clientRates[this.currentCategory._id]?.[clientCode]?.ranges.length > 0) {
            console.log('SALVANDO RANGES NO BACKEND!');
            const ranges = this.clientRates[this.currentCategory._id][clientCode].ranges;
            console.log('Ranges a salvar:', ranges);
            this.addClientRule(ranges);
        } else {
            console.log('NADA PARA SALVAR');
        }

        // Limpar seleção
        document.getElementById('clientRuleSelect').value = '';
        document.getElementById('clientRateForm').style.display = 'none';
    }
    loadClientRatesForEdit() {
        const select = document.getElementById('clientRuleSelect');
        const form = document.getElementById('clientRateForm');
        const clientCode = select.value;

        if (clientCode) {
            // Mostrar formulário
            form.style.display = 'block';
            // Carregar faixas existentes para este cliente
            this.loadClientRanges(clientCode);
        } else {
            form.style.display = 'none';
        }
    }

    async loadClientRanges(clientCode) {
        // Por enquanto mostrar vazio
        const container = document.getElementById('clientRatesListModal');
        container.innerHTML = '<p class="text-muted">No rates configured for this client</p>';
    }

    async saveClientRate() {
        const clientCode = document.getElementById('clientRuleSelect').value;
        const clientName = document.getElementById('clientRuleSelect').selectedOptions[0]?.text;
        const minQty = document.getElementById('clientMinQty').value;
        const maxQty = document.getElementById('clientMaxQty').value;
        const price = document.getElementById('clientPrice').value;

        // DEBUG
        console.log('=== DEBUG SAVELIENTRATE ===');
        console.log('clientCode:', clientCode);
        console.log('clientName:', clientName);
        console.log('minQty:', minQty);
        console.log('maxQty:', maxQty);
        console.log('price:', price);
        console.log('currentCategory:', this.currentCategory);
        console.log('==========================');

        if (!clientCode || !minQty || !price) {
            this.showNotification('Please fill all required fields', 'error');
            return;
        }

        if (!this.currentCategory) {
            this.showNotification('No category selected!', 'error');
            return;
        }

        // Criar estrutura se não existir
        if (!this.clientRates[this.currentCategory._id]) {
            this.clientRates[this.currentCategory._id] = {};
        }
        if (!this.clientRates[this.currentCategory._id][clientCode]) {
            this.clientRates[this.currentCategory._id][clientCode] = {
                clientName: clientName,
                ranges: []
            };
        }

        // Adicionar nova faixa
        this.clientRates[this.currentCategory._id][clientCode].ranges.push({
            min: parseInt(minQty),
            max: maxQty ? parseInt(maxQty) : null,
            price: parseFloat(price)
        });

        // Atualizar visualização no modal
        this.loadClientRanges(clientCode);

        // Limpar campos
        document.getElementById('clientMinQty').value = '';
        document.getElementById('clientMaxQty').value = '';
        document.getElementById('clientPrice').value = '';

        console.log('Faixa adicionada localmente:', this.clientRates);
        this.showNotification('Range added! Click Done to save all.', 'info');
    }

    async loadAvailableClients() {
        try {
            const response = await fetch('/api/pricing/clients/active', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            if (data.success && data.clients.length > 0) {
                // Preencher TODOS os selects de cliente que existirem
                const selects = [
                    document.getElementById('clientRuleSelect'),
                    document.getElementById('calcClientSelect')  // caso ainda exista
                ];

                selects.forEach(select => {
                    if (select) {
                        select.innerHTML = '<option value="">Choose a client...</option>' +
                            data.clients.map(client =>
                                `<option value="${client.code}">${client.name}</option>`
                            ).join('');
                    }
                });
            }
        } catch (error) {
            console.error('❌ Error loading clients:', error);
        }
    }

    // ===== VIEW CATEGORY DETAILS =====
    async viewCategoryDetails(categoryId) {
        try {
            const response = await fetch(`/api/pricing/categories/${categoryId}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                // Open price modal with full details
                this.currentCategory = data.category;
                this.updatePriceModal();
                this.showModal();
            }

        } catch (error) {
            console.error('❌ Error loading category:', error);
            this.showNotification('Error loading category details', 'error');
        }
    }

    // ===== FILTERS =====
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
        this.currentPage = 1;
        this.loadCategories();
    }

    handleSort(value) {
        this.filters.sortBy = value;
        this.currentPage = 1;
        this.loadCategories();
    }

    // ===== PAGINATION =====
    updatePagination(pagination) {
        if (!this.pricingPagination || !pagination) return;

        const { page = 1, totalPages = 1, hasNext = false, hasPrev = false } = pagination;

        const paginationInfo = document.getElementById('paginationInfo');
        const btnPrevPage = document.getElementById('btnPrevPage');
        const btnNextPage = document.getElementById('btnNextPage');

        if (paginationInfo) paginationInfo.textContent = `Page ${page} of ${totalPages}`;
        if (btnPrevPage) btnPrevPage.disabled = !hasPrev;
        if (btnNextPage) btnNextPage.disabled = !hasNext;

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

    // ===== BULK EDIT =====
    openBulkEditModal() {
        this.showNotification('Bulk edit coming soon!', 'info');
        // TODO: Implement bulk price editing
    }

    // ===== UTILITIES =====
    cleanCategoryName(displayName) {
        if (!displayName) return '';

        // Remove common prefixes
        const prefixes = [
            'Sunshine Cowhides Actual Pictures →',
            'Sunshine Cowhides →'
        ];

        let cleaned = displayName;
        prefixes.forEach(prefix => {
            if (cleaned.startsWith(prefix)) {
                cleaned = cleaned.substring(prefix.length).trim();
            }
        });

        return cleaned;
    }

    // Toggle section visibility (expandir/colapsar)
    toggleSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            if (section.style.display === 'none') {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        }
    }

    getAuthHeaders() {
        const sessionData = localStorage.getItem('sunshineSession');
        if (sessionData) {
            const session = JSON.parse(sessionData);
            return { 'Authorization': `Bearer ${session.token}` };
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
        // Show/hide loading overlay
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = loading ? 'flex' : 'none';
        }
    }

    showNotification(message, type = 'info') {
        if (window.UISystem && window.UISystem.showToast) {
            window.UISystem.showToast(type, message);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }
}

// ===== GLOBAL INITIALIZATION =====
let adminPricing = null;

document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const section = document.getElementById('section-pricing');
                if (section && section.style.display !== 'none' && !adminPricing) {
                    adminPricing = new AdminPricing();
                    window.adminPricing = adminPricing;
                }
            }
        });
    });

    const pricingSection = document.getElementById('section-pricing');
    if (pricingSection) {
        observer.observe(pricingSection, { attributes: true });

        if (pricingSection.style.display !== 'none') {
            adminPricing = new AdminPricing();
            window.adminPricing = adminPricing;
        }
    }
});

// ===== GLOBAL FUNCTIONS FOR HTML =====
window.adminPricing = adminPricing;