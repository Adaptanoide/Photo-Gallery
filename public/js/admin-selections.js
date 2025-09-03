// public/js/admin-selections.js

class AdminSelections {
    constructor() {
        this.currentPage = 1;
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
            this.showNotification('✅ Data refreshed successfully!', 'success');
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
            this.showNotification(`Error refreshing data: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
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
        this.updateStatCard('thisMonthSelections', this.stats.thisMonthSelections, 'This month');
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
        this.updateStatCard('thisMonthSelections', '?', 'Error loading');
        this.updateStatCard('averageSelectionValue', '?', 'Error loading');
    }

    // ===== LOAD SELECTIONS =====
    async loadSelections() {
        try {
            const tableBody = document.getElementById('selectionsTableBody');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <i class="fas fa-spinner fa-spin"></i>
                        Loading selections...
                    </td>
                </tr>
            `;

            const params = new URLSearchParams({
                status: this.currentFilters.status,
                clientSearch: this.currentFilters.clientSearch || '',
                page: this.currentPage,
                limit: 20
            });

            const response = await fetch(`/api/selections?${params}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.renderSelections(data.selections);
                // ✅ LOG TEMPORÁRIO PARA DEBUG:
                console.log('🔍 PRIMEIRA SELEÇÃO DEBUG:', data.selections[0]);
                console.log(`✅ ${data.selections.length} selections loaded`);
            } else {
                throw new Error(data.message);
            }

        } catch (error) {
            console.error('❌ Error loading selections:', error);
            this.showTableError('Error loading selections: ' + error.message);
        }
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
                <td class="type-cell">
                    <span class="type-badge ${selection.selectionType || 'normal'}">
                        ${selection.selectionId.startsWith('SPEC_') ? '⭐ Special' : '📄 Regular'}
                    </span>
                </td>
                <td class="client-info-cell">
                    <div class="client-name">${selection.clientName}</div>
                    <div class="client-code">Code: ${selection.clientCode}</div>
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
            'reverted': 'REVERTED'  // ADICIONE ESTA LINHA
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

        // PENDING - adiciona Mark as Sold e Cancel
        if (selection.status === 'pending') {
            buttons += `
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

        // FINALIZED (SOLD) - adiciona botão Revert
        else if (selection.status === 'finalized') {
            buttons += `
                <button class="special-btn-icon btn-revert" 
                        onclick="adminSelections.revertSold('${selection.selectionId}')"
                        data-tooltip="Revert to Available">
                    <i class="fas fa-undo"></i>
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

        // DELETE - para seleções antigas (não pending)
        if (selection.status !== 'pending') {
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
                        <label>Code:</label>
                        <span>${selection.clientCode}</span>
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
                    <h4 class="section-title">Items by Category</h4>
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
                                <div class="category-items">
                                    ${items.map(item => `
                                        <div class="item-row">
                                            <span class="item-name">${item.fileName}</span>
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
                    <button class="btn-modal-action btn-download" onclick="adminSelections.downloadSelectionExcel('${selection.selectionId}')">
                        <i class="fas fa-file-excel"></i>
                        Download Excel
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
                setTimeout(() => this.loadSelections(), 2000);
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

    // ===== DOWNLOAD EXCEL FUNCTION - VERSÃO CORRIGIDA =====
    async downloadSelectionExcel(selectionId) {
        try {
            console.log(`📊 Baixando Excel para seleção: ${selectionId}`);

            // Fazer a mesma chamada que viewSelection faz
            const response = await fetch(`/api/selections/${selectionId}`, {
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.generateExcelFile(data.selection);
            } else {
                throw new Error(data.message || 'Erro ao carregar dados');
            }

        } catch (error) {
            console.error('❌ Erro ao baixar Excel:', error);
            alert('Erro ao gerar arquivo Excel. Tente novamente.');
        }
    }

    // ===== GENERATE EXCEL FILE - LAYOUT ORGANIZADO =====
    async generateExcelFile(selection) {
        try {
            console.log('📄 Gerando Excel com dados:', selection);

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
                console.log('ERRO AO BUSCAR EMPRESA:', error);
            }

            // Criar workbook
            const workbook = XLSX.utils.book_new();

            // CABEÇALHO MELHORADO
            const allData = [
                ['', 'SUNSHINE COWHIDES', '', ''],
                ['', 'Selection Details Report', '', ''],
                ['', '', '', ''],
                ['', 'Date:', this.formatDateForExcel(selection.createdAt), ''],
                ['', 'Company:', companyName, ''],
                ['', 'Client:', selection.clientName, ''],
                ['', 'Client Code:', selection.clientCode, ''],
                ['', 'Selection ID:', selection.selectionId, ''],
                ['', 'Status:', this.getStatusText(selection.status), ''],
                ['', '', '', ''],
                ['', '═══════════════════════════════════════', '', ''],
                ['', '', '', '']
            ];

            // AGRUPAR ITEMS POR CATEGORIA
            const itemsByCategory = {};
            if (selection.items && selection.items.length > 0) {
                selection.items.forEach(item => {
                    if (!itemsByCategory[item.category]) {
                        itemsByCategory[item.category] = [];
                    }
                    itemsByCategory[item.category].push(item);
                });
            }

            let totalItems = 0;
            let grandTotal = 0;
            let categoryNumber = 1;

            // ADICIONAR CADA CATEGORIA COMO SEÇÃO
            for (const [category, items] of Object.entries(itemsByCategory)) {
                const categoryTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
                const averagePrice = categoryTotal / items.length;

                // Buscar QB para esta categoria
                const qbCode = await this.getQBForCategory(category);

                // CABEÇALHO DA CATEGORIA COM NÚMERO
                allData.push(['', `CATEGORY ${categoryNumber}: ${category}`, '', '']);

                // QB CODE EM LINHA SEPARADA COM DESTAQUE
                if (qbCode && qbCode !== 'NO-QB') {
                    allData.push(['', 'QB CODE →', qbCode, '⚠️ IMPORTANT']);
                }

                // INFORMAÇÕES DA CATEGORIA EM GRID
                allData.push(['', 'Quantity:', `${items.length} items`, '']);
                allData.push(['', 'Unit Price:', `$${averagePrice.toFixed(2)}`, '']);
                allData.push(['', 'Category Total:', `$${categoryTotal.toFixed(2)}`, '']);
                allData.push(['', '', '', '']);
                allData.push(['', 'Photo Numbers:', '', '']);

                // NÚMEROS DAS FOTOS
                const photoNumbers = items.map(item => {
                    const fileName = item.fileName || item.name || '';
                    return fileName.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '');
                });

                const allPhotoNumbers = photoNumbers.join('-');
                allData.push(['', allPhotoNumbers, '', '']);

                // SEPARADOR ENTRE CATEGORIAS
                allData.push(['', '', '', '']);
                allData.push(['', '───────────────────────────────────────', '', '']);
                allData.push(['', '', '', '']);

                totalItems += items.length;
                grandTotal += categoryTotal;
                categoryNumber++;
            }

            // RESUMO FINAL MELHORADO
            allData.push(['', '═══════════════════════════════════════', '', '']);
            allData.push(['', 'FINAL SUMMARY', '', '']);
            allData.push(['', '═══════════════════════════════════════', '', '']);
            allData.push(['', 'Total Categories:', Object.keys(itemsByCategory).length, '']);
            allData.push(['', 'Total Items:', totalItems, '']);
            allData.push(['', 'GRAND TOTAL:', `$${grandTotal.toFixed(2)}`, '']);

            // CRIAR PLANILHA
            const worksheet = XLSX.utils.aoa_to_sheet(allData);

            // CONFIGURAR LARGURA DAS COLUNAS
            worksheet['!cols'] = [
                { width: 3 },   // Margem esquerda
                { width: 40 },  // Labels
                { width: 60 },  // Valores/Conteúdo
                { width: 15 }   // Notas/Extra
            ];

            // FORMATAÇÃO PROFISSIONAL
            const range = XLSX.utils.decode_range(worksheet['!ref']);

            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!worksheet[cellAddress]) continue;

                    const cell = worksheet[cellAddress];
                    if (!cell.s) cell.s = {};

                    const cellValue = cell.v ? cell.v.toString() : '';

                    // BORDAS PADRÃO
                    cell.s.border = {
                        top: { style: "thin", color: { rgb: "E0E0E0" } },
                        bottom: { style: "thin", color: { rgb: "E0E0E0" } },
                        left: { style: "thin", color: { rgb: "E0E0E0" } },
                        right: { style: "thin", color: { rgb: "E0E0E0" } }
                    };

                    // TÍTULO PRINCIPAL (SUNSHINE COWHIDES)
                    if (R === 0 && C === 1) {
                        cell.s.font = { bold: true, size: 18, color: { rgb: "FFFFFF" } };
                        cell.s.alignment = { horizontal: "center", vertical: "center" };
                        cell.s.fill = { fgColor: { rgb: "1E3A5F" } };
                    }

                    // SUBTÍTULO
                    if (R === 1 && C === 1) {
                        cell.s.font = { bold: true, size: 14, color: { rgb: "FFFFFF" } };
                        cell.s.alignment = { horizontal: "center", vertical: "center" };
                        cell.s.fill = { fgColor: { rgb: "2E5BBA" } };
                    }

                    // LABELS (Date:, Company:, etc.)
                    if (C === 1 && cellValue.includes(':') && R >= 3 && R <= 8) {
                        cell.s.font = { bold: true, size: 11, color: { rgb: "333333" } };
                        cell.s.fill = { fgColor: { rgb: "F5F5F5" } };
                    }

                    // VALORES DOS LABELS
                    if (C === 2 && R >= 3 && R <= 8) {
                        cell.s.font = { size: 11, color: { rgb: "000000" } };
                        cell.s.fill = { fgColor: { rgb: "FFFFFF" } };
                    }

                    // CATEGORY HEADERS
                    if (cellValue.includes('CATEGORY') && cellValue.includes(':')) {
                        cell.s.font = { bold: true, size: 12, color: { rgb: "000000" } };
                        cell.s.fill = { fgColor: { rgb: "FFD700" } }; // DOURADO
                        cell.s.border = {
                            top: { style: "thick", color: { rgb: "FFA500" } },
                            bottom: { style: "thick", color: { rgb: "FFA500" } },
                            left: { style: "thick", color: { rgb: "FFA500" } },
                            right: { style: "thick", color: { rgb: "FFA500" } }
                        };
                    }

                    // QB CODE - SUPER DESTAQUE
                    if (cellValue === 'QB CODE →') {
                        cell.s.font = { bold: true, size: 11, color: { rgb: "FF0000" } };
                        cell.s.fill = { fgColor: { rgb: "FFFF00" } }; // AMARELO FORTE
                        cell.s.alignment = { horizontal: "right", vertical: "center" };
                    }

                    // VALOR DO QB CODE
                    if (C === 2 && cellValue.match(/^\d+[A-Z]*$|^[A-Z]+\d+[A-Z]*$/)) {
                        cell.s.font = { bold: true, size: 12, color: { rgb: "000000" } };
                        cell.s.fill = { fgColor: { rgb: "FFFF00" } }; // AMARELO FORTE
                        cell.s.alignment = { horizontal: "center", vertical: "center" };
                        cell.s.border = {
                            top: { style: "thick", color: { rgb: "FF0000" } },
                            bottom: { style: "thick", color: { rgb: "FF0000" } },
                            left: { style: "thick", color: { rgb: "FF0000" } },
                            right: { style: "thick", color: { rgb: "FF0000" } }
                        };
                    }

                    // NÚMEROS DAS FOTOS
                    if (cellValue.includes('-') && cellValue.length > 20 && !cellValue.includes(' ')) {
                        cell.s.font = { name: "Courier New", size: 10, bold: true };
                        cell.s.fill = { fgColor: { rgb: "FFFFCC" } }; // AMARELO CLARO
                        cell.s.alignment = { horizontal: "left", wrapText: true };
                    }

                    // FINAL SUMMARY
                    if (cellValue === 'FINAL SUMMARY') {
                        cell.s.font = { bold: true, size: 14, color: { rgb: "FFFFFF" } };
                        cell.s.fill = { fgColor: { rgb: "4CAF50" } };
                        cell.s.alignment = { horizontal: "center", vertical: "center" };
                    }

                    // GRAND TOTAL
                    if (cellValue === 'GRAND TOTAL:') {
                        cell.s.font = { bold: true, size: 12, color: { rgb: "FFFFFF" } };
                        cell.s.fill = { fgColor: { rgb: "2E7D32" } };
                    }

                    // VALOR DO GRAND TOTAL
                    if (C === 2 && cellValue.includes('$') && R > range.e.r - 5) {
                        cell.s.font = { bold: true, size: 12, color: { rgb: "000000" } };
                        cell.s.fill = { fgColor: { rgb: "C8E6C9" } };
                    }
                }
            }

            // SALVAR
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Selection');
            const fileName = `Selection_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${selection.clientCode}_${this.formatDateForFileName(selection.createdAt)}.xlsx`;

            XLSX.writeFile(workbook, fileName);
            console.log(`✅ Excel profissional gerado: ${fileName}`);

        } catch (error) {
            console.error('❌ Erro ao gerar Excel:', error);
            alert('Erro detalhado: ' + error.message);
        }
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
                setTimeout(() => this.loadSelections(), 1000);
            }

        } catch (error) {
            console.error('❌ Error deleting selection:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

}

// Initialize when DOM loads
let adminSelections;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🛒 DOM loaded, initializing Selection Management...');
    adminSelections = new AdminSelections();
});