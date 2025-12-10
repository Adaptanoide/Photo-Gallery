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
                            Verificando CDE, Galería y R2... Esto puede tomar 30-60 segundos
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
        this.updateElement('standbyCount', summary.standby);

        // Atualizar totais
        const totals = document.getElementById('scanTotals');
        if (totals) {
            totals.innerHTML = `
                <span>En Galería: <strong>${summary.totalScanned}</strong></span>
                <span>En CDE: <strong>${summary.totalCdeIngresado}</strong></span>
                <span>Fotos R2: <strong>${summary.totalR2Photos || '-'}</strong></span>
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
            ...(data.autoFixable || []).map(i => ({ ...i, category: 'autofix' })),
            ...(data.standby || []).map(i => ({ ...i, category: 'standby' }))
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
            critical: { icon: '🔴', class: 'severity-critical', label: 'URGENTE', color: '#f44336' },
            warning: { icon: '🟡', class: 'severity-warning', label: 'VERIFICAR', color: '#ffc107' },
            pendingSync: { icon: '🔄', class: 'severity-sync', label: 'IMPORTAR', color: '#2196f3' },
            noPhoto: { icon: '📷', class: 'severity-nophoto', label: 'PENDIENTE', color: '#9c27b0' },
            pass: { icon: '🔀', class: 'severity-pass', label: 'MOVER', color: '#ff9800' },
            autofix: { icon: '🔧', class: 'severity-autofix', label: 'AUTO', color: '#4caf50' },
            standby: { icon: '⏸️', class: 'severity-standby', label: 'BLOQUEADO', color: '#607d8b' }
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

        // Botões de ação baseados no tipo de problema
        let actionButtons = this.renderActionButtons(issue);

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
                    <div>G: ${issue.mongoQb || '-'}</div>
                    <div>C: ${issue.cdeQb || '-'}</div>
                </td>
                <td style="text-align: center;">
                    ${actionButtons}
                </td>
            </tr>
        `;
    }

    renderActionButtons(issue) {
        // SIN FOTO não tem ação - requer fotografar
        if (issue.category === 'noPhoto') {
            return '-';
        }

        // STANDBY: Se tem foto no R2, pode preparar. Se não, precisa fotografar primeiro.
        if (issue.category === 'standby') {
            if (issue.hasR2Photo) {
                return `
                    <button
                        onclick="window.monitor.executeImportStandby('${issue.photoNumber}')"
                        style="
                            background: linear-gradient(135deg, #607d8b 0%, #455a64 100%);
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 11px;
                            font-weight: 600;
                            display: inline-flex;
                            align-items: center;
                            gap: 6px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.3)';"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.2)';"
                        title="Preparar registro para cuando sea liberado en CDE"
                    >
                        <i class="fas fa-clock"></i> Preparar
                    </button>
                `;
            }
            return '-';
        }

        // Detectar tipo de problema baseado na descrição
        const isRetorno = issue.issue && issue.issue.includes('Posible retorno');
        const isPase = issue.issue && issue.issue.includes('PASE');
        const isCritical = issue.issue && issue.issue.includes('RIESGO DE VENTA DUPLICADA');
        const isSyncPending = issue.issue && issue.issue.includes('pendiente de sincronización');

        // SYNC PENDIENTE: Foto existe no R2 e CDE mas não no MongoDB → Importar
        if (isSyncPending) {
            return `
                <button
                    onclick="window.monitor.executeImport('${issue.photoNumber}', '${issue.cdeQb || ''}')"
                    style="
                        background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 11px;
                        font-weight: 600;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        transition: all 0.2s;
                    "
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.3)';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.2)';"
                    title="Importar foto a la Galería"
                >
                    <i class="fas fa-download"></i> Importar
                </button>
            `;
        }

        // CRÍTICO: MongoDB=available, CDE=RETIRADO → Marcar como vendida
        if (isCritical) {
            return `
                <button
                    onclick="window.monitor.openVendidaModal('${issue.photoNumber}')"
                    style="
                        background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 11px;
                        font-weight: 600;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        transition: all 0.2s;
                    "
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.3)';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.2)';"
                    title="Marcar como vendida (sincronizar con CDE)"
                >
                    <i class="fas fa-ban"></i> Vendida
                </button>
            `;
        }

        if (isRetorno) {
            // Botão de ANALIZAR (antes Retorno)
            return `
                <button
                    onclick="window.monitor.openRetornoModal('${issue.photoNumber}')"
                    style="
                        background: linear-gradient(135deg, #ffc107 0%, #ffa000 100%);
                        color: #333;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 11px;
                        font-weight: 600;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        transition: all 0.2s;
                    "
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.3)';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.2)';"
                    title="Analizar situación y ver opciones"
                >
                    <i class="fas fa-search"></i> Analizar
                </button>
            `;
        } else if (isPase) {
            // Botão de PASE
            return `
                <button
                    onclick="window.monitor.openPaseModal('${issue.photoNumber}')"
                    style="
                        background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 11px;
                        font-weight: 600;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        transition: all 0.2s;
                    "
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.3)';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.2)';"
                    title="Aplicar PASE (mover foto en R2)"
                >
                    <i class="fas fa-exchange-alt"></i> Pase
                </button>
            `;
        } else if (issue.syncCanFix) {
            return '<span style="background: rgba(76,175,80,0.2); color: #81c784; padding: 4px 8px; border-radius: 4px; font-size: 11px;">⚡ Auto</span>';
        } else if (issue.needsManualReview) {
            return '<span style="background: rgba(255,193,7,0.2); color: #ffc107; padding: 4px 8px; border-radius: 4px; font-size: 11px;">👁️ Manual</span>';
        }

        return '-';
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
            'INGRESADO': 'Disponible',
            'PRE-SELECTED': 'Pre-selec.',
            'CONFIRMED': 'Confirmado',
            'RETIRADO': 'Vendido',
            'RESERVED': 'Reservado',
            'STANDBY': 'Bloqueado',
            'NO EXISTE': 'Solo CDE',
            'N/A': 'Solo CDE'
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

    async openRetornoModal(photoNumber) {
        // Mostrar loading primeiro
        this.showLoadingModal(photoNumber, 'retorno');

        try {
            // Buscar dados completos da foto
            const photoData = await this.fetchPhotoData(photoNumber);

            if (!photoData) {
                throw new Error('No se pudo obtener información de la foto');
            }

            // Analisar se QB mudou (seria PASE, não retorno)
            const qbChanged = photoData.mongoQb !== photoData.cdeQb;

            // Fechar loading
            document.getElementById('loadingModal')?.remove();

            if (qbChanged) {
                // QB mudou - não é retorno simples, é PASE!
                this.showPaseWarningModal(photoNumber, photoData);
            } else {
                // QB não mudou - retorno simples
                this.showRetornoConfirmModal(photoNumber, photoData);
            }

        } catch (error) {
            console.error('Error al abrir modal:', error);
            document.getElementById('loadingModal')?.remove();
            alert(`Error: ${error.message}`);
        }
    }

    showLoadingModal(photoNumber, action) {
        const modal = document.createElement('div');
        modal.id = 'loadingModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;

        modal.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 16px;
                padding: 48px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">
                    <i class="fas fa-spinner fa-spin" style="color: #4caf50;"></i>
                </div>
                <div style="color: #fff; font-size: 16px;">
                    Analizando foto ${photoNumber}...
                </div>
                <div style="color: #888; font-size: 13px; margin-top: 8px;">
                    Verificando Galería y CDE
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    async fetchPhotoData(photoNumber) {
        const sessionData = localStorage.getItem('sunshineSession');
        const session = JSON.parse(sessionData);

        const response = await fetch(`/api/monitor-actions/photo-info/${photoNumber}`, {
            headers: { 'Authorization': `Bearer ${session.token}` }
        });

        if (!response.ok) {
            throw new Error('Error al obtener datos de la foto');
        }

        return await response.json();
    }

    showRetornoConfirmModal(photoNumber, data) {
        const modal = document.createElement('div');
        modal.id = 'retornoModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
            padding: 16px;
            box-sizing: border-box;
        `;

        modal.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 16px;
                padding: 20px;
                max-width: 520px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border-radius: 10px;
                        background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
                        flex-shrink: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                    ">
                        <i class="fas fa-undo"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0; color: #fff; font-size: 18px;">Confirmar Retorno</h3>
                        <p style="margin: 2px 0 0 0; color: #888; font-size: 12px;">Foto: ${photoNumber}</p>
                    </div>
                </div>

                ${data.isCollision ? `
                <!-- Alerta de Colisão Compacto -->
                <div style="
                    background: rgba(244,67,54,0.12);
                    border: 1px solid #f44336;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 12px;
                ">
                    <div style="color: #f44336; font-weight: 600; font-size: 13px; margin-bottom: 6px;">
                        ⚠️ COLISIÓN: Número Reutilizado
                    </div>
                    <div style="color: #ffcdd2; font-size: 11px; line-height: 1.5;">
                        <strong>Galería:</strong> IDH ${data.mongoIdh || 'N/A'} (${data.mongoQb || '-'})<br>
                        <strong>CDE:</strong> ${data.collisionDetails?.cdeIdhs?.join(', ') || data.cdeIdh || 'N/A'}<br>
                        <strong>Estados CDE:</strong> ${data.collisionDetails?.cdeStatuses?.join(', ') || '-'}
                    </div>
                    <div style="
                        margin-top: 10px;
                        padding-top: 10px;
                        border-top: 1px solid rgba(244,67,54,0.3);
                        color: #fff;
                        font-size: 11px;
                    ">
                        <strong style="color: #4caf50;">Acción recomendada:</strong> ${data.collisionDetails?.actionMessage || 'Revisar manualmente'}
                    </div>
                </div>
                ` : ''}

                <!-- Estado Actual -->
                <div style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                ">
                    <div style="color: #999; font-size: 12px; margin-bottom: 8px;">📊 ESTADO ACTUAL:</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <div style="color: #888; font-size: 11px;">En Galería:</div>
                            <div style="color: #f44336; font-weight: 600;">${this.translateStatus(data.mongoStatus) || 'Vendido'}</div>
                            <div style="color: #888; font-size: 11px; margin-top: 4px;">Cat: ${data.mongoQb || '-'}</div>
                            <div style="color: #888; font-size: 10px; margin-top: 2px;">IDH: ${data.mongoIdh || '-'}</div>
                        </div>
                        <div>
                            <div style="color: #888; font-size: 11px;">En CDE:</div>
                            <div style="color: #4caf50; font-weight: 600;">${this.translateStatus(data.cdeStatus) || 'Disponible'}</div>
                            <div style="color: #888; font-size: 11px; margin-top: 4px;">Cat: ${data.cdeQb || '-'}</div>
                            <div style="color: #888; font-size: 10px; margin-top: 2px;">IDH: ${data.cdeIdh || '-'}</div>
                        </div>
                    </div>
                    ${data.category ? `<div style="color: #888; font-size: 11px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
                        📁 Categoría: <span style="color: #90caf9;">${data.category}</span>
                    </div>` : ''}
                </div>

                <!-- Cambios a Aplicar -->
                <div style="
                    background: rgba(76, 175, 80, 0.1);
                    border-left: 3px solid #4caf50;
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                ">
                    <div style="color: #4caf50; font-weight: 600; margin-bottom: 12px;">✓ CAMBIOS A APLICAR:</div>
                    <div style="color: #e0e0e0; font-size: 14px; line-height: 1.8;">
                        • Estado: <strong style="color: #f44336;">Vendido</strong> → <strong style="color: #4caf50;">Disponible</strong><br>
                        • La foto volverá a aparecer en la galería<br>
                        • Categoría: <strong style="color: #90caf9;">${data.mongoQb || '-'}</strong> (sin cambios ✓)<br>
                        • Se limpiarán reservas anteriores
                    </div>
                </div>

                <!-- Aviso de Verificación -->
                <div style="
                    background: rgba(255,193,7,0.1);
                    border-left: 3px solid #ffc107;
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 24px;
                ">
                    <div style="color: #ffc107; font-size: 12px; font-weight: 600; margin-bottom: 4px;">
                        ⚠️ VERIFICACIÓN MANUAL RECOMENDADA:
                    </div>
                    <div style="color: #ffb74d; font-size: 12px; line-height: 1.5;">
                        Verifique en el CDE que la foto ${photoNumber} realmente está INGRESADO
                        y que corresponde físicamente al QB <strong>${data.mongoQb || '-'}</strong>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
                    <button
                        onclick="document.getElementById('retornoModal').remove()"
                        style="
                            background: rgba(255,255,255,0.1);
                            color: #999;
                            border: 1px solid rgba(255,255,255,0.2);
                            padding: 10px 18px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.background='rgba(255,255,255,0.15)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.1)'"
                    >
                        ${data.isCollision ? 'Cerrar' : 'Cancelar'}
                    </button>
                    ${data.isCollision && data.collisionDetails?.recommendedAction === 'reciclar' ? `
                    <button
                        onclick="window.monitor.executeReciclar('${photoNumber}')"
                        style="
                            background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
                            color: white;
                            border: none;
                            padding: 10px 18px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            box-shadow: 0 4px 12px rgba(156, 39, 176, 0.3);
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(156, 39, 176, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(156, 39, 176, 0.3)'"
                    >
                        <i class="fas fa-recycle"></i> Reciclar Número
                    </button>
                    ` : data.isCollision && data.collisionDetails?.recommendedAction === 'desativar' ? `
                    <button
                        onclick="window.monitor.executeDesativar('${photoNumber}')"
                        style="
                            background: linear-gradient(135deg, #607d8b 0%, #455a64 100%);
                            color: white;
                            border: none;
                            padding: 10px 18px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            box-shadow: 0 4px 12px rgba(96, 125, 139, 0.3);
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(96, 125, 139, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(96, 125, 139, 0.3)'"
                    >
                        <i class="fas fa-ban"></i> Desactivar Registro
                    </button>
                    ` : !data.isCollision ? `
                    <button
                        onclick="window.monitor.executeRetorno('${photoNumber}')"
                        style="
                            background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
                            color: white;
                            border: none;
                            padding: 10px 18px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(76, 175, 80, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(76, 175, 80, 0.3)'"
                    >
                        <i class="fas fa-check"></i> Confirmar Retorno
                    </button>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    showPaseWarningModal(photoNumber, data) {
        const modal = document.createElement('div');
        modal.id = 'retornoModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
            padding: 16px;
            box-sizing: border-box;
        `;

        modal.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 16px;
                padding: 20px;
                max-width: 520px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                border: 1px solid rgba(255,152,0,0.3);
            ">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border-radius: 10px;
                        background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                        flex-shrink: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 18px;
                    ">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0; color: #ff9800; font-size: 16px;">⚠️ QB Diferente Detectado</h3>
                        <p style="margin: 2px 0 0 0; color: #888; font-size: 12px;">Foto: ${photoNumber}</p>
                    </div>
                </div>

                ${data.isCollision ? `
                <!-- Alerta de Colisão Compacto -->
                <div style="
                    background: rgba(244,67,54,0.12);
                    border: 1px solid #f44336;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 12px;
                ">
                    <div style="color: #f44336; font-weight: 600; font-size: 13px; margin-bottom: 6px;">
                        ⚠️ COLISIÓN: Número Reutilizado
                    </div>
                    <div style="color: #ffcdd2; font-size: 11px; line-height: 1.5;">
                        <strong>Galería:</strong> IDH ${data.mongoIdh || 'N/A'} (${data.mongoQb || '-'})<br>
                        <strong>CDE:</strong> ${data.collisionDetails?.cdeIdhs?.join(', ') || data.cdeIdh || 'N/A'}<br>
                        <strong>Estados CDE:</strong> ${data.collisionDetails?.cdeStatuses?.join(', ') || '-'}
                    </div>
                    <div style="
                        margin-top: 10px;
                        padding-top: 10px;
                        border-top: 1px solid rgba(244,67,54,0.3);
                        color: #fff;
                        font-size: 11px;
                    ">
                        <strong style="color: #4caf50;">Acción:</strong> ${data.collisionDetails?.actionMessage || 'Revisar manualmente'}
                    </div>
                </div>
                ` : ''}

                <!-- QB Diferente -->
                <div style="
                    background: rgba(255,152,0,0.1);
                    border-left: 3px solid #ff9800;
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                ">
                    <div style="color: #ff9800; font-weight: 600; margin-bottom: 12px;">🔄 QB DIFERENTE:</div>
                    <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center;">
                        <div style="text-align: center; padding: 12px; background: rgba(244,67,54,0.2); border-radius: 8px;">
                            <div style="color: #888; font-size: 11px;">En Galería</div>
                            <div style="color: #f44336; font-weight: 600; font-size: 18px; margin-top: 4px;">
                                ${data.mongoQb || '-'}
                            </div>
                            <div style="color: #666; font-size: 10px; margin-top: 4px;">IDH: ${data.mongoIdh || '-'}</div>
                        </div>
                        <div style="color: #ff9800; font-size: 24px;">≠</div>
                        <div style="text-align: center; padding: 12px; background: rgba(76,175,80,0.2); border-radius: 8px;">
                            <div style="color: #888; font-size: 11px;">En CDE</div>
                            <div style="color: #4caf50; font-weight: 600; font-size: 18px; margin-top: 4px;">
                                ${data.cdeQb || '-'}
                            </div>
                            <div style="color: #666; font-size: 10px; margin-top: 4px;">IDH: ${data.cdeIdh || '-'}</div>
                        </div>
                    </div>
                </div>

                <!-- Explicação -->
                <div style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 24px;
                ">
                    ${data.isCollision ? `
                    <div style="color: #fff; font-size: 13px; line-height: 1.7;">
                        <strong style="color: #9c27b0;">♻️ RECICLAR NÚMERO</strong><br>
                        <span style="color: #ce93d8;">Desactiva el registro antiguo y crea uno nuevo:</span><br><br>

                        <span style="color: #f44336;">❌ Antiguo:</span> IDH ${data.mongoIdh} (${data.mongoQb}) → <strong>isActive: false</strong><br>
                        <span style="color: #4caf50;">✅ Nuevo:</span> IDH ${data.cdeIdh} (${data.cdeQb}) → <strong>available</strong><br><br>

                        <strong style="color: #4caf50;">Resultado:</strong> El nuevo couro aparecerá disponible en la galería con el QB correcto.
                    </div>
                    ` : `
                    <div style="color: #fff; font-size: 14px; line-height: 1.8;">
                        <strong style="color: #ff9800;">Esto NO es un retorno simple!</strong><br><br>

                        La foto regresó pero <strong>cambió de categoría</strong>. Esto significa que:<br><br>

                        • La foto necesita moverse en el R2<br>
                        • La categoría debe actualizarse<br>
                        • El path debe cambiar<br><br>

                        <strong>Use el botón PASE</strong> para hacer estos cambios correctamente.
                    </div>
                    `}
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
                    <button
                        onclick="document.getElementById('retornoModal').remove()"
                        style="
                            background: rgba(255,255,255,0.1);
                            color: #999;
                            border: 1px solid rgba(255,255,255,0.2);
                            padding: 10px 18px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.background='rgba(255,255,255,0.15)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.1)'"
                    >
                        ${data.isCollision ? 'Cerrar' : 'Cancelar'}
                    </button>
                    ${data.isCollision && data.collisionDetails?.recommendedAction === 'reciclar' ? `
                    <button
                        onclick="window.monitor.executeReciclar('${photoNumber}')"
                        style="
                            background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
                            color: white;
                            border: none;
                            padding: 10px 18px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            box-shadow: 0 4px 12px rgba(156, 39, 176, 0.3);
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(156, 39, 176, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(156, 39, 176, 0.3)'"
                    >
                        <i class="fas fa-recycle"></i> Reciclar Número
                    </button>
                    ` : data.isCollision && data.collisionDetails?.recommendedAction === 'desativar' ? `
                    <button
                        onclick="window.monitor.executeDesativar('${photoNumber}')"
                        style="
                            background: linear-gradient(135deg, #607d8b 0%, #455a64 100%);
                            color: white;
                            border: none;
                            padding: 10px 18px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            box-shadow: 0 4px 12px rgba(96, 125, 139, 0.3);
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(96, 125, 139, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(96, 125, 139, 0.3)'"
                    >
                        <i class="fas fa-ban"></i> Desactivar Registro
                    </button>
                    ` : !data.isCollision ? `
                    <button
                        onclick="document.getElementById('retornoModal').remove(); window.monitor.openPaseModal('${photoNumber}')"
                        style="
                            background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                            color: white;
                            border: none;
                            padding: 10px 18px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(255, 152, 0, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(255, 152, 0, 0.3)'"
                    >
                        <i class="fas fa-exchange-alt"></i> Ir a PASE
                    </button>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async executeRetorno(photoNumber) {
        console.log(`🔙 Executando retorno da foto ${photoNumber}...`);

        // Fechar modal
        const modal = document.getElementById('retornoModal');
        if (modal) modal.remove();

        // Mostrar loading
        this.showActionLoading(photoNumber, 'retorno');

        try {
            const sessionData = localStorage.getItem('sunshineSession');
            const session = JSON.parse(sessionData);

            const response = await fetch('/api/monitor-actions/retorno', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({
                    photoNumber,
                    adminUser: session.username || 'admin'
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showActionSuccess(photoNumber, 'retorno', result.message);
                // Re-scan após 2 segundos
                setTimeout(() => this.scan(), 2000);
            } else {
                throw new Error(result.message || 'Error desconocido');
            }

        } catch (error) {
            console.error('❌ Error al ejecutar retorno:', error);
            this.showActionError(photoNumber, 'retorno', error.message);
        }
    }

    openPaseModal(photoNumber) {
        alert(`Modal de PASE para foto ${photoNumber} - En desarrollo`);
    }

    // ===========================================
    // AÇÃO: IMPORTAR STANDBY
    // ===========================================
    // Importa item STANDBY para a galería como bloqueado
    async executeImportStandby(photoNumber) {
        console.log(`⏸️ Importando STANDBY ${photoNumber}...`);

        this.showActionLoading(photoNumber, 'standby');

        try {
            const sessionData = localStorage.getItem('sunshineSession');
            const session = JSON.parse(sessionData);

            const response = await fetch(`/api/monitor-actions/import-standby`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({
                    photoNumber: photoNumber,
                    adminUser: session.user?.username || 'admin'
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ STANDBY importado:', result);
                this.showActionSuccess(photoNumber, 'standby', result.message);
                setTimeout(() => this.scan(), 2000);
            } else {
                throw new Error(result.message || 'Error desconocido');
            }

        } catch (error) {
            console.error('❌ Error al importar STANDBY:', error);
            this.showActionError(photoNumber, 'standby', error.message);
        }
    }

    // ===========================================
    // AÇÃO: DESATIVAR REGISTRO (COLISÃO SEM INGRESADO)
    // ===========================================
    // Apenas desativa o registro antigo no MongoDB (todos CDE são RETIRADO)
    async executeDesativar(photoNumber) {
        console.log(`⏹️ Desativando registro ${photoNumber}...`);

        // Fechar modal se existir
        document.getElementById('retornoModal')?.remove();

        // Mostrar loading
        this.showActionLoading(photoNumber, 'desativar');

        try {
            const sessionData = localStorage.getItem('sunshineSession');
            const session = JSON.parse(sessionData);

            const response = await fetch(`/api/monitor-actions/desativar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({
                    photoNumber: photoNumber,
                    adminUser: session.user?.username || 'admin'
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ Desativação exitosa:', result);
                this.showActionSuccess(photoNumber, 'desativar', result.message);
                // Re-scan após 2 segundos
                setTimeout(() => this.scan(), 2000);
            } else {
                throw new Error(result.message || 'Error desconocido');
            }

        } catch (error) {
            console.error('❌ Error al desativar registro:', error);
            this.showActionError(photoNumber, 'desativar', error.message);
        }
    }

    // ===========================================
    // AÇÃO: RECICLAR NÚMERO (COLISÃO)
    // ===========================================
    // Desativa o registro antigo no MongoDB e cria um novo com os dados do CDE
    async executeReciclar(photoNumber) {
        console.log(`♻️ Reciclando número da foto ${photoNumber}...`);

        // Fechar modal se existir
        document.getElementById('retornoModal')?.remove();

        // Mostrar loading
        this.showActionLoading(photoNumber, 'reciclar');

        try {
            const sessionData = localStorage.getItem('sunshineSession');
            const session = JSON.parse(sessionData);

            const response = await fetch(`/api/monitor-actions/reciclar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({
                    photoNumber: photoNumber,
                    adminUser: session.user?.username || 'admin'
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ Reciclaje exitoso:', result);
                this.showActionSuccess(photoNumber, 'reciclar', result.message);
                // Re-scan após 2 segundos
                setTimeout(() => this.scan(), 2000);
            } else {
                throw new Error(result.message || 'Error desconocido');
            }

        } catch (error) {
            console.error('❌ Error al reciclar número:', error);
            this.showActionError(photoNumber, 'reciclar', error.message);
        }
    }

    // ===========================================
    // MODAL PARA MARCAR COMO VENDIDA (CRÍTICO)
    // ===========================================
    async openVendidaModal(photoNumber) {
        // Mostrar loading primeiro
        this.showLoadingModal(photoNumber, 'vendida');

        try {
            // Buscar dados completos da foto
            const photoData = await this.fetchPhotoData(photoNumber);

            if (!photoData) {
                throw new Error('No se pudo obtener información de la foto');
            }

            // Fechar loading
            document.getElementById('loadingModal')?.remove();

            // Mostrar modal de confirmação para marcar como vendida
            this.showVendidaConfirmModal(photoNumber, photoData);

        } catch (error) {
            console.error('Error al abrir modal vendida:', error);
            document.getElementById('loadingModal')?.remove();
            alert(`Error: ${error.message}`);
        }
    }

    showVendidaConfirmModal(photoNumber, data) {
        const modal = document.createElement('div');
        modal.id = 'vendidaModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 16px;
                padding: 32px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                border: 1px solid rgba(255,255,255,0.1);
            ">
                <!-- Header -->
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                    <div style="
                        width: 48px;
                        height: 48px;
                        background: rgba(244, 67, 54, 0.2);
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <i class="fas fa-ban" style="color: #f44336; font-size: 24px;"></i>
                    </div>
                    <div>
                        <h3 style="color: #f44336; margin: 0; font-size: 18px;">Marcar como Vendida</h3>
                        <p style="margin: 4px 0 0 0; color: #888; font-size: 13px;">Foto: ${photoNumber}</p>
                    </div>
                </div>

                <!-- Estado Actual -->
                <div style="
                    background: rgba(244,67,54,0.1);
                    border-left: 3px solid #f44336;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                ">
                    <div style="color: #f44336; font-weight: 600; margin-bottom: 8px;">⚠️ RIESGO DE VENTA DUPLICADA</div>
                    <div style="color: #e0e0e0; font-size: 13px; line-height: 1.6;">
                        Esta foto aparece <strong style="color: #4caf50;">disponible</strong> en la galería
                        pero está marcada como <strong style="color: #f44336;">RETIRADO (vendida)</strong> en el CDE.
                    </div>
                </div>

                <!-- Estado Comparativo -->
                <div style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                ">
                    <div style="color: #999; font-size: 12px; margin-bottom: 8px;">📊 ESTADO ACTUAL:</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <div style="color: #888; font-size: 11px;">En Galería:</div>
                            <div style="color: #4caf50; font-weight: 600;">${this.translateStatus(data.mongoStatus) || 'Disponible'}</div>
                            <div style="color: #888; font-size: 11px; margin-top: 4px;">Cat: ${data.mongoQb || '-'}</div>
                        </div>
                        <div>
                            <div style="color: #888; font-size: 11px;">En CDE:</div>
                            <div style="color: #f44336; font-weight: 600;">${this.translateStatus(data.cdeStatus) || 'Vendido'}</div>
                            <div style="color: #888; font-size: 11px; margin-top: 4px;">Cat: ${data.cdeQb || '-'}</div>
                        </div>
                    </div>
                </div>

                <!-- Cambios a Aplicar -->
                <div style="
                    background: rgba(244, 67, 54, 0.1);
                    border-left: 3px solid #f44336;
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                ">
                    <div style="color: #f44336; font-weight: 600; margin-bottom: 12px;">✓ CAMBIOS A APLICAR:</div>
                    <div style="color: #e0e0e0; font-size: 14px; line-height: 1.8;">
                        • Estado: <strong style="color: #4caf50;">Disponible</strong> → <strong style="color: #f44336;">Vendido</strong><br>
                        • La foto será removida de la galería<br>
                        • Se sincronizará con el estado del CDE
                    </div>
                </div>

                <!-- Aviso -->
                <div style="
                    background: rgba(255,193,7,0.1);
                    border-left: 3px solid #ffc107;
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 24px;
                ">
                    <div style="color: #ffc107; font-size: 12px; font-weight: 600; margin-bottom: 4px;">
                        ⚠️ VERIFICACIÓN RECOMENDADA:
                    </div>
                    <div style="color: #ffb74d; font-size: 12px; line-height: 1.5;">
                        Confirme en el CDE que la foto ${photoNumber} realmente fue vendida
                        antes de marcarla como vendida en el sistema.
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button
                        onclick="document.getElementById('vendidaModal').remove()"
                        style="
                            background: rgba(255,255,255,0.1);
                            color: #999;
                            border: 1px solid rgba(255,255,255,0.2);
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.background='rgba(255,255,255,0.15)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.1)'"
                    >
                        Cancelar
                    </button>
                    <button
                        onclick="window.monitor.executeVendida('${photoNumber}')"
                        style="
                            background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(244, 67, 54, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(244, 67, 54, 0.3)'"
                    >
                        <i class="fas fa-ban"></i> Confirmar Vendida
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async executeVendida(photoNumber) {
        console.log(`🛑 Marcando foto ${photoNumber} como vendida...`);

        // Fechar modal
        const modal = document.getElementById('vendidaModal');
        if (modal) modal.remove();

        // Mostrar loading
        this.showActionLoading(photoNumber, 'vendida');

        try {
            const sessionData = localStorage.getItem('sunshineSession');
            const session = JSON.parse(sessionData);

            const response = await fetch('/api/monitor-actions/vendida', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({
                    photoNumber: photoNumber,
                    adminUser: session.user?.username || 'admin'
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showActionSuccess(photoNumber, 'vendida', result.message || 'Foto marcada como vendida');
                // Atualizar o scan após sucesso
                setTimeout(() => this.scan(), 1000);
            } else {
                throw new Error(result.message || 'Error al marcar como vendida');
            }
        } catch (error) {
            console.error('Error al marcar como vendida:', error);
            this.showActionError(photoNumber, 'vendida', error.message);
        }
    }

    async executeImport(photoNumber, cdeQb) {
        console.log(`📥 Importando foto ${photoNumber}...`);

        // Mostrar loading
        this.showActionLoading(photoNumber, 'import');

        try {
            const sessionData = localStorage.getItem('sunshineSession');
            const session = JSON.parse(sessionData);

            const response = await fetch('/api/monitor-actions/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({
                    photoNumber: photoNumber,
                    cdeQb: cdeQb || null,
                    adminUser: session.user?.username || 'admin'
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showActionSuccess(photoNumber, 'import', result.message || 'Foto importada con éxito');
                // Atualizar o scan após sucesso
                setTimeout(() => this.scan(), 1000);
            } else {
                throw new Error(result.message || 'Error al importar foto');
            }
        } catch (error) {
            console.error('Error al importar foto:', error);
            this.showActionError(photoNumber, 'import', error.message);
        }
    }

    showActionLoading(photoNumber, action) {
        const actionNames = { retorno: 'Retorno', pase: 'Pase', import: 'Importar', vendida: 'Vendida', reciclar: 'Reciclar', desativar: 'Desactivar', standby: 'Preparar' };
        const actionName = actionNames[action] || action;
        this.showToast({
            type: 'loading',
            title: `Procesando ${actionName}...`,
            message: `Foto ${photoNumber}`,
            duration: 0 // No auto-dismiss while loading
        });
    }

    showActionSuccess(photoNumber, action, message) {
        const actionNames = { retorno: 'Retorno', pase: 'Pase', import: 'Importar', vendida: 'Vendida', reciclar: 'Reciclar', desativar: 'Desactivar', standby: 'Preparar' };
        const actionName = actionNames[action] || action;
        this.showToast({
            type: 'success',
            title: `${actionName} exitoso`,
            message: `Foto ${photoNumber}: ${message}`,
            duration: 4000
        });
    }

    showActionError(photoNumber, action, error) {
        const actionNames = { retorno: 'Retorno', pase: 'Pase', import: 'Importar', vendida: 'Vendida', reciclar: 'Reciclar', desativar: 'Desactivar', standby: 'Preparar' };
        const actionName = actionNames[action] || action;
        this.showToast({
            type: 'error',
            title: `Error en ${actionName}`,
            message: `Foto ${photoNumber}: ${error}`,
            duration: 6000
        });
    }

    showToast({ type, title, message, duration = 4000 }) {
        // Remover toast anterior se existir
        const existingToast = document.getElementById('monitorToast');
        if (existingToast) {
            existingToast.remove();
        }

        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-times-circle"></i>',
            loading: '<i class="fas fa-spinner fa-spin"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };

        const colors = {
            success: { bg: 'rgba(76, 175, 80, 0.95)', border: '#4caf50', icon: '#fff' },
            error: { bg: 'rgba(244, 67, 54, 0.95)', border: '#f44336', icon: '#fff' },
            loading: { bg: 'rgba(33, 150, 243, 0.95)', border: '#2196f3', icon: '#fff' },
            info: { bg: 'rgba(255, 193, 7, 0.95)', border: '#ffc107', icon: '#fff' }
        };

        const config = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.id = 'monitorToast';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            min-width: 320px;
            max-width: 420px;
            background: ${config.bg};
            border-left: 4px solid ${config.border};
            border-radius: 12px;
            padding: 16px 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10001;
            display: flex;
            align-items: flex-start;
            gap: 14px;
            transform: translateX(120%);
            transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            backdrop-filter: blur(10px);
        `;

        toast.innerHTML = `
            <div style="
                font-size: 24px;
                color: ${config.icon};
                flex-shrink: 0;
                margin-top: 2px;
            ">
                ${icons[type]}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="
                    font-weight: 700;
                    font-size: 15px;
                    color: #fff;
                    margin-bottom: 4px;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                ">${title}</div>
                <div style="
                    font-size: 13px;
                    color: rgba(255,255,255,0.9);
                    line-height: 1.4;
                    word-break: break-word;
                ">${message}</div>
            </div>
            ${duration > 0 ? `
                <button onclick="this.parentElement.remove()" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: #fff;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: background 0.2s;
                    font-size: 14px;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    <i class="fas fa-times"></i>
                </button>
            ` : ''}
        `;

        document.body.appendChild(toast);

        // Animar entrada
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => {
                toast.style.transform = 'translateX(120%)';
                setTimeout(() => toast.remove(), 400);
            }, duration);
        }
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