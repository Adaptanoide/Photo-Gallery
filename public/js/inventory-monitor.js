// public/js/inventory-monitor.js - VERSÃO ESPANHOL COMPLETA
class InventoryMonitor {
    constructor() {
        this.isScanning = false;
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
        this.updateUI('scanning');

        try {
            const token = session.token;
            const response = await fetch('/api/inventory-monitor/scan', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Error al escanear');
            }

            this.displayResults(result.data);

        } catch (error) {
            console.error('Scan error:', error);
            alert('Error al escanear: ' + error.message);
        } finally {
            this.isScanning = false;
            this.updateUI('idle');
        }
    }

    updateUI(state) {
        const btn = document.getElementById('scanBtn');
        const status = document.getElementById('scanStatus');

        if (state === 'scanning') {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Escaneando...';
            }
            if (status) {
                status.textContent = '🔍 Escaneando inventario...';
                status.classList.add('scanning');
            }
        } else {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-search"></i> Escanear Ahora';
            }
            if (status) {
                status.textContent = '';
                status.classList.remove('scanning');
            }
        }
    }

    displayResults(data) {
        console.log('📊 Exibindo resultados:', data);

        const totalScanned = document.getElementById('totalScanned');
        const totalDiscrepancies = document.getElementById('totalDiscrepancies');
        const criticalCount = document.getElementById('criticalCount');
        const mediumCount = document.getElementById('mediumCount');
        const warningCount = document.getElementById('warningCount');

        if (totalScanned) totalScanned.textContent = data.summary.totalScanned;
        if (totalDiscrepancies) totalDiscrepancies.textContent = data.summary.totalDiscrepancies;
        if (criticalCount) criticalCount.textContent = data.summary.critical;
        if (mediumCount) mediumCount.textContent = data.summary.medium;
        if (warningCount) warningCount.textContent = data.summary.warnings;

        const allIssues = [
            ...data.critical.map(i => ({ ...i, severity: i.severity || 'critical' })),
            ...data.medium.map(i => ({ ...i, severity: 'autofix' })), // ← MUDANÇA AQUI
            ...data.warnings.map(i => ({ ...i, severity: i.severity || 'warning' }))
        ];

        console.log(`📊 Total de problemas: ${allIssues.length}`);

        const tbody = document.getElementById('discrepanciesTable');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (allIssues.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div class="empty-state-icon">✅</div>
                        <div class="empty-state-text">No se encontraron inconsistencias</div>
                        <div class="empty-state-subtext">Todo el inventario está sincronizado</div>
                    </td>
                </tr>
            `;
            return;
        }

        allIssues.forEach(issue => {
            const tr = document.createElement('tr');

            let severityIcon, severityClass, severityText;
            if (issue.severity === 'critical') {
                severityIcon = '🔴';
                severityClass = 'severity-critical';
                severityText = 'crítico';
            } else if (issue.severity === 'autofix') { // ← NOVO
                severityIcon = '🔧';
                severityClass = 'severity-autofix';
                severityText = 'auto-corrección';
            } else if (issue.severity === 'warning') {
                severityIcon = '🟡';
                severityClass = 'severity-warning';
                severityText = 'advertencia';
            } else {
                severityIcon = '🟢';
                severityClass = 'severity-info';
                severityText = 'información';
            }

            const cdeStatus = this.translateStatus(issue.cdeStatus);
            const mongoStatus = this.translateStatus(issue.mongoStatus);

            tr.innerHTML = `
                <td>${issue.photoNumber}</td>
                <td>${cdeStatus}</td>
                <td>${mongoStatus}</td>
                <td>${issue.cdeQb || '-'}</td>
                <td><span class="severity-badge ${severityClass}">${severityIcon} ${severityText}</span></td>
                <td><strong>${issue.issue}</strong><br><small>${issue.description}</small></td>
            `;

            tbody.appendChild(tr);
        });

        console.log('✅ Tabela atualizada com', allIssues.length, 'linhas');
    }

    translateStatus(status) {
        const translations = {
            'INGRESADO': 'INGRESADO',
            'RETIRADO': 'RETIRADO',
            'available': 'disponible',
            'sold': 'vendido',
            'reserved': 'reservado',
            'NÃO EXISTE': 'NO EXISTE',
            'NO EXISTE': 'NO EXISTE'
        };
        return translations[status] || status || '-';
    }
}

window.monitor = new InventoryMonitor();

document.addEventListener('DOMContentLoaded', () => {
    const sessionData = localStorage.getItem('sunshineSession');
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            if (session && session.token && session.userType === 'admin') {
                console.log('📊 Inventory Monitor ativado - disparando scan...');
                if (window.monitor && typeof window.monitor.scan === 'function') {
                    window.monitor.scan();
                }
            }
        } catch (error) {
            console.log('⚠️ Sessão inválida - scan não será executado');
        }
    }
});