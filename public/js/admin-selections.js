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
                        ${selection.status === 'confirmed' ? `
                            <button class="btn-action btn-force-cancel" onclick="adminSelections.forceCancelSelection('${selection.selectionId}')" title="Cancelamento forçado para limpeza">
                                <i class="fas fa-exclamation-triangle"></i>
                                Cancelar Forçado
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

    /**
         * Ver detalhes da seleção
         */
    viewSelection(selectionId) {
        // TODO: Implementar modal de detalhes completo
        console.log(`👁️ Visualizando seleção: ${selectionId}`);
        this.showNotification('Funcionalidade de visualização em desenvolvimento', 'info');
    }

    /**
     * Aprovar seleção
     */
    async approveSelection(selectionId) {
        try {
            // Confirmação do usuário
            const confirmMessage = `Tem certeza que deseja APROVAR a seleção ${selectionId}?\n\nEsta ação irá:\n• Mover pasta para SYSTEM_SOLD\n• Marcar produtos como vendidos\n• Finalizar a transação`;

            if (!confirm(confirmMessage)) {
                return;
            }

            // Pedir observações opcionais
            const notes = prompt('Observações sobre a aprovação (opcional):');

            this.setLoading(true);

            console.log(`✅ Aprovando seleção: ${selectionId}`);

            const response = await fetch(`/api/selections/${selectionId}/approve`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin', // TODO: Pegar usuário logado
                    notes: notes || ''
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Erro ao aprovar seleção');
            }

            if (result.success) {
                this.showNotification(`✅ Seleção ${selectionId} aprovada com sucesso!`, 'success');

                // Recarregar lista
                await this.loadSelections();

                console.log('📁 Pasta movida para SYSTEM_SOLD:', result.googleDrive?.finalFolderName);
            } else {
                throw new Error(result.message || 'Erro desconhecido na aprovação');
            }

        } catch (error) {
            console.error('❌ Erro ao aprovar seleção:', error);
            this.showNotification(`Erro ao aprovar: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Cancelar seleção
     */
    /**
         * Cancelar seleção FORÇADO (para seleções confirmadas)
         */
    async forceCancelSelection(selectionId) {
        try {
            // Aviso de segurança
            const warningMessage = `⚠️ CANCELAMENTO FORÇADO ⚠️\n\nVocê está prestes a cancelar forçadamente a seleção ${selectionId}.\n\nEsta operação irá:\n• Reverter fotos de SYSTEM_SOLD para pastas originais\n• Marcar produtos como disponíveis\n• Alterar status para "cancelada"\n\n🚨 ESTA AÇÃO É IRREVERSÍVEL! 🚨\n\nDeseja continuar?`;

            if (!confirm(warningMessage)) {
                return;
            }

            // Texto de confirmação obrigatório
            const confirmText = prompt(`Para confirmar o cancelamento forçado, digite exatamente:\n\nCONFIRMO CANCELAMENTO FORÇADO`);

            if (confirmText !== 'CONFIRMO CANCELAMENTO FORÇADO') {
                this.showNotification('Texto de confirmação incorreto. Cancelamento abortado.', 'warning');
                return;
            }

            // Pedir motivo obrigatório
            const reason = prompt('Motivo do cancelamento forçado (obrigatório):');

            if (!reason || reason.trim() === '') {
                this.showNotification('Motivo do cancelamento é obrigatório', 'warning');
                return;
            }

            this.setLoading(true);

            console.log(`🚨 Cancelamento forçado: ${selectionId}`);

            const response = await fetch(`/api/selections/${selectionId}/force-cancel`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    adminUser: 'admin', // TODO: Pegar usuário logado
                    reason: reason.trim(),
                    confirmText: 'CONFIRMO CANCELAMENTO FORÇADO'
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Erro no cancelamento forçado');
            }

            if (result.success) {
                const reversion = result.reversion;
                const successMessage = `✅ Cancelamento forçado executado!\n\n📊 Reversão: ${reversion.successful}/${reversion.total} fotos revertidas\n\n⚠️ ${result.warning}`;

                this.showNotification(successMessage, 'success');

                // Recarregar lista
                await this.loadSelections();

                console.log('🔄 Fotos revertidas (forçado):', reversion);

                if (reversion.failed > 0) {
                    const failureDetails = reversion.details
                        .filter(d => !d.success)
                        .map(d => `• ${d.fileName}: ${d.error}`)
                        .join('\n');

                    this.showNotification(`⚠️ ${reversion.failed} fotos tiveram problemas:\n\n${failureDetails}`, 'warning');
                }
            } else {
                throw new Error(result.message || 'Erro desconhecido no cancelamento forçado');
            }

        } catch (error) {
            console.error('❌ Erro no cancelamento forçado:', error);
            this.showNotification(`Erro no cancelamento forçado: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Controlar estado de loading
     */
    setLoading(isLoading) {
        this.isLoading = isLoading;

        // Desabilitar botões durante loading
        const actionButtons = document.querySelectorAll('.btn-action');
        actionButtons.forEach(btn => {
            btn.disabled = isLoading;
        });

        // Mostrar/ocultar indicador de loading se existir
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.classList.toggle('hidden', !isLoading);
        }
    }

    /**
     * Mostrar notificações
     */
    showNotification(message, type = 'info') {
        // Integração com sistema de notificações do app.js
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback para alert
            alert(`[${type.toUpperCase()}] ${message}`);
        }
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