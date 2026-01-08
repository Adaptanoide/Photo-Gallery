// public/js/admin-selections.js

class AdminSelections {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.totalPages = 1;
        this.totalSelections = 0;
        this.currentFilters = {
            status: 'all'
        };
        this.isLoading = false;
        this.stats = {
            totalSelections: 0,
            pendingSelections: 0,
            thisMonthSelections: 0,
            averageValue: 0
        };
        // NOVO: View mode para modal
        this.viewMode = 'list'; // 'list' ou 'grid'
        this.currentSelection = null;
        this.lightboxIndex = 0;
        this.lightboxPhotos = [];

        // Estado do zoom (COMEÇA AMPLIADO)
        this.zoomState = {
            scale: 1.5,  // ← MUDOU!
            panX: 0,
            panY: 0,
            isDragging: false
        };
        this.init();
    }

    init() {
        console.log('🛒 Initializing Selection Management...');
        this.bindEvents();
        this.initActionMenuHandler();
        this.loadStatistics();
        this.loadSelections();
        console.log('✅ Selection Management initialized');
    }

    bindEvents() {
        // Refresh button
        document.getElementById('btnRefreshSelections')?.addEventListener('click', () => {
            this.refreshData();
        });

        // Filter buttons
        document.getElementById('btnApplySelectionFilters')?.addEventListener('click', () => {
            this.applyFilters();
        });

        // Status filter change
        document.getElementById('filterSelectionStatus')?.addEventListener('change', (e) => {
            this.currentFilters.status = e.target.value;
            this.loadSelections();
        });

        // Search input with debounce
        const searchInput = document.getElementById('searchSelectionClient');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.currentFilters.clientSearch = e.target.value;
                    this.loadSelections();
                }, 500);
            });
        }

        // Keyboard handler for selection lightbox
        document.addEventListener('keydown', (e) => this.handleSelectionLightboxKeyboard(e));

        console.log('🔗 Event listeners configured');
    }

    // ===== AUTHENTICATION HEADERS =====
    getAuthHeaders() {
        const sessionData = localStorage.getItem('sunshineSession');
        if (sessionData) {
            const session = JSON.parse(sessionData);
            return {
                'Authorization': `Bearer ${session.token}`,
                'Content-Type': 'application/json'
            };
        }
        return {
            'Content-Type': 'application/json'
        };
    }

    // ===== REFRESH ALL DATA =====
    async refreshData() {
        console.log('🔄 Refreshing all selection data...');
        this.setLoading(true);

        try {
            await Promise.all([
                this.loadStatistics(),
                this.loadSelections()
            ]);
            if (window.UISystem && window.UISystem.showToast) {
                UISystem.showToast('success', 'Data refreshed successfully!');
            } else {
                this.showNotification('✅ Data refreshed successfully!', 'success');
            }
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
            this.showNotification(`Error refreshing data: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // ===== SILENT REFRESH (sem notificação) =====
    async silentRefresh() {
        try {
            await Promise.all([
                this.loadStatistics(),
                this.loadSelections()
            ]);
        } catch (error) {
            console.error('Error in silent refresh:', error);
        }
    }

    // ===== LOAD STATISTICS FOR CARDS =====
    async loadStatistics() {
        try {
            console.log('📊 Loading selection statistics...');

            const response = await fetch('/api/selections/stats', {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.stats = data.stats;
                this.renderStatistics();
                this.updateSidebarBadge(this.stats.pendingSelections);
                console.log('✅ Statistics loaded:', this.stats);
            } else {
                throw new Error(data.message || 'Failed to load statistics');
            }

        } catch (error) {
            console.error('❌ Error loading statistics:', error);
            this.renderStatisticsError();
        }
    }

    // ===== RENDER STATISTICS CARDS =====
    renderStatistics() {
        // Update stat values
        this.updateStatCard('totalSelections', this.stats.totalSelections, 'All time selections');
        this.updateStatCard('pendingSelections', this.stats.pendingSelections, 'Awaiting approval');
        this.updateStatCard('thisMonthSelections', this.stats.soldPhotosCount || 0, 'Photos sold');
        this.updateStatCard('averageSelectionValue',
            this.formatCurrency(this.stats.averageValue), 'Per selection');
    }

    updateStatCard(elementId, value, description) {
        const valueElement = document.getElementById(elementId);
        const descElement = document.getElementById(`${elementId}Description`);

        if (valueElement) {
            valueElement.textContent = value;
            valueElement.style.opacity = '0';
            setTimeout(() => {
                valueElement.style.opacity = '1';
            }, 100);
        }

        if (descElement) {
            descElement.textContent = description;
        }
    }

    renderStatisticsError() {
        this.updateStatCard('totalSelections', '?', 'Error loading');
        this.updateStatCard('pendingSelections', '?', 'Error loading');
        this.updateStatCard('thisMonthSelections', '?', 'Photos sold');
        this.updateStatCard('averageSelectionValue', '?', 'Error loading');
    }

    // ===== LOAD SELECTIONS =====
    async loadSelections() {
        try {
            const tableBody = document.getElementById('selectionsTableBody');
            tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <i class="fas fa-spinner fa-spin"></i>
                    Loading selections...
                </td>
            </tr>
        `;

            const params = new URLSearchParams({
                status: this.currentFilters.status,
                clientSearch: this.currentFilters.clientSearch || '',
                page: this.currentPage,
                limit: this.itemsPerPage
            });

            const response = await fetch(`/api/selections?${params}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.renderSelections(data.selections);

                // PROCESSAR PAGINAÇÃO
                if (data.pagination) {
                    this.currentPage = data.pagination.page;
                    this.totalPages = data.pagination.totalPages;
                    this.totalSelections = data.pagination.total;

                    // Atualizar UI da paginação
                    //document.getElementById('paginationInfoSel').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
                    document.getElementById('btnPrevPageSel').disabled = (this.currentPage === 1);
                    document.getElementById('btnNextPageSel').disabled = (this.currentPage === this.totalPages);
                    this.renderPaginationNumbers();
                }

                console.log(`✅ Página ${this.currentPage}/${this.totalPages} - Total: ${this.totalSelections} seleções`);
            } else {
                throw new Error(data.message);
            }

        } catch (error) {
            console.error('❌ Error loading selections:', error);
            this.showTableError('Error loading selections: ' + error.message);
        }
    }

    // ===== GO TO PAGE =====
    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;

        this.currentPage = page;
        this.loadSelections();
    }

    // ===== RENDER PAGINATION NUMBERS =====
    renderPaginationNumbers() {
        const container = document.getElementById('paginationNumbersSel');
        if (!container) return;

        let html = '';
        const maxButtons = 5;
        let startPage = 1;
        let endPage = this.totalPages;

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

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === this.currentPage ? 'active' : '';
            html += `
                <button class="btn-page-number ${isActive}" 
                        onclick="adminSelections.goToPage(${i})"
                        ${i === this.currentPage ? 'disabled' : ''}>
                    ${i}
                </button>
            `;
        }

        if (endPage < this.totalPages) {
            html += `<span class="pagination-dots">...</span>`;
        }

        container.innerHTML = html;
    }

    // ===== RENDER SELECTIONS TABLE =====
    renderSelections(selections) {
        const tableBody = document.getElementById('selectionsTableBody');

        if (selections.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <i class="fas fa-inbox"></i>
                        No selections found
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = selections.map(selection => `
            <tr data-selection-id="${selection.selectionId}">
                <td class="client-info-cell">
                    <div class="client-name-row">
                        <span class="client-name">${selection.clientName}</span>
                        ${selection.hasAutoCorrection ? `
                            <button class="alert-badge-btn" 
                                    onclick="adminSelections.showCorrectionAlert('${selection.selectionId}')"
                                    title="Selection was auto-corrected">
                                <i class="fas fa-exclamation-triangle"></i>
                            </button>
                        ` : ''}
                        ${selection.hasRetiredPhotos ? `
                            <button class="alert-badge-btn" 
                                    onclick="adminSelections.showRetiredPhotosAlert('${selection.selectionId}')"
                                    title="Photos marked as RETIRADO in CDE - verify if should be SOLD">
                                <i class="fas fa-exclamation-triangle"></i>
                            </button>
                        ` : ''}
                    </div>
                    <div class="client-code">Code: ${selection.clientCode}</div>
                </td>
                <td class="company-cell">
                    ${selection.clientCompany || '-'}
                </td>
                <td class="sales-rep-cell">
                    ${selection.salesRep || 'Unassigned'}
                </td>
                <td class="items-count-cell">
                    <span class="items-badge">
                        <i class="fas fa-images"></i>
                        ${selection.totalItems} items
                    </span>
                </td>
                <td class="total-value-cell" ${selection.clientCurrency && selection.clientCurrency !== 'USD' ? `title="Client viewed as: ${selection.clientCurrency === 'CAD' ? 'C$' : '€'}${selection.convertedValue ? selection.convertedValue.toFixed(2) : (selection.totalValue * (selection.currencyRate || 1.38)).toFixed(2)} ${selection.clientCurrency}\nExchange rate: ${selection.currencyRate || 'N/A'}" style="cursor: help;"` : ''}>
                    <strong>${selection.totalValue > 0 ? '$' + selection.totalValue.toFixed(2) : '-'}</strong>
                    ${selection.clientCurrency && selection.clientCurrency !== 'USD' ? `<br><small style="color: #888; font-weight: normal;">(${selection.clientCurrency} ℹ️)</small>` : ''}
                </td>
                <td class="date-cell">
                    <div class="date-created">${this.formatDate(selection.createdAt)}</div>
                </td>
                <td class="status-cell">
                    <span class="status-badge status-${selection.status}">
                        ${this.getStatusIcon(selection.status)}
                        ${this.getStatusText(selection.status)}
                    </span>
                </td>
                <td class="actions-cell">
                    <div class="action-buttons">
                        ${this.getActionButtons(selection)}
                    </div>
                </td>
            </tr>
        `).join('');

        // Guardar dados das seleções para acesso no modal
        this.selectionsData = {};
        selections.forEach(s => {
            this.selectionsData[s.selectionId] = s;
        });

        // Configure event listeners after rendering
        console.log('🔗 Event listeners configured after rendering');
    }

    // ===== GET STATUS ICON =====
    getStatusIcon(status) {
        const icons = {
            'pending': '<i class="fas fa-clock"></i>',
            'confirmed': '<i class="fas fa-check-circle"></i>',
            'cancelled': '<i class="fas fa-times-circle"></i>',
            'finalized': '<i class="fas fa-star"></i>',
            'reverted': '<i class="fas fa-undo"></i>'  // ADICIONE ESTA LINHA
        };
        return icons[status] || '<i class="fas fa-question"></i>';
    }

    // ===== GET STATUS TEXT =====
    getStatusText(status) {
        const statusMap = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'cancelled': 'Cancelled',
            'finalized': 'SOLD',
        };
        return statusMap[status] || status;
    }

    getActionButtons(selection) {
        // Build action items based on status
        let actions = [];

        // VIEW para TODOS os status (sempre primeiro)
        actions.push({
            icon: 'fas fa-eye',
            label: 'View Details',
            class: 'action-view',
            onclick: `adminSelections.viewSelection('${selection.selectionId}')`
        });

        // APPROVE (Mark as Sold) - só para PENDING
        if (selection.status === 'pending') {
            actions.push({
                icon: 'fas fa-check-circle',
                label: 'Mark as Sold',
                class: 'action-approve',
                onclick: `adminSelections.approveSelection('${selection.selectionId}')`
            });
        }

        // SEND DOWNLOAD LINK - para PENDING e FINALIZED
        if (selection.status === 'pending' || selection.status === 'finalized') {
            actions.push({
                icon: 'fas fa-paper-plane',
                label: 'Send Download Link',
                class: 'action-send',
                onclick: `adminSelections.sendDownloadLink('${selection.selectionId}')`
            });
        }

        // COPY VIEW LINK - para PENDING e FINALIZED
        if (selection.status === 'pending' || selection.status === 'finalized') {
            actions.push({
                icon: 'fas fa-link',
                label: 'Copy View Link',
                class: 'action-copy-link',
                onclick: `adminSelections.copyViewLink('${selection.selectionId}')`
            });
        }

        // PENDING - adiciona Reopen e Cancel
        if (selection.status === 'pending') {
            actions.push({
                icon: 'fas fa-undo',
                label: 'Reopen for Client',
                class: 'action-reopen',
                onclick: `adminSelections.reopenCart('${selection.selectionId}')`
            });
            actions.push({
                icon: 'fas fa-times-circle',
                label: 'Cancel Selection',
                class: 'action-cancel',
                onclick: `adminSelections.cancelSelection('${selection.selectionId}')`
            });
        }

        // FINALIZED (SOLD) - adiciona botão Cancel
        if (selection.status === 'finalized') {
            actions.push({
                icon: 'fas fa-times-circle',
                label: 'Cancel Sale',
                class: 'action-cancel',
                onclick: `adminSelections.cancelSoldSelection('${selection.selectionId}')`
            });
        }

        // CONFIRMED - adiciona Force Cancel (para limpeza)
        else if (selection.status === 'confirmed') {
            actions.push({
                icon: 'fas fa-exclamation-triangle',
                label: 'Force Cancel',
                class: 'action-force',
                onclick: `adminSelections.forceCancelSelection('${selection.selectionId}')`
            });
        }

        // DELETE - apenas para seleções canceladas
        if (selection.status === 'cancelled') {
            actions.push({
                icon: 'fas fa-trash',
                label: 'Delete',
                class: 'action-delete',
                onclick: `adminSelections.deleteSelection('${selection.selectionId}')`
            });
        }

        // Build dropdown menu HTML
        const menuItems = actions.map(action => `
            <button class="action-menu-item ${action.class}" onclick="${action.onclick}; adminSelections.closeActionMenu(event);">
                <i class="${action.icon}"></i>
                <span>${action.label}</span>
            </button>
        `).join('');

        return `
            <div class="action-menu-container">
                <button class="action-menu-trigger" onclick="adminSelections.toggleActionMenu(event)">
                    <span>Actions</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="action-menu-dropdown">
                    ${menuItems}
                </div>
            </div>
        `;
    }

    // Toggle action menu dropdown
    toggleActionMenu(event) {
        event.stopPropagation();
        const trigger = event.currentTarget;
        const container = trigger.closest('.action-menu-container');
        const dropdown = container.querySelector('.action-menu-dropdown');
        const parentRow = container.closest('tr');

        // Close all other open menus and remove active class from rows
        document.querySelectorAll('.action-menu-dropdown.open').forEach(menu => {
            if (menu !== dropdown) {
                menu.classList.remove('open');
                const row = menu.closest('tr');
                if (row) row.classList.remove('dropdown-active');
            }
        });

        // Toggle this menu
        const isOpening = !dropdown.classList.contains('open');
        dropdown.classList.toggle('open');

        // Add/remove active class to parent row for z-index
        if (parentRow) {
            if (isOpening) {
                parentRow.classList.add('dropdown-active');
            } else {
                parentRow.classList.remove('dropdown-active');
            }
        }

        if (dropdown.classList.contains('open')) {
            // Check if dropdown should open upward
            this.positionDropdown(container, dropdown);
        }
    }

    // Position dropdown (up or down based on available space)
    positionDropdown(container, dropdown) {
        // Use requestAnimationFrame to ensure dropdown is rendered
        requestAnimationFrame(() => {
            const containerRect = container.getBoundingClientRect();

            // Get actual dropdown height (try multiple properties for accuracy)
            const dropdownHeight = dropdown.scrollHeight || dropdown.offsetHeight || 250;

            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - containerRect.bottom;
            const spaceAbove = containerRect.top;

            // Add a safety buffer to prevent dropdown from being too close to edges
            const buffer = 20;
            const requiredSpace = dropdownHeight + buffer;

            // If not enough space below, open upward
            if (spaceBelow < requiredSpace && spaceAbove > spaceBelow) {
                dropdown.classList.add('open-up');
            } else {
                dropdown.classList.remove('open-up');
            }
        });
    }

    // Close action menu
    closeActionMenu(event) {
        if (event) event.stopPropagation();
        document.querySelectorAll('.action-menu-dropdown.open').forEach(menu => {
            menu.classList.remove('open');
            const row = menu.closest('tr');
            if (row) row.classList.remove('dropdown-active');
        });
    }

    // Initialize global click handler to close menus
    initActionMenuHandler() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.action-menu-container')) {
                this.closeActionMenu();
            }
        });
    }

    // ===== VIEW SELECTION DETAILS =====
    async viewSelection(selectionId) {
        try {
            console.log(`👁️ Viewing selection: ${selectionId}`);

            // Show loading modal
            this.showSelectionModal(selectionId, null, true);

            const response = await fetch(`/api/selections/${selectionId}`, {
                headers: this.getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                // Buscar nome real da empresa do access-codes
                try {
                    const codesResp = await fetch('/api/admin/access-codes', {
                        headers: this.getAuthHeaders()
                    });
                    const codesData = await codesResp.json();
                    if (codesData.success) {
                        const client = codesData.codes.find(c => c.code === data.selection.clientCode);
                        if (client?.companyName) {
                            data.selection.clientCompany = client.companyName;
                        }
                    }
                } catch (err) {
                    console.log('Erro buscando empresa:', err);
                }
                // Separar categorias de fotos vs catalog products
                const photoItems = data.selection.items.filter(item => !item.isCatalogProduct);
                const catalogItems = data.selection.items.filter(item => item.isCatalogProduct);

                // Buscar QB items apenas para categorias de fotos
                const photoCategories = [...new Set(photoItems.map(item => item.category))];
                let qbMap = {};

                if (photoCategories.length > 0) {
                    qbMap = await this.fetchQBItems(photoCategories);
                }

                // Adicionar QB items de catálogo diretamente (já vêm com qbItem no item)
                catalogItems.forEach(item => {
                    if (item.qbItem) {
                        qbMap[item.category] = item.qbItem;
                    }
                });

                console.log(`📊 QB Map: ${photoCategories.length} fotos buscadas, ${catalogItems.length} catálogo direto`);

                // Adicionar QB items aos dados
                data.selection.qbMap = qbMap;

                // SALVAR SELEÇÃO ATUAL
                this.currentSelection = data.selection;

                this.showSelectionModal(selectionId, data.selection, false);
            } else {
                throw new Error(data.message || 'Failed to load selection details');
            }

        } catch (error) {
            console.error('❌ Error viewing selection:', error);
            this.showNotification(`Error viewing selection: ${error.message}`, 'error');
            this.hideSelectionModal();
        }
    }

    // ===== SHOW SELECTION MODAL - REDESIGNED =====
    showSelectionModal(selectionId, selection, loading = false) {
        // Check if modal exists and has the NEW structure
        let modal = document.getElementById('selectionDetailsModal');

        // Se modal existe mas NÃO tem a nova estrutura, remover e recriar
        if (modal && !modal.querySelector('#selectionModalTitle')) {
            console.log('🔄 Removing old modal structure, creating new one...');
            modal.remove();
            modal = null;
        }

        // Create modal if doesn't exist
        if (!modal) {
            modal = this.createSelectionModal();
        }

        if (loading) {
            // Show loading state
            document.getElementById('selectionModalTitle').textContent = 'Loading...';
            document.getElementById('selectionCategoriesList').innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p>Loading selection details...</p>
                </div>
            `;
            document.getElementById('selectionQBNav').innerHTML = '';
            document.getElementById('selectionStatus').innerHTML = '';
        } else {
            // Populate all fields with selection data
            this.populateSelectionModal(selection);
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // ===== POPULATE SELECTION MODAL =====
    populateSelectionModal(selection) {
        if (!selection) return;

        // Format date
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        // Header info
        document.getElementById('selectionModalTitle').textContent = `Selection - ${selection.clientName}`;
        document.getElementById('selectionDate').textContent = formatDate(selection.createdAt);
        document.getElementById('selectionClient').textContent = selection.clientName;
        document.getElementById('selectionCompany').textContent = selection.clientCompany || selection.clientName;
        document.getElementById('selectionId').textContent = selection.selectionId;

        // Status badge
        const statusEl = document.getElementById('selectionStatus');
        statusEl.className = `selection-status-badge status-${selection.status}`;
        statusEl.innerHTML = `${this.getStatusIcon(selection.status)} ${this.getStatusText(selection.status)}`;

        // Customer Notes
        const notesSection = document.getElementById('selectionNotesSection');
        if (selection.customerNotes) {
            document.getElementById('selectionNotes').textContent = selection.customerNotes;
            notesSection.style.display = 'block';
        } else {
            notesSection.style.display = 'none';
        }

        // Group items by category and calculate stats
        const categoriesData = this.groupItemsByCategory(selection);
        this.selectionCategories = categoriesData;
        this.currentQBIndex = 0;

        // QB Navigation tabs
        this.renderQBNavigation(categoriesData, selection.qbMap);

        // Categories list
        this.renderSelectionCategories(categoriesData, selection);

        // Footer totals
        document.getElementById('selectionTotalItems').textContent = `${selection.totalItems || selection.items.length} items`;
        const totalValue = selection.totalValue || categoriesData.reduce((sum, cat) => sum + cat.value, 0);
        document.getElementById('selectionTotalValue').textContent = `= $${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

        // Update view mode buttons
        this.updateViewModeButtons();

        // Initialize scroll listener for dynamic QB tabs
        this.initScrollListener();
    }

    // ===== INIT SCROLL LISTENER FOR DYNAMIC QB TABS =====
    initScrollListener() {
        const scrollContainer = document.querySelector('#selectionDetailsModal .selection-body');
        if (!scrollContainer) return;

        // Remove old listener if exists
        if (this._scrollHandler) {
            scrollContainer.removeEventListener('scroll', this._scrollHandler);
        }

        // Create scroll handler
        this._scrollHandler = () => {
            this.updateActiveQBTab(scrollContainer);
        };

        scrollContainer.addEventListener('scroll', this._scrollHandler, { passive: true });
    }

    // ===== UPDATE ACTIVE QB TAB BASED ON SCROLL =====
    updateActiveQBTab(scrollContainer) {
        const categories = scrollContainer.querySelectorAll('.selection-category');
        if (!categories.length) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        const containerTop = containerRect.top;
        let activeIndex = 0;

        // Find which category is most visible (closest to top of container)
        categories.forEach((cat, index) => {
            const catRect = cat.getBoundingClientRect();
            const catTop = catRect.top - containerTop;

            // If category top is above or at the container top (with some threshold)
            if (catTop <= 50) {
                activeIndex = index;
            }
        });

        // Update QB tabs if changed
        if (this.currentQBIndex !== activeIndex) {
            this.currentQBIndex = activeIndex;
            this.highlightQBTab(activeIndex);
        }
    }

    // ===== HIGHLIGHT QB TAB (DROPDOWN) =====
    highlightQBTab(index) {
        const dropdown = document.getElementById('selectionQBNav');
        if (dropdown && dropdown.tagName === 'SELECT') {
            dropdown.value = index;
        }
    }

    // ===== GROUP ITEMS BY CATEGORY =====
    // Fotos únicas: agrupadas por subcategoria (folder path)
    // Produtos de catálogo: cada produto é uma "categoria" separada com seu QB code
    groupItemsByCategory(selection) {
        const grouped = {};

        selection.items.forEach(item => {
            let groupKey;
            let shortName;
            let qbItem;

            if (item.isCatalogProduct) {
                // CATÁLOGO: Agrupar por qbItem (cada produto é uma entrada)
                groupKey = `catalog_${item.qbItem || item.productName}`;
                shortName = item.productName || item.fileName || 'Catalog Product';
                qbItem = item.qbItem || null;
            } else {
                // FOTOS ÚNICAS: Agrupar por subcategoria (folder path)
                // Mostrar caminho completo para melhor identificação
                groupKey = item.category;
                shortName = item.category || 'Unknown Category';
                qbItem = selection.qbMap ? selection.qbMap[item.category] : null;
            }

            if (!grouped[groupKey]) {
                grouped[groupKey] = {
                    category: item.category,
                    groupKey: groupKey,
                    shortName: shortName,
                    items: [],
                    count: 0,
                    value: 0,
                    qbItem: qbItem,
                    isCatalogProduct: item.isCatalogProduct || false
                };
            }

            grouped[groupKey].items.push(item);
            grouped[groupKey].count += item.quantity || 1;
            // item.price is already the total (unitPrice × quantity), no need to multiply again
            grouped[groupKey].value += item.price || 0;
        });

        // Ordenar: fotos únicas primeiro, depois catálogo por nome
        return Object.values(grouped).sort((a, b) => {
            if (a.isCatalogProduct && !b.isCatalogProduct) return 1;
            if (!a.isCatalogProduct && b.isCatalogProduct) return -1;
            return a.shortName.localeCompare(b.shortName);
        });
    }

    // ===== RENDER QB NAVIGATION (DROPDOWN) =====
    renderQBNavigation(categoriesData, qbMap) {
        const navContainer = document.getElementById('selectionQBNav');

        // Separar fotos únicas e produtos de catálogo
        const photoCategories = categoriesData.filter(c => !c.isCatalogProduct);
        const catalogProducts = categoriesData.filter(c => c.isCatalogProduct);

        let optionsHTML = '';

        // Grupo de fotos únicas
        if (photoCategories.length > 0) {
            optionsHTML += `<optgroup label="📷 Unique Photos (${photoCategories.length})">`;
            photoCategories.forEach((cat) => {
                const i = categoriesData.indexOf(cat);
                const qbCode = cat.qbItem || '—';
                // Mostrar nome mais completo (até 50 chars)
                const displayName = cat.shortName.length > 50 ? cat.shortName.substring(0, 50) + '...' : cat.shortName;
                optionsHTML += `<option value="${i}">${qbCode} - ${displayName} (${cat.count})</option>`;
            });
            optionsHTML += `</optgroup>`;
        }

        // Grupo de produtos de catálogo
        if (catalogProducts.length > 0) {
            optionsHTML += `<optgroup label="📦 Catalog Products (${catalogProducts.length})">`;
            catalogProducts.forEach((cat) => {
                const i = categoriesData.indexOf(cat);
                const qbCode = cat.qbItem || '—';
                const displayName = cat.shortName.length > 50 ? cat.shortName.substring(0, 50) + '...' : cat.shortName;
                optionsHTML += `<option value="${i}">${qbCode} - ${displayName} (${cat.count})</option>`;
            });
            optionsHTML += `</optgroup>`;
        }

        navContainer.innerHTML = optionsHTML;
    }

    // ===== RENDER SELECTION CATEGORIES =====
    renderSelectionCategories(categoriesData, selection) {
        const container = document.getElementById('selectionCategoriesList');
        const canRemove = selection && (selection.status === 'pending' || selection.status === 'finalized');

        const categoriesHTML = categoriesData.map((cat, catIndex) => {
            const qbBadge = cat.qbItem
                ? `<span class="qb-badge">${cat.qbItem}</span>`
                : `<span class="qb-badge empty">—</span>`;
            const escapedCategory = (cat.groupKey || cat.category).replace(/'/g, "\\'");

            // Produtos de catálogo: expansível como fotos únicas
            if (cat.isCatalogProduct) {
                return `
                <div class="selection-category catalog-product" data-index="${catIndex}" id="selCat${catIndex}" data-is-catalog="true">
                    <div class="cat-row" onclick="adminSelections.toggleSelCategory(${catIndex})">
                        <div class="col-checkbox">
                            ${canRemove ? `
                                <input type="checkbox"
                                    class="cat-select-all"
                                    data-category="${escapedCategory}"
                                    data-cat-index="${catIndex}"
                                    data-is-catalog="true"
                                    onclick="event.stopPropagation(); adminSelections.toggleCategorySelection(${catIndex}, '${escapedCategory}');"
                                    title="Select all in this category">
                            ` : ''}
                        </div>
                        <div class="col-category" title="${cat.shortName}">
                            <i class="fas fa-chevron-right cat-arrow"></i>
                            <span class="cat-name">${cat.shortName}</span>
                        </div>
                        <div class="col-qb">${qbBadge}</div>
                        <div class="col-qty">${cat.count}</div>
                        <div class="col-value">$${cat.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div class="cat-items" style="display: none;" data-rendered="false">
                        <!-- Items loaded on expand -->
                    </div>
                </div>
                `;
            }

            // Fotos únicas: expansível com subcategorias
            return `
            <div class="selection-category photo-category" data-index="${catIndex}" id="selCat${catIndex}" data-is-catalog="false">
                <div class="cat-row" onclick="adminSelections.toggleSelCategory(${catIndex})">
                    <div class="col-checkbox">
                        ${canRemove ? `
                            <input type="checkbox"
                                class="cat-select-all"
                                data-category="${cat.category}"
                                data-cat-index="${catIndex}"
                                onclick="event.stopPropagation(); adminSelections.toggleCategorySelection(${catIndex}, '${escapedCategory}');"
                                title="Select all in this category">
                        ` : ''}
                    </div>
                    <div class="col-category" title="${cat.category}">
                        <i class="fas fa-chevron-right cat-arrow"></i>
                        <span class="cat-name">${cat.shortName}</span>
                    </div>
                    <div class="col-qb">${qbBadge}</div>
                    <div class="col-qty">${cat.count}</div>
                    <div class="col-value">$${cat.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="cat-items" style="display: none;" data-rendered="false">
                    <!-- Items loaded on expand -->
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = categoriesHTML || '<div class="empty-selection">No categories</div>';
    }

    // ===== TOGGLE CATEGORY SELECTION =====
    toggleCategorySelection(catIndex, category) {
        const catCheckbox = document.querySelector(`.cat-select-all[data-cat-index="${catIndex}"]`);
        const isChecked = catCheckbox?.checked;

        // Get the category container
        const categoryDiv = document.getElementById(`selCat${catIndex}`);
        if (!categoryDiv) return;

        const itemsDiv = categoryDiv.querySelector('.cat-items');

        // Force expand if needed
        if (!categoryDiv.classList.contains('expanded')) {
            this.toggleSelCategory(catIndex);
        }

        // Force render if needed
        if (itemsDiv && itemsDiv.dataset.rendered === 'false') {
            this.renderCategoryPhotos(catIndex, itemsDiv);
        }

        // Select all checkboxes with retry (DOM needs time to render)
        let attempts = 0;
        const selectAll = () => {
            attempts++;
            const checkboxes = categoryDiv.querySelectorAll('.cat-items .photo-checkbox');

            if (checkboxes.length > 0) {
                checkboxes.forEach(cb => {
                    cb.checked = isChecked;
                });
                this.updateRemoveButtonState();
            } else if (attempts < 10) {
                setTimeout(selectAll, 100);
            }
        };

        setTimeout(selectAll, 50);
    }

    // ===== TOGGLE CATALOG PRODUCT SELECTION =====
    toggleCatalogProductSelection(catIndex) {
        // Para produtos de catálogo, apenas atualiza o estado do botão de remover
        this.updateRemoveButtonState();
    }

    // ===== TOGGLE SELECTION CATEGORY =====
    toggleSelCategory(index) {
        const category = document.querySelector(`.selection-category[data-index="${index}"]`);
        if (!category) return;

        const itemsDiv = category.querySelector('.cat-items');
        const arrow = category.querySelector('.cat-arrow');
        if (!itemsDiv || !arrow) return;

        const isExpanded = category.classList.contains('expanded');

        if (isExpanded) {
            category.classList.remove('expanded');
            itemsDiv.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
        } else {
            category.classList.add('expanded');
            itemsDiv.style.display = 'block';
            arrow.style.transform = 'rotate(90deg)';

            // Lazy load items if not rendered
            if (itemsDiv.dataset.rendered === 'false') {
                this.renderCategoryPhotos(index, itemsDiv);
            }
        }
    }

    // ===== RENDER CATEGORY PHOTOS =====
    renderCategoryPhotos(catIndex, container) {
        const cat = this.selectionCategories[catIndex];
        if (!cat) return;

        const viewMode = this.viewMode || 'list';
        const selection = this.currentSelection;
        const canRemove = selection && (selection.status === 'pending' || selection.status === 'finalized');
        const escapedCategory = cat.category.replace(/'/g, "\\'");

        const photosHTML = cat.items.map((item, itemIndex) => {
            const thumbUrl = this.getThumbnailUrl(item);
            const itemName = item.productName || item.fileName || item.name || 'Unknown';

            if (viewMode === 'grid') {
                return `
                <div class="photo-grid-item">
                    ${canRemove ? `
                        <input type="checkbox"
                            class="photo-checkbox item-checkbox"
                            data-filename="${itemName}"
                            data-category="${cat.category}"
                            data-price="${item.price || 0}"
                            onclick="event.stopPropagation(); adminSelections.updateRemoveButtonState();">
                    ` : ''}
                    <img src="${thumbUrl}" alt="${itemName}" loading="lazy"
                         onclick="adminSelections.openSelectionLightbox(${catIndex}, ${itemIndex})"
                         onerror="this.onerror=null; this.style.display='none'; this.parentElement.classList.add('no-img');">
                    <span class="photo-name">${itemName}</span>
                </div>`;
            } else {
                return `
                <div class="photo-list-item">
                    ${canRemove ? `
                        <input type="checkbox"
                            class="photo-checkbox item-checkbox"
                            data-filename="${itemName}"
                            data-category="${cat.category}"
                            data-price="${item.price || 0}"
                            onclick="event.stopPropagation(); adminSelections.updateRemoveButtonState();">
                    ` : ''}
                    <img src="${thumbUrl}" alt="${itemName}" loading="lazy"
                         onclick="adminSelections.openSelectionLightbox(${catIndex}, ${itemIndex})"
                         onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2212%22>No img</text></svg>';">
                    <div class="photo-info">
                        <span class="photo-name">${itemName}</span>
                        <span class="photo-price">$${(item.price || 0).toFixed(2)}</span>
                    </div>
                </div>`;
            }
        }).join('');

        container.innerHTML = `<div class="photos-container ${viewMode}-view">${photosHTML}</div>`;
        container.dataset.rendered = 'true';
    }

    // ===== UPDATE REMOVE BUTTON STATE =====
    updateRemoveButtonState() {
        const checkedBoxes = document.querySelectorAll('#selectionDetailsModal .item-checkbox:checked');
        const removeBtn = document.getElementById('btnRemoveSelected');

        if (removeBtn) {
            if (checkedBoxes.length > 0) {
                removeBtn.style.display = 'inline-flex';
                removeBtn.querySelector('.selected-count').textContent = checkedBoxes.length;
            } else {
                removeBtn.style.display = 'none';
            }
        }
    }

    // ===== REMOVE SELECTED FROM MODAL =====
    async removeSelectedFromModal() {
        if (!this.currentSelection) return;

        const checkedBoxes = document.querySelectorAll('#selectionDetailsModal .item-checkbox:checked');

        if (checkedBoxes.length === 0) {
            UISystem.showToast('warning', 'No items selected');
            return;
        }

        // Collect selected items
        const itemsToRemove = Array.from(checkedBoxes).map(checkbox => ({
            fileName: checkbox.dataset.filename,
            price: parseFloat(checkbox.dataset.price) || 0,
            category: checkbox.dataset.category
        }));

        const confirmMessage = itemsToRemove.length === 1
            ? 'Remove 1 item from this selection?'
            : `Remove ${itemsToRemove.length} items from this selection?`;

        const confirmed = await UISystem.confirm(
            'Remove Selected Items?',
            confirmMessage
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/selections/${this.currentSelection.selectionId}/remove-items`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ items: itemsToRemove })
            });

            const result = await response.json();

            if (result.success) {
                UISystem.showToast('success', `Removed ${itemsToRemove.length} items`);

                // Reload modal with fresh data
                await this.viewSelection(this.currentSelection.selectionId);

                // Reload main list
                await this.loadSelections();
            } else {
                UISystem.showToast('error', result.message || 'Failed to remove items');
            }
        } catch (error) {
            console.error('Error removing items:', error);
            UISystem.showToast('error', 'Error removing items');
        }
    }

    // ===== QB NAVIGATION FUNCTIONS =====
    goToCategory(index) {
        // Convert to number (dropdown passes string)
        index = parseInt(index, 10);

        // Update active dropdown
        this.highlightQBTab(index);
        this.currentQBIndex = index;

        // Scroll to category within modal container
        const category = document.getElementById(`selCat${index}`);
        const scrollContainer = document.querySelector('#selectionDetailsModal .selection-body');

        if (category && scrollContainer) {
            // Calculate scroll position relative to container
            const containerTop = scrollContainer.getBoundingClientRect().top;
            const categoryTop = category.getBoundingClientRect().top;
            const scrollOffset = scrollContainer.scrollTop + (categoryTop - containerTop);

            scrollContainer.scrollTo({
                top: scrollOffset,
                behavior: 'smooth'
            });

            // Expand if not expanded
            if (!category.classList.contains('expanded')) {
                this.toggleSelCategory(index);
            }
        }
    }

    prevQBCategory() {
        if (!this.selectionCategories || this.selectionCategories.length === 0) return;
        const newIndex = this.currentQBIndex > 0
            ? this.currentQBIndex - 1
            : this.selectionCategories.length - 1;
        this.goToCategory(newIndex);
    }

    nextQBCategory() {
        if (!this.selectionCategories || this.selectionCategories.length === 0) return;
        const newIndex = this.currentQBIndex < this.selectionCategories.length - 1
            ? this.currentQBIndex + 1
            : 0;
        this.goToCategory(newIndex);
    }

    // ===== VIEW MODE FUNCTIONS =====
    setViewMode(mode) {
        this.viewMode = mode;
        this.updateViewModeButtons();

        // Re-render all expanded categories
        document.querySelectorAll('.selection-category.expanded .cat-items').forEach(container => {
            container.dataset.rendered = 'false';
            const catIndex = container.closest('.selection-category').dataset.index;
            this.renderCategoryPhotos(parseInt(catIndex), container);
        });
    }

    updateViewModeButtons() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`.view-btn[onclick*="${this.viewMode}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    // ===== PRINT CURRENT SELECTION =====
    printCurrentSelection() {
        if (this.currentSelection) {
            this.printSelection(this.currentSelection.selectionId);
        }
    }

    // ===== EXPORT CURRENT TO CDE =====
    exportCurrentToCDE() {
        if (this.currentSelection) {
            this.openPONumberModal(this.currentSelection.selectionId);
        }
    }

    // ===== OPEN SELECTION LIGHTBOX (NEW) =====
    openSelectionLightbox(catIndex, itemIndex) {
        if (!this.selectionCategories || !this.selectionCategories[catIndex]) return;

        const cat = this.selectionCategories[catIndex];
        const item = cat.items[itemIndex];
        if (!item) return;

        // Store current position for navigation
        this.lightboxCatIndex = catIndex;
        this.lightboxItemIndex = itemIndex;
        this.lightboxItems = cat.items;

        // Get full image URL using the corrected method
        const fullUrl = this.getOriginalUrl(item);

        // Show lightbox with this item
        this.showSelectionLightbox(item, fullUrl);
    }

    // ===== SHOW SELECTION LIGHTBOX =====
    showSelectionLightbox(item, imageUrl) {
        // Create or get lightbox
        let lightbox = document.getElementById('selectionLightbox');
        if (!lightbox) {
            lightbox = document.createElement('div');
            lightbox.id = 'selectionLightbox';
            lightbox.className = 'lightbox-overlay';
            lightbox.innerHTML = `
                <div class="lightbox-content">
                    <button class="lightbox-close" onclick="adminSelections.closeSelectionLightbox()">
                        <i class="fas fa-times"></i>
                    </button>
                    <button class="lightbox-nav lightbox-prev" onclick="adminSelections.prevSelectionPhoto()">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <img id="selectionLightboxImage" src="" alt="">
                    <button class="lightbox-nav lightbox-next" onclick="adminSelections.nextSelectionPhoto()">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                    <div class="lightbox-info">
                        <span id="selectionLightboxName"></span>
                        <span id="selectionLightboxPrice"></span>
                    </div>
                </div>
            `;
            document.body.appendChild(lightbox);
        }

        // Update image and info
        document.getElementById('selectionLightboxImage').src = imageUrl;
        document.getElementById('selectionLightboxName').textContent = item.productName || item.fileName || item.name || '';
        document.getElementById('selectionLightboxPrice').textContent = `$${(item.price || 0).toFixed(2)}`;

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeSelectionLightbox() {
        const lightbox = document.getElementById('selectionLightbox');
        if (lightbox) {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    prevSelectionPhoto() {
        if (!this.lightboxItems || this.lightboxItemIndex <= 0) return;
        this.lightboxItemIndex--;
        const item = this.lightboxItems[this.lightboxItemIndex];
        this.showSelectionLightbox(item, this.getOriginalUrl(item));
    }

    nextSelectionPhoto() {
        if (!this.lightboxItems || this.lightboxItemIndex >= this.lightboxItems.length - 1) return;
        this.lightboxItemIndex++;
        const item = this.lightboxItems[this.lightboxItemIndex];
        this.showSelectionLightbox(item, this.getOriginalUrl(item));
    }

    // ===== KEYBOARD HANDLER FOR LIGHTBOX =====
    handleSelectionLightboxKeyboard(e) {
        const lightbox = document.getElementById('selectionLightbox');
        if (!lightbox || !lightbox.classList.contains('active')) return;

        switch (e.key) {
            case 'Escape':
                this.closeSelectionLightbox();
                break;
            case 'ArrowLeft':
                this.prevSelectionPhoto();
                break;
            case 'ArrowRight':
                this.nextSelectionPhoto();
                break;
        }
    }

    // ===== CREATE SELECTION MODAL - REDESIGNED =====
    createSelectionModal() {
        const modal = document.createElement('div');
        modal.id = 'selectionDetailsModal';
        modal.className = 'selection-modal';
        modal.innerHTML = `
            <div class="selection-modal-content">
                <!-- Fixed Top Section -->
                <div class="selection-fixed-top">
                    <!-- Header -->
                    <div class="selection-modal-header">
                        <div class="selection-title">
                            <i class="fas fa-shopping-cart"></i>
                            <span id="selectionModalTitle">Selection Details</span>
                        </div>
                        <div class="selection-header-right">
                            <span id="selectionStatus" class="selection-status-badge"></span>
                            <button class="selection-close" onclick="adminSelections.hideSelectionModal()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Info Bar -->
                    <div class="selection-info-bar">
                        <div class="info-item">
                            <i class="fas fa-calendar"></i>
                            <span id="selectionDate">--</span>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-user"></i>
                            <span id="selectionClient">--</span>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-building"></i>
                            <span id="selectionCompany">--</span>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-fingerprint"></i>
                            <span id="selectionId" class="selection-id-code">--</span>
                        </div>
                    </div>

                    <!-- Customer Notes (if exists) -->
                    <div id="selectionNotesSection" class="selection-notes-section" style="display: none;">
                        <div class="notes-content">
                            <i class="fas fa-comment-dots"></i>
                            <span id="selectionNotes"></span>
                        </div>
                    </div>

                    <!-- QB Items Navigation - DROPDOWN STYLE -->
                    <div class="selection-nav-section">
                        <div class="qb-dropdown-container">
                            <label style="color: #999; font-size: 12px; margin-right: 8px;">Jump to:</label>
                            <select id="selectionQBNav" class="qb-dropdown" onchange="adminSelections.goToCategory(this.value)">
                                <!-- Options will be filled via JS -->
                            </select>
                        </div>
                        <div class="view-toggle-btns">
                            <button class="view-btn active" onclick="adminSelections.setViewMode('list')" title="List View">
                                <i class="fas fa-list"></i>
                            </button>
                            <button class="view-btn" onclick="adminSelections.setViewMode('grid')" title="Grid View">
                                <i class="fas fa-th"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Column Headers -->
                    <div class="selection-columns-header">
                        <div class="col-checkbox"></div>
                        <div class="col-category">Category</div>
                        <div class="col-qb">QB</div>
                        <div class="col-qty">Qty</div>
                        <div class="col-value">Value</div>
                    </div>
                </div>

                <!-- Scrollable Categories Section -->
                <div class="selection-body">
                    <div id="selectionCategoriesList" class="selection-categories">
                        <!-- Categories will be filled via JS -->
                    </div>
                </div>

                <!-- Fixed Footer -->
                <div class="selection-modal-footer">
                    <div class="selection-totals">
                        <span class="total-label">Total:</span>
                        <span id="selectionTotalItems" class="total-items">0 items</span>
                        <span id="selectionTotalValue" class="total-value">= $0</span>
                    </div>
                    <div class="selection-actions">
                        <button id="btnRemoveSelected" class="btn-selection btn-remove" style="display: none;" onclick="adminSelections.removeSelectedFromModal()">
                            <i class="fas fa-trash"></i> Remove (<span class="selected-count">0</span>)
                        </button>
                        <button class="btn-selection btn-export" onclick="adminSelections.exportCurrentToCDE()">
                            <i class="fas fa-file-export"></i> Export to CDE
                        </button>
                        <button class="btn-selection btn-close" onclick="adminSelections.hideSelectionModal()">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideSelectionModal();
            }
        });

        return modal;
    }

    // ===== RENDER SELECTION DETAILS =====
    renderSelectionDetails(selection) {
        if (!selection) return '<p>No data available</p>';

        // Agrupar items por categoria
        const itemsByCategory = {};
        selection.items.forEach(item => {
            if (!itemsByCategory[item.category]) {
                itemsByCategory[item.category] = [];
            }
            itemsByCategory[item.category].push(item);
        });

        // Formatar data
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        // ⭐ INJETAR FOOTER NO CONTAINER SEPARADO
        setTimeout(() => {
            const footerContainer = document.querySelector('.selection-details-footer');
            if (footerContainer) {
                footerContainer.innerHTML = `
                    <!-- Compact Footer: Summary + Buttons -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-top: 2px solid #d4af37;">
                        <!-- Left: Summary -->
                        <div style="display: flex; gap: 30px; align-items: center;">
                            <span style="color: #999; font-size: 20px">Total items: <strong style="color: #fff;">${selection.totalItems || selection.items.length}</strong></span>
                            <span style="color: #999; font-size: 20px">Total Value: <strong style="font-size: 1.0em; color: #16a34a;">${selection.totalValue > 0 ? '$' + selection.totalValue.toFixed(2) : 'To be calculated'}</strong>${selection.clientCurrency && selection.clientCurrency !== 'USD' ? ` <small style="color: #888; font-size: 14px; cursor: help;" title="Client viewed as: ${selection.clientCurrency === 'CAD' ? 'C$' : '€'}${selection.convertedValue ? selection.convertedValue.toFixed(2) : (selection.totalValue * (selection.currencyRate || 1)).toFixed(2)} ${selection.clientCurrency}\nExchange rate used: ${selection.currencyRate || 'N/A'}">(${selection.clientCurrency} ℹ️)</small>` : ''}</span>
                        </div>
                        <!-- Right: Buttons -->
                        <div style="display: flex; gap: 10px;">
                            <button class="btn-modal-action btn-download" onclick="adminSelections.openPONumberModal('${selection.selectionId}')">
                                <i class="fas fa-file-excel"></i>
                                Download CSV
                            </button>
                            <button class="btn-modal-action btn-print" onclick="adminSelections.printSelection('${selection.selectionId}')">
                                <i class="fas fa-print"></i>
                                Print
                            </button>
                            <button class="btn-modal-action btn-close" onclick="adminSelections.hideSelectionModal()">
                                <i class="fas fa-times"></i>
                                Close
                            </button>
                        </div>
                    </div>
                `;
            }
        }, 100);

        return `
            <div class="selection-details-container">
                <!-- Header Info -->
                <div class="selection-info-grid">
                    <div class="info-item">
                        <label>Date:</label>
                        <span>${formatDate(selection.createdAt)}</span>
                    </div>
                    <div class="info-item">
                        <label>Client:</label>
                        <span>${selection.clientName}</span>
                    </div>
                    <div class="info-item">
                        <label>Company:</label>
                        <span>${selection.clientCompany || selection.clientName}</span>
                    </div>
                    <div class="info-item">
                        <label>Status:</label>
                        <span class="status-badge status-${selection.status}">
                            ${this.getStatusIcon(selection.status)}
                            ${this.getStatusText(selection.status)}
                        </span>
                    </div>
                    <div class="info-item">
                        <label>Selection ID:</label>
                        <span style="font-family: monospace; font-size: 12px; color: #888;">${selection.selectionId}</span>
                    </div>
                </div>

                <!-- Customer Notes -->
                ${selection.customerNotes ? `
                    <div class="customer-notes-section" style="background: #FFF9C4; border-left: 4px solid #FFC107; padding: 15px; margin: 0px 0px 10px 0px; border-radius: 4px;">
                        <h4 style="margin: 0 0 10px 0; color: #F57C00; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-comment-dots"></i>
                            Customer Notes
                        </h4>
                        <p style="margin: 0; color: #333; white-space: pre-wrap; font-style: italic;">${selection.customerNotes}</p>
                    </div>
                ` : ''}

                <!-- Items by Category -->
                <div class="items-section">
                    <div class="items-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h4 class="section-title" style="margin: 0;">Items by Category</h4>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <!-- TOGGLE VIEW BUTTONS -->
                            <div class="view-toggle-container">
                                <button class="btn-view-toggle ${this.viewMode === 'list' ? 'active' : ''}" onclick="adminSelections.toggleView('list')">
                                    <i class="fas fa-list"></i> List
                                </button>
                                <button class="btn-view-toggle ${this.viewMode === 'grid' ? 'active' : ''}" onclick="adminSelections.toggleView('grid')">
                                    <i class="fas fa-th"></i> Grid
                                </button>
                            </div>
                            ${(selection.status === 'pending' || selection.status === 'finalized') ? `
                                <button class="btn-remove-selected" 
                                    id="btn-remove-selected-${selection.selectionId}"
                                    style="display: none; background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;"
                                    onclick="adminSelections.removeSelectedItems('${selection.selectionId}')">
                                    <i class="fas fa-trash"></i>
                                    Remove Selected (<span class="selected-count">0</span>)
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="categories-list">
                        ${Object.entries(itemsByCategory).map(([category, items]) => `
                            <div class="category-group">
                                <div class="category-header" onclick="adminSelections.toggleCategory(this.parentElement, '${category.replace(/'/g, '\\\'')}')">
                                    <div class="category-title" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                                            <i class="fas fa-chevron-right toggle-icon"></i>
                                            <span class="category-name">${category}</span>
                                        </div>
                                        <span class="category-info" style="white-space: nowrap !important; margin-left: auto !important; margin-bottom: 0 !important;">
                                            ${items.length} items | <strong style="color: #4CAF50;">$${items.reduce((sum, item) => sum + (item.price || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                            ${selection.qbMap && selection.qbMap[category] ? ` | <strong style="color: #d4af37;">QB: ${selection.qbMap[category]}</strong>` : ''}
                                        </span>
                                    </div>
                                </div>
                                ${(selection.status === 'pending' || selection.status === 'finalized') ? `
                                    <div class="category-select-all-container" style="padding: 8px 15px; background: #2a2a2a; border-top: 1px solid #444;">
                                        <label style="color: #d4af37; cursor: pointer; display: flex; align-items: center;">
                                            <input type="checkbox" 
                                                class="category-select-all" 
                                                data-category="${category.replace(/'/g, '\\\'')}"
                                                style="accent-color: #d4af37; margin-right: 8px; width: 18px; height: 18px;"
                                                onchange="adminSelections.toggleLegacyCategorySelection(this, '${category.replace(/'/g, '\\\'')}')">
                                            <span>Select All</span>
                                        </label>
                                    </div>
                                ` : ''}
                                <div class="category-items ${this.viewMode}-view">
                                    <!-- Fotos serão carregadas sob demanda -->
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // ===== RENDER CATEGORY ON DEMAND (LAZY LOADING) =====
    renderCategoryItems(categoryElement, category, items, selection) {
        // Verificar se já foi renderizado
        if (categoryElement.dataset.rendered === 'true') {
            return; // Já foi carregado, não fazer nada
        }

        const itemsContainer = categoryElement.querySelector('.category-items');
        if (!itemsContainer) return;

        // Mostrar loading temporário
        itemsContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: #999;"><i class="fas fa-spinner fa-spin"></i> Loading photos...</div>';

        // Renderizar as fotos com um pequeno delay para não travar
        setTimeout(() => {
            const viewMode = this.viewMode;
            itemsContainer.className = `category-items ${viewMode}-view`;
            itemsContainer.innerHTML = viewMode === 'list'
                ? this.renderListView(items, selection, category)
                : this.renderGridView(items, selection, category);

            // Marcar como renderizado
            categoryElement.dataset.rendered = 'true';

            // Reinicializar listeners se necessário
            this.initCheckboxListeners();
        }, 50);
    }

    // ===== TOGGLE CATEGORY (expandir/colapsar com lazy load) =====
    toggleCategory(categoryElement, category) {
        // Toggle expanded class
        categoryElement.classList.toggle('expanded');

        // Se está expandindo, renderizar as fotos
        if (categoryElement.classList.contains('expanded')) {
            const categoryData = this.currentSelection.items.filter(item => item.category === category);
            this.renderCategoryItems(categoryElement, category, categoryData, this.currentSelection);
        }
    }

    // Buscar QB items para as categorias
    async fetchQBItems(categories) {
        try {
            console.log('🔍 Buscando QB para categorias:', categories);

            const response = await fetch('/api/admin/map-categories', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    items: categories
                })
            });

            const data = await response.json();

            if (data.success) {
                const qbMap = {};
                data.mapped.forEach(item => {
                    const qbCode = item.qbItem || 'NO-QB';

                    // Mapeia com e sem barra final
                    const cleanCategory = item.original.replace(/\/$/, '');
                    qbMap[cleanCategory] = qbCode;
                    qbMap[item.original] = qbCode;
                });
                console.log('🗺️ QB Map final:', qbMap);
                return qbMap;
            }
        } catch (error) {
            console.error('Erro ao buscar QB items:', error);
        }
        return {};
    }

    // Hide selection modal
    hideSelectionModal() {
        const modal = document.getElementById('selectionDetailsModal');
        if (modal) {
            modal.classList.remove('active');
        }

        // Clean up scroll listener
        const scrollContainer = document.querySelector('#selectionDetailsModal .selection-body');
        if (scrollContainer && this._scrollHandler) {
            scrollContainer.removeEventListener('scroll', this._scrollHandler);
            this._scrollHandler = null;
        }

        // Restore body scroll
        document.body.style.overflow = '';
    }

    // ===== RENDER LIST VIEW =====
    renderListView(items, selection, category) {
        return items.map((item, index) => {
            const thumbnailUrl = item.thumbnailUrl || this.getThumbnailUrl(item);
            return `
                <div class="item-row list-view">
                    <div class="item-list-thumbnail" onclick="adminSelections.openLightbox(${index}, '${category}')">
                        <img src="${thumbnailUrl}" alt="${item.fileName}" loading="lazy">
                    </div>
                    <div style="display: flex; align-items: center; flex: 1;">
                        <span class="item-name">${item.fileName}</span>
                        <span class="item-price" style="margin-left: auto; color: #16a34a; font-weight: bold; margin-right: 15px;">
                            ${item.price > 0 ? '$' + item.price.toFixed(2) : '-'}
                        </span>
                        ${(selection.status === 'pending' || selection.status === 'finalized') ? `
                            <input type="checkbox" 
                                class="item-checkbox" 
                                data-filename="${item.fileName}"
                                data-category="${category}"
                                data-price="${item.price}"
                                id="item-${selection.selectionId}-${category}-${index}"
                                style="margin-left: 10px;">
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ===== RENDER GRID VIEW =====
    renderGridView(items, selection, category) {
        return items.map((item, index) => {
            const thumbnailUrl = item.thumbnailUrl || this.getThumbnailUrl(item);
            return `
                <div class="item-card" onclick="adminSelections.openLightbox(${index}, '${category}')">
                    <div class="item-card-thumbnail">
                        ${(selection.status === 'pending' || selection.status === 'finalized') ? `
                            <input type="checkbox" 
                                class="item-card-checkbox item-checkbox" 
                                data-filename="${item.fileName}"
                                data-category="${category}"
                                data-price="${item.price}"
                                id="item-${selection.selectionId}-${category}-${index}"
                                onclick="event.stopPropagation()">
                        ` : ''}
                        <img src="${thumbnailUrl}" alt="${item.fileName}" loading="lazy">
                    </div>
                    <div class="item-card-info">
                        <div class="item-card-name" title="${item.fileName}">${item.fileName}</div>
                        <div class="item-card-price">${item.price > 0 ? '$' + item.price.toFixed(2) : '-'}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ===== GET THUMBNAIL URL =====
    getThumbnailUrl(item) {
        // 1. Se já tem thumbnailUrl no banco, usar direto
        if (item.thumbnailUrl) return item.thumbnailUrl;

        // 2. Produtos de catálogo - verificar propriedades específicas
        if (item.isCatalogProduct) {
            if (item.productImage) return item.productImage;
            if (item.imageUrl) return item.imageUrl;
            if (item.image) return item.image;
        }

        // 3. Tentar construir a partir de category + fileName
        if (item.category && item.fileName) {
            // category format: "NATURAL COWHIDES → Premium" - usar primeira parte
            const categoryPath = item.category.split(' → ')[0].trim();
            const path = `${categoryPath}/${item.fileName}`;
            const encodedPath = path.split('/').map(part => encodeURIComponent(part)).join('/');
            return `https://images.sunshinecowhides-gallery.com/_thumbnails/${encodedPath}`;
        }

        // 4. Fallback para ImageUtils
        if (window.ImageUtils && window.ImageUtils.getThumbnailUrl) {
            return window.ImageUtils.getThumbnailUrl(item);
        }

        return '';
    }

    // ===== GET ORIGINAL URL =====
    getOriginalUrl(item) {
        // 1. Se tem thumbnailUrl, converter para full
        if (item.thumbnailUrl) {
            return item.thumbnailUrl.replace('/_thumbnails/', '/');
        }

        // 2. Produtos de catálogo - verificar propriedades específicas
        if (item.isCatalogProduct) {
            if (item.productImage) return item.productImage.replace('/_thumbnails/', '/');
            if (item.imageUrl) return item.imageUrl.replace('/_thumbnails/', '/');
            if (item.image) return item.image.replace('/_thumbnails/', '/');
        }

        // 3. Tentar construir a partir de category + fileName
        if (item.category && item.fileName) {
            const categoryPath = item.category.split(' → ')[0].trim();
            const path = `${categoryPath}/${item.fileName}`;
            const encodedPath = path.split('/').map(part => encodeURIComponent(part)).join('/');
            return `https://images.sunshinecowhides-gallery.com/${encodedPath}`;
        }

        // 4. Fallback para ImageUtils
        if (window.ImageUtils && window.ImageUtils.getFullImageUrl) {
            return window.ImageUtils.getFullImageUrl(item);
        }

        // 5. Fallback final
        if (item.r2Key || item.id) {
            const key = item.r2Key || item.id;
            return `https://images.sunshinecowhides-gallery.com/${key}`;
        }

        return '';
    }

    // ===== TOGGLE VIEW =====
    toggleView(mode) {
        this.viewMode = mode;
        // Re-render modal com nova view
        if (this.currentSelection) {
            this.showSelectionModal(this.currentSelection.selectionId, this.currentSelection, false);
        }
    }

    // ===== OPEN LIGHTBOX =====
    openLightbox(index, category) {
        if (!this.currentSelection) return;

        // Encontrar fotos da categoria
        const categoryItems = this.currentSelection.items.filter(item => item.category === category);
        this.lightboxPhotos = categoryItems;
        this.lightboxIndex = index;

        // Criar lightbox se não existe
        let lightbox = document.getElementById('photoLightbox');
        if (!lightbox) {
            lightbox = document.createElement('div');
            lightbox.id = 'photoLightbox';
            lightbox.className = 'photo-lightbox';
            document.body.appendChild(lightbox);

            // Event listeners
            lightbox.addEventListener('click', (e) => {
                if (e.target === lightbox) this.closeLightbox();
            });

            document.addEventListener('keydown', (e) => {
                const lb = document.getElementById('photoLightbox');
                if (lb && lb.classList.contains('active')) {
                    if (e.key === 'Escape') this.closeLightbox();
                    if (e.key === 'ArrowLeft') this.lightboxPrev();
                    if (e.key === 'ArrowRight') this.lightboxNext();
                }
            });
        }

        this.renderLightbox();
        lightbox.classList.add('active');

        // Inicializar zoom
        if (typeof initializePhotoZoom === 'function') {
            initializePhotoZoom();
        }

        // APLICAR ZOOM INICIAL (foto começa grande)
        setTimeout(() => {
            this.updateZoom();
        }, 100);
    }

    // ===== RENDER LIGHTBOX =====
    renderLightbox() {
        const lightbox = document.getElementById('photoLightbox');
        if (!lightbox || this.lightboxPhotos.length === 0) return;

        const item = this.lightboxPhotos[this.lightboxIndex];
        const originalUrl = this.getOriginalUrl(item);

        // ⭐ VERIFICAR SE JÁ EXISTE A ESTRUTURA
        let img = document.getElementById('lightbox-current-img');

        if (!img) {
            // ⭐ PRIMEIRA VEZ: CRIAR ESTRUTURA COMPLETA
            lightbox.innerHTML = `
                <div class="lightbox-content" style="padding: 0; max-width: 95vw; max-height: 95vh;">
                    <div class="lightbox-image-container" style="position: relative; display: flex; align-items: center; justify-content: center; min-height: 85vh;">
                        
                        <!-- BOTÃO CLOSE (EXTREMIDADE) -->
                        <button class="lightbox-close" onclick="adminSelections.closeLightbox()" style="position: absolute; top: -15px; right: -150px; z-index: 1001; width: 45px; height: 45px;">
                            <i class="fas fa-times"></i>
                        </button>
                        
                        <!-- BOTÕES DE ZOOM (EXTREMIDADE) -->
                        <div class="lightbox-zoom-controls" style="position: absolute; top: 60px; right: -150px; z-index: 1000; display: flex; flex-direction: column; gap: 8px;">
                            <button onclick="adminSelections.zoomIn()" style="width: 40px; height: 40px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #d4af37; border: 1px solid #d4af37; cursor: pointer; font-size: 18px;">+</button>
                            <button onclick="adminSelections.zoomOut()" style="width: 40px; height: 40px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #d4af37; border: 1px solid #d4af37; cursor: pointer; font-size: 18px;">−</button>
                            <button onclick="adminSelections.resetZoom()" style="width: 40px; height: 40px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #d4af37; border: 1px solid #d4af37; cursor: pointer; font-size: 14px;">↔</button>
                        </div>
                        
                        <!-- BOTÃO PREVIOUS (MAIS AFASTADO) -->
                        <button onclick="adminSelections.lightboxPrev()" id="lightbox-btn-prev" style="position: absolute; left: -150px; top: 50%; transform: translateY(-50%); width: 50px; height: 50px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #d4af37; border: 1px solid #d4af37; cursor: pointer; font-size: 24px; z-index: 100;">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        
                        <!-- BOTÃO NEXT (MAIS AFASTADO) -->
                        <button onclick="adminSelections.lightboxNext()" id="lightbox-btn-next" style="position: absolute; right: -150px; top: 50%; transform: translateY(-50%); width: 50px; height: 50px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #d4af37; border: 1px solid #d4af37; cursor: pointer; font-size: 24px; z-index: 100;">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        
                        <!-- LOADING -->
                        <div class="lightbox-loading" id="lightbox-spinner">
                            <div class="lightbox-spinner"></div>
                        </div>
                        
                        <!-- IMAGEM (MAIOR - 90vh) -->
                        <img src="${originalUrl}" alt="${item.fileName}" class="lightbox-image" id="lightbox-current-img" style="max-width: 90vw; max-height: 90vh; width: auto; height: auto; object-fit: contain;">
                    </div>
                    
                    <!-- INFO EMBAIXO (SEMPRE VISÍVEL) -->
                    <div class="lightbox-info" id="lightbox-info" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); text-align: center; padding: 10px 20px; background: rgba(0,0,0,0.8); border-radius: 8px; z-index: 1000;">
                        <div class="lightbox-filename" id="lightbox-filename" style="color: #d4af37; font-weight: bold;">${item.fileName}</div>
                        <div class="lightbox-meta" style="color: #fff; margin-top: 5px;">
                            <span id="lightbox-price">${item.price > 0 ? '$' + item.price.toFixed(2) : '-'}</span>
                            <span>•</span>
                            <span id="lightbox-counter">${this.lightboxIndex + 1} / ${this.lightboxPhotos.length}</span>
                        </div>
                    </div>
                </div>
            `;
            img = document.getElementById('lightbox-current-img');
        } else {
            // ⭐ JÁ EXISTE: SÓ ATUALIZAR CONTEÚDO
            const spinner = document.getElementById('lightbox-spinner');
            const filename = document.getElementById('lightbox-filename');
            const price = document.getElementById('lightbox-price');
            const counter = document.getElementById('lightbox-counter');

            // Mostrar spinner
            if (spinner) spinner.style.display = 'block';

            // Remover classe loaded da imagem
            img.classList.remove('loaded');

            // Atualizar informações
            if (filename) filename.textContent = item.fileName;
            if (price) price.textContent = item.price > 0 ? '$' + item.price.toFixed(2) : '-';
            if (counter) counter.textContent = `${this.lightboxIndex + 1} / ${this.lightboxPhotos.length}`;

            // Trocar imagem
            img.src = originalUrl;
            img.alt = item.fileName;
        }

        // ⭐ ATUALIZAR BOTÕES (habilitar/desabilitar)
        const btnPrev = document.getElementById('lightbox-btn-prev');
        const btnNext = document.getElementById('lightbox-btn-next');
        if (btnPrev) btnPrev.disabled = (this.lightboxIndex === 0);
        if (btnNext) btnNext.disabled = (this.lightboxIndex === this.lightboxPhotos.length - 1);

        // ⭐ EVENTO QUANDO IMAGEM CARREGAR
        const spinner = document.getElementById('lightbox-spinner');

        img.onload = function () {
            if (spinner) spinner.style.display = 'none';
            img.classList.add('loaded');

            // ⭐ PRÉ-CARREGAR PRÓXIMA IMAGEM
            adminSelections.preloadNextImage();
        };

        // Se já está em cache
        if (img.complete) {
            if (spinner) spinner.style.display = 'none';
            img.classList.add('loaded');
        }
    }

    // ===== PRELOAD NEXT IMAGE (carregar próxima em background) =====
    preloadNextImage() {
        // Verificar se existe próxima foto
        if (this.lightboxIndex >= this.lightboxPhotos.length - 1) {
            return; // Já é a última foto
        }

        // Pegar próxima foto
        const nextItem = this.lightboxPhotos[this.lightboxIndex + 1];
        const nextUrl = this.getOriginalUrl(nextItem);

        // Criar objeto Image para pré-carregar
        const preloadImg = new Image();
        preloadImg.src = nextUrl;

        // Browser automaticamente baixa e coloca em cache!
        console.log('🚀 Pré-carregando próxima imagem:', nextItem.fileName);
    }

    // ===== CLOSE LIGHTBOX =====
    closeLightbox() {
        const lightbox = document.getElementById('photoLightbox');
        if (lightbox) {
            this.resetZoom();  // ← ADICIONAR: Reset zoom ao fechar
            lightbox.classList.remove('active');
        }
    }

    // ===== ZOOM IN =====
    zoomIn() {
        this.zoomState.scale = Math.min(3, this.zoomState.scale + 0.5);
        this.updateZoom();
    }

    // ===== ZOOM OUT =====
    zoomOut() {
        this.zoomState.scale = Math.max(1.5, this.zoomState.scale - 0.5);  // ← MUDOU de 0.8 para 1.5
        this.updateZoom();
    }

    // ===== RESET ZOOM =====
    resetZoom() {
        this.zoomState.scale = 1.5;  // ← MUDOU de 1 para 1.5
        this.zoomState.panX = 0;
        this.zoomState.panY = 0;
        this.hdLoaded = false;  // ← ADICIONAR (limpar flag HD)
        this.updateZoom();
    }

    // ===== UPDATE ZOOM =====
    updateZoom() {
        const img = document.getElementById('lightbox-current-img');
        if (!img) return;

        img.style.transform = `scale(${this.zoomState.scale}) translate(${this.zoomState.panX}px, ${this.zoomState.panY}px)`;
        img.style.transition = 'transform 0.3s ease';
        img.style.cursor = this.zoomState.scale > 1 ? 'grab' : 'default';

        // Carregar HD quando zoom > 1.5x
        if (this.zoomState.scale >= 1.5 && !this.hdLoaded) {
            this.loadHDImage();
        }

        console.log('🔍 Zoom:', this.zoomState.scale);
    }

    // ===== LOAD HD IMAGE =====
    loadHDImage() {
        this.hdLoaded = true; // Marcar como carregada (evita recarregar)

        const img = document.getElementById('lightbox-current-img');
        if (!img) return;

        const currentItem = this.lightboxPhotos[this.lightboxIndex];
        const hdUrl = this.getOriginalUrl(currentItem);

        console.log('🔍 Zoom 1.5x+! Carregando HD:', hdUrl);

        // Carregar em background
        const tempImg = new Image();
        tempImg.onload = () => {
            // Trocar para HD
            img.src = hdUrl;
            console.log('✅ HD carregada!');
        };

        tempImg.onerror = () => {
            console.error('❌ Erro ao carregar HD');
        };

        tempImg.src = hdUrl;
    }

    // ===== LIGHTBOX PREVIOUS =====
    lightboxPrev() {
        if (this.lightboxIndex > 0) {
            this.lightboxIndex--;
            this.resetZoom();  // ← ADICIONAR: Reset zoom
            this.renderLightbox();
            setTimeout(() => this.updateZoom(), 100);  // ← ADICIONAR: Aplicar 1.5x
        }
    }

    // ===== LIGHTBOX NEXT =====
    lightboxNext() {
        if (this.lightboxIndex < this.lightboxPhotos.length - 1) {
            this.lightboxIndex++;
            this.resetZoom();  // ← ADICIONAR: Reset zoom
            this.renderLightbox();
            setTimeout(() => this.updateZoom(), 100);  // ← ADICIONAR: Aplicar 1.5x
        }
    }

    confirmWithCheckbox(title, message, checkboxLabel, action) {
        return new Promise((resolve) => {
            const modalId = 'confirm-checkbox-' + Date.now();
            const modal = document.createElement('div');
            modal.className = 'ui-modal-backdrop';
            modal.id = modalId;

            // Mostrar checkbox de download apenas para approve
            const showDownloadCheckbox = action === 'approve';

            modal.innerHTML = `
                <div class="ui-modal">
                    <div class="ui-modal-header">
                        <span class="modal-icon">⚠️</span>
                        <h3>${title}</h3>
                        <button class="modal-close" id="btnClose_${modalId}">✕</button>
                    </div>
                    <div class="ui-modal-body">
                        <p class="confirm-message">${message}</p>
                        
                        <div style="margin-top: 20px; padding: 12px; background: rgba(23, 162, 184, 0.1); border-radius: 4px; border-left: 3px solid #17a2b8;">
                            <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px; font-weight: 500;">
                                <input 
                                    type="checkbox" 
                                    id="restoreAccessCheckbox_${modalId}"
                                    checked
                                    style="width: 18px; height: 18px; margin-right: 10px; cursor: pointer;"
                                />
                                <span>
                                    <i class="fas fa-unlock-alt" style="margin-right: 6px; color: #17a2b8;"></i>
                                    ${checkboxLabel}
                                </span>
                            </label>
                            <p style="margin: 8px 0 0 28px; font-size: 13px; opacity: 0.7;">
                                Enable client login and system access again
                            </p>
                        </div>

                        ${showDownloadCheckbox ? `
                        <div style="margin-top: 15px; padding: 12px; background: rgba(212, 175, 55, 0.1); border-radius: 4px; border-left: 3px solid #D4AF37;">
                            <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px; font-weight: 500;">
                                <input 
                                    type="checkbox" 
                                    id="sendDownloadLinkCheckbox_${modalId}"
                                    style="width: 18px; height: 18px; margin-right: 10px; cursor: pointer;"
                                />
                                <span>
                                    <i class="fas fa-paper-plane" style="margin-right: 6px; color: #D4AF37;"></i>
                                    Send download link to client
                                </span>
                            </label>
                            <p style="margin: 8px 0 0 28px; font-size: 13px; opacity: 0.7;">
                                Client will receive an email with a link to download their photos
                            </p>
                        </div>
                        ` : ''}
                    </div>
                    <div class="ui-modal-footer">
                        <button class="btn-secondary" id="btnCancel_${modalId}">
                            Cancel
                        </button>
                        <button class="btn-primary" id="btnConfirm_${modalId}">
                            Confirm
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Event listeners
            const checkbox = modal.querySelector(`#restoreAccessCheckbox_${modalId}`);
            const downloadCheckbox = modal.querySelector(`#sendDownloadLinkCheckbox_${modalId}`);
            const btnClose = modal.querySelector(`#btnClose_${modalId}`);
            const btnCancel = modal.querySelector(`#btnCancel_${modalId}`);
            const btnConfirm = modal.querySelector(`#btnConfirm_${modalId}`);

            const cleanup = () => {
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            };

            const handleCancel = () => {
                cleanup();
                resolve({ confirmed: false, restoreAccess: false, sendDownloadLink: false });
            };

            const handleConfirm = () => {
                const restoreAccess = checkbox.checked;
                const sendDownloadLink = downloadCheckbox ? downloadCheckbox.checked : false;
                cleanup();
                resolve({ confirmed: true, restoreAccess, sendDownloadLink });
            };

            btnClose.onclick = handleCancel;
            btnCancel.onclick = handleCancel;
            btnConfirm.onclick = handleConfirm;

            // ESC para cancelar
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve({ confirmed: false, restoreAccess: false, sendDownloadLink: false });
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    }

    // ===== HELPER: TOGGLE CLIENT ACCESS =====
    async toggleClientAccess(clientCode, isActive) {
        try {
            console.log(`🔑 ${isActive ? 'Activating' : 'Deactivating'} access for client ${clientCode}...`);

            // Tentar usar o CODE diretamente no endpoint de toggle
            const toggleResponse = await fetch(`/api/admin/access-codes/${clientCode}/toggle`, {
                method: 'PATCH',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ isActive })
            });

            const toggleData = await toggleResponse.json();

            if (!toggleData.success) {
                throw new Error(toggleData.message || 'Failed to toggle access');
            }

            console.log(`✅ Client access ${isActive ? 'restored' : 'disabled'} successfully`);
            UISystem.showToast('success', `Client ${clientCode} access ${isActive ? 'restored' : 'disabled'}`);
            return true;

        } catch (error) {
            console.error('❌ Error toggling client access:', error);
            UISystem.showToast('warning', `Could not ${isActive ? 'restore' : 'disable'} client access: ${error.message}`);
            return false;
        }
    }

    // ===== APPROVE SELECTION =====
    async approveSelection(selectionId) {
        // ✅ BUSCAR clientCode PRIMEIRO
        let clientCode = null;
        try {
            const selectionResponse = await fetch(`/api/selections/${selectionId}`, {
                headers: this.getAuthHeaders()
            });
            const selectionData = await selectionResponse.json();
            clientCode = selectionData.selection?.clientCode;
        } catch (error) {
            console.warn('Could not fetch clientCode:', error);
        }

        // ✅ MODAL COM CHECKBOX
        const result = await this.confirmWithCheckbox(
            'Confirmation Required',
            'Approve this selection? This will mark all photos as SOLD and finalize the transaction.',
            'Restore client access',
            'approve'
        );

        if (!result.confirmed) return;

        // Encontrar a linha na tabela
        const row = document.querySelector(`tr[data-selection-id="${selectionId}"]`);
        if (!row) {
            console.error('Row not found for selection:', selectionId);
            UISystem.showToast('error', 'Could not find selection in table');
            return;
        }

        // Atualizar status visual para "APPROVING..."
        const statusCell = row.querySelector('td:nth-child(5)');
        const originalStatus = statusCell ? statusCell.innerHTML : '';

        if (statusCell) {
            statusCell.innerHTML = `
                <span class="badge badge-approving">
                    <span class="spinner-inline"></span>
                    APPROVING...
                </span>
            `;
        }

        // Esconder botões durante processamento
        const actionsCell = row.querySelector('td:last-child');
        const originalActions = actionsCell ? actionsCell.innerHTML : '';

        if (actionsCell) {
            actionsCell.innerHTML = `
                <div style="text-align: center;">
                    <span style="color: #28a745; font-size: 20px;">🔒</span>
                    <br>
                    <small style="color: #999;">Locked</small>
                </div>
            `;
        }

        try {
            // 1. Aprovar seleção
            const response = await fetch(`/api/selections/${selectionId}/approve`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin',
                    notes: ''
                })
            });

            const approveResult = await response.json();

            if (!response.ok) {
                throw new Error(approveResult.message || 'Failed to approve');
            }

            // ✅ BUSCAR clientCode do BACKEND (não da tabela!)
            const selectionResponse = await fetch(`/api/selections/${selectionId}`, {
                headers: this.getAuthHeaders()
            });
            const selectionData = await selectionResponse.json();
            const clientCode = selectionData.selection?.clientCode;

            console.log('✅ Selection approved! ClientCode:', clientCode);

            // ✅ Restaurar acesso se checkbox marcado
            if (result.restoreAccess && clientCode) {
                console.log('🔓 Restoring client access...');
                await this.toggleClientAccess(clientCode, true);
            }

            // ✅ Enviar link de download se checkbox marcado
            if (result.sendDownloadLink) {
                console.log('📧 Sending download link to client...');
                try {
                    const emailResponse = await fetch(`/api/selections/${selectionId}/send-download-link`, {
                        method: 'POST',
                        headers: this.getAuthHeaders(),
                        body: JSON.stringify({})
                    });
                    const emailResult = await emailResponse.json();

                    if (emailResult.success) {
                        UISystem.showToast('success', `Download link sent to ${emailResult.sentTo}`);
                    } else if (emailResult.needsEmail) {
                        UISystem.showToast('warning', 'Client has no email. Use "Send Download Link" button to provide one.');
                    } else {
                        UISystem.showToast('warning', 'Could not send download link: ' + emailResult.message);
                    }
                } catch (emailError) {
                    console.error('Error sending download link:', emailError);
                    UISystem.showToast('warning', 'Approved but could not send download link');
                }
            }

            UISystem.showToast('success', 'Selection approved successfully! Products marked as SOLD.');
            // Recarregar tabela após 2 segundos
            setTimeout(() => {
                this.loadSelections();
                this.loadStatistics();
            }, 2000);

        } catch (error) {
            console.error('Error approving:', error);
            UISystem.showToast('error', `Error approving selection: ${error.message}`);

            // Reverter status visual em caso de erro
            if (statusCell) {
                statusCell.innerHTML = originalStatus;
            }
            if (actionsCell) {
                actionsCell.innerHTML = originalActions;
            }
        }
    }

    async cancelSelection(selectionId) {
        // ✅ BUSCAR clientCode PRIMEIRO
        let clientCode = null;
        try {
            const selectionResponse = await fetch(`/api/selections/${selectionId}`, {
                headers: this.getAuthHeaders()
            });
            const selectionData = await selectionResponse.json();
            clientCode = selectionData.selection?.clientCode;
        } catch (error) {
            console.warn('Could not fetch clientCode:', error);
        }

        // ✅ MODAL COM CHECKBOX
        const result = await this.confirmWithCheckbox(
            'Confirmation Required',
            'Cancel this selection? All photos will be released and marked as available again.',
            'Restore client access',
            'cancel'
        );

        if (!result.confirmed) return;

        // Encontrar a linha na tabela
        const row = document.querySelector(`tr[data-selection-id="${selectionId}"]`);
        if (!row) {
            console.error('Row not found for selection:', selectionId);
            UISystem.showToast('error', 'Could not find selection in table');
            return;
        }

        // Atualizar status visual para "CANCELLING..."
        const statusCell = row.querySelector('td:nth-child(5)');
        const originalStatus = statusCell ? statusCell.innerHTML : '';

        if (statusCell) {
            statusCell.innerHTML = `
                <span class="badge badge-cancelling">
                    <span class="spinner-inline"></span>
                    CANCELLING...
                </span>
            `;
        }

        // Esconder botões durante processamento
        const actionsCell = row.querySelector('td:last-child');
        const originalActions = actionsCell ? actionsCell.innerHTML : '';

        if (actionsCell) {
            actionsCell.innerHTML = `
                <div style="text-align: center;">
                    <span style="color: #dc3545; font-size: 20px;">🔒</span>
                    <br>
                    <small style="color: #999;">Locked</small>
                </div>
            `;
        }

        try {
            // 1. Cancelar seleção
            const response = await fetch(`/api/selections/${selectionId}/cancel`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin',
                    reason: 'Cancelled by admin'
                })
            });

            const cancelResult = await response.json();

            if (!response.ok) {
                throw new Error(cancelResult.message || 'Failed to cancel');
            }

            // ✅ Restaurar acesso se checkbox marcado
            if (result.restoreAccess && clientCode) {
                console.log('🔓 Restoring client access...');
                await this.toggleClientAccess(clientCode, true);
            }

            UISystem.showToast('success', 'Selection cancelled successfully!');

            // Recarregar tabela após 2 segundos
            setTimeout(() => {
                this.loadSelections();
                this.loadStatistics();
            }, 2000);

        } catch (error) {
            console.error('Error cancelling:', error);
            UISystem.showToast('error', `Error cancelling selection: ${error.message}`);

            // Reverter status visual em caso de erro
            if (statusCell) {
                statusCell.innerHTML = originalStatus;
            }
            if (actionsCell) {
                actionsCell.innerHTML = originalActions;
            }
        }
    }

    async cancelSoldSelection(selectionId) {
        const confirmed = await UISystem.confirm(
            'Cancel this SOLD selection?',
            'This will release ALL photos back to available status. The sale will be reversed. Are you sure?'
        );

        if (!confirmed) return;

        const row = document.querySelector(`tr[data-selection-id="${selectionId}"]`);
        if (!row) {
            console.error('Row not found for selection:', selectionId);
            UISystem.showToast('error', 'Could not find selection in table');
            return;
        }

        const statusCell = row.querySelector('td:nth-child(6)');
        const originalStatus = statusCell ? statusCell.innerHTML : '';

        if (statusCell) {
            statusCell.innerHTML = `
                <span class="badge badge-cancelling">
                    <span class="spinner-inline"></span>
                    REVERSING...
                </span>
            `;
        }

        const actionsCell = row.querySelector('td:last-child');
        const originalActions = actionsCell ? actionsCell.innerHTML : '';

        if (actionsCell) {
            actionsCell.innerHTML = `
                <div style="text-align: center;">
                    <span style="color: #dc3545; font-size: 20px;">🔒</span>
                    <br>
                    <small style="color: #999;">Processing</small>
                </div>
            `;
        }

        try {
            const response = await fetch(`/api/selections/${selectionId}/cancel`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin',
                    reason: 'Sale cancelled - photos released'
                })
            });

            if (response.ok) {
                UISystem.showToast('success', 'Sale cancelled! All photos released to available.');
                setTimeout(() => {
                    this.loadSelections();
                    this.loadStatistics(); // ADICIONE ESTA LINHA
                }, 2000);
            } else {
                throw new Error('Failed to cancel sale');
            }
        } catch (error) {
            console.error('Error cancelling sold selection:', error);
            UISystem.showToast('error', 'Error cancelling selection');

            if (statusCell) {
                statusCell.innerHTML = originalStatus;
            }
            if (actionsCell) {
                actionsCell.innerHTML = originalActions;
            }
        }
    }

    // ===== FORCE CANCEL SELECTION =====
    async forceCancelSelection(selectionId) {
        try {
            const warningMessage = `⚠️ FORCE CANCELLATION ⚠️\n\nYou are about to force cancel selection ${selectionId}.\n\nThis operation will:\n• Revert photos from SYSTEM_SOLD to original folders\n• Mark products as available\n• Change status to "cancelled"\n\n🚨 THIS ACTION IS IRREVERSIBLE! 🚨\n\nDo you want to continue?`;

            if (!confirm(warningMessage)) {
                return;
            }

            const confirmText = prompt(`To confirm force cancellation, type exactly:\n\nCONFIRM FORCE CANCELLATION`);

            if (confirmText !== 'CONFIRM FORCE CANCELLATION') {
                this.showNotification('Incorrect confirmation text. Cancellation aborted.', 'warning');
                return;
            }

            const reason = prompt('Reason for force cancellation (required):');

            if (!reason || reason.trim() === '') {
                this.showNotification('Reason for cancellation is required', 'warning');
                return;
            }

            this.setLoading(true);
            console.log(`🚨 Force cancelling: ${selectionId}`);

            const response = await fetch(`/api/selections/${selectionId}/force-cancel`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin',
                    reason: reason.trim(),
                    confirmText: 'CONFIRM FORCE CANCELLATION'
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Error in force cancellation');
            }

            if (result.success) {
                const reversion = result.reversion;
                const successMessage = `✅ Force cancellation executed!\n\n📊 Reversion: ${reversion.successful}/${reversion.total} photos reverted\n\n⚠️ ${result.warning}`;

                this.showNotification(successMessage, 'success');
                await this.refreshData();

                console.log('🔄 Photos reverted (forced):', reversion);

                if (reversion.failed > 0) {
                    const failureDetails = reversion.details
                        .filter(d => !d.success)
                        .map(d => `• ${d.fileName}: ${d.error}`)
                        .join('\n');

                    this.showNotification(`⚠️ ${reversion.failed} photos had issues:\n\n${failureDetails}`, 'warning');
                }
            } else {
                throw new Error(result.message || 'Unknown error in force cancellation');
            }

        } catch (error) {
            console.error('❌ Error in force cancellation:', error);
            this.showNotification(`Error in force cancellation: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // ===== APPLY FILTERS =====
    applyFilters() {
        console.log('🔍 Applying filters:', this.currentFilters);
        this.currentPage = 1;
        this.loadSelections();
    }

    // ===== UTILITY METHODS =====
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatCurrency(value) {
        if (typeof value !== 'number') return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    // ===== LOADING STATE =====
    setLoading(isLoading) {
        this.isLoading = isLoading;

        // Disable action buttons during loading
        const actionButtons = document.querySelectorAll('.btn-action');
        actionButtons.forEach(btn => {
            btn.disabled = isLoading;
            if (isLoading) {
                btn.style.opacity = '0.6';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });

        // Show/hide global loading indicator
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.classList.toggle('hidden', !isLoading);
        }
    }

    // ===== NOTIFICATIONS =====
    showNotification(message, type = 'info') {
        // ✅ Sempre usar toast próprio (evita alert nativo do browser)
        this.showToast(message, type);
    }

    // ✅ Toast notification independente (não depende de app.js)
    showToast(message, type = 'info') {
        // Criar container se não existir
        let container = document.getElementById('admin-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'admin-toast-container';
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column-reverse;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        // Cores por tipo
        const colors = {
            success: { bg: '#10b981', icon: '✓' },
            error: { bg: '#ef4444', icon: '✕' },
            warning: { bg: '#f59e0b', icon: '⚠' },
            info: { bg: '#3b82f6', icon: 'ℹ' }
        };
        const config = colors[type] || colors.info;

        // Criar toast
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${config.bg};
            color: white;
            padding: 14px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            font-weight: 500;
            pointer-events: auto;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        `;
        toast.innerHTML = `
            <span style="font-size: 18px;">${config.icon}</span>
            <span>${message}</span>
        `;

        // Adicionar animação CSS se não existir
        if (!document.getElementById('toast-animation-style')) {
            const style = document.createElement('style');
            style.id = 'toast-animation-style';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateY(0); opacity: 1; }
                    to { transform: translateY(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        container.appendChild(toast);

        // Remover após 4 segundos
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ===== REVERT SOLD TO AVAILABLE =====
    async revertSold(selectionId) {
        const confirmed = await UISystem.confirm(
            'Revert Sold Items?',
            'This will make all photos available again. Are you sure?'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/selections/${selectionId}/revert-sold`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin',
                    reason: 'Manual revert'
                })
            });

            if (response.ok) {
                UISystem.showToast('success', 'Photos reverted to available!');
                setTimeout(() => {
                    this.loadSelections();
                    this.loadStatistics();
                }, 2000);
            } else {
                throw new Error('Failed to revert');
            }
        } catch (error) {
            console.error('Error reverting:', error);
            UISystem.showToast('error', 'Error reverting selection');
        }
    }

    // ===== ERROR HANDLING =====
    showTableError(message) {
        const tableBody = document.getElementById('selectionsTableBody');
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${message}
                </td>
            </tr>
        `;
    }

    // Buscar QB para uma categoria específica
    async getQBForCategory(category) {
        // Limpar categoria (remover barra final)
        const cleanCategory = category.replace(/\/$/, '');
        const qbMap = await this.fetchQBItems([cleanCategory, category]);

        // Tentar com e sem barra
        return qbMap[category] || qbMap[cleanCategory] || null;
    }

    // ===== HELPER FUNCTION - QUEBRAR TEXTO =====
    wrapText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;

        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            if ((currentLine + word).length <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });

        if (currentLine) lines.push(currentLine);
        return lines.join('\n');
    }

    // ===== HELPER FUNCTIONS =====
    formatDateForExcel(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'Data inválida';
            }
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Data não disponível';
        }
    }

    formatDateForFileName(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'unknown-date';
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            return 'unknown-date';
        }
    }

    // ===== PRINT FUNCTION =====
    printSelection(selectionId) {
        const modal = document.getElementById('selectionDetailsModal');
        if (!modal) return;

        const printWindow = window.open('', '_blank');
        const modalContent = modal.querySelector('.selection-details-body').innerHTML;

        printWindow.document.write(`
            <html>
            <head>
                <title>Selection Details - ${selectionId}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .selection-details-container { max-width: 800px; }
                    .selection-info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
                    .info-item { padding: 10px; border: 1px solid #ddd; }
                    .info-item label { font-weight: bold; }
                    .category-group { margin-bottom: 15px; }
                    .category-header { background: #f5f5f5; padding: 10px; font-weight: bold; }
                    .item-row { padding: 5px 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
                    .totals-section { margin-top: 20px; border-top: 2px solid #333; padding-top: 10px; }
                    .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
                    .total-final { font-weight: bold; font-size: 1.2em; }
                </style>
            </head>
            <body>
                <h1>SUNSHINE COWHIDES - Selection Details</h1>
                ${modalContent}
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.print();
    }

    // ===== DELETE SELECTION =====
    async deleteSelection(selectionId) {
        const confirmed = await UISystem.confirm(
            'Delete Selection?',
            'This will permanently delete this selection. This action cannot be undone.'
        );

        if (!confirmed) return;

        try {
            this.setLoading(true);
            console.log(`🗑️ Deleting selection: ${selectionId}`);

            const response = await fetch(`/api/selections/${selectionId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to delete selection');
            }

            if (result.success) {
                // Remover da tabela imediatamente
                const row = document.querySelector(`tr[data-selection-id="${selectionId}"]`);
                if (row) {
                    row.style.opacity = '0.3';
                    setTimeout(() => row.remove(), 500);
                }

                // Recarregar lista
                setTimeout(() => {
                    this.loadSelections();
                    this.loadStatistics();
                }, 1000);
            }

        } catch (error) {
            console.error('❌ Error deleting selection:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // ===== MODAL PARA PO NUMBER =====
    createPONumberModal() {
        if (document.getElementById('poNumberModal')) {
            return;
        }

        const modalHTML = `
            <div id="poNumberModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 99999; display: none; align-items: center; justify-content: center;">
                <div style="background: #2a2a2a; border-radius: 12px; max-width: 450px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid #444;">
                    <div style="padding: 16px 20px; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; color: #daa520; font-size: 16px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-file-excel"></i>
                            CDE Export - PO Number
                        </h3>
                        <button class="po-modal-close-btn" style="background: none; border: none; color: #999; font-size: 20px; cursor: pointer; padding: 0; line-height: 1;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div style="padding: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #eee;">
                            Enter CDE PO Number:
                        </label>
                        <input
                            type="text"
                            id="cdePoNumber"
                            placeholder="Ex: PO-2025-001"
                            style="width: 100%; padding: 10px 12px; font-size: 14px; border: 1px solid #555; border-radius: 6px; background: #1a1a1a; color: #fff; box-sizing: border-box;"
                        >
                        <small style="color: #888; display: block; margin-top: 8px; font-size: 12px;">
                            This will be used in the PO. Number column for CDE import
                        </small>
                        <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                            <button
                                class="po-modal-cancel-btn"
                                style="padding: 8px 16px; background: #555; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                Cancel
                            </button>
                            <button
                                id="confirmPONumber"
                                style="padding: 8px 20px; background: #daa520; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                                Generate Excel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // ✅ Adicionar event listeners para fechar e desbloquear scroll
        const modal = document.getElementById('poNumberModal');

        // Fechar ao clicar no backdrop
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.classList.remove('modal-open');
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        });

        // Fechar ao clicar no botão X
        const closeBtn = modal.querySelector('.po-modal-close-btn');
        closeBtn.addEventListener('click', () => {
            document.body.classList.remove('modal-open');
            modal.classList.remove('active');
            modal.style.display = 'none';
        });

        // Fechar ao clicar no botão Cancel
        const cancelBtn = modal.querySelector('.po-modal-cancel-btn');
        cancelBtn.addEventListener('click', () => {
            document.body.classList.remove('modal-open');
            modal.classList.remove('active');
            modal.style.display = 'none';
        });
    }

    // ===== ABRIR MODAL DO PO NUMBER =====
    async openPONumberModal(selectionId) {
        // Criar modal se não existir
        this.createPONumberModal();

        // Buscar dados da seleção primeiro
        const response = await fetch(`/api/selections/${selectionId}`, {
            headers: this.getAuthHeaders()
        });
        const data = await response.json();

        if (!data.success) {
            this.showNotification('Erro ao carregar dados da seleção', 'error');
            return;
        }

        const selection = data.selection;

        // Mostrar modal
        const modal = document.getElementById('poNumberModal');
        modal.classList.add('active');
        modal.style.display = 'flex';

        // ✅ Bloquear scroll do body - INLINE para forçar
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.top = `-${window.scrollY}px`;

        // Limpar campo
        document.getElementById('cdePoNumber').value = '';

        // Focar no input
        setTimeout(() => {
            document.getElementById('cdePoNumber').focus();
        }, 100);

        // Configurar botão de confirmar
        const confirmBtn = document.getElementById('confirmPONumber');

        // Remover listener anterior se existir
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        // Adicionar novo listener
        newConfirmBtn.addEventListener('click', () => {
            const poNumber = document.getElementById('cdePoNumber').value.trim();

            if (!poNumber) {
                this.showNotification('Please enter a PO Number', 'warning');
                document.getElementById('cdePoNumber').focus();
                return;
            }

            // ✅ Desbloquear scroll do body
            const scrollY = document.body.style.top;
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);

            // Fechar modal
            modal.classList.remove('active');
            modal.style.display = 'none';

            // Gerar Excel com o PO Number
            this.generateExcelFile(selection, poNumber);
        });
    }


    async generateExcelFile(selection, poNumber) {
        try {
            console.log('Gerando Excel com PO:', poNumber);

            // ✅ Usar company direto da seleção (já vem da API)
            let companyName = 'NO COMPANY';

            if (selection.clientCompany && selection.clientCompany.trim() !== '' && selection.clientCompany !== '-') {
                companyName = selection.clientCompany;
                console.log('✅ Company encontrada na seleção:', companyName);
            } else {
                console.log('⚠️ Company não encontrada, usando: NO COMPANY');
                console.log('   selection.clientCompany =', selection.clientCompany);
            }

            // 🆕 FUNÇÃO PARA LIMPAR STRINGS PARA CSV/MYSQL (VERSÃO 3.0)
            const cleanForCSV = (text) => {
                if (!text) return '';

                return String(text)
                    // ===== ASPAS E ESCAPE =====
                    .replace(/"/g, '')           // Aspas duplas
                    .replace(/'/g, '')           // Aspas simples (problemático em SQL)
                    .replace(/`/g, '')           // Backticks
                    .replace(/\\/g, '')          // Backslash (escape character)

                    // ===== CARACTERES SQL/PHP PERIGOSOS =====
                    .replace(/;/g, '')           // Ponto-virgula (SQL injection)
                    .replace(/--/g, '-')         // SQL comment
                    .replace(/#/g, '')           // MySQL comment / PHP issue
                    .replace(/%/g, '')           // SQL wildcard / encoding
                    .replace(/&/g, 'and')        // HTML entity / URL encoding
                    .replace(/\$/g, '')          // PHP variable
                    .replace(/@/g, '')           // SQL variable

                    // ===== CARACTERES HTML/XML =====
                    .replace(/</g, '')           // HTML tag
                    .replace(/>/g, '')           // HTML tag
                    .replace(/\|/g, '-')         // Pipe

                    // ===== PONTUACAO ESPECIAL =====
                    .replace(/\./g, '')          // Pontos
                    .replace(/,/g, '-')          // Virgulas (quebram CSV)
                    .replace(/:/g, '-')          // Dois pontos
                    .replace(/\(/g, '')          // Parenteses
                    .replace(/\)/g, '')
                    .replace(/\[/g, '')          // Colchetes
                    .replace(/\]/g, '')
                    .replace(/\{/g, '')          // Chaves
                    .replace(/\}/g, '')

                    // ===== SETAS E SIMBOLOS UNICODE =====
                    .replace(/[►→➜➤⟶⇒]/g, ' ')   // Setas para espaco
                    .replace(/[•·°™®©]/g, '')    // Simbolos especiais

                    // ===== BARRAS - CONVERTER PARA ESPACO =====
                    .replace(/\s*\/\s*/g, ' ')   // Barras para espaco
                    .replace(/\s*\\\s*/g, ' ')   // Backslash para espaco

                    // ===== CARACTERES DE CONTROLE =====
                    .replace(/[\x00-\x1F\x7F]/g, '')  // ASCII control chars
                    .replace(/[\u2000-\u200F]/g, '') // Unicode spaces/controls
                    .replace(/[\uFEFF]/g, '')        // BOM

                    // ===== LIMPEZA FINAL =====
                    .replace(/\s+/g, ' ')        // Espacos multiplos
                    .replace(/-+/g, '-')         // Hifens multiplos
                    .replace(/^-/, '')           // Hifen inicial
                    .replace(/-$/, '')           // Hifen final
                    .trim();
            };

            // FORMATO CORRETO: NOMECLIENTE-CÓDIGO
            const clientNameFormatted = cleanForCSV(selection.clientName.toUpperCase().replace(/\s+/g, ''));
            const reservedusu = `${clientNameFormatted}-${selection.clientCode || '0000'}`;
            console.log('RESERVEDUSU será:', reservedusu);

            // ✅ SEPARAR FOTOS ÚNICAS de PRODUTOS DE CATÁLOGO
            const uniquePhotos = selection.items.filter(item => !item.isCatalogProduct);
            const catalogProducts = selection.items.filter(item => item.isCatalogProduct);

            console.log(`📷 Fotos únicas: ${uniquePhotos.length}`);
            console.log(`📦 Produtos de catálogo: ${catalogProducts.length}`);

            // ===== AGRUPAR FOTOS ÚNICAS POR CATEGORIA =====
            const qbGroups = {};
            for (const item of uniquePhotos) {
                const qbCode = await this.getQBForCategory(item.category) || 'NO-QB';

                if (!qbGroups[qbCode]) {
                    qbGroups[qbCode] = {
                        qbCode: qbCode,
                        categoryName: item.category,
                        items: [],
                        photoNumbers: [],
                        totalQty: 0,
                        unitPrice: 0,
                        totalAmount: 0
                    };
                }

                qbGroups[qbCode].items.push(item);
                qbGroups[qbCode].totalQty++;
                const itemPrice = item.price || 0;
                qbGroups[qbCode].totalAmount += itemPrice;

                // Adicionar número da foto APENAS para esta categoria
                const photoNumber = (item.fileName || '').replace(/\.(webp|jpg|jpeg|png)$/i, '');
                if (photoNumber) {
                    qbGroups[qbCode].photoNumbers.push(photoNumber);
                }
            }

            // Calcular preço médio para fotos
            Object.values(qbGroups).forEach(group => {
                if (group.totalQty > 0) {
                    group.unitPrice = group.totalAmount / group.totalQty;
                }
            });

            // Criar dados da planilha - FORMATO LIMPO SEM CARACTERES PROBLEMÁTICOS
            const excelData = [];

            // 🆕 LIMPAR COMPANY NAME E PO NUMBER UMA VEZ
            const cleanCompanyName = cleanForCSV(companyName);
            const cleanPoNumber = cleanForCSV(poNumber);

            // ===== 1. ADICIONAR FOTOS ÚNICAS (agrupadas por categoria) =====
            Object.values(qbGroups).forEach(group => {
                // String de fotos APENAS desta categoria
                const categoryPhotoNumbers = group.photoNumbers.join('-');

                // LIMPAR ITEM NAME
                let itemName = cleanForCSV(group.categoryName);
                const cleanQbCode = cleanForCSV(group.qbCode);

                console.log(`📷 Foto categoria: ${itemName} | QB: ${cleanQbCode} | Fotos: ${group.photoNumbers.length}`);

                excelData.push([
                    selection.clientName,    // Coluna 1: Nome do cliente
                    cleanPoNumber,           // Coluna 2: PO Number
                    cleanCompanyName,        // Coluna 3: Company
                    categoryPhotoNumbers,    // Coluna 4: Foto numbers
                    cleanQbCode,             // Coluna 5: QB Code
                    itemName,                // Coluna 6: Categoria
                    group.totalQty,          // Coluna 7: Quantidade
                    group.unitPrice.toFixed(2),    // Coluna 8: Preço unitário
                    group.totalAmount.toFixed(2)   // Coluna 9: Total
                ]);
            });

            // ===== 2. ADICIONAR PRODUTOS DE CATÁLOGO (cada um em sua própria linha) =====
            catalogProducts.forEach(item => {
                // Usar qbItem do próprio item (definido ao adicionar ao carrinho)
                const qbCode = cleanForCSV(item.qbItem || 'NO-QB');
                const productName = cleanForCSV(item.productName || item.fileName || 'Catalog Product');
                const quantity = item.quantity || 1;
                const unitPrice = item.unitPrice || item.price || 0;
                const totalAmount = unitPrice * quantity;

                console.log(`📦 Catálogo: ${productName} | QB: ${qbCode} | Qty: ${quantity} | $${unitPrice}`);

                excelData.push([
                    selection.clientName,    // Coluna 1: Nome do cliente
                    cleanPoNumber,           // Coluna 2: PO Number
                    cleanCompanyName,        // Coluna 3: Company
                    '',                      // Coluna 4: Vazio (sem foto number para catálogo)
                    qbCode,                  // Coluna 5: QB Code
                    productName,             // Coluna 6: Nome do produto
                    quantity,                // Coluna 7: Quantidade
                    unitPrice.toFixed(2),    // Coluna 8: Preço unitário
                    totalAmount.toFixed(2)   // Coluna 9: Total
                ]);
            });

            console.log(`✅ Total de linhas no CSV: ${excelData.length}`);

            // Criar workbook
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(excelData);

            // Configurar larguras
            worksheet['!cols'] = [
                { width: 30 },  // Customer
                { width: 20 },  // PO. Number
                { width: 25 },  // RESERVEDUSU
                { width: 100 }, // Photo.Number
                { width: 15 },  // ITEM REQ
                { width: 60 },  // ITEM NAME
                { width: 12 },  // ITEM QTY
                { width: 12 },  // RATE
                { width: 15 }   // AMOUNT
            ];

            // Adicionar sheet e salvar
            XLSX.utils.book_append_sheet(workbook, worksheet, 'CDE_Order');

            // Nome do arquivo
            const cleanFileName = cleanForCSV(`CDE_${poNumber}_${companyName}_${this.formatDateForFileName(selection.createdAt)}`);
            const fileName = `${cleanFileName}.csv`;

            // 🆕 SALVAR COMO CSV COM CONFIGURAÇÕES CORRETAS PARA MYSQL
            XLSX.writeFile(workbook, fileName, {
                bookType: 'csv',
                FS: ',',  // Field separator
                RS: '\n'  // Record separator
            });

            console.log(`✅ Excel gerado com PO: ${poNumber}`);
            console.log(`✅ RESERVEDUSU aplicado: ${reservedusu}`);
            console.log(`✅ Total de categorias: ${Object.keys(qbGroups).length}`);
            console.log(`✅ Arquivo limpo para import MySQL`);

            this.showNotification(`CDE spreadsheet downloaded - PO: ${poNumber}`, 'success');

        } catch (error) {
            console.error('Error generating Excel:', error);
            this.showNotification('Error generating spreadsheet: ' + error.message, 'error');
        }
    }

    // Função para gerenciar checkboxes
    initCheckboxListeners() {
        setTimeout(() => {
            const checkboxes = document.querySelectorAll('.item-checkbox');

            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    // Atualizar contador
                    this.updateRemoveButtonCount();

                    // Verificar se todos da categoria estão marcados
                    const category = checkbox.dataset.category;
                    const escapedCategory = category.replace(/['"\\]/g, '\\$&');
                    const categoryCheckboxes = document.querySelectorAll(`.item-checkbox[data-category="${escapedCategory}"]`);
                    const selectAllCheckbox = document.querySelector(`.category-select-all[data-category="${escapedCategory}"]`);

                    if (selectAllCheckbox) {
                        const allChecked = Array.from(categoryCheckboxes).every(cb => cb.checked);
                        const someChecked = Array.from(categoryCheckboxes).some(cb => cb.checked);

                        if (allChecked) {
                            selectAllCheckbox.checked = true;
                            selectAllCheckbox.indeterminate = false;
                        } else if (someChecked) {
                            selectAllCheckbox.checked = false;
                            selectAllCheckbox.indeterminate = true; // Estado intermediário
                        } else {
                            selectAllCheckbox.checked = false;
                            selectAllCheckbox.indeterminate = false;
                        }
                    }
                });
            });
        }, 500);
    }

    // Função para marcar/desmarcar todos os checkboxes de uma categoria (LEGACY - overlay antigo)
    toggleLegacyCategorySelection(selectAllCheckbox, category) {
        const isChecked = selectAllCheckbox.checked;
        // Escapar caracteres especiais na categoria para o seletor
        const escapedCategory = category.replace(/['"\\]/g, '\\$&');
        // Encontrar todos os checkboxes dessa categoria
        const categoryCheckboxes = document.querySelectorAll(`.item-checkbox[data-category="${escapedCategory}"]`);

        categoryCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
        });

        // Atualizar o contador do botão Remove Selected
        this.updateRemoveButtonCount();
    }

    // Função para atualizar o contador do botão
    updateRemoveButtonCount() {
        const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
        const removeBtn = document.querySelector('.btn-remove-selected');

        if (removeBtn) {
            if (checkedBoxes.length > 0) {
                removeBtn.style.display = 'inline-flex';
                const countSpan = removeBtn.querySelector('.selected-count');
                if (countSpan) {
                    countSpan.textContent = checkedBoxes.length;
                }
            } else {
                removeBtn.style.display = 'none';
            }
        }
    }

    // Função para remover items selecionados
    async removeSelectedItems(selectionId) {
        const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');

        if (checkedBoxes.length === 0) {
            this.showNotification('No items selected', 'warning');
            return;
        }

        // Coletar informações dos items selecionados
        const itemsToRemove = Array.from(checkedBoxes).map(checkbox => ({
            fileName: checkbox.dataset.filename,
            price: parseFloat(checkbox.dataset.price) || 0,
            category: checkbox.dataset.category
        }));

        const confirmMessage = itemsToRemove.length === 1
            ? 'Remove 1 selected item from this selection?'
            : `Remove ${itemsToRemove.length} selected items from this selection?`;

        const confirmed = await UISystem.confirm(
            'Remove Selected Items?',
            confirmMessage
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/selections/${selectionId}/remove-items`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ items: itemsToRemove })
            });

            const result = await response.json();

            if (result.success) {
                UISystem.showToast('success', `Successfully removed ${itemsToRemove.length} items`);

                // Recarregar o modal buscando dados completos
                await this.viewSelection(selectionId);

                // Recarregar a lista principal
                await this.loadSelections();
            } else {
                UISystem.showToast('error', result.message || 'Failed to remove items');
            }
        } catch (error) {
            console.error('Error removing items:', error);
            UISystem.showToast('error', 'Error removing items');
        }
    }

    // ===== REOPEN CART FOR CLIENT =====
    async reopenCart(selectionId) {
        const confirmed = await UISystem.confirm(
            'Reopen cart for client?',
            'This will allow the client to edit their selection. The current selection will be removed from this list and a new cart will be created with 24h expiration.'
        );

        if (!confirmed) return;

        // Encontrar a linha na tabela
        const row = document.querySelector(`tr[data-selection-id="${selectionId}"]`);

        // Atualizar visual para "REOPENING..."
        if (row) {
            const statusCell = row.querySelector('.status-cell');
            if (statusCell) {
                statusCell.innerHTML = `
                    <span class="badge badge-approving">
                        <span class="spinner-inline"></span>
                        REOPENING...
                    </span>
                `;
            }
        }

        try {
            const response = await fetch(`/api/selections/${selectionId}/reopen-cart`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin'
                })
            });

            const result = await response.json();

            if (result.success) {
                // Fazer a linha desaparecer com fade
                if (row) {
                    row.style.transition = 'opacity 0.5s';
                    row.style.opacity = '0';
                    setTimeout(() => row.remove(), 500);
                }

                UISystem.showToast('success', `Cart reopened! Client ${result.data.clientCode} can now edit their selection.`);

                // Recarregar lista após 2 segundos
                setTimeout(() => {
                    this.loadSelections();
                    this.loadStatistics();
                }, 2000);
            } else {
                throw new Error(result.message || 'Failed to reopen cart');
            }
        } catch (error) {
            console.error('Error reopening cart:', error);
            UISystem.showToast('error', `Error: ${error.message}`);

            // Recarregar em caso de erro
            this.loadSelections();
        }
    }

    // ===== DOWNLOAD SELECTION PHOTOS AS ZIP =====
    async downloadSelectionPhotos(selectionId) {
        // Encontrar a linha na tabela
        const row = document.querySelector(`tr[data-selection-id="${selectionId}"]`);
        let originalStatusHTML = '';

        try {
            console.log(`📥 Downloading photos for selection: ${selectionId}`);

            // Salvar status original e atualizar visual para "DOWNLOADING..."
            if (row) {
                const statusCell = row.querySelector('.status-cell');
                if (statusCell) {
                    originalStatusHTML = statusCell.innerHTML;
                    statusCell.innerHTML = `
                        <span class="badge badge-approving">
                            <span class="spinner-inline"></span>
                            DOWNLOADING...
                        </span>
                    `;
                }
            }

            // Mostrar toast
            UISystem.showToast('info', 'Preparing photos for download...');

            // Fazer download via backend COM autenticação
            const downloadUrl = `/api/selections/${selectionId}/download-zip`;

            const response = await fetch(downloadUrl, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            // Converter resposta para blob
            const blob = await response.blob();

            // Extrair nome do arquivo do header Content-Disposition
            const contentDisposition = response.headers.get('Content-Disposition');
            let fileName = 'selection.zip';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match) fileName = match[1];
            }

            // Criar URL temporária e fazer download
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Limpar URL temporária
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

            // Restaurar status original
            if (row && originalStatusHTML) {
                const statusCell = row.querySelector('.status-cell');
                if (statusCell) {
                    statusCell.innerHTML = originalStatusHTML;
                }
            }

            UISystem.showToast('success', 'ZIP downloaded successfully!');
            console.log(`✅ Download completed: ${fileName}`);

        } catch (error) {
            console.error('❌ Error downloading photos:', error);

            // Restaurar status original em caso de erro
            if (row && originalStatusHTML) {
                const statusCell = row.querySelector('.status-cell');
                if (statusCell) {
                    statusCell.innerHTML = originalStatusHTML;
                }
            }

            UISystem.showToast('error', `Error downloading photos: ${error.message}`);
        }
    }

    // ===== SEND DOWNLOAD LINK TO CLIENT =====
    async sendDownloadLink(selectionId) {
        try {
            // Buscar dados da seleção primeiro
            const selectionResponse = await fetch(`/api/selections/${selectionId}`, {
                headers: this.getAuthHeaders()
            });
            const selectionData = await selectionResponse.json();
            const selection = selectionData.selection;

            // Show styled confirmation modal before sending
            const confirmed = await this.showDownloadLinkConfirmModal(selection);
            if (!confirmed) return;

            // Mostrar loading
            UISystem.showToast('info', 'Checking email...');

            // Tentar enviar primeiro - backend vai buscar email no AccessCode se necessário
            const response = await fetch(`/api/selections/${selectionId}/send-download-link`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({})
            });

            const result = await response.json();

            // Se backend não encontrou email em lugar nenhum, pedir ao usuário
            if (result.needsEmail) {
                const emailTo = prompt(`No email found for ${selection?.clientName || 'this client'}.\n\nPlease enter the email address:`);

                if (!emailTo) {
                    UISystem.showToast('info', 'Cancelled - no email provided');
                    return;
                }

                // Validar formato básico de email
                if (!emailTo.includes('@') || !emailTo.includes('.')) {
                    UISystem.showToast('error', 'Invalid email format');
                    return;
                }

                // Confirmar envio
                const confirmed = await UISystem.confirm(
                    'Send Download Link',
                    `Send download link to:\n\n📧 ${emailTo}\n\nThe client will receive an email with a link to download their ${selection?.totalItems || ''} photos.`
                );

                if (!confirmed) return;

                // Mostrar loading
                UISystem.showToast('info', 'Sending download link...');

                // Enviar com email manual
                const retryResponse = await fetch(`/api/selections/${selectionId}/send-download-link`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ customEmail: emailTo })
                });

                const retryResult = await retryResponse.json();

                if (retryResult.success) {
                    UISystem.showToast('success', `✅ Download link sent to ${retryResult.sentTo}`);
                } else {
                    UISystem.showToast('error', `Failed: ${retryResult.message}`);
                }
                return;
            }

            // Sucesso na primeira tentativa (backend encontrou email)
            if (result.success) {
                UISystem.showToast('success', `✅ Download link sent to ${result.sentTo}`);
            } else {
                UISystem.showToast('error', `Failed: ${result.message}`);
            }

        } catch (error) {
            console.error('Error sending download link:', error);
            UISystem.showToast('error', `Error: ${error.message}`);
        }
    }

    // ===== COPY VIEW LINK - Generate and copy link for client to view photos =====
    async copyViewLink(selectionId) {
        try {
            UISystem.showToast('info', 'Generating view link...');

            // Generate token if doesn't exist (reuse send-download-link endpoint logic)
            const response = await fetch(`/api/selections/${selectionId}/generate-view-token`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            const result = await response.json();

            if (!result.success) {
                UISystem.showToast('error', result.message || 'Failed to generate link');
                return;
            }

            const viewLink = result.viewLink;

            // Show modal with link
            this.showCopyLinkModal(viewLink, result.clientName, result.totalItems);

        } catch (error) {
            console.error('Error generating view link:', error);
            UISystem.showToast('error', `Error: ${error.message}`);
        }
    }

    // ===== MODAL TO SHOW AND COPY VIEW LINK =====
    showCopyLinkModal(link, clientName, totalItems) {
        const modalId = 'copyLinkModal-' + Date.now();
        const modal = document.createElement('div');
        modal.className = 'ui-modal-backdrop';
        modal.id = modalId;
        modal.innerHTML = `
            <div class="ui-modal" style="max-width: 500px;">
                <div class="ui-modal-header">
                    <span class="modal-icon"><i class="fas fa-link"></i></span>
                    <h3>View Link Generated</h3>
                    <button class="modal-close" id="${modalId}-close">×</button>
                </div>
                <div class="ui-modal-body">
                    <p style="color: #888; margin-bottom: 15px;">Share this link with <strong style="color: #d4af37;">${clientName}</strong> to view their ${totalItems} photos:</p>

                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input
                            type="text"
                            id="${modalId}-link"
                            value="${link}"
                            readonly
                            style="
                                flex: 1;
                                padding: 12px;
                                background: rgba(255,255,255,0.05);
                                border: 1px solid rgba(212, 175, 55, 0.3);
                                border-radius: 8px;
                                color: #fff;
                                font-size: 13px;
                                font-family: monospace;
                            "
                        />
                        <button
                            id="${modalId}-copy"
                            style="
                                padding: 12px 20px;
                                background: linear-gradient(135deg, #d4af37, #b8960c);
                                border: none;
                                border-radius: 8px;
                                color: #000;
                                font-weight: 600;
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                gap: 6px;
                                transition: all 0.3s ease;
                            "
                        >
                            <i class="fas fa-copy"></i>
                            Copy
                        </button>
                    </div>

                    <p style="color: #666; font-size: 12px; margin-top: 15px;">
                        <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
                        Link expires in 7 days. Client can view and download photos.
                    </p>
                </div>
                <div class="ui-modal-footer">
                    <button class="btn-secondary" id="${modalId}-done">Done</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const copyBtn = document.getElementById(`${modalId}-copy`);
        const linkInput = document.getElementById(`${modalId}-link`);
        const closeBtn = document.getElementById(`${modalId}-close`);
        const doneBtn = document.getElementById(`${modalId}-done`);

        const cleanup = () => {
            if (modal) modal.remove();
        };

        copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(link);
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.style.background = 'linear-gradient(135deg, #28a745, #1e7b34)';
                linkInput.select();
                UISystem.showToast('success', 'Link copied to clipboard!');

                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                    copyBtn.style.background = 'linear-gradient(135deg, #d4af37, #b8960c)';
                }, 2000);
            } catch (err) {
                // Fallback para browsers mais antigos
                linkInput.select();
                document.execCommand('copy');
                UISystem.showToast('success', 'Link copied!');
            }
        };

        closeBtn.onclick = cleanup;
        doneBtn.onclick = cleanup;

        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) cleanup();
        };

        // ESC to close
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Auto-select link text
        setTimeout(() => linkInput.select(), 100);
    }

    // ===== STYLED CONFIRMATION MODAL FOR DOWNLOAD LINK (UISystem pattern) =====
    showDownloadLinkConfirmModal(selection) {
        return new Promise((resolve) => {
            const clientName = selection?.clientName || 'Client';
            const itemCount = selection?.totalItems || 0;
            const email = selection?.clientEmail || 'registered email';

            const modalId = 'downloadLinkConfirm-' + Date.now();
            const modal = document.createElement('div');
            modal.className = 'ui-modal-backdrop';
            modal.id = modalId;
            modal.innerHTML = `
                <div class="ui-modal">
                    <div class="ui-modal-header">
                        <span class="modal-icon">📧</span>
                        <h3>Send Download Link</h3>
                        <button class="modal-close" id="${modalId}-close">✕</button>
                    </div>
                    <div class="ui-modal-body">
                        <p class="confirm-message">You are about to send a download link to the client:</p>
                        <div class="confirm-details">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <i class="fas fa-user" style="color: #d4af37; width: 16px;"></i>
                                <span style="font-weight: 500;">${clientName}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <i class="fas fa-images" style="color: #d4af37; width: 16px;"></i>
                                <span>${itemCount} photos to download</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-envelope" style="color: #d4af37; width: 16px;"></i>
                                <span>${email}</span>
                            </div>
                        </div>
                    </div>
                    <div class="ui-modal-footer">
                        <button class="btn-secondary" id="${modalId}-cancel">
                            Cancel
                        </button>
                        <button class="btn-primary" id="${modalId}-confirm">
                            Send Link
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const cleanup = () => {
                if (modal) modal.remove();
            };

            document.getElementById(`${modalId}-close`).onclick = () => {
                cleanup();
                resolve(false);
            };

            document.getElementById(`${modalId}-cancel`).onclick = () => {
                cleanup();
                resolve(false);
            };

            document.getElementById(`${modalId}-confirm`).onclick = () => {
                cleanup();
                resolve(true);
            };

            // Close on backdrop click
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            };
        });
    }

    // ===== ATUALIZAR BADGE DO SIDEBAR =====
    updateSidebarBadge(count) {
        const badge = document.getElementById('sidebarPendingBadge');
        if (badge) {
            badge.textContent = count || '0';
            badge.setAttribute('data-count', count || '0');

            // Animação
            badge.classList.add('updated');
            setTimeout(() => badge.classList.remove('updated'), 300);
        }
    }

    // ===== SHOW AUTO-CORRECTION ALERT MODAL =====
    showCorrectionAlert(selectionId) {
        const selection = this.selectionsData[selectionId];

        if (!selection || !selection.autoCorrections || selection.autoCorrections.length === 0) {
            UISystem.showToast('info', 'No correction details available');
            return;
        }

        // Construir conteúdo do modal
        let correctionsHTML = '';

        selection.autoCorrections.forEach((correction, index) => {
            const date = new Date(correction.timestamp).toLocaleString();
            const extraData = correction.extraData || {};
            const removedPhotos = extraData.removedPhotos || [];
            const recalc = extraData.recalculation || {};

            correctionsHTML += `
                <div class="correction-item ${index === 0 ? 'latest' : ''}">
                    ${index === 0 ? '<span class="latest-badge">Latest</span>' : ''}
                    <div class="correction-date">
                        <i class="fas fa-clock"></i> ${date}
                    </div>
                    <div class="correction-details">
                        ${removedPhotos.length > 0 ? `
                            <div class="correction-section">
                                <strong><i class="fas fa-times-circle text-danger"></i> Photos Removed:</strong>
                                <ul class="removed-photos-list">
                                    ${removedPhotos.map(photo => `<li>${photo}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}

                        ${recalc.totalRecalculado !== undefined ? `
                            <div class="correction-section">
                                <strong><i class="fas fa-calculator"></i> New Total:</strong>
                                <span class="new-total">$${recalc.totalRecalculado.toFixed(2)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        // Criar modal
        const modalHTML = `
            <div class="modal-overlay" id="correctionAlertModal" onclick="adminSelections.closeCorrectionModal(event)">
                <div class="modal-content correction-modal" onclick="event.stopPropagation()">
                    <div class="modal-header correction-header">
                        <h3>
                            <i class="fas fa-exclamation-triangle text-warning"></i>
                            Selection Auto-Corrected
                        </h3>
                        <button class="modal-close-btn" onclick="adminSelections.closeCorrectionModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="correction-info-box">
                            <p>
                                <i class="fas fa-info-circle"></i>
                                This selection was automatically corrected because some photos 
                                were no longer available in the CDE system (sold via phone, warehouse, etc.).
                            </p>
                        </div>
                        
                        <div class="correction-client">
                            <strong>Client:</strong> ${selection.clientName} (${selection.clientCode})
                        </div>
                        
                        <h4>Correction History</h4>
                        <div class="corrections-list">
                            ${correctionsHTML}
                        </div>
                        
                        <div class="correction-note">
                            <i class="fas fa-lightbulb"></i>
                            <span>Prices have been automatically recalculated.</span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="adminSelections.closeCorrectionModal()">
                            <i class="fas fa-check"></i> Got it
                        </button>
                        <button class="btn btn-secondary" onclick="adminSelections.viewSelection('${selectionId}'); adminSelections.closeCorrectionModal();">
                            <i class="fas fa-eye"></i> View Selection
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remover modal existente se houver
        const existingModal = document.getElementById('correctionAlertModal');
        if (existingModal) existingModal.remove();

        // Adicionar ao DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Animar entrada
        setTimeout(() => {
            document.getElementById('correctionAlertModal').classList.add('show');
        }, 10);
    }

    // ===== CLOSE CORRECTION MODAL =====
    closeCorrectionModal(event) {
        if (event && event.target !== event.currentTarget) return;

        const modal = document.getElementById('correctionAlertModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }

    // ===== SHOW RETIRED PHOTOS ALERT MODAL =====
    showRetiredPhotosAlert(selectionId) {
        const selection = this.selectionsData[selectionId];

        if (!selection || !selection.retiredPhotosDetails || selection.retiredPhotosDetails.length === 0) {
            UISystem.showToast('info', 'No retired photos details available');
            return;
        }

        // Construir lista de fotos
        const photosHTML = selection.retiredPhotosDetails.map(photo => `
            <li>
                <span class="photo-name">${photo.fileName}</span>
                <span class="photo-info">CDE: ${photo.reservedUsu || 'N/A'}</span>
            </li>
        `).join('');

        // Criar modal
        const modalHTML = `
            <div class="modal-overlay" id="retiredPhotosModal" onclick="adminSelections.closeRetiredPhotosModal(event)">
                <div class="modal-content correction-modal retired-modal" onclick="event.stopPropagation()">
                    <div class="modal-header retired-header">
                        <h3>
                            <i class="fas fa-clipboard-check"></i>
                            Photos Already RETIRADO in CDE
                        </h3>
                        <button class="modal-close-btn" onclick="adminSelections.closeRetiredPhotosModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="correction-info-box retired-info-box">
                            <p>
                                <i class="fas fa-info-circle"></i>
                                The following photos from this selection are already marked as <strong>RETIRADO</strong> 
                                in the CDE system. This usually means they were already scanned and removed from CDE.
                            </p>
                        </div>
                        
                        <div class="correction-client">
                            <strong>Client:</strong> ${selection.clientName} (${selection.clientCode})
                            <br>
                            <strong>Company:</strong> ${selection.clientCompany}
                        </div>
                        
                        <h4>RETIRADO Photos (${selection.retiredPhotosDetails.length})</h4>
                        <div class="retired-photos-container">
                            <ul class="retired-photos-list-modal">
                                ${photosHTML}
                            </ul>
                        </div>
                        
                        <div class="correction-note retired-note">
                            <i class="fas fa-lightbulb"></i>
                            <span>
                                <strong>Suggestion:</strong> If these photos were sold to this client, 
                                please mark this selection as <strong>SOLD</strong> to keep records accurate.
                            </span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="adminSelections.closeRetiredPhotosModal()">
                            <i class="fas fa-check"></i> Got it
                        </button>
                        <button class="btn btn-secondary" onclick="adminSelections.viewSelection('${selectionId}'); adminSelections.closeRetiredPhotosModal();">
                            <i class="fas fa-eye"></i> View Selection
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remover modal existente se houver
        const existingModal = document.getElementById('retiredPhotosModal');
        if (existingModal) existingModal.remove();

        // Adicionar ao DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Animar entrada
        setTimeout(() => {
            document.getElementById('retiredPhotosModal').classList.add('show');
        }, 10);
    }

    // ===== CLOSE RETIRED PHOTOS MODAL =====
    closeRetiredPhotosModal(event) {
        if (event && event.target !== event.currentTarget) return;

        const modal = document.getElementById('retiredPhotosModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }
}

// Initialize when DOM loads
let adminSelections;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🛒 DOM loaded, initializing Selection Management...');
    adminSelections = new AdminSelections();
});