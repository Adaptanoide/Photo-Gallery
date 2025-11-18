// public/js/inventory-monitor.js
class InventoryMonitor {
    constructor() {
        this.isScanning = false;
    }

    async scan() {
        if (this.isScanning) return;

        // ✅ VERIFICAR SE HÁ SESSÃO ANTES DE ESCANEAR
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
                throw new Error(result.message || 'Erro ao escanear');
            }

            this.displayResults(result.data);

        } catch (error) {
            console.error('Scan error:', error);
            alert('Erro ao escanear: ' + error.message);
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
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
            }
            if (status) {
                status.textContent = '🔍 Scanning inventory...';
                status.classList.add('scanning');
            }
        } else {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-search"></i> Scan Now';
            }
            if (status) {
                status.textContent = '';
                status.classList.remove('scanning');
            }
        }
    }

    displayResults(data) {
        console.log('📊 Exibindo resultados:', data);

        // Atualizar contadores
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

        // Combinar todos os problemas
        const allIssues = [
            ...data.critical.map(i => ({ ...i, severity: 'critical' })),
            ...data.medium.map(i => ({ ...i, severity: 'medium' })),
            ...data.warnings.map(i => ({ ...i, severity: 'warning' }))
        ];

        console.log(`📊 Total de problemas: ${allIssues.length}`);

        // Atualizar tabela
        const tbody = document.getElementById('discrepanciesTable');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (allIssues.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-state-icon">✅</div>
                        <div class="empty-state-text">Nenhuma inconsistência encontrada</div>
                        <div class="empty-state-subtext">Todo o inventário está sincronizado</div>
                    </td>
                </tr>
            `;
            return;
        }

        // Criar linhas da tabela
        allIssues.forEach(issue => {
            const tr = document.createElement('tr');

            // Ícone e cor por severidade
            let severityIcon, severityClass;
            if (issue.severity === 'critical') {
                severityIcon = '🔴';
                severityClass = 'severity-critical';
            } else if (issue.severity === 'medium') {
                severityIcon = '🟡';
                severityClass = 'severity-medium';
            } else {
                severityIcon = '🟢';
                severityClass = 'severity-warning';
            }

            tr.innerHTML = `
                <td>${issue.photoNumber}</td>
                <td>${issue.cdeStatus || '-'}</td>
                <td>${issue.mongoStatus || '-'}</td>
                <td>${issue.cdeQb || '-'}</td>
                <td><span class="severity-badge ${severityClass}">${severityIcon} ${issue.severity}</span></td>
                <td><strong>${issue.issue}</strong><br><small>${issue.description}</small></td>
            `;

            tbody.appendChild(tr);
        });

        console.log('✅ Tabela atualizada com', allIssues.length, 'linhas');
    }
}

// Inicializar
window.monitor = new InventoryMonitor();

// ✅ Auto-scan SOMENTE se houver sessão válida
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