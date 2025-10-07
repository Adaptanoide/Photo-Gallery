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
                    <div class="client-name">${selection.clientName}</div>
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
                <td class="total-value-cell">
                    <strong>${this.formatCurrency(selection.totalValue)}</strong>
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

    // ===== GET ACTION BUTTONS =====
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

        // PENDING - adiciona Reopen, Mark as Sold e Cancel
        if (selection.status === 'pending') {
            buttons += `
                <button class="special-btn-icon btn-reopen" 
                        onclick="adminSelections.reopenCart('${selection.selectionId}')"
                        data-tooltip="Reopen for Client">
                    <i class="fas fa-undo"></i>
                </button>
                <button class="special-btn-icon btn-approve" 
                        onclick="adminSelections.approveSelection('${selection.selectionId}')"
                        data-tooltip="Mark as Sold">
                    <i class="fas fa-check-circle"></i>
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
                </div>

                <!-- Items by Category -->
                <div class="items-section">
                    <div class="items-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h4 class="section-title" style="margin: 0;">Items by Category</h4>
                        ${(selection.status === 'pending' || selection.status === 'finalized') ? `
                            <button class="btn-remove-selected" 
                                id="btn-remove-selected-${selection.selectionId}"
                                style="display: none; background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;"
                                onclick="adminSelections.removeSelectedItems('${selection.selectionId}')"
                                <i class="fas fa-trash"></i>
                                Remove Selected (<span class="selected-count">0</span>)
                            </button>
                        ` : ''}
                    </div>
                    <div class="categories-list">
                        ${Object.entries(itemsByCategory).map(([category, items]) => `
                            <div class="category-group">
                                <div class="category-header" onclick="this.parentElement.classList.toggle('expanded')">
                                    <div class="category-title">
                                        <i class="fas fa-chevron-right toggle-icon"></i>
                                        <span class="category-name">${category}</span>
                                        <span class="category-info">
                                            ${items.length} items | ${this.formatCurrency(items.reduce((sum, item) => sum + item.price, 0))}
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
                                <div class="category-items">
                                    ${items.map((item, index) => `
                                        <div class="item-row">
                                            <div style="display: flex; align-items: center; flex: 1;">
                                                <span class="item-name">${item.fileName}</span>
                                                ${(selection.status === 'pending' || selection.status === 'finalized') ? `
                                                    <input type="checkbox" 
                                                        class="item-checkbox" 
                                                        data-filename="${item.fileName}"
                                                        data-price="${item.price}"
                                                        data-category="${category}"
                                                        id="item-${selection.selectionId}-${category}-${index}"
                                                        style="margin-left: 10px;">
                                                ` : ''}
                                            </div>
                                            <span class="item-price">${this.formatCurrency(item.price)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Summary -->
                <div class="selection-summary-footer">
                    <div class="summary-row">
                        <span>Total items:</span>
                        <span>${selection.totalItems || selection.items.length}</span>
                    </div>
                    <div class="summary-row">
                        <span>Subtotal:</span>
                        <span>${this.formatCurrency(selection.totalValue)}</span>
                    </div>
                    <div class="summary-row total">
                        <span>TOTAL:</span>
                        <span class="total-value">${this.formatCurrency(selection.totalValue)}</span>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="modal-actions">
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
    }

    // ===== APPROVE SELECTION =====
    async approveSelection(selectionId) {
        // Confirm com modal bonito
        const confirmed = await UISystem.confirm(
            'Approve this selection?',
            'This will move photos to SOLD folder and finalize the transaction.'
        );

        if (!confirmed) return;

        // Encontrar a linha na tabela
        const row = document.querySelector(`tr[data-selection-id="${selectionId}"]`);
        if (!row) {
            console.error('Row not found for selection:', selectionId);
            UISystem.showToast('error', 'Could not find selection in table');
            return;
        }

        // Atualizar status visual para "APPROVING..."
        const statusCell = row.querySelector('td:nth-child(5)'); // 5ª coluna é status
        const originalStatus = statusCell ? statusCell.innerHTML : '';

        if (statusCell) {
            statusCell.innerHTML = `
                <span class="badge badge-approving">
                    <span class="spinner-inline"></span>
                    APPROVING...
                </span>
            `;
        }

        // NOVO: Esconder botões durante processamento
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
            const response = await fetch(`/api/selections/${selectionId}/approve`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin',
                    notes: ''
                })
            });

            if (response.ok) {
                UISystem.showToast('success', 'Selection approved successfully! Products marked as SOLD.');

                // Recarregar tabela após 2 segundos
                setTimeout(() => {
                    this.loadSelections();
                    this.loadStatistics(); // ADICIONE ESTA LINHA
                }, 2000);
            } else {
                throw new Error('Failed to approve');
            }
        } catch (error) {
            console.error('Error approving:', error);
            UISystem.showToast('error', 'Error approving selection');

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
        // Confirm com modal bonito
        const confirmed = await UISystem.confirm(
            'Cancel this selection?',
            'All photos will be returned to their original locations. This may take a few minutes.'
        );

        if (!confirmed) return;

        // Encontrar a linha na tabela
        const row = document.querySelector(`tr[data-selection-id="${selectionId}"]`);
        if (!row) {
            console.error('Row not found for selection:', selectionId);
            UISystem.showToast('error', 'Could not find selection in table');
            return;
        }

        // Atualizar status visual para "CANCELLING..."
        const statusCell = row.querySelector('td:nth-child(5)'); // 5ª coluna é status
        const originalStatus = statusCell ? statusCell.innerHTML : '';

        if (statusCell) {
            statusCell.innerHTML = `
                <span class="badge badge-cancelling">
                    <span class="spinner-inline"></span>
                    CANCELLING...
                </span>
            `;
        }

        // NOVO: Esconder botões durante processamento
        const actionsCell = row.querySelector('td:last-child'); // Última coluna são as ações
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
            const response = await fetch(`/api/selections/${selectionId}/cancel`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin',
                    reason: 'Cancelled by admin'
                })
            });

            if (response.ok) {
                UISystem.showToast('success', 'Selection cancelled successfully!');

                // Recarregar tabela após 2 segundos
                setTimeout(() => {
                    this.loadSelections();
                    this.loadStatistics(); // ADICIONE ESTA LINHA
                }, 2000);
            } else {
                throw new Error('Failed to cancel');
            }
        } catch (error) {
            console.error('Error cancelling:', error);
            UISystem.showToast('error', 'Error cancelling selection');

            // Reverter status visual em caso de erro
            if (statusCell) {
                statusCell.innerHTML = originalStatus;
            }

            // NOVO: Restaurar botões em caso de erro
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

            // Buscar nome da empresa
            let companyName = selection.clientName;
            try {
                const response = await fetch('/api/admin/access-codes', {
                    headers: this.getAuthHeaders()
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.codes) {
                        const client = data.codes.find(ac => ac.code === selection.clientCode);
                        if (client?.companyName) {
                            companyName = client.companyName;
                        }
                    }
                }
            } catch (error) {
                console.log('Usando nome do cliente:', companyName);
            }

            // REMOVER O CÓDIGO ANTIGO QUE COLETAVA TODAS AS FOTOS
            // NÃO fazer mais isso aqui!

            // FORMATO CORRETO: NOMECLIENTE-CÓDIGO
            const clientNameFormatted = selection.clientName.toUpperCase().replace(/\s+/g, '');
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
                        photoNumbers: [], // NOVO: Array para fotos desta categoria
                        totalQty: 0,
                        unitPrice: 0,
                        totalAmount: 0
                    };
                }

                qbGroups[qbCode].items.push(item);
                qbGroups[qbCode].totalQty++;
                const itemPrice = item.price || 0;
                qbGroups[qbCode].totalAmount += itemPrice;

                // NOVO: Adicionar número da foto APENAS para esta categoria
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

            // Criar dados da planilha - FORMATO CORRETO COM 10 COLUNAS
            const excelData = [];

            // Adicionar linhas com fotos ESPECÍFICAS de cada categoria
            Object.values(qbGroups).forEach(group => {
                // NOVO: Criar string de fotos APENAS desta categoria
                const categoryPhotoNumbers = group.photoNumbers.join('-');

                // MANTER DESCRIÇÃO COMPLETA
                let itemName = group.categoryName;

                // ✅ CORREÇÃO: Converter setas para barras (sem espaços)
                itemName = itemName
                    .replace(/[›→>]/g, '/')      // Converter setas para barras
                    .replace(/\s*\/\s*/g, '/')   // Remover espaços ao redor das barras
                    .replace(/\/+/g, '/')        // Remover barras duplicadas
                    .replace(/\/$/, '')          // Remover barra final
                    .trim();

                console.log(`✅ Categoria formatada para CSV: ${itemName}`);

                excelData.push([
                    companyName,                              // Customer
                    poNumber,                                  // PO. Number (digitado pelo usuário)
                    reservedusu,                              // RESERVEDUSU
                    categoryPhotoNumbers,                      // Photo.Number - AGORA ESPECÍFICO DA CATEGORIA!
                    group.qbCode,                             // ITEM REQ
                    itemName,                                  // ITEM NAME (descrição completa)
                    group.totalQty,                           // ITEM QTY
                    group.unitPrice.toFixed(2),               // RATE
                    group.totalAmount.toFixed(2),             // AMOUNT
                    //this.getStatusText(selection.status)      // ESTADO
                ]);

                // LOG para debug
                console.log(`Categoria ${group.qbCode}: ${group.photoNumbers.length} fotos`);
            });

            // Criar workbook
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(excelData);

            // Configurar larguras - AJUSTADO PARA 10 COLUNAS
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
                // REMOVIDO: width para ESTADO
            ];

            // Adicionar sheet e salvar
            XLSX.utils.book_append_sheet(workbook, worksheet, 'CDE_Order');

            // Nome do arquivo - MUDANÇA 1: extensão .csv
            const fileName = `CDE_${poNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${companyName.replace(/[^a-zA-Z0-9]/g, '')}_${this.formatDateForFileName(selection.createdAt)}.csv`;

            // MUDANÇA 2: Salvar como CSV
            XLSX.writeFile(workbook, fileName, { bookType: 'csv' });

            console.log(`✅ Excel gerado com PO: ${poNumber}`);
            console.log(`✅ RESERVEDUSU aplicado: ${reservedusu}`);
            console.log(`✅ Total de categorias: ${Object.keys(qbGroups).length}`);
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
                // Recarregar o modal com dados atualizados
                if (result.data && result.data.updatedSelection) {
                    this.showSelectionModal(selectionId, result.data.updatedSelection);
                }

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
}

// Initialize when DOM loads
let adminSelections;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🛒 DOM loaded, initializing Selection Management...');
    adminSelections = new AdminSelections();
});