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
        let buttons = '';

        // VIEW para TODOS os status (sempre primeiro)
        buttons += `
            <button class="special-btn-icon btn-view" 
                    onclick="adminSelections.viewSelection('${selection.selectionId}')" 
                    data-tooltip="View Details">
                <i class="fas fa-eye"></i>
            </button>
        `;

        // APPROVE (Mark as Sold) - segundo botão, só para PENDING
        if (selection.status === 'pending') {
            buttons += `
                <button class="special-btn-icon btn-approve" 
                        onclick="adminSelections.approveSelection('${selection.selectionId}')"
                        data-tooltip="Mark as Sold">
                    <i class="fas fa-check-circle"></i>
                </button>
            `;
        }

        // SEND DOWNLOAD LINK - para PENDING e FINALIZED
        if (selection.status === 'pending' || selection.status === 'finalized') {
            buttons += `
                <button class="special-btn-icon btn-send-link" 
                        onclick="adminSelections.sendDownloadLink('${selection.selectionId}')" 
                        data-tooltip="Send Download Link to Client">
                    <i class="fas fa-paper-plane"></i>
                </button>
            `;
        }

        // PENDING - adiciona Reopen e Cancel
        if (selection.status === 'pending') {
            buttons += `
                <button class="special-btn-icon btn-reopen" 
                        onclick="adminSelections.reopenCart('${selection.selectionId}')"
                        data-tooltip="Reopen for Client">
                    <i class="fas fa-undo"></i>
                </button>
                <button class="special-btn-icon btn-cancel" 
                        onclick="adminSelections.cancelSelection('${selection.selectionId}')"
                        data-tooltip="Cancel Selection">
                    <i class="fas fa-times-circle"></i>
                </button>
            `;
        }

        // FINALIZED (SOLD) - adiciona botão Cancel
        if (selection.status === 'finalized') {
            buttons += `
                <button class="special-btn-icon btn-cancel" 
                        onclick="adminSelections.cancelSoldSelection('${selection.selectionId}')"
                        data-tooltip="Cancel Sale & Release Photos">
                    <i class="fas fa-times-circle"></i>
                </button>
            `;
        }

        // CONFIRMED - adiciona Force Cancel (para limpeza)
        else if (selection.status === 'confirmed') {
            buttons += `
                <button class="special-btn-icon btn-force" 
                        onclick="adminSelections.forceCancelSelection('${selection.selectionId}')" 
                        data-tooltip="⚠️ Force Cancel">
                    <i class="fas fa-exclamation-triangle"></i>
                </button>
            `;
        }

        // DELETE - apenas para seleções canceladas (para limpeza da interface)
        if (selection.status === 'cancelled') {
            buttons += `
                <button class="special-btn-icon btn-delete" 
                        onclick="adminSelections.deleteSelection('${selection.selectionId}')"
                        data-tooltip="Delete Selection">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }

        return buttons;
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
                // Buscar QB items para as categorias
                const categories = [...new Set(data.selection.items.map(item => item.category))];
                const qbMap = await this.fetchQBItems(categories);

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

    // ===== SHOW SELECTION MODAL =====
    showSelectionModal(selectionId, selection, loading = false) {
        // Create modal if doesn't exist
        let modal = document.getElementById('selectionDetailsModal');
        if (!modal) {
            modal = this.createSelectionModal();
        }

        const modalTitle = modal.querySelector('.selection-details-title');
        const modalBody = modal.querySelector('.selection-details-body');

        modalTitle.innerHTML = `
            <i class="fas fa-shopping-cart"></i>
            Selection Details
        `;

        if (loading) {
            modalBody.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p>Loading selection details...</p>
                </div>
            `;
        } else {
            modalBody.innerHTML = this.renderSelectionDetails(selection);
        }

        modal.classList.add('active');
        // ⭐ BLOQUEAR SCROLL DO BODY
        document.body.style.overflow = 'hidden';
        // Inicializar listeners dos checkboxes
        this.initCheckboxListeners();
    }

    // ===== CREATE SELECTION MODAL =====
    createSelectionModal() {
        const modal = document.createElement('div');
        modal.id = 'selectionDetailsModal';
        modal.className = 'selection-details-modal';
        modal.innerHTML = `
            <div class="selection-details-content">
                <div class="selection-details-header">
                    <h3 class="selection-details-title">
                        <i class="fas fa-shopping-cart"></i>
                        Selection Details
                    </h3>
                    <button class="selection-details-close" onclick="adminSelections.hideSelectionModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="selection-details-body">
                    <!-- Content will be injected here -->
                </div>
                <div class="selection-details-footer">
                    <!-- Footer will be injected here -->
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
                                                onchange="adminSelections.toggleCategorySelection(this, '${category.replace(/'/g, '\\\'')}')">
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

    // Adicione também a função hideSelectionModal se não existir:
    hideSelectionModal() {
        const modal = document.getElementById('selectionDetailsModal');
        if (modal) {
            modal.classList.remove('active');
        }
        // ⭐ RESTAURAR SCROLL DO BODY
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
        if (item.thumbnailUrl) return item.thumbnailUrl;
        if (window.ImageUtils && window.ImageUtils.getThumbnailUrl) {
            return window.ImageUtils.getThumbnailUrl(item);
        }
        return '';
    }

    // ===== GET ORIGINAL URL =====
    getOriginalUrl(item) {
        if (item.thumbnailUrl) {
            return item.thumbnailUrl.replace('/_thumbnails/', '/');
        }
        if (window.ImageUtils && window.ImageUtils.getFullImageUrl) {
            return window.ImageUtils.getFullImageUrl(item);
        }
        // Fallback
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
        // Integration with app.js notification system
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback to alert
            const typeLabel = type.toUpperCase();
            alert(`[${typeLabel}] ${message}`);
        }
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
            <div id="poNumberModal" class="selection-details-modal" style="display: none;">
                <div class="selection-details-content" style="max-width: 500px;">
                    <div class="selection-details-header">
                        <h3 class="selection-details-title">
                            <i class="fas fa-file-excel"></i>
                            CDE Export - PO Number
                        </h3>
                        <button class="selection-details-close po-modal-close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="selection-details-body" style="padding: 30px;">
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 10px; font-weight: bold; font-size: 16px;">
                                Enter CDE PO Number:
                            </label>
                            <input 
                                type="text" 
                                id="cdePoNumber" 
                                class="form-control" 
                                placeholder="Ex: PO-2025-001"
                                style="width: 100%; padding: 12px; font-size: 16px; border: 2px solid #ddd; border-radius: 6px;"
                            >
                            <small style="color: #666; display: block; margin-top: 10px;">
                                This will be used in the PO. Number column for CDE import
                            </small>
                        </div>
                        <div style="margin-top: 25px; display: flex; gap: 10px; justify-content: flex-end;">
                            <button 
                                class="btn-modal-action po-modal-cancel-btn" 
                                style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                Cancel
                            </button>
                            <button 
                                id="confirmPONumber" 
                                class="btn-modal-action"
                                style="padding: 10px 30px; background: #daa520; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
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
                alert('Please enter a PO Number');
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

            // 🆕 FUNÇÃO PARA LIMPAR STRINGS PARA CSV/MYSQL (VERSÃO 2.0)
            const cleanForCSV = (text) => {
                if (!text) return '';

                return String(text)
                    // Remover aspas duplas
                    .replace(/"/g, '')
                    // Remover aspas simples (se necessário, descomente a linha abaixo)
                    // .replace(/'/g, '')
                    // 🆕 REMOVER PONTOS
                    .replace(/\./g, '')
                    // Converter setas para barras
                    .replace(/[►→'>]/g, '/')
                    // Remover espaços ao redor das barras
                    .replace(/\s*\/\s*/g, '/')
                    // Remover barras duplicadas
                    .replace(/\/+/g, '/')
                    // Remover barra final
                    .replace(/\/$/, '')
                    // Remover caracteres de controle e especiais problemáticos
                    .replace(/[\x00-\x1F\x7F]/g, '')
                    // Remover vírgulas (que quebram CSV)
                    .replace(/,/g, '-')
                    // Limpar espaços múltiplos
                    .replace(/\s+/g, ' ')
                    .trim();
            };

            // FORMATO CORRETO: NOMECLIENTE-CÓDIGO
            const clientNameFormatted = cleanForCSV(selection.clientName.toUpperCase().replace(/\s+/g, ''));
            const reservedusu = `${clientNameFormatted}-${selection.clientCode || '0000'}`;
            console.log('RESERVEDUSU será:', reservedusu);

            // Agrupar por QB Item e COLETAR FOTOS POR CATEGORIA
            const qbGroups = {};
            for (const item of selection.items) {
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

            // Calcular preço médio
            Object.values(qbGroups).forEach(group => {
                if (group.totalQty > 0) {
                    group.unitPrice = group.totalAmount / group.totalQty;
                }
            });

            // Criar dados da planilha - FORMATO LIMPO SEM CARACTERES PROBLEMÁTICOS
            const excelData = [];

            // Adicionar linhas com fotos ESPECÍFICAS de cada categoria
            Object.values(qbGroups).forEach(group => {
                // String de fotos APENAS desta categoria
                const categoryPhotoNumbers = group.photoNumbers.join('-');

                // 🆕 LIMPAR ITEM NAME - REMOVE ASPAS E CARACTERES PROBLEMÁTICOS
                let itemName = cleanForCSV(group.categoryName);

                console.log(`✅ Categoria limpa para CSV: ${itemName}`);

                // 🆕 LIMPAR TAMBÉM O COMPANY NAME E PO NUMBER
                const cleanCompanyName = cleanForCSV(companyName);
                const cleanPoNumber = cleanForCSV(poNumber);
                const cleanReservedusu = cleanForCSV(reservedusu);
                const cleanQbCode = cleanForCSV(group.qbCode);

                excelData.push([
                    selection.clientName,    // ✅ Coluna 1: Nome do cliente (Mary Devos)
                    cleanPoNumber,           // ✅ Coluna 2: PO Number (COLUNA CDE)
                    cleanCompanyName,        // ✅ Coluna 3: Company (Gastamo Group)
                    categoryPhotoNumbers,    // ✅ Coluna 4: Foto numbers
                    cleanQbCode,             // ✅ Coluna 5: QB Code
                    itemName,                // ✅ Coluna 6: Categoria
                    group.totalQty,          // ✅ Coluna 7: Quantidade
                    group.unitPrice.toFixed(2),    // ✅ Coluna 8: Preço unitário
                    group.totalAmount.toFixed(2)   // ✅ Coluna 9: Total
                ]);

                // LOG para debug
                console.log(`Categoria ${group.qbCode}: ${group.photoNumbers.length} fotos`);
            });

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

            this.showNotification(`Planilha CDE baixada com PO: ${poNumber} | RESERVEDUSU: ${reservedusu}`, 'success');

        } catch (error) {
            console.error('Erro ao gerar Excel:', error);
            this.showNotification('Erro ao gerar planilha: ' + error.message, 'error');
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

    // Função para marcar/desmarcar todos os checkboxes de uma categoria
    toggleCategorySelection(selectAllCheckbox, category) {
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
            const tierChange = extraData.tierChange || {};
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
                        
                        ${tierChange.from && tierChange.to ? `
                            <div class="correction-section">
                                <strong><i class="fas fa-layer-group"></i> Tier Change:</strong>
                                <span class="tier-change">
                                    <span class="tier-old">${tierChange.from}</span>
                                    <i class="fas fa-arrow-right"></i>
                                    <span class="tier-new">${tierChange.to}</span>
                                </span>
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
                            <span>Prices have been automatically recalculated based on the new quantity tier.</span>
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