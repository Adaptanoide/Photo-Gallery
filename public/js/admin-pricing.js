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
        this.itemsPerPage = 25;
        this.allCategories = [];  // Cache de todas as categorias
        this.filteredCategories = []; // Categorias após aplicar filtros
        this.lastLoadTime = 0;    // Controle de tempo do cache
        this.clientRates = {};
        this.filters = {
            search: '',
            priceStatus: 'all',
            sortBy: 'name'
        };

        this.hasUnsavedChanges = false;
        this.originalVolumeRules = [];

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
        const btnPrevPage = document.getElementById('btnPrevPagePricing');
        const btnNextPage = document.getElementById('btnNextPagePricing');

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
            await this.loadCategories(true); // Forçar reload após sync
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
    async loadCategories(forceReload = false) {
        try {
            // Se tem cache válido e não está forçando reload, usar cache
            if (!forceReload && this.allCategories.length > 0) {
                console.log('📦 Usando cache local');
                this.renderFromCache();
                return;
            }

            // Primeira vez ou reload forçado - carregar TUDO
            console.log('🔄 Carregando todas as categorias...');

            const response = await fetch('/api/pricing/categories/all', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                // Salvar TODAS as categorias no cache
                this.allCategories = data.categories;
                console.log(`💾 Cache completo: ${this.allCategories.length} categorias`);

                // Aplicar filtros localmente
                this.applyLocalFilters();

                // Renderizar página atual
                this.renderFromCache();

                // Atualizar estatísticas
                if (data.statistics) {
                    this.updateStatistics(data.categories);
                }
            } else {
                throw new Error(data.message || 'Erro ao carregar categorias');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar categorias:', error);
            this.showError('Erro ao carregar categorias');
        }
    }

    // ===== APPLY LOCAL FILTERS =====
    applyLocalFilters() {
        let filtered = [...this.allCategories];

        // Filtro de busca
        if (this.filters.search) {
            const searchLower = this.filters.search.toLowerCase();
            filtered = filtered.filter(cat =>
                cat.displayName.toLowerCase().includes(searchLower) ||
                cat.folderName.toLowerCase().includes(searchLower) ||
                (cat.qbItem && cat.qbItem.toLowerCase().includes(searchLower))
            );
        }

        // Filtro de preço
        if (this.filters.priceStatus === 'with') {
            filtered = filtered.filter(cat => cat.basePrice > 0);
        } else if (this.filters.priceStatus === 'without') {
            filtered = filtered.filter(cat => !cat.basePrice || cat.basePrice === 0);
        }

        // Ordenação
        switch (this.filters.sortBy) {
            case 'name':
                filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
                break;
            case 'price-high':
                filtered.sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0));
                break;
            case 'price-low':
                filtered.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
                break;
            case 'photos':
                filtered.sort((a, b) => b.photoCount - a.photoCount);
                break;
        }

        this.filteredCategories = filtered;
        console.log(`🔍 Filtrados: ${filtered.length} de ${this.allCategories.length}`);
    }

    // ===== RENDER FROM CACHE =====
    renderFromCache() {
        // Usar categorias filtradas ou todas se não houver filtros
        const source = this.filteredCategories.length > 0 ? this.filteredCategories : this.allCategories;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;

        this.categories = source.slice(startIndex, endIndex);
        this.renderCategoriesTable();

        const totalPages = Math.ceil(source.length / this.itemsPerPage);
        this.updatePagination({
            page: this.currentPage,
            totalPages: totalPages,
            hasNext: this.currentPage < totalPages,
            hasPrev: this.currentPage > 1
        });
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
                    <span class="photo-count-badge">${category.availableCount || category.photoCount}</span>
                    <small>photo${(category.availableCount || category.photoCount) !== 1 ? 's' : ''}</small>
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
            // Linha removida - Total Photos card removido
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
        if (photoCount) photoCount.textContent = `${this.currentCategory.availableCount || this.currentCategory.photoCount} photos`;

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

            // ADICIONAR ESTA LINHA:
            this.setupBasePriceListener();
        }
    }

    // Listener para mudanças no base price
    setupBasePriceListener() {
        const basePriceInput = document.getElementById('newPrice');
        if (!basePriceInput) return;

        // Adicionar listener para atualizar primeira regra de volume
        basePriceInput.addEventListener('input', (e) => {
            const newBasePrice = parseFloat(e.target.value) || 0;

            // Atualizar primeira regra de volume automaticamente
            const firstVolumePrice = document.querySelector('[data-first-rule="true"]');
            if (firstVolumePrice) {
                const oldValue = parseFloat(firstVolumePrice.value);
                firstVolumePrice.value = newBasePrice;

                // Visual feedback
                firstVolumePrice.style.transition = 'background-color 0.3s';
                firstVolumePrice.style.backgroundColor = 'rgba(212, 175, 55, 0.2)';
                setTimeout(() => {
                    firstVolumePrice.style.backgroundColor = '';
                }, 300);

                // Remover aviso de erro se existir
                const warning = firstVolumePrice.parentElement.querySelector('.text-danger');
                if (warning) warning.remove();
                firstVolumePrice.classList.remove('is-invalid');

                console.log(`✅ First volume rule auto-updated: $${oldValue} → $${newBasePrice}`);
            }

            // Atualizar display do current price em tempo real
            const currentPriceDisplay = document.getElementById('modalCurrentPrice');
            if (currentPriceDisplay) {
                if (newBasePrice > 0) {
                    currentPriceDisplay.innerHTML = `<i class="fas fa-dollar-sign"></i> Current: <strong>$${newBasePrice.toFixed(2)}</strong>`;
                    currentPriceDisplay.parentElement.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
                } else {
                    currentPriceDisplay.innerHTML = '<i class="fas fa-exclamation-circle"></i> <span style="color: #ff6b6b;">No price set</span>';
                    currentPriceDisplay.parentElement.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
                }
            }

            // Marcar como alterado apenas se mudou do valor original
            if (this.currentCategory && newBasePrice !== this.currentCategory.basePrice) {
                this.markAsChanged();
            }
        });
    }

    closePriceModal() {
        // Verificar mudanças não salvas
        if (this.hasUnsavedChanges) {
            // Mostrar modal customizado ao invés de alert
            const modal = document.getElementById('unsavedChangesModal');
            if (modal) {
                modal.style.display = 'flex';
                return; // Não fecha ainda
            }
        }

        // Se não tem mudanças, fecha direto
        this.executeClose();
    }

    // Nova função para confirmar fechamento
    confirmClose() {
        const confirmModal = document.getElementById('unsavedChangesModal');
        if (confirmModal) {
            confirmModal.style.display = 'none';
        }
        this.executeClose();
    }

    // Nova função para cancelar fechamento
    cancelClose() {
        const confirmModal = document.getElementById('unsavedChangesModal');
        if (confirmModal) {
            confirmModal.style.display = 'none';
        }
    }

    // Nova função que realmente fecha
    executeClose() {
        const modal = document.getElementById('priceModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }

        // Resetar estados
        this.currentCategory = null;
        this.hasUnsavedChanges = false;
    }

    async saveAllPricing() {
        if (!this.currentCategory) return;

        try {
            // 1. Pegar valores do formulário
            const newPrice = parseFloat(document.getElementById('newPrice').value) || 0;
            const reason = 'Price update via modal';
            const qbItem = document.getElementById('qbItem')?.value || this.currentCategory.qbItem || '';

            if (newPrice < 0) {
                this.showNotification('Price must be positive', 'error');
                return;
            }

            // 2. Auto-ajustar primeira regra se necessário (apenas se existirem volume rules)
            const volumeRulesExist = document.querySelectorAll('.volume-rule-row').length > 0;
            if (volumeRulesExist) {
                const firstPriceInput = document.querySelector('[data-first-rule="true"]');
                if (firstPriceInput) {
                    const firstPrice = parseFloat(firstPriceInput.value);
                    if (firstPrice !== newPrice) {
                        // Auto-corrigir ao invés de dar erro
                        firstPriceInput.value = newPrice;
                        console.log(`✅ First volume rule auto-adjusted to $${newPrice}`);
                    }
                }
            }

            this.setLoading(true);

            // 3. Salvar base price
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
                // 4. Coletar volume rules
                const volumeRules = [];
                const ruleRows = document.querySelectorAll('.volume-rule-row');

                ruleRows.forEach(row => {
                    const from = parseInt(row.querySelector('.volume-from').value);
                    const to = row.querySelector('.volume-to').value;
                    const price = parseFloat(row.querySelector('.volume-price').value);

                    if (from && price) {
                        volumeRules.push({
                            min: from,
                            max: to ? parseInt(to) : null,
                            price: price
                        });
                    }
                });

                // 5. Salvar ou deletar volume rules baseado na quantidade
                if (volumeRules.length > 0) {
                    // TEM REGRAS - SALVAR
                    console.log(`💾 Saving ${volumeRules.length} volume rules...`);
                    const volumeResponse = await fetch(`/api/pricing/categories/${this.currentCategory._id}/volume-rules`, {
                        method: 'POST',
                        headers: {
                            ...this.getAuthHeaders(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ priceRanges: volumeRules })
                    });

                    const volumeResult = await volumeResponse.json();
                    if (!volumeResult.success) {
                        this.showNotification('Price saved but volume rules failed', 'warning');
                    } else {
                        console.log(`✅ ${volumeRules.length} volume rules saved`);
                    }
                } else {
                    // NÃO TEM REGRAS - DELETAR DO BANCO
                    console.log('🗑️ No volume rules found, deleting from database...');
                    try {
                        const deleteResponse = await fetch(`/api/pricing/categories/${this.currentCategory._id}/volume-rules`, {
                            method: 'DELETE',
                            headers: this.getAuthHeaders()
                        });

                        const deleteResult = await deleteResponse.json();
                        if (deleteResult.success) {
                            console.log('✅ All volume rules deleted from database');
                        } else {
                            console.log('⚠️ Failed to delete volume rules:', deleteResult.message);
                        }
                    } catch (deleteError) {
                        console.error('❌ Error deleting volume rules:', deleteError);
                        // Não bloquear o fluxo, apenas avisar
                        console.log('⚠️ Volume rules may not have been deleted');
                    }
                }

                // 6. Resetar flag e atualizar botão
                this.hasUnsavedChanges = false;
                const saveButton = document.querySelector('[onclick*="saveAllPricing"]');
                if (saveButton) {
                    saveButton.innerHTML = '<i class="fas fa-save"></i> Save All Changes';
                    saveButton.classList.remove('btn-warning');
                }

                this.showNotification('All settings saved successfully!', 'success');
                this.closePriceModal();
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

        // Salvar regras originais para comparação
        this.originalVolumeRules = JSON.parse(JSON.stringify(rules || []));

        let html = '<div class="volume-rules-container">';

        // Container sempre existe
        if (!rules || rules.length === 0) {
            // Container vazio com mensagem
            html += '<p class="text-muted empty-message">No volume rules configured</p>';
        } else {
            // Tem regras - renderizar normalmente
            rules.forEach((rule, index) => {
                html += this.createVolumeRuleRow(rule.min, rule.max, rule.price, index, index === 0);
            });
        }

        html += '</div>';

        // Botão para adicionar nova regra
        html += `
            <button type="button" class="btn-add-rule" onclick="adminPricing.addVolumeRuleLine()">
                <i class="fas fa-plus"></i> Add Volume Rule
            </button>
        `;

        container.innerHTML = html;

        // Esconder o botão antigo "Manage Volume Rules"
        const oldButton = container.parentElement.querySelector('button[onclick*="openVolumeRulesManager"]');
        if (oldButton) oldButton.style.display = 'none';

        // Adicionar listeners para rastrear mudanças
        this.attachVolumeRuleListeners();

        // Validar primeira regra
        this.validateFirstVolumeRule();
    }

    createVolumeRuleRow(min, max, price, index, isFirst) {
        return `
            <div class="volume-rule-row" data-index="${index}">
                <span class="rule-label">From</span>
                <input type="number" 
                    class="form-control volume-from" 
                    value="${min}" 
                    ${isFirst ? 'readonly' : 'onchange="adminPricing.updateNextRuleFrom(this)"'}>
                
                <span class="rule-label">to</span>
                <input type="number" 
                    class="form-control volume-to" 
                    value="${max || ''}" 
                    placeholder="∞"
                    onchange="adminPricing.markAsChanged()">
                
                <span class="rule-arrow">→ $</span>
                <input type="number" 
                    class="form-control volume-price" 
                    value="${price}" 
                    step="0.01"
                    ${isFirst ? 'data-first-rule="true"' : ''}
                    onchange="adminPricing.markAsChanged()">
                
                <button type="button" class="btn-icon btn-delete-rule" onclick="adminPricing.removeVolumeRule(this)" title="Remove rule">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }

    addVolumeRuleLine() {
        let container = document.querySelector('.volume-rules-container');

        // Se não existe container, não fazer nada
        if (!container) {
            console.error('Volume rules container not found!');
            return;
        }

        // Remover mensagem de vazio se existir
        const emptyMessage = container.querySelector('.empty-message');
        if (emptyMessage) {
            emptyMessage.remove();
        }

        const rules = container.querySelectorAll('.volume-rule-row');
        const lastRule = rules[rules.length - 1];

        let fromValue = 1;
        let priceValue = '';
        let isFirstRule = false;

        if (!lastRule) {
            // PRIMEIRA REGRA - usar base price
            isFirstRule = true;
            fromValue = 1;
            priceValue = this.currentCategory?.basePrice || document.getElementById('newPrice')?.value || 99;
            console.log(`📝 Creating first rule with base price: $${priceValue}`);
        } else {
            // Regras subsequentes
            const lastTo = lastRule.querySelector('.volume-to').value;
            fromValue = lastTo ? parseInt(lastTo) + 1 :
                parseInt(lastRule.querySelector('.volume-from').value) + 1;
            priceValue = ''; // Deixar vazio para o usuário preencher
        }

        const newIndex = rules.length;
        const newRuleHtml = this.createVolumeRuleRow(fromValue, '', priceValue, newIndex, isFirstRule);

        // Criar elemento temporário para inserir
        const temp = document.createElement('div');
        temp.innerHTML = newRuleHtml;
        container.appendChild(temp.firstElementChild);

        this.markAsChanged();
        this.attachVolumeRuleListeners();

        // Se é a primeira regra, aplicar validação
        if (isFirstRule) {
            this.validateFirstVolumeRule();

            // Adicionar listener para atualização automática com base price
            const basePriceInput = document.getElementById('newPrice');
            const firstPriceInput = container.querySelector('[data-first-rule="true"]');

            if (basePriceInput && firstPriceInput) {
                // Garantir que primeira regra acompanha base price
                const updateFirstRule = () => {
                    const newBase = parseFloat(basePriceInput.value) || 0;
                    firstPriceInput.value = newBase;
                    console.log(`✅ First rule auto-synced with base price: $${newBase}`);
                };

                // Já está sendo feito em setupBasePriceListener, mas garantir aqui também
                if (!firstPriceInput.hasAttribute('data-synced')) {
                    firstPriceInput.setAttribute('data-synced', 'true');
                }
            }
        }
    }

    removeVolumeRule(button) {
        const row = button.closest('.volume-rule-row');
        const container = document.querySelector('.volume-rules-container');
        const totalRows = container.querySelectorAll('.volume-rule-row').length;

        // Remover a regra
        row.remove();

        // Se era a última regra, mostrar mensagem de vazio
        if (totalRows === 1) {
            container.innerHTML = '<p class="text-muted empty-message">No volume rules configured</p>';
        } else {
            // Reajustar números "from" das regras seguintes
            this.recalculateVolumeRanges();
        }

        this.markAsChanged();
    }

    updateNextRuleFrom(input) {
        const row = input.closest('.volume-rule-row');
        const nextRow = row.nextElementSibling;

        if (nextRow && nextRow.classList.contains('volume-rule-row')) {
            const toValue = row.querySelector('.volume-to').value;
            if (toValue) {
                const nextFrom = nextRow.querySelector('.volume-from');
                nextFrom.value = parseInt(toValue) + 1;
            }
        }

        this.markAsChanged();
    }

    recalculateVolumeRanges() {
        const rows = document.querySelectorAll('.volume-rule-row');
        rows.forEach((row, index) => {
            if (index > 0) {
                const prevRow = rows[index - 1];
                const prevTo = prevRow.querySelector('.volume-to').value;
                if (prevTo) {
                    row.querySelector('.volume-from').value = parseInt(prevTo) + 1;
                }
            }
        });
    }

    markAsChanged() {
        this.hasUnsavedChanges = true;

        // Adicionar indicador visual
        const saveButton = document.querySelector('.modal-footer .btn-primary');
        if (saveButton && !saveButton.textContent.includes('*')) {
            saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes*';
            saveButton.classList.add('btn-warning');
        }
    }

    attachVolumeRuleListeners() {
        // Adicionar listener para rastrear mudanças
        const inputs = document.querySelectorAll('.volume-rule-row input');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.markAsChanged());
        });
    }

    validateFirstVolumeRule() {
        const firstPriceInput = document.querySelector('[data-first-rule="true"]');
        if (!firstPriceInput) return;

        const basePrice = this.currentCategory?.basePrice || 99;

        firstPriceInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const warningElement = e.target.parentElement.querySelector('.text-danger');

            if (value !== basePrice) {
                e.target.classList.add('is-invalid');
                if (!warningElement) {
                    const warning = document.createElement('small');
                    warning.className = 'text-danger';
                    warning.textContent = `Must be $${basePrice} (base price)`;
                    e.target.parentElement.appendChild(warning);
                }
            } else {
                e.target.classList.remove('is-invalid');
                if (warningElement) warningElement.remove();
            }
        });
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
        // Abrir primeiro modal (seleção)
        const selectModal = document.getElementById('clientSelectModal');
        if (selectModal) {
            selectModal.style.display = 'flex';
            this.loadClientsForSelection();
        }
    }

    // Carregar clientes no dropdown de seleção
    async loadClientsForSelection() {
        try {
            const response = await fetch('/api/pricing/clients/active', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            if (data.success && data.clients.length > 0) {
                const dropdown = document.getElementById('clientSelectDropdown');
                if (dropdown) {
                    dropdown.innerHTML = '<option value="">Select...</option>' +
                        data.clients.map(client =>
                            `<option value="${client.code}">${client.name}</option>`
                        ).join('');
                }
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    }

    // Proceder para configurar rates
    proceedToConfigureRates() {
        const dropdown = document.getElementById('clientSelectDropdown');
        const clientCode = dropdown.value;
        const clientName = dropdown.options[dropdown.selectedIndex].text;

        if (!clientCode) {
            this.showNotification('Please select a client', 'error');
            return;
        }

        // Guardar cliente selecionado
        this.selectedClient = { code: clientCode, name: clientName };

        // Fechar modal de seleção
        document.getElementById('clientSelectModal').style.display = 'none';

        // Abrir modal de configuração
        const configModal = document.getElementById('clientRuleModal');
        if (configModal) {
            // Atualizar nome do cliente
            document.getElementById('selectedClientName').textContent = clientName;

            // Mostrar formulário
            document.getElementById('clientRateForm').style.display = 'block';

            // Carregar rates existentes
            this.loadClientRatesForClient(clientCode);

            // Limpar lista temporária
            this.tempClientRates = [];

            // Mostrar modal
            configModal.style.display = 'flex';
        }
    }

    // Carregar rates do cliente específico
    async loadClientRatesForClient(clientCode) {
        const container = document.getElementById('clientRatesListModal');

        // Por enquanto vazio
        container.innerHTML = '<p class="text-muted">No rates configured yet</p>';

        // Limpar lista temporária
        if (!this.tempClientRates) {
            this.tempClientRates = [];
        }
    }

    closeClientRuleModal() {
        // Limpar dados temporários
        this.tempClientRates = [];
        this.selectedClient = null;

        // Fechar modal
        const modal = document.getElementById('clientRuleModal');
        if (modal) {
            modal.style.display = 'none';
        }

        // Resetar formulário
        document.getElementById('clientRateForm').style.display = 'none';
        document.getElementById('clientMinQty').value = '';
        document.getElementById('clientMaxQty').value = '';
        document.getElementById('clientPrice').value = '';
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
        const minQty = document.getElementById('clientMinQty').value;
        const maxQty = document.getElementById('clientMaxQty').value;
        const price = document.getElementById('clientPrice').value;

        if (!minQty || !price) {
            this.showNotification('Please fill required fields', 'error');
            return;
        }

        // Adicionar à lista temporária
        const newRate = {
            min: parseInt(minQty),
            max: maxQty ? parseInt(maxQty) : null,
            price: parseFloat(price)
        };

        if (!this.tempClientRates) {
            this.tempClientRates = [];
        }
        this.tempClientRates.push(newRate);

        // Mostrar na lista imediatamente
        this.displayTempRates();

        // Limpar formulário
        document.getElementById('clientMinQty').value = '';
        document.getElementById('clientMaxQty').value = '';
        document.getElementById('clientPrice').value = '';

        this.showNotification('Rate added! Click Done to save all.', 'info');
    }

    // Mostrar rates temporárias
    displayTempRates() {
        const container = document.getElementById('clientRatesListModal');

        if (!this.tempClientRates || this.tempClientRates.length === 0) {
            container.innerHTML = '<p class="text-muted">No rates configured yet</p>';
            return;
        }

        container.innerHTML = '<h5 style="margin-bottom: 10px;">Configured Rates:</h5>' +
            this.tempClientRates.map((rate, index) => {
                const rangeText = rate.max ? `${rate.min}-${rate.max}` : `${rate.min}+`;
                return `
                <div class="rate-item" style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.02); margin-bottom: 8px; border-radius: 4px; align-items: center;">
                    <span>${rangeText} photos: <strong style="color: #d4af37;">$${rate.price.toFixed(2)}</strong></span>
                    <button class="btn-icon" onclick="adminPricing.removeTempRate(${index})" style="background: transparent; border: none; color: #999; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            }).join('');
    }

    // Remover rate temporária
    removeTempRate(index) {
        this.tempClientRates.splice(index, 1);
        this.displayTempRates();
    }

    // Salvar todas as rates do cliente
    async saveAllClientRates() {
        if (!this.selectedClient || !this.tempClientRates || this.tempClientRates.length === 0) {
            this.showNotification('No rates to save', 'warning');
            this.closeClientRuleModal();
            return;
        }

        try {
            // Salvar no backend
            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/discount-rules`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    clientCode: this.selectedClient.code,
                    clientName: this.selectedClient.name,
                    priceRanges: this.tempClientRates,
                    isActive: true
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(`Client rates saved for ${this.selectedClient.name}!`, 'success');

                // Recarregar client rules
                await this.loadClientRules();

                // Fechar modal
                this.closeClientRuleModal();
            } else {
                this.showNotification(result.message || 'Error saving rates', 'error');
            }
        } catch (error) {
            console.error('Error saving client rates:', error);
            this.showNotification('Error saving rates', 'error');
        }
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
            if (this.allCategories.length > 0) {
                this.applyLocalFilters();
                this.renderFromCache();
            } else {
                this.loadCategories();
            }
        }, 300);
    }

    handlePriceFilter(value) {
        this.filters.priceStatus = value;
        this.currentPage = 1;
        if (this.allCategories.length > 0) {
            this.applyLocalFilters();
            this.renderFromCache();
        } else {
            this.loadCategories();
        }
    }

    handleSort(value) {
        this.filters.sortBy = value;
        this.currentPage = 1;
        if (this.allCategories.length > 0) {
            this.applyLocalFilters();
            this.renderFromCache();
        } else {
            this.loadCategories();
        }
    }

    // ===== PAGINATION =====
    updatePagination(pagination) {
        if (!this.pricingPagination || !pagination) return;

        const { page = 1, totalPages = 1, hasNext = false, hasPrev = false } = pagination;

        // const paginationInfo = document.getElementById('paginationInfo');  // COMENTAR
        const btnPrevPage = document.getElementById('btnPrevPagePricing');
        const btnNextPage = document.getElementById('btnNextPagePricing');

        // if (paginationInfo) paginationInfo.textContent = `Page ${page} of ${totalPages}`;  // COMENTAR
        if (btnPrevPage) btnPrevPage.disabled = !hasPrev;
        if (btnNextPage) btnNextPage.disabled = !hasNext;

        // ADICIONAR ESTA LINHA:
        this.renderPaginationNumbers(page, totalPages);

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

    // ===== GO TO PAGE =====
    goToPage(page) {
        if (page < 1) return;
        this.currentPage = page;
        this.loadCategories();
    }

    // ===== RENDER PAGINATION NUMBERS =====
    renderPaginationNumbers(currentPage, totalPages) {
        const container = document.getElementById('pricingPaginationNumbers');
        if (!container) return;

        let html = '';
        const maxButtons = 5;
        let startPage = 1;
        let endPage = totalPages;

        if (totalPages > maxButtons) {
            const halfButtons = Math.floor(maxButtons / 2);

            if (currentPage <= halfButtons + 1) {
                endPage = maxButtons;
            } else if (currentPage >= totalPages - halfButtons) {
                startPage = totalPages - maxButtons + 1;
            } else {
                startPage = currentPage - halfButtons;
                endPage = currentPage + halfButtons;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === currentPage ? 'active' : '';
            html += `
                <button class="btn-page-number ${isActive}" 
                        onclick="adminPricing.goToPage(${i})"
                        ${i === currentPage ? 'disabled' : ''}>
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            html += `<span class="pagination-dots">...</span>`;
        }

        container.innerHTML = html;
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