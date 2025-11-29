// public/js/inventory-monitor.js - VERSÃO COMPLETA COM 6 CATEGORIAS
class InventoryMonitor {
    constructor() {
        this.isScanning = false;
        this.lastResults = null;
        this.initEventListeners();
    }

    initEventListeners() {
        // Botão de scan
        const scanBtn = document.getElementById('scanInventoryBtn');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.scan());
        }

        // Botão de exportar
        const exportBtn = document.getElementById('exportMonitorBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportResults());
        }

        // Filtros por categoria
        const filterBtns = document.querySelectorAll('.monitor-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterByCategory(btn.dataset.category);
            });
        });
    }

    async scan() {
        if (this.isScanning) return;

        const sessionData = localStorage.getItem('sunshineSession');
        if (!sessionData) {
            console.log('⚠️ Scan cancelado - sem sessão ativa');
            return;
        }

        let session;
        try {
            session = JSON.parse(sessionData);
        } catch (error) {
            console.error('⚠️ Erro ao parsear sessão:', error);
            return;
        }

        if (!session || !session.token) {
            console.log('⚠️ Scan cancelado - sessão inválida');
            return;
        }

        this.isScanning = true;
        this.showLoading();

        try {
            const token = session.token;
            const response = await fetch('/api/inventory-monitor/scan', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Error al escanear');
            }

            this.lastResults = result.data;
            this.displayResults(result.data);

        } catch (error) {
            console.error('Scan error:', error);
            this.showError(error.message);
        } finally {
            this.isScanning = false;
            this.hideLoading();
        }
    }

    showLoading() {
        const btn = document.getElementById('scanInventoryBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Escaneando...';
        }

        const tbody = document.getElementById('issuesTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 60px; color: #888;">
                        <div style="font-size: 32px; margin-bottom: 15px;">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                        <div>Escaneando inventario...</div>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            Verificando CDE, MongoDB y R2... Esto puede tomar 30-60 segundos
                        </div>
                    </td>
                </tr>
            `;
        }

        const totals = document.getElementById('scanTotals');
        if (totals) {
            totals.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> Escaneando...</span>';
        }
    }

    hideLoading() {
        const btn = document.getElementById('scanInventoryBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-search"></i> Escanear Ahora';
        }
    }

    showError(message) {
        const tbody = document.getElementById('issuesTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 60px; color: #f44336;">
                        <div style="font-size: 32px; margin-bottom: 15px;">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div>Error al escanear</div>
                        <div style="font-size: 12px; margin-top: 5px;">${message}</div>
                        <button onclick="window.monitor.scan()" style="margin-top: 15px; padding: 8px 16px; background: rgba(244,67,54,0.2); color: #f44336; border: 1px solid rgba(244,67,54,0.4); border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-redo"></i> Reintentar
                        </button>
                    </td>
                </tr>
            `;
        }
    }

    displayResults(data) {
        console.log('📊 Exibindo resultados:', data);

        const { summary } = data;

        // Atualizar cards de resumo
        this.updateElement('criticalCount', summary.critical);
        this.updateElement('warningsCount', summary.warnings);
        this.updateElement('pendingSyncCount', summary.pendingSync);
        this.updateElement('noPhotoCount', summary.noPhoto);
        this.updateElement('autoFixCount', summary.autoFixable);
        this.updateElement('passCount', summary.pass);

        // Atualizar totais
        const totals = document.getElementById('scanTotals');
        if (totals) {
            totals.innerHTML = `
                <span>MongoDB: <strong>${summary.totalScanned}</strong></span>
                <span>CDE: <strong>${summary.totalCdeIngresado}</strong></span>
                <span>R2: <strong>${summary.totalR2Photos || '-'}</strong></span>
                <span>Tiempo: <strong>${summary.scanTime}s</strong></span>
            `;
        }

        // Combinar todas as issues
        const allIssues = [
            ...(data.critical || []).map(i => ({ ...i, category: 'critical' })),
            ...(data.warnings || []).map(i => ({ ...i, category: 'warning' })),
            ...(data.pendingSync || []).map(i => ({ ...i, category: 'pendingSync' })),
            ...(data.noPhoto || []).map(i => ({ ...i, category: 'noPhoto' })),
            ...(data.pass || []).map(i => ({ ...i, category: 'pass' })),
            ...(data.autoFixable || []).map(i => ({ ...i, category: 'autofix' }))
        ];

        const totalIssues = allIssues.length;
        console.log(`📊 Total de problemas: ${totalIssues}`);

        // Renderizar tabela
        this.renderTable(allIssues);
    }

    updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value !== undefined ? value : '-';
        }
    }

    renderTable(issues) {
        const tbody = document.getElementById('issuesTableBody');
        if (!tbody) return;

        if (issues.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 60px; color: #4caf50;">
                        <div style="font-size: 48px; margin-bottom: 15px;">✅</div>
                        <div style="font-size: 18px;">¡Excelente! No se encontraron discrepancias.</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = issues.map(issue => this.renderIssueRow(issue)).join('');
        console.log('✅ Tabela atualizada com', issues.length, 'linhas');
    }

    renderIssueRow(issue) {
        const severityConfig = {
            critical: { icon: '🔴', class: 'severity-critical', label: 'CRÍTICO', color: '#f44336' },
            warning: { icon: '🟡', class: 'severity-warning', label: 'ADVERTENCIA', color: '#ffc107' },
            pendingSync: { icon: '🔄', class: 'severity-sync', label: 'SYNC PENDIENTE', color: '#2196f3' },
            noPhoto: { icon: '📷', class: 'severity-nophoto', label: 'SIN FOTO', color: '#9c27b0' },
            pass: { icon: '🔀', class: 'severity-pass', label: 'PASS', color: '#ff9800' },
            autofix: { icon: '🔧', class: 'severity-autofix', label: 'AUTO-CORRECCIÓN', color: '#4caf50' }
        };

        const config = severityConfig[issue.category] || severityConfig.warning;

        // Traduzir status
        const mongoStatus = this.translateStatus(issue.mongoStatus);
        const cdeStatus = this.translateStatus(issue.cdeStatus);

        // Indicadores extras
        let r2Indicator = '';
        if (issue.hasR2Photo !== undefined) {
            r2Indicator = issue.hasR2Photo
                ? '<span style="color: #4caf50; font-size: 10px;">✅ R2</span>'
                : '<span style="color: #f44336; font-size: 10px;">❌ R2</span>';
        }

        let actionIndicator = '';
        if (issue.syncCanFix) {
            actionIndicator = '<span style="background: rgba(76,175,80,0.2); color: #81c784; padding: 4px 8px; border-radius: 4px; font-size: 11px;">⚡ Auto</span>';
        } else if (issue.needsManualReview) {
            actionIndicator = '<span style="background: rgba(255,193,7,0.2); color: #ffc107; padding: 4px 8px; border-radius: 4px; font-size: 11px;">👁️ Manual</span>';
        }

        // Detalhes extras
        let extraDetails = '';
        if (issue.passDetails) {
            extraDetails = `<div style="margin-top: 8px; padding: 8px; background: rgba(255,152,0,0.1); border-left: 2px solid #ff9800; border-radius: 4px; font-size: 12px; color: #ffb74d;">
                📋 ${issue.passDetails.totalRegistros} registros: ${issue.passDetails.categorias.join(' → ')}
            </div>`;
        }
        if (issue.selectionInfo) {
            extraDetails = `<div style="margin-top: 8px; padding: 8px; background: rgba(33,150,243,0.1); border-left: 2px solid #2196f3; border-radius: 4px; font-size: 12px; color: #90caf9;">
                👤 Cliente: ${issue.selectionInfo.client} | Status: ${issue.selectionInfo.status}
            </div>`;
        }

        return `
            <tr class="issue-row" data-category="${issue.category}" style="border-left: 4px solid ${config.color};">
                <td style="font-family: monospace; font-weight: bold;">
                    ${issue.photoNumber}
                    <div>${r2Indicator}</div>
                </td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; background: rgba(${this.hexToRgb(config.color)}, 0.2); color: ${config.color}; border: 1px solid rgba(${this.hexToRgb(config.color)}, 0.4);">
                        ${config.icon} ${config.label}
                    </span>
                </td>
                <td style="min-width: 300px;">
                    <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">${issue.issue}</div>
                    <div style="font-size: 13px; color: #888; line-height: 1.4;">${issue.description}</div>
                    ${extraDetails}
                </td>
                <td style="text-align: center;">
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; background: rgba(103,58,183,0.2); color: #b39ddb;">
                        ${mongoStatus}
                    </span>
                </td>
                <td style="text-align: center;">
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; background: rgba(0,150,136,0.2); color: #80cbc4;">
                        ${cdeStatus}
                    </span>
                </td>
                <td style="font-family: monospace; font-size: 11px; color: #888;">
                    <div>M: ${issue.mongoQb || '-'}</div>
                    <div>C: ${issue.cdeQb || '-'}</div>
                </td>
                <td style="text-align: center;">
                    ${actionIndicator}
                </td>
            </tr>
        `;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
    }

    translateStatus(status) {
        const translations = {
            'available': 'Disponible',
            'reserved': 'Reservado',
            'sold': 'Vendido',
            'in_selection': 'En Selección',
            'pending': 'Pendiente',
            'INGRESADO': 'INGRESADO',
            'PRE-SELECTED': 'PRE-SELECTED',
            'CONFIRMED': 'CONFIRMED',
            'RETIRADO': 'RETIRADO',
            'RESERVED': 'RESERVED',
            'STANDBY': 'STANDBY',
            'NO EXISTE': 'NO EXISTE',
            'N/A': 'N/A'
        };
        return translations[status] || status || '-';
    }

    filterByCategory(category) {
        const rows = document.querySelectorAll('#issuesTableBody tr.issue-row');

        rows.forEach(row => {
            if (category === 'all') {
                row.style.display = '';
            } else {
                const rowCategory = row.dataset.category;
                row.style.display = rowCategory === category ? '' : 'none';
            }
        });
    }

    exportResults() {
        if (!this.lastResults) {
            alert('No hay resultados para exportar. Ejecute un escaneo primero.');
            return;
        }

        const data = JSON.stringify(this.lastResults, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory-monitor-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }
}

// Instância global (compatível com código antigo)
window.monitor = new InventoryMonitor();
window.inventoryMonitor = window.monitor;

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Inventory Monitor inicializado');

    // Re-inicializar event listeners (caso o DOM tenha mudado)
    setTimeout(() => {
        window.monitor.initEventListeners();
    }, 100);
});

// Função para ser chamada quando a seção for mostrada
function onInventoryMonitorVisible() {
    console.log('📊 Inventory Monitor ativado - disparando scan...');
    if (window.monitor && typeof window.monitor.scan === 'function') {
        setTimeout(() => window.monitor.scan(), 500);
    }
}