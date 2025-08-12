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

        // Estado de sincronização (NOVA ADIÇÃO)
        this.syncState = {
            isRunning: false,
            startTime: null,
            intervalId: null
        };

        this.init();
    }

    // ===== INITIALIZATION =====
    init() {
        console.log('💰 Initializing Price Management...');
        this.setupElements();
        this.setupEventListeners();
        this.checkSyncStatus();
        this.initAutoSync();
        console.log('✅ Price Management initialized');
    }

    setupElements() {
        // Main container
        this.section = document.getElementById('section-pricing');
        if (!this.section) {
            console.warn('⚠️ Pricing section not found');
            return;
        }

        // Main elements - ATUALIZADO PARA NOVO HTML
        this.syncStatusBanner = document.getElementById('syncStatusBanner');
        this.syncStatusText = document.getElementById('syncStatusText');
        this.syncLastUpdate = document.getElementById('syncLastUpdate');
        this.pricingTable = document.getElementById('pricingTableBody');
        this.pricingPagination = document.getElementById('pricingPagination');

        // Modal
        this.priceModal = document.getElementById('priceModal');
        this.priceForm = document.getElementById('priceForm');

        // DEBUG LOG
        console.log('🔵 Elements found:', {
            banner: this.syncStatusBanner,
            table: this.pricingTable,
            modal: this.priceModal
        });

        // Loading
        this.loading = document.getElementById('loading');
    }

    setupEventListeners() {
        // Main buttons - ATUALIZADO PARA NOVOS BOTÕES
        const btnSyncDrive = document.getElementById('btnSyncDrive');
        const btnBulkEdit = document.getElementById('btnBulkEdit');

        if (btnSyncDrive) btnSyncDrive.addEventListener('click', () => this.syncDrive(true)); // sempre force sync
        if (btnBulkEdit) btnBulkEdit.addEventListener('click', () => this.openBulkEditModal());

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

        // Listener para atualizar preview ao digitar preço
        const newPriceInput = document.getElementById('newPrice');
        if (newPriceInput) {
            newPriceInput.addEventListener('input', () => {
                this.updatePricePreview();
            });
        }

        // NEW: Debug log
        console.log('🔵 Event listeners configured');
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
            this.showSyncStatus('Error checking status', 'warning');
        }
    }

    async syncDrive(forceRefresh = false) {
        try {
            // this.setLoading(true); // Comentado - agora usa loading localizado
            this.showSyncLoading(true);
            this.updateSyncProgress('Connecting to Google Drive...', 10);
            this.showSyncStatus('Synchronizing with Google Drive...', 'warning');

            const response = await fetch('/api/pricing/sync', {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ forceRefresh })
            });

            this.updateSyncProgress('Processing response...', 50);
            const data = await response.json();
            this.updateSyncProgress('Updating database...', 70);

            if (data.success) {
                const { created, updated, deactivated, errors } = data.summary;
                const message = `Sync completed: ${created} created, ${updated} updated, ${deactivated} removed, ${errors} errors`;

                this.showSyncStatus(message, errors > 0 ? 'warning' : 'success');

                // Reload data
                await Promise.all([
                    this.checkSyncStatus(),
                    this.loadCategories()
                ]);

                this.updateSyncProgress('Synchronization complete!', 100);
                this.showNotification('Synchronization completed successfully!', 'success');
                // Esconder loading após 2 segundos
                setTimeout(() => {
                    this.showSyncLoading(false);
                }, 2000);

            } else {
                throw new Error(data.message || 'Synchronization error');
            }

        } catch (error) {
            console.error('❌ Synchronization error:', error);
            this.showSyncStatus(`Sync error: ${error.message}`, 'danger');
            this.showNotification('Synchronization error', 'error');
            this.updateSyncProgress('Synchronization failed!', 0);
            // Esconder loading após 3 segundos em caso de erro
            setTimeout(() => {
                this.showSyncLoading(false);
            }, 3000);
        } finally {
            // this.setLoading(false); // Comentado - agora usa loading localizado
            // Loading já é escondido no setTimeout acima
        }
    }

    // Mostrar/ocultar loading de sincronização localizado
    showSyncLoading(show = true) {
        const loadingEl = document.getElementById('pricingSyncLoading');
        if (loadingEl) {
            loadingEl.style.display = show ? 'block' : 'none';
            if (show) {
                loadingEl.classList.add('active');
            } else {
                loadingEl.classList.remove('active');
            }
        }
    }

    // Atualizar progresso da sincronização
    updateSyncProgress(message, percentage = 0) {
        const progressBar = document.getElementById('syncProgressBar');
        const progressText = document.getElementById('syncProgressText');

        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = message;
    }

    // Inicializar sincronização automática
    initAutoSync() {
        console.log('🔄 Auto-sync initialized (manual only for now)');
        // Por enquanto só manual, depois implementamos o automático
    }

    updateSyncStatus(syncStatus) {
        if (!this.syncStatusBanner) return;

        const { needingSyncCount, lastSyncDate, isOutdated, hoursOld } = syncStatus;

        if (isOutdated) {
            this.syncStatusBanner.className = 'sync-status-banner warning';
            this.syncStatusText.textContent = `${needingSyncCount} categories need synchronization`;
            this.syncLastUpdate.textContent = `Last sync: ${hoursOld}h ago`;
        } else {
            this.syncStatusBanner.className = 'sync-status-banner';
            this.syncStatusText.textContent = 'System synchronized';
            this.syncLastUpdate.textContent = lastSyncDate ?
                `Last update: ${this.formatDate(lastSyncDate)}` :
                'Last update: Never';
        }

        this.syncStatusBanner.style.display = 'block';
    }

    showSyncStatus(message, type = 'warning') {
        if (!this.syncStatusBanner) return;

        this.syncStatusText.textContent = message;
        this.syncStatusBanner.className = `sync-status-banner ${type === 'warning' ? 'warning' : ''}`;
        this.syncStatusBanner.style.display = 'block';

        // Se for sucesso, atualizar também o Last Update
        if (type === 'success') {
            this.syncLastUpdate.textContent = `Last update: ${this.formatDate(new Date())}`;
        }
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
                <td class="qb-item-cell">
                    <div class="qb-item-container">
                        <span class="qb-item-display">${category.qbItem || 'Not set'}</span>
                        <button class="btn-edit-qb" onclick="event.stopPropagation(); adminPricing.editQBItem('${category._id}', '${(category.qbItem || '').replace(/'/g, '&#39;')}')" title="Edit QB Item">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
                <td class="category-description-cell" title="${category.googleDrivePath}">
                    <strong>${this.cleanCategoryName(category.displayName)}</strong>
                </td>
                <td class="photos-count-cell">
                    <span class="photo-count-badge">${category.photoCount}</span>
                    <small class="photo-label">photo${category.photoCount !== 1 ? 's' : ''}</small>
                </td>
                <td class="price-cell ${category.basePrice > 0 ? 'has-price' : 'no-price'}">
                    <div class="price-display">
                        ${category.basePrice > 0 ? `<span class="price-value">$${category.basePrice.toFixed(2)}</span>` : '<span class="no-price-text">No price</span>'}
                    </div>
                </td>
                <td class="pricing-actions-cell" onclick="event.stopPropagation();">
                    <div class="pricing-action-buttons">
                        <button class="btn-pricing-action btn-edit-price" 
                                onclick="adminPricing.openPriceModal('${category._id}', 'edit')"
                                title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-pricing-action btn-view-details" 
                                onclick="adminPricing.viewCategoryDetails('${category._id}')"
                                title="View Details">
                            <i class="fas fa-eye"></i>
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

        // Carregar dados adicionais para o novo modal
        setTimeout(async () => {
            this.updatePricePreview();

            // Verificar se tem regras ativas - CORRIGIDO!
            try {
                // Verificar volume rules
                const volumeResponse = await fetch('/api/pricing/quantity-discounts', {
                    headers: this.getAuthHeaders()
                });
                const volumeData = await volumeResponse.json();
                const hasVolumeRules = volumeData.success && volumeData.rules && volumeData.rules.length > 0;

                // Verificar client rules
                const hasClientRules = (this.currentCategory.discountRules || []).length > 0;

                // Marcar checkboxes se tem regras
                const volumeCheckbox = document.getElementById('enableVolumeDiscounts');
                const clientCheckbox = document.getElementById('enableClientExceptions');

                if (volumeCheckbox) {
                    volumeCheckbox.checked = hasVolumeRules;
                    this.toggleVolumeDiscounts();
                }

                if (clientCheckbox) {
                    clientCheckbox.checked = hasClientRules;
                    this.toggleClientExceptions();
                }

                // Popular dropdown do client calculator
                if (clientCheckbox && clientCheckbox.checked) {
                    this.populateClientCalculatorDropdown();
                }

            } catch (error) {
                console.error('Error checking rules:', error);
            }
        }, 100);
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
            categoryName.textContent = this.cleanCategoryName(this.currentCategory.displayName);
        }

        if (categoryPath) {
            categoryPath.style.display = 'none'; // Ocultar descrição duplicada
        }

        if (photoCount) {
            photoCount.textContent = `${this.currentCategory.photoCount} photo${this.currentCategory.photoCount !== 1 ? 's' : ''}`;
        }

        if (currentPrice) {
            const priceText = this.currentCategory.basePrice > 0 ?
                `Current price: $${this.currentCategory.basePrice.toFixed(2)}` :
                'No price set';
            currentPrice.textContent = priceText;
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

        // ===== NOVAS LINHAS ADICIONADAS =====
        // Inicializar pricing mode toggles
        this.initializePricingModeToggles();

        // Definir modo atual
        const currentMode = this.currentCategory.pricingMode || 'base';
        this.setInitialToggleState(currentMode);

        // Atualizar visibilidade das abas
        this.updateTabsVisibilityToggle(currentMode);
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

    // ===== NOVAS FUNÇÕES PARA O MODAL REDESENHADO =====

    toggleVolumeDiscounts() {
        const checkbox = document.getElementById('enableVolumeDiscounts');
        const content = document.getElementById('volumeDiscountsContent');

        if (checkbox && content) {
            content.style.display = checkbox.checked ? 'block' : 'none';

            if (checkbox.checked) {
                // Desativar Client-Specific se Volume está ativo
                const clientCheckbox = document.getElementById('enableClientExceptions');
                if (clientCheckbox && clientCheckbox.checked) {
                    clientCheckbox.checked = false;
                    this.toggleClientExceptions();
                }

                // Carregar regras de volume
                this.loadVolumeRules();
                // Atualizar calculator
                this.updatePricePreview();
            }
        }
    }

    toggleClientExceptions() {
        const checkbox = document.getElementById('enableClientExceptions');
        const content = document.getElementById('clientExceptionsContent');

        if (checkbox && content) {
            content.style.display = checkbox.checked ? 'block' : 'none';

            if (checkbox.checked) {
                // Desativar Volume se Client está ativo
                const volumeCheckbox = document.getElementById('enableVolumeDiscounts');
                if (volumeCheckbox && volumeCheckbox.checked) {
                    volumeCheckbox.checked = false;
                    this.toggleVolumeDiscounts();
                }

                // Carregar regras de cliente
                this.loadClientRules();
                // Popular dropdown do calculator
                this.populateClientCalculatorDropdown();
                // Atualizar calculator
                this.updatePricePreview();
            }
        }
    }

    async loadVolumeRules() {
        try {
            const response = await fetch('/api/pricing/quantity-discounts', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            if (data.success) {
                this.displayVolumeRules(data.rules || []);
            }
        } catch (error) {
            console.error('Error loading volume rules:', error);
        }
    }

    displayVolumeRules(rules) {
        const container = document.getElementById('volumeRulesList');
        if (!container) return;

        if (rules.length === 0) {
            container.innerHTML = '<p class="text-muted">No volume discounts configured</p>';
            return;
        }

        container.innerHTML = rules.map(rule => `
            <div class="rule-item">
                <span>${rule.minQuantity}${rule.maxQuantity ? `-${rule.maxQuantity}` : '+'} photos: ${rule.discountPercent}% off</span>
                <button class="btn-icon" onclick="adminPricing.deleteVolumeRule('${rule._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    async loadClientRules() {
        if (!this.currentCategory) return;

        const container = document.getElementById('clientRulesList');
        if (!container) return;

        // Mostrar loading enquanto carrega
        container.innerHTML = '<p class="text-muted"><i class="fas fa-spinner fa-spin"></i> Loading rules...</p>';

        try {
            // BUSCAR DADOS FRESCOS DO SERVIDOR
            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success && data.category) {
                // Atualizar categoria local com dados frescos
                this.currentCategory.discountRules = data.category.discountRules || [];
                const rules = this.currentCategory.discountRules.filter(rule => rule.isActive);

                if (rules.length === 0) {
                    container.innerHTML = '<p class="text-muted">No client exceptions configured</p>';
                    return;
                }

                container.innerHTML = rules.map(rule => `
                    <div class="rule-item">
                        <span>${rule.clientName}: ${rule.customPrice ? `$${rule.customPrice.toFixed(2)} fixed` : `${rule.discountPercent}% off`}</span>
                        <button class="btn-icon" onclick="adminPricing.deleteClientRule('${rule.clientCode}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="text-muted">No client exceptions configured</p>';
            }
        } catch (error) {
            console.error('Error loading client rules:', error);
            container.innerHTML = '<p class="text-muted">Error loading rules</p>';
        }

        // Atualizar dropdown do calculator também
        this.populateClientCalculatorDropdown();
    }

    async updatePricePreview() {
        const basePrice = parseFloat(document.getElementById('newPrice')?.value) || 0;

        // Atualizar VOLUME calculator
        const volumeCalc1 = document.getElementById('volumeCalc1');
        const volumeCalc15 = document.getElementById('volumeCalc15');
        const volumeCalc50 = document.getElementById('volumeCalc50');

        // Atualizar CLIENT calculator
        const clientCalc1 = document.getElementById('clientCalc1');
        const clientCalc15 = document.getElementById('clientCalc15');
        const clientCalc50 = document.getElementById('clientCalc50');

        if (basePrice === 0) {
            // Zerar todos se não tem preço
            if (volumeCalc1) volumeCalc1.textContent = '$0.00';
            if (volumeCalc15) volumeCalc15.textContent = '$0.00';
            if (volumeCalc50) volumeCalc50.textContent = '$0.00';

            if (clientCalc1) clientCalc1.textContent = '$0.00';
            if (clientCalc15) clientCalc15.textContent = '$0.00';
            if (clientCalc50) clientCalc50.textContent = '$0.00';
            return;
        }

        try {
            // VOLUME CALCULATOR
            const response = await fetch('/api/pricing/quantity-discounts', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            const volumeRules = data.success ? (data.rules || []) : [];

            // Calcular preços com volume discount
            const discount15 = this.calculateVolumeDiscount(15, volumeRules);
            const discount50 = this.calculateVolumeDiscount(50, volumeRules);

            const price15 = basePrice * (1 - discount15 / 100);
            const price50 = basePrice * (1 - discount50 / 100);

            // Atualizar Volume Calculator
            if (volumeCalc1) {
                volumeCalc1.innerHTML = `$${basePrice.toFixed(2)}`;
            }

            if (volumeCalc15) {
                volumeCalc15.innerHTML = discount15 > 0 ?
                    `$${price15.toFixed(2)} <span class="discount-badge">${discount15}% off</span>` :
                    `$${price15.toFixed(2)}`;
            }

            if (volumeCalc50) {
                volumeCalc50.innerHTML = discount50 > 0 ?
                    `$${price50.toFixed(2)} <span class="discount-badge">${discount50}% off</span>` :
                    `$${price50.toFixed(2)}`;
            }

            // CLIENT CALCULATOR - atualizar baseado no cliente selecionado
            this.updateClientCalculator();

        } catch (error) {
            console.error('Error updating price preview:', error);
        }
    }

    async updateClientCalculator() {
        const basePrice = parseFloat(document.getElementById('newPrice')?.value) || 0;
        const selectedClient = document.getElementById('calcClientSelect')?.value;

        const clientCalc1 = document.getElementById('clientCalc1');
        const clientCalc15 = document.getElementById('clientCalc15');
        const clientCalc50 = document.getElementById('clientCalc50');

        if (!clientCalc1) return; // Modal não está aberto

        if (!selectedClient || basePrice === 0) {
            // Sem cliente selecionado ou sem preço
            clientCalc1.textContent = '$0.00';
            clientCalc15.textContent = '$0.00';
            clientCalc50.textContent = '$0.00';
            return;
        }

        // Encontrar regra do cliente
        const clientRule = (this.currentCategory?.discountRules || [])
            .find(rule => rule.clientCode === selectedClient);

        if (clientRule) {
            let finalPrice;

            if (clientRule.customPrice) {
                // Preço fixo para este cliente
                finalPrice = clientRule.customPrice;
                clientCalc1.innerHTML = `$${finalPrice.toFixed(2)} <span class="fixed-badge">Fixed</span>`;
                clientCalc15.innerHTML = `$${finalPrice.toFixed(2)} <span class="fixed-badge">Fixed</span>`;
                clientCalc50.innerHTML = `$${finalPrice.toFixed(2)} <span class="fixed-badge">Fixed</span>`;
            } else if (clientRule.discountPercent) {
                // Desconto percentual
                finalPrice = basePrice * (1 - clientRule.discountPercent / 100);
                const badge = `<span class="discount-badge">${clientRule.discountPercent}% off</span>`;
                clientCalc1.innerHTML = `$${finalPrice.toFixed(2)} ${badge}`;
                clientCalc15.innerHTML = `$${finalPrice.toFixed(2)} ${badge}`;
                clientCalc50.innerHTML = `$${finalPrice.toFixed(2)} ${badge}`;
            }
        } else {
            // Cliente sem regra especial - usa preço base
            clientCalc1.textContent = `$${basePrice.toFixed(2)}`;
            clientCalc15.textContent = `$${basePrice.toFixed(2)}`;
            clientCalc50.textContent = `$${basePrice.toFixed(2)}`;
        }
    }

    populateClientCalculatorDropdown() {
        const dropdown = document.getElementById('calcClientSelect');
        if (!dropdown) return;

        // Limpar dropdown
        dropdown.innerHTML = '<option value="">Select a client...</option>';

        // Pegar regras de cliente da categoria atual
        const clientRules = this.currentCategory?.discountRules || [];

        if (clientRules.length === 0) {
            dropdown.innerHTML = '<option value="">No clients configured</option>';
            return;
        }

        // Adicionar cada cliente configurado
        clientRules.forEach(rule => {
            if (rule.isActive) {
                const option = document.createElement('option');
                option.value = rule.clientCode;
                option.textContent = `${rule.clientName} (${rule.clientCode})`;
                dropdown.appendChild(option);
            }
        });

        // Se só tem um cliente, selecionar automaticamente
        if (clientRules.filter(r => r.isActive).length === 1) {
            dropdown.selectedIndex = 1;
            this.updateClientCalculator();
        }
    }

    // Nova função para calcular desconto de volume
    calculateVolumeDiscount(quantity, rules) {
        if (!rules || rules.length === 0) return 0;

        // Ordenar regras por minQuantity (maior primeiro)
        const sortedRules = [...rules].sort((a, b) => b.minQuantity - a.minQuantity);

        // Encontrar regra aplicável
        for (const rule of sortedRules) {
            if (quantity >= rule.minQuantity) {
                // Verificar se tem máximo
                if (!rule.maxQuantity || quantity <= rule.maxQuantity) {
                    return rule.discountPercent || 0;
                }
            }
        }

        return 0; // Nenhum desconto aplicável
    }

    async saveAllPricing() {
        try {
            if (!this.currentCategory) {
                this.showNotification('No category selected', 'error');
                return;
            }

            const basePrice = parseFloat(document.getElementById('newPrice')?.value) || 0;

            // Validar
            if (basePrice < 0) {
                this.showNotification('Price must be positive', 'error');
                return;
            }

            // Salvar preço base
            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/price`, {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    price: basePrice,
                    reason: 'Updated via new pricing interface'
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Pricing saved successfully!', 'success');
                this.closePriceModal();
                await this.loadCategories(); // Recarregar tabela
            } else {
                throw new Error(data.message);
            }

        } catch (error) {
            console.error('Error saving pricing:', error);
            this.showNotification('Error saving pricing', 'error');
        }
    }

    // ===== FUNÇÕES PARA VOLUME RULES =====

    openVolumeRulesManager() {
        const modal = document.getElementById('volumeRulesModal');
        if (modal) {
            modal.style.display = 'flex';
            this.loadVolumeRulesForModal();
        }
    }

    closeVolumeRulesModal() {
        const modal = document.getElementById('volumeRulesModal');
        if (modal) {
            modal.style.display = 'none';

            // Reabrir o modal de preços se estava aberto
            const priceModal = document.getElementById('priceModal');
            if (priceModal && this.currentCategory) {
                priceModal.style.display = 'flex';
            }
        }
        console.log('✅ Volume rules modal closed properly');
    }

    closeClientRuleModal() {
        const modal = document.getElementById('clientRuleModal');
        if (modal) {
            modal.style.display = 'none';

            // Reabrir o modal de preços se estava aberto
            const priceModal = document.getElementById('priceModal');
            if (priceModal && this.currentCategory) {
                priceModal.style.display = 'flex';
            }
        }
        console.log('✅ Client rule modal closed properly');
    }

    async loadVolumeRulesForModal() {
        try {
            const response = await fetch('/api/pricing/quantity-discounts', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            const container = document.getElementById('volumeRulesListModal');

            if (!container) return;

            if (!data.success || data.rules.length === 0) {
                container.innerHTML = '<p class="text-muted">No volume rules configured yet</p>';
                return;
            }

            container.innerHTML = `
                <h5>Existing Rules</h5>
                <div class="rules-list">
                    ${data.rules.map(rule => `
                        <div class="rule-item">
                            <span>${rule.minQuantity}${rule.maxQuantity ? `-${rule.maxQuantity}` : '+'} photos: ${rule.discountPercent}% off</span>
                            <button class="btn-icon" onclick="adminPricing.deleteVolumeRule('${rule._id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            console.error('Error loading volume rules:', error);
        }
    }

    async addVolumeRule() {
        try {
            const minQty = parseInt(document.getElementById('volumeMinQty').value);
            const maxQty = document.getElementById('volumeMaxQty').value ?
                parseInt(document.getElementById('volumeMaxQty').value) : null;
            const discount = parseFloat(document.getElementById('volumeDiscount').value);

            // Validar
            if (!minQty || minQty < 1) {
                this.showNotification('Minimum quantity must be at least 1', 'error');
                return;
            }

            if (discount < 0 || discount > 100) {
                this.showNotification('Discount must be between 0 and 100', 'error');
                return;
            }

            const description = maxQty ?
                `${minQty}-${maxQty} photos: ${discount}% off` :
                `${minQty}+ photos: ${discount}% off`;

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
                    description: description,
                    createdBy: 'admin'
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Volume rule added successfully!', 'success');

                // Limpar form
                document.getElementById('volumeMinQty').value = '';
                document.getElementById('volumeMaxQty').value = '';
                document.getElementById('volumeDiscount').value = '';

                // Recarregar listas
                this.loadVolumeRulesForModal();
                this.loadVolumeRules();
            } else {
                throw new Error(data.message);
            }

        } catch (error) {
            console.error('Error adding volume rule:', error);
            this.showNotification(error.message || 'Error adding rule', 'error');
        }
    }

    async deleteVolumeRule(ruleId) {
        // Usar confirm bonito do UISystem
        const confirmed = await UISystem.confirm(
            'Delete this volume discount rule?',
            'This action cannot be undone.'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/pricing/quantity-discounts/${ruleId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Rule deleted successfully!', 'success');
                this.loadVolumeRulesForModal();
                this.loadVolumeRules();
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
            this.showNotification('Error deleting rule', 'error');
        }
    }

    // ===== FUNÇÕES PARA CLIENT EXCEPTIONS =====

    async showAddClientRule() {
        const modal = document.getElementById('clientRuleModal');
        if (modal) {
            modal.style.display = 'flex';
            await this.loadAvailableClients();
        }
    }

    async loadAvailableClients() {
        try {
            const response = await fetch('/api/admin/access-codes', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            const select = document.getElementById('clientRuleSelect');

            if (!select) return;

            // Filtrar apenas clientes ativos
            const clients = (data.codes || []).filter(code => code.isActive);

            if (clients.length === 0) {
                select.innerHTML = '<option value="">No active clients available</option>';
                return;
            }

            select.innerHTML = `
                <option value="">Choose a client...</option>
                ${clients.map(client => `
                    <option value="${client.code}">${client.clientName || 'No name'} (${client.code})</option>
                `).join('')}
            `;

            console.log(`✅ ${clients.length} active clients loaded`);
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    }

    toggleClientPriceType() {
        const discountGroup = document.getElementById('clientDiscountGroup');
        const fixedGroup = document.getElementById('clientFixedGroup');
        const selectedType = document.querySelector('input[name="clientPriceType"]:checked').value;

        if (discountGroup && fixedGroup) {
            discountGroup.style.display = selectedType === 'discount' ? 'block' : 'none';
            fixedGroup.style.display = selectedType === 'fixed' ? 'block' : 'none';
        }
    }

    async saveClientRule() {
        try {
            if (!this.currentCategory) {
                this.showNotification('No category selected', 'error');
                return;
            }

            const clientCode = document.getElementById('clientRuleSelect').value;
            const priceType = document.querySelector('input[name="clientPriceType"]:checked').value;
            const discountPercent = priceType === 'discount' ?
                parseFloat(document.getElementById('clientDiscountPercent').value) : 0;
            const customPrice = priceType === 'fixed' ?
                parseFloat(document.getElementById('clientFixedPrice').value) : 0;

            if (!clientCode) {
                this.showNotification('Please select a client', 'error');
                return;
            }

            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/discount-rules`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    clientCode: clientCode,
                    clientName: document.querySelector(`#clientRuleSelect option[value="${clientCode}"]`).text,
                    discountPercent: discountPercent,
                    customPrice: customPrice
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Client rule added successfully!', 'success');

                // Atualizar a categoria atual
                this.currentCategory.discountRules = this.currentCategory.discountRules || [];
                this.currentCategory.discountRules.push({
                    clientCode: clientCode,
                    clientName: document.querySelector(`#clientRuleSelect option[value="${clientCode}"]`).text.split(' (')[0],
                    discountPercent: discountPercent,
                    customPrice: customPrice,
                    isActive: true
                });

                document.getElementById('clientRuleModal').style.display = 'none';

                // Recarregar
                await this.loadClientRules();
            } else {
                throw new Error(data.message);
            }

        } catch (error) {
            console.error('Error saving client rule:', error);
            this.showNotification(error.message || 'Error saving rule', 'error');
        }
    }

    async deleteClientRule(clientCode) {
        if (!this.currentCategory) return;

        // Usar confirm bonito do UISystem
        const confirmed = await UISystem.confirm(
            'Remove this client exception?',
            `This will remove the custom pricing for client ${clientCode}.`
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/discount-rules/${clientCode}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Client rule removed successfully!', 'success');

                // Remover da categoria atual
                if (this.currentCategory.discountRules) {
                    this.currentCategory.discountRules = this.currentCategory.discountRules.filter(
                        rule => rule.clientCode !== clientCode
                    );
                }

                // Atualizar a lista
                await this.loadClientRules();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error deleting client rule:', error);
            this.showNotification('Error removing rule', 'error');
        }
    }

    async handlePriceSubmit(e) {
        e.preventDefault();

        if (!this.currentCategory) return;

        try {
            const newPrice = parseFloat(document.getElementById('newPrice').value);
            const reasonSelect = document.getElementById('priceReasonSelect').value;
            const customReason = document.getElementById('priceReason').value.trim();
            const reason = reasonSelect === 'Other' ? customReason : reasonSelect;

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
                    qbItem: qbItem,
                    reason: reason || 'Price updated'
                })
            });

            const data = await response.json();

            if (data.success) {
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
        if (!statistics) return;

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

        // Não precisa mais mostrar/esconder pricingStats pois agora é sempre visível
        console.log('📊 Stats updated:', statistics);
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

    // ===== BULK EDIT =====
    openBulkEditModal() {
        console.log('🔧 Bulk Edit clicked');
        this.showNotification('Bulk edit feature coming soon!', 'info');
        // TODO: Implementar bulk edit para múltiplas categorias
        // - Selecionar múltiplas categorias
        // - Aplicar preço em massa
        // - Aplicar descontos em massa
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
        // Usar o sistema de toasts estilizado
        if (window.UISystem && window.UISystem.showToast) {
            // CORREÇÃO: Ordem correta dos parâmetros (type, message)
            window.UISystem.showToast(type, message);
        } else if (window.showToast) {
            window.showToast(type, message);
        } else {
            // Fallback
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    showError(message) {
        this.showNotification(message, 'error');
    }

    async viewCategoryDetails(categoryId) {
        try {
            console.log('👁️ Loading category details:', categoryId);

            // Buscar detalhes completos da categoria
            const response = await fetch(`/api/pricing/categories/${categoryId}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Category not found');
            }

            // Mostrar modal de detalhes
            this.showCategoryDetailsModal(data.category);

        } catch (error) {
            console.error('❌ Error loading category details:', error);
            this.showNotification('Error loading category details', 'error');
        }
    }

    // ===== EDIÇÃO RÁPIDA DE QB ITEM =====
    async editQBItem(categoryId, currentQBItem = '') {
        // Buscar dados da categoria primeiro
        const category = this.categories.find(cat => cat._id === categoryId);
        const cleanDescription = category ? this.cleanCategoryName(category.displayName) : 'Unknown category';

        // Mostrar modal customizado com descrição
        this.showQBItemModal(categoryId, currentQBItem, cleanDescription);
    }

    // ===== MODAL QB ITEM CUSTOMIZADO =====
    showQBItemModal(categoryId, currentQBItem = '', categoryDescription = '') {
        // Criar modal HTML
        const modalHTML = `
            <div id="qbItemModal" class="price-modal" style="display: flex;">
                <div class="price-modal-overlay" onclick="this.parentElement.remove()"></div>
                <div class="price-modal-content" style="max-width: 600px;">
                    <div class="price-modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-edit"></i>
                            <span>Edit QB Item</span>
                        </h3>
                        <button class="modal-close" onclick="this.closest('.price-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="price-modal-body">
                        <div class="category-info" style="margin-bottom: 1.5rem;">
                            <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1.1rem;">Category:</h4>
                            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem; font-family: inherit;">${categoryDescription}</p>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">QB Item Code</label>
                            <input type="text" id="qbItemQuickInput" class="form-input" 
                                value="${currentQBItem}" placeholder="e.g. COW-BRN-M-001" maxlength="50">
                            <small class="form-help" style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.25rem; display: block;">
                                QuickBooks item identifier for accounting integration
                            </small>
                        </div>
                    </div>
                    <div class="price-modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.price-modal').remove()">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                        <button type="button" class="btn btn-primary" onclick="adminPricing.saveQBItemQuick('${categoryId}')">
                            <i class="fas fa-save"></i> Save
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Adicionar ao DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Focar no input
        setTimeout(() => {
            const input = document.getElementById('qbItemQuickInput');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    async saveQBItemQuick(categoryId) {
        const input = document.getElementById('qbItemQuickInput');
        if (!input) return;

        const newQBItem = input.value.trim();

        try {
            const response = await fetch(`/api/pricing/categories/${categoryId}/price`, {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    price: 0, // Manter preço atual (será ignorado no backend)
                    qbItem: newQBItem,
                    reason: 'QB Item updated via quick edit'
                })
            });

            const data = await response.json();

            if (data.success) {
                await this.loadCategories(); // Recarregar tabela

                // Fechar modal
                document.getElementById('qbItemModal')?.remove();
            } else {
                throw new Error(data.message || 'Error updating QB Item');
            }

        } catch (error) {
            console.error('❌ Error updating QB Item:', error);
            this.showNotification(`Error updating QB Item: ${error.message}`, 'error');
        }
    }

    // ===== LIMPEZA DE NOMES =====
    cleanCategoryName(displayName) {
        if (!displayName) return '';

        const prefixToRemove = 'Sunshine Cowhides Actual Pictures →';
        if (displayName.startsWith(prefixToRemove)) {
            return displayName.substring(prefixToRemove.length).trim();
        }

        return displayName;
    }

    // ===== MODAL DE DETALHES DA CATEGORIA =====
    showCategoryDetailsModal(category) {
        const cleanDescription = this.cleanCategoryName(category.displayName);
        const lastPriceChange = category.priceHistory && category.priceHistory.length > 0 ?
            category.priceHistory[category.priceHistory.length - 1] : null;

        const modalHTML = `
            <div id="categoryDetailsModal" class="price-modal" style="display: flex;">
                <div class="price-modal-overlay" onclick="this.parentElement.remove()"></div>
                <div class="price-modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                    <div class="price-modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-info-circle"></i>
                            <span>${cleanDescription}</span>
                        </h3>
                        <button class="modal-close" onclick="this.closest('.price-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="price-modal-body">
                        <!-- Informações Básicas -->
                        <div class="details-section">
                            <h4 class="details-section-title">📊 Basic Information</h4>
                            <div class="details-grid">
                                <div class="detail-item">
                                    <label>Category Name:</label>
                                    <span>${cleanDescription}</span>
                                </div>
                                <div class="detail-item">
                                    <label>QB Item:</label>
                                    <span class="qb-item-inline">${category.qbItem || 'Not set'}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Photo Count:</label>
                                    <span class="photo-count-inline">${category.photoCount} photos</span>
                                </div>
                                <div class="detail-item">
                                    <label>Base Price:</label>
                                    <span class="price-inline ${category.basePrice > 0 ? 'has-price' : 'no-price'}">
                                        ${category.basePrice > 0 ? `$${category.basePrice.toFixed(2)}` : 'No price set'}
                                    </span>
                                </div>
                                <div class="detail-item">
                                    <label>Status:</label>
                                    <span class="status-badge ${category.isActive ? 'active' : 'inactive'}">
                                        ${category.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div class="detail-item">
                                    <label>Created:</label>
                                    <span>${this.formatDate(category.createdAt)}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Last Updated:</label>
                                    <span>${this.formatDate(category.updatedAt)}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Last Sync:</label>
                                    <span>${this.formatDate(category.lastSync)}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Google Drive Info -->
                        <div class="details-section">
                            <h4 class="details-section-title">📁 Google Drive Information</h4>
                            <div class="details-grid">
                                <div class="detail-item full-width">
                                    <label>Drive Path:</label>
                                    <span class="drive-path">${category.googleDrivePath}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Drive ID:</label>
                                    <span class="drive-id">${category.googleDriveId}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Folder Name:</label>
                                    <span>${category.folderName}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Histórico de Preços -->
                        <div class="details-section">
                            <h4 class="details-section-title">💰 Price History</h4>
                            ${this.renderPriceHistory(category.priceHistory)}
                        </div>

                        <!-- Regras de Desconto -->
                        <div class="details-section">
                            <h4 class="details-section-title">🏷️ Discount Rules</h4>
                            ${this.renderDiscountRules(category.discountRules)}
                        </div>
                    </div>

                    <div class="price-modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.price-modal').remove()">
                            <i class="fas fa-times"></i> Close
                        </button>
                        <button type="button" class="btn btn-primary" onclick="this.closest('.price-modal').remove(); adminPricing.openPriceModal('${category._id}', 'edit')">
                            <i class="fas fa-edit"></i> Edit Price & QB Item
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Adicionar ao DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // ===== RENDER PRICE HISTORY =====
    renderPriceHistory(priceHistory) {
        if (!priceHistory || priceHistory.length === 0) {
            return `<div class="empty-state">No price changes recorded</div>`;
        }

        const historyHTML = priceHistory.slice(-5).reverse().map(change => `
            <div class="history-item">
                <div class="history-change">
                    <span class="old-price">$${change.oldPrice.toFixed(2)}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span class="new-price">$${change.newPrice.toFixed(2)}</span>
                </div>
                <div class="history-meta">
                    <span class="history-user">${change.changedBy}</span>
                    <span class="history-date">${this.formatDate(change.changedAt)}</span>
                </div>
                ${change.reason ? `<div class="history-reason"><strong>Reason:</strong> ${change.reason}</div>` : ''}
            </div>
        `).join('');

        return `<div class="history-list">${historyHTML}</div>`;
    }

    // ===== RENDER DISCOUNT RULES =====
    renderDiscountRules(discountRules) {
        const activeRules = discountRules ? discountRules.filter(rule => rule.isActive) : [];

        if (activeRules.length === 0) {
            return `<div class="empty-state">No discount rules configured</div>`;
        }

        const rulesHTML = activeRules.map(rule => `
            <div class="rule-item">
                <div class="rule-client">
                    <strong>${rule.clientName}</strong>
                    <span class="client-code">(${rule.clientCode})</span>
                </div>
                <div class="rule-discount">
                    ${rule.customPrice ?
                `Custom Price: $${rule.customPrice.toFixed(2)}` :
                `Discount: ${rule.discountPercent}%`
            }
                </div>
                <div class="rule-date">${this.formatDate(rule.createdAt)}</div>
            </div>
        `).join('');

        return `<div class="rules-list">${rulesHTML}</div>`;
    }

    // ===== GERENCIAR DROPDOWN DE RAZÕES =====
    handleReasonChange(selectedValue) {
        const customReasonGroup = document.getElementById('customReasonGroup');
        const priceReasonTextarea = document.getElementById('priceReason');

        if (selectedValue === 'Other') {
            customReasonGroup.style.display = 'block';
            priceReasonTextarea.focus();
        } else {
            customReasonGroup.style.display = 'none';
            priceReasonTextarea.value = '';
        }
    }

    // ===== PRICING MODE TOGGLES =====
    initializePricingModeToggles() {
        // Aguardar elementos estarem no DOM
        setTimeout(() => {
            const toggles = document.querySelectorAll('.toggle-switch input[type="checkbox"]');
            const sliders = document.querySelectorAll('.toggle-slider');

            console.log(`🔍 Found ${toggles.length} toggles and ${sliders.length} sliders to initialize`);

            if (toggles.length === 0) {
                console.warn('⚠️ No toggles found in DOM yet');
                return;
            }

            // Event listeners nos checkboxes
            toggles.forEach((toggle, index) => {
                toggle.addEventListener('change', (e) => {
                    console.log(`🎛️ Toggle ${toggle.id} changed to:`, e.target.checked);
                    this.handleToggleChange(e.target);
                });
                console.log(`✅ Event listener added to ${toggle.id}`);
            });

            // Event listeners nos sliders (que capturam os cliques)
            sliders.forEach((slider, index) => {
                slider.addEventListener('click', (e) => {
                    e.preventDefault();
                    const checkbox = slider.previousElementSibling;
                    if (checkbox && checkbox.type === 'checkbox') {
                        console.log(`🎛️ Slider clicked, triggering ${checkbox.id}`);
                        this.handleToggleChange(checkbox);
                    }
                });
                console.log(`✅ Event listener added to slider ${index}`);
            });

            console.log('🎛️ Pricing mode toggles initialized successfully');
        }, 100);
    }

    handleToggleChange(activeToggle) {
        if (!this.currentCategory) return;

        const newMode = activeToggle.dataset.mode;

        console.log(`🎛️ Toggle ${activeToggle.id} clicked, activating mode: ${newMode}`);

        // Sempre ativar o modo (desativar outros e ativar este)
        this.deactivateOtherToggles(activeToggle);
        activeToggle.checked = true;

        // Ativar o modo selecionado
        this.activatePricingMode(newMode);
    }

    deactivateOtherToggles(activeToggle) {
        const allToggles = document.querySelectorAll('.toggle-switch input[type="checkbox"]');

        allToggles.forEach(toggle => {
            if (toggle !== activeToggle) {
                toggle.checked = false;
            }
        });
    }

    async activatePricingMode(mode) {
        try {
            console.log(`🎛️ Activating pricing mode: ${mode}`);

            // Atualizar no backend
            const response = await fetch(`/api/pricing/categories/${this.currentCategory._id}/pricing-mode`, {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pricingMode: mode })
            });

            const data = await response.json();

            if (data.success) {
                // Atualizar categoria local
                this.currentCategory.pricingMode = mode;

                // Mostrar/esconder abas baseado no modo
                this.updateTabsVisibilityToggle(mode);

                console.log(`✅ Pricing mode activated: ${mode}`);
            } else {
                throw new Error(data.message || 'Error updating pricing mode');
            }

        } catch (error) {
            console.error('❌ Error activating pricing mode:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    updateTabsVisibilityToggle(mode) {
        // Encontrar todos os painéis
        const basePanel = document.getElementById('tab-base-price');
        const clientPanel = document.getElementById('tab-client-prices');
        const quantityPanel = document.getElementById('tab-quantity-discounts');

        // Esconder todos os painéis
        if (basePanel) basePanel.classList.remove('active');
        if (clientPanel) clientPanel.classList.remove('active');
        if (quantityPanel) quantityPanel.classList.remove('active');

        // Mostrar painel baseado no modo
        switch (mode) {
            case 'client':
                if (basePanel) basePanel.classList.add('active');
                if (clientPanel) clientPanel.classList.add('active');
                // Carregar dados da aba client
                if (typeof loadClientRules === 'function') loadClientRules();
                if (typeof loadAvailableClients === 'function') loadAvailableClients();
                break;

            case 'quantity':
                if (basePanel) basePanel.classList.add('active');
                if (quantityPanel) quantityPanel.classList.add('active');
                // Carregar dados da aba quantity
                if (typeof loadQuantityRules === 'function') loadQuantityRules();
                break;

            case 'base':
            default:
                if (basePanel) basePanel.classList.add('active');
                break;
        }

        console.log(`🎛️ Panels updated for mode: ${mode}. Active panels: ${document.querySelectorAll('.price-tab-panel.active').length}`);
    }

    setInitialToggleState(mode) {
        // Definir estado inicial dos toggles
        const toggleBase = document.getElementById('toggleBase');
        const toggleClient = document.getElementById('toggleClient');
        const toggleQuantity = document.getElementById('toggleQuantity');

        // Base SEMPRE ativo e desabilitado (não pode desmarcar)
        if (toggleBase) {
            toggleBase.checked = true;
            toggleBase.disabled = true;
        }

        // Client e Quantity são opcionais e independentes
        // Não resetar - deixar como o usuário configurou
        // Se estiver criando nova regra, pode ativar baseado no mode
        if (mode === 'client' && toggleClient && !toggleClient.checked) {
            toggleClient.checked = true;
        }
        if (mode === 'quantity' && toggleQuantity && !toggleQuantity.checked) {
            toggleQuantity.checked = true;
        }
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
                    window.adminPricing = adminPricing;
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
            window.adminPricing = adminPricing;
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

        const response = await fetch('/api/admin/access-codes', {
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