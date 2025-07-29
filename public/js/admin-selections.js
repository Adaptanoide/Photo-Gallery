//public/js/admin-selections.js - Gestão de Seleções
class AdminSelections {
    constructor() {
        this.currentPage = 1;
        this.currentFilters = {
            status: 'pending'
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSelections();
    }

    bindEvents() {
        // Botões
        document.getElementById('btnRefreshSelections')?.addEventListener('click', () => {
            this.loadSelections();
        });

        document.getElementById('btnApplySelectionFilters')?.addEventListener('click', () => {
            this.applyFilters();
        });

        // Filtros
        document.getElementById('filterSelectionStatus')?.addEventListener('change', (e) => {
            this.currentFilters.status = e.target.value;
            this.loadSelections();
        });
    }

    // ===== NOVO MÉTODO DE AUTENTICAÇÃO (IGUAL AO ADMIN-PRICING) =====
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

    async loadSelections() {
        try {
            const tableBody = document.getElementById('selectionsTableBody');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <i class="fas fa-spinner fa-spin"></i>
                        Carregando seleções...
                    </td>
                </tr>
            `;

            const params = new URLSearchParams({
                status: this.currentFilters.status,
                page: this.currentPage,
                limit: 20
            });

            const response = await fetch(`/api/selections?${params}`, {
                headers: this.getAuthHeaders()  // ← USAR O NOVO MÉTODO
            });

            const data = await response.json();

            if (data.success) {
                this.renderSelections(data.selections);
            } else {
                throw new Error(data.message);
            }

        } catch (error) {
            console.error('Erro ao carregar seleções:', error);
            this.showError('Erro ao carregar seleções: ' + error.message);
        }
    }

    renderSelections(selections) {
        const tableBody = document.getElementById('selectionsTableBody');

        if (selections.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <i class="fas fa-inbox"></i>
                        Nenhuma seleção encontrada
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
                    <div class="client-code">Código: ${selection.clientCode}</div>
                </td>
                <td class="items-count-cell">
                    <span class="items-badge">${selection.totalItems} itens</span>
                </td>
                <td class="total-value-cell">
                    <strong>R$ ${selection.totalValue.toFixed(2)}</strong>
                </td>
                <td class="date-cell">
                    <div class="date-created">${this.formatDate(selection.createdAt)}</div>
                    ${selection.isExpired ? '<div class="status-expired">⏰ Expirado</div>' : ''}
                </td>
                <td class="status-cell">
                    <span class="status-badge status-${selection.status}">
                        ${this.getStatusText(selection.status)}
                    </span>
                </td>
                <td class="actions-cell">
                    <div class="action-buttons">
                        <button class="btn-action btn-view" onclick="adminSelections.viewSelection('${selection.selectionId}')">
                            <i class="fas fa-eye"></i>
                            Ver
                        </button>
                        ${selection.status === 'pending' ? `
                            <button class="btn-action btn-approve" onclick="adminSelections.approveSelection('${selection.selectionId}')">
                                <i class="fas fa-check"></i>
                                Aprovar
                            </button>
                            <button class="btn-action btn-cancel" onclick="adminSelections.cancelSelection('${selection.selectionId}')">
                                <i class="fas fa-times"></i>
                                Cancelar
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pendente',
            'confirmed': 'Confirmada',
            'cancelled': 'Cancelada',
            'finalized': 'Finalizada'
        };
        return statusMap[status] || status;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    viewSelection(selectionId) {
        alert(`Ver detalhes da seleção: ${selectionId}`);
        // TODO: Implementar modal de detalhes
    }

    approveSelection(selectionId) {
        alert(`Aprovar seleção: ${selectionId}`);
        // TODO: Implementar aprovação
    }

    cancelSelection(selectionId) {
        alert(`Cancelar seleção: ${selectionId}`);
        // TODO: Implementar cancelamento
    }

    showError(message) {
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

// Inicializar quando DOM carregar
let adminSelections;
document.addEventListener('DOMContentLoaded', () => {
    adminSelections = new AdminSelections();
});