// public/js/admin-selections.js

class AdminSelections {
    constructor() {
        this.currentPage = 1;
        this.currentFilters = {
            status: 'pending'
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
            <tr>
                <td class="selection-id-cell">
                    <strong>${selection.selectionId}</strong>
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
                    ${selection.isExpired ? '<div class="status-expired"><i class="fas fa-clock"></i> Expired</div>' : ''}
                </td>
                <td class="status-cell">
                    <span class="status-badge status-${selection.status}">
                        ${this.getStatusIcon(selection.status)}
                        ${this.getStatusText(selection.status)}
                    </span>
                </td>
                <td class="actions-cell">
                    <div class="action-buttons">
                        <button class="btn-action btn-view" onclick="adminSelections.viewSelection('${selection.selectionId}')">
                            <i class="fas fa-eye"></i>
                            View
                        </button>
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
            'finalized': '<i class="fas fa-star"></i>'
        };
        return icons[status] || '<i class="fas fa-question"></i>';
    }

    // ===== GET STATUS TEXT =====
    getStatusText(status) {
        const statusMap = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'cancelled': 'Cancelled',
            'finalized': 'Finalized'
        };
        return statusMap[status] || status;
    }

    // ===== GET ACTION BUTTONS =====
    getActionButtons(selection) {
        let buttons = '';

        if (selection.status === 'pending') {
            buttons += `
                <button class="btn-action btn-approve" onclick="adminSelections.approveSelection('${selection.selectionId}')">
                    <i class="fas fa-check"></i>
                    Approve
                </button>
                <button class="btn-action btn-cancel" onclick="adminSelections.cancelSelection('${selection.selectionId}')">
                    <i class="fas fa-times"></i>
                    Cancel
                </button>
            `;
        }

        if (selection.status === 'confirmed') {
            buttons += `
                <button class="btn-action btn-force-cancel" onclick="adminSelections.forceCancelSelection('${selection.selectionId}')" title="Force cancellation for cleanup">
                    <i class="fas fa-exclamation-triangle"></i>
                    Force Cancel
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
            Selection Details - ${selectionId}
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
        return `
            <div class="selection-summary">
                <div class="form-row">
                    <div class="form-group">
                        <label>Client</label>
                        <div style="padding: 0.75rem; background: var(--luxury-dark); border-radius: var(--border-radius); color: var(--text-primary);">
                            ${selection.clientName} (Code: ${selection.clientCode})
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <div style="padding: 0.75rem;">
                            <span class="status-badge status-${selection.status}">
                                ${this.getStatusIcon(selection.status)}
                                ${this.getStatusText(selection.status)}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Total Items</label>
                        <div style="padding: 0.75rem; background: var(--luxury-dark); border-radius: var(--border-radius); color: var(--text-primary);">
                            ${selection.totalItems} photos
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Total Value</label>
                        <div style="padding: 0.75rem; background: var(--luxury-dark); border-radius: var(--border-radius); color: var(--success); font-weight: 600;">
                            ${this.formatCurrency(selection.totalValue)}
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Created</label>
                        <div style="padding: 0.75rem; background: var(--luxury-dark); border-radius: var(--border-radius); color: var(--text-primary);">
                            ${this.formatDate(selection.createdAt)}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Selection ID</label>
                        <div style="padding: 0.75rem; background: var(--luxury-dark); border-radius: var(--border-radius); color: var(--gold-primary); font-family: monospace;">
                            ${selection.selectionId}
                        </div>
                    </div>
                </div>
            </div>

            ${selection.items && selection.items.length > 0 ? `
                <div class="selection-items" style="margin-top: 2rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Selected Items</h4>
                    <div style="max-height: 300px; overflow-y: auto; background: var(--luxury-dark); border-radius: var(--border-radius); padding: 1rem;">
                        ${selection.items.map((item, index) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);">
                                <div>
                                    <strong style="color: var(--text-primary);">${item.fileName}</strong>
                                    <br>
                                    <small style="color: var(--text-muted);">${item.category}</small>
                                </div>
                                <div style="color: var(--success); font-weight: 600;">
                                    ${this.formatCurrency(item.price)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    // ===== HIDE SELECTION MODAL =====
    hideSelectionModal() {
        const modal = document.getElementById('selectionDetailsModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // ===== APPROVE SELECTION =====
    async approveSelection(selectionId) {
        try {
            const confirmMessage = `Are you sure you want to APPROVE selection ${selectionId}?\n\nThis action will:\n• Move folder to SYSTEM_SOLD\n• Mark products as sold\n• Finalize the transaction`;

            if (!confirm(confirmMessage)) {
                return;
            }

            const notes = prompt('Notes about approval (optional):');

            this.setLoading(true);
            console.log(`✅ Approving selection: ${selectionId}`);

            const response = await fetch(`/api/selections/${selectionId}/approve`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin', // TODO: Get logged user
                    notes: notes || ''
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Error approving selection');
            }

            if (result.success) {
                this.showNotification(`✅ Selection ${selectionId} approved successfully!`, 'success');
                await this.refreshData();
                console.log('📁 Folder moved to SYSTEM_SOLD:', result.googleDrive?.finalFolderName);
            } else {
                throw new Error(result.message || 'Unknown error in approval');
            }

        } catch (error) {
            console.error('❌ Error approving selection:', error);
            this.showNotification(`Error approving: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // ===== CANCEL SELECTION =====
    async cancelSelection(selectionId) {
        try {
            const confirmMessage = `Are you sure you want to CANCEL selection ${selectionId}?\n\nThis action will:\n• Release reserved photos\n• Notify the client\n• Change status to cancelled`;

            if (!confirm(confirmMessage)) {
                return;
            }

            const reason = prompt('Reason for cancellation (optional):');

            this.setLoading(true);
            console.log(`❌ Cancelling selection: ${selectionId}`);

            const response = await fetch(`/api/selections/${selectionId}/cancel`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin',
                    reason: reason || ''
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Error cancelling selection');
            }

            if (result.success) {
                this.showNotification(`✅ Selection ${selectionId} cancelled successfully!`, 'success');
                await this.refreshData();
            } else {
                throw new Error(result.message || 'Unknown error in cancellation');
            }

        } catch (error) {
            console.error('❌ Error cancelling selection:', error);
            this.showNotification(`Error cancelling: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
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
}

// Initialize when DOM loads
let adminSelections;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🛒 DOM loaded, initializing Selection Management...');
    adminSelections = new AdminSelections();
});