// public/js/stock.js
// =====================================================
// STOCK CONTROL - Frontend Logic
// =====================================================

const StockManager = {
    currentFilter: 'all',
    currentPage: 1,
    limit: 50,
    totalPages: 1,
    summary: null,
    items: [],

    async init() {
        console.log('[STOCK] Initializing Stock Manager...');
        this.attachEventListeners();
        this.setupSectionObserver();
    },

    setupSectionObserver() {
        // Detect when Stock section becomes visible
        const stockSection = document.getElementById('section-stock');
        if (!stockSection) {
            console.warn('[STOCK] Section not found');
            return;
        }

        // Use MutationObserver to detect when section becomes visible
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style') {
                    const isVisible = stockSection.style.display !== 'none';
                    if (isVisible && this.items.length === 0) {
                        console.log('[STOCK] Section became visible - loading data automatically');
                        this.loadData();
                    }
                }
            });
        });

        observer.observe(stockSection, {
            attributes: true,
            attributeFilter: ['style']
        });

        // Also check if section is already visible on init
        if (stockSection.style.display !== 'none') {
            console.log('[STOCK] Section already visible - loading data');
            setTimeout(() => this.loadData(), 500);
        }
    },

    attachEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('stockRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }

        // Summary cards (clickable filters)
        const cards = document.querySelectorAll('.stock-card');
        cards.forEach(card => {
            // Click handler
            card.addEventListener('click', () => {
                const filter = card.getAttribute('data-filter');
                this.applyFilter(filter);
            });

            // Hover effect
            card.addEventListener('mouseenter', () => {
                if (!card.classList.contains('active')) {
                    card.style.background = 'rgba(255,255,255,0.1)';
                    card.style.transform = 'translateY(-2px)';
                }
            });

            card.addEventListener('mouseleave', () => {
                if (!card.classList.contains('active')) {
                    // Check if it's the issues card
                    const filter = card.getAttribute('data-filter');
                    if (filter === 'issues') {
                        card.style.background = 'rgba(220,53,69,0.1)';
                    } else {
                        card.style.background = 'rgba(255,255,255,0.05)';
                    }
                    card.style.transform = 'translateY(0)';
                }
            });
        });

        // Clear filter button
        const clearBtn = document.getElementById('stockClearFilter');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearFilter());
        }

        // Pagination
        const prevBtn = document.getElementById('stockPrevPage');
        const nextBtn = document.getElementById('stockNextPage');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevPage());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextPage());
        }
    },

    async loadData() {
        console.log(`[STOCK] Loading data - filter: ${this.currentFilter}, page: ${this.currentPage}`);

        // Show loading state
        const refreshBtn = document.getElementById('stockRefreshBtn');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            refreshBtn.disabled = true;
        }

        try {
            // Get admin token from sunshineSession
            const token = this.getAdminToken();
            if (!token) {
                throw new Error('No admin token found. Please log in again.');
            }

            const response = await fetch(
                `/api/stock/overview?filter=${this.currentFilter}&page=${this.currentPage}&limit=${this.limit}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load stock data');
            }

            console.log('[STOCK] Data loaded successfully:', data);

            // Update state
            this.summary = data.summary;
            this.items = data.items;
            this.totalPages = data.pagination.totalPages;

            // Update UI
            this.updateSummaryCards();
            this.updateTable();
            this.updatePagination(data.pagination);

        } catch (error) {
            console.error('[STOCK] Error loading data:', error);
            this.showError(error.message);
        } finally {
            // Reset refresh button
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                refreshBtn.disabled = false;
            }
        }
    },

    updateSummaryCards() {
        if (!this.summary) return;

        // Update counts
        document.getElementById('uniquePhotosCount').textContent =
            this.summary.uniquePhotos.toLocaleString();

        document.getElementById('sampleStockCount').textContent =
            this.summary.sampleStock.toLocaleString();

        document.getElementById('transitItemsCount').textContent =
            this.summary.transitItems.toLocaleString();

        document.getElementById('issuesCount').textContent =
            this.summary.issues.toLocaleString();

        // Highlight active card
        document.querySelectorAll('.stock-card').forEach(card => {
            const filter = card.getAttribute('data-filter');
            if (filter === this.currentFilter) {
                card.style.background = 'rgba(13,110,253,0.2)';
                card.style.borderColor = 'rgba(13,110,253,0.5)';
            } else {
                // Reset to default styles
                if (filter === 'issues') {
                    card.style.background = 'rgba(220,53,69,0.1)';
                    card.style.borderColor = 'rgba(220,53,69,0.3)';
                } else {
                    card.style.background = 'rgba(255,255,255,0.05)';
                    card.style.borderColor = 'rgba(255,255,255,0.1)';
                }
            }
        });
    },

    updateTable() {
        const tbody = document.getElementById('stockTableBody');
        if (!tbody) return;

        // Clear table
        tbody.innerHTML = '';

        if (this.items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding: 40px; text-align: center; color: #666;">
                        No items found for filter: ${this.currentFilter}
                    </td>
                </tr>
            `;
            return;
        }

        // Render items
        this.items.forEach(item => {
            const row = this.createTableRow(item);
            tbody.appendChild(row);
        });
    },

    createTableRow(item) {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        row.style.transition = 'background 0.2s';

        // Hover effect
        row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(255,255,255,0.05)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent';
        });

        // Type (text + icon)
        const typeCell = document.createElement('td');
        typeCell.style.padding = '12px';
        typeCell.style.fontSize = '13px';
        typeCell.style.color = '#e0e0e0';
        typeCell.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 16px;">${item.typeIcon || item.icon}</span>
                <span>${item.type}</span>
            </div>
        `;
        row.appendChild(typeCell);

        // QB Item
        const qbCell = document.createElement('td');
        qbCell.style.padding = '12px';
        qbCell.style.fontFamily = 'monospace';
        qbCell.style.color = '#e0e0e0';
        qbCell.textContent = item.qbItem;
        row.appendChild(qbCell);

        // Description / Category
        const descCell = document.createElement('td');
        descCell.style.padding = '12px';
        descCell.innerHTML = `
            <div style="color: #e0e0e0; font-size: 14px;">${this.escapeHtml(item.description)}</div>
            ${item.category ? `<div style="color: #666; font-size: 12px; margin-top: 4px;">${this.escapeHtml(item.category)}</div>` : ''}
        `;
        row.appendChild(descCell);

        // Quantity
        const qtyCell = document.createElement('td');
        qtyCell.style.padding = '12px';
        qtyCell.style.textAlign = 'center';
        qtyCell.style.fontWeight = '600';
        qtyCell.style.color = item.quantity > 0 ? '#4caf50' : '#666';
        qtyCell.textContent = item.quantity;
        row.appendChild(qtyCell);

        // Action
        const actionCell = document.createElement('td');
        actionCell.style.padding = '12px';
        actionCell.style.textAlign = 'center';

        if (item.action && item.action !== 'none') {
            const actionBtn = document.createElement('button');
            actionBtn.style.padding = '6px 12px';
            actionBtn.style.background = 'rgba(13,110,253,0.2)';
            actionBtn.style.border = '1px solid rgba(13,110,253,0.5)';
            actionBtn.style.color = '#0d6efd';
            actionBtn.style.borderRadius = '4px';
            actionBtn.style.cursor = 'pointer';
            actionBtn.style.fontSize = '12px';
            actionBtn.textContent = item.action === 'view' ? 'View' : item.action;

            actionBtn.addEventListener('click', () => {
                this.handleAction(item);
            });

            actionCell.appendChild(actionBtn);
        } else {
            actionCell.innerHTML = '<span style="color: #666;">-</span>';
        }

        row.appendChild(actionCell);

        return row;
    },

    updatePagination(pagination) {
        const info = document.getElementById('stockPaginationInfo');
        const prevBtn = document.getElementById('stockPrevPage');
        const nextBtn = document.getElementById('stockNextPage');

        if (info) {
            const start = (pagination.page - 1) * pagination.limit + 1;
            const end = Math.min(pagination.page * pagination.limit, pagination.total);
            info.textContent = `Showing ${start}-${end} of ${pagination.total.toLocaleString()} items`;
        }

        if (prevBtn) {
            prevBtn.disabled = pagination.page === 1;
            prevBtn.style.opacity = pagination.page === 1 ? '0.5' : '1';
            prevBtn.style.cursor = pagination.page === 1 ? 'not-allowed' : 'pointer';
        }

        if (nextBtn) {
            nextBtn.disabled = pagination.page >= pagination.totalPages;
            nextBtn.style.opacity = pagination.page >= pagination.totalPages ? '0.5' : '1';
            nextBtn.style.cursor = pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer';
        }
    },

    applyFilter(filter) {
        console.log(`[STOCK] Applying filter: ${filter}`);
        this.currentFilter = filter;
        this.currentPage = 1; // Reset to first page

        // Show loading in table immediately
        const tbody = document.getElementById('stockTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding: 40px; text-align: center; color: #666;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
                        <div>Loading filtered data...</div>
                    </td>
                </tr>
            `;
        }

        // Update filter indicator
        const filterName = document.getElementById('stockFilterName');
        const clearBtn = document.getElementById('stockClearFilter');

        if (filterName) {
            const filterNames = {
                'all': 'All Items',
                'unique': 'Unique Photos',
                'sample': 'Sample Stock',
                'transit': 'In Transit',
                'issues': 'Issues'
            };
            filterName.textContent = filterNames[filter] || filter;
        }

        if (clearBtn) {
            clearBtn.style.display = filter === 'all' ? 'none' : 'inline-block';
        }

        // Reload data
        this.loadData();
    },

    clearFilter() {
        this.applyFilter('all');
    },

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadData();
        }
    },

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadData();
        }
    },

    handleAction(item) {
        console.log('[STOCK] Action clicked for item:', item);

        // TODO: Implement action handlers based on item type
        if (item.type === 'issue') {
            // Show issue details modal
            alert(`Issue: ${item.description}\nAction: ${item.action}`);
        } else if (item.type === 'unique') {
            // Show photo details
            alert(`Photo ${item.qbItem}\nCategory: ${item.category}`);
        } else if (item.type === 'sample') {
            // Show stock details
            alert(`Stock Item: ${item.description}\nQuantity: ${item.quantity}`);
        }
    },

    showError(message) {
        const tbody = document.getElementById('stockTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding: 40px; text-align: center; color: #dc3545;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px;"></i>
                        <div style="font-size: 16px; margin-top: 10px;">${this.escapeHtml(message)}</div>
                    </td>
                </tr>
            `;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    getAdminToken() {
        const sessionData = localStorage.getItem('sunshineSession');
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                return session.token;
            } catch (e) {
                console.error('[STOCK] Error parsing session data:', e);
                return null;
            }
        }
        return null;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => StockManager.init());
} else {
    StockManager.init();
}
