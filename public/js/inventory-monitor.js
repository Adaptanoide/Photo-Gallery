// public/js/inventory-monitor.js
class InventoryMonitor {
    constructor() {
        this.isScanning = false;
    }

    async scan() {
        if (this.isScanning) return;
        
        this.isScanning = true;
        this.updateUI('scanning');
        
        try {
            const token = JSON.parse(localStorage.getItem('sunshineSession')).token;
            const response = await fetch('/api/inventory-monitor/scan', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            this.displayResults(data.data);
            
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
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
            status.textContent = '🔍 Scanning inventory...';
            status.classList.add('scanning');
        } else {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-search"></i> Scan Now';
            status.textContent = '';
            status.classList.remove('scanning');
        }
    }

    displayResults(data) {
        // Stats
        document.getElementById('totalScanned').textContent = data.summary.totalScanned;
        document.getElementById('totalDiscrepancies').textContent = data.summary.totalDiscrepancies;
        document.getElementById('criticalCount').textContent = data.summary.critical;
        document.getElementById('mediumCount').textContent = data.summary.medium;
        document.getElementById('warningCount').textContent = data.summary.warning;
        
        // Table
        const tbody = document.getElementById('discrepanciesTable');
        tbody.innerHTML = '';
        
        if (data.discrepancies.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div class="empty-state-icon">✅</div>
                        <div class="empty-state-text">No discrepancies found</div>
                        <div class="empty-state-subtext">All inventory is synchronized</div>
                    </td>
                </tr>
            `;
            return;
        }
        
        data.discrepancies.forEach(d => {
            const tr = document.createElement('tr');
            const severityIcon = d.severity === 'critical' ? '🔴' : 
                                 d.severity === 'medium' ? '🟡' : '⚠️';
            
            tr.innerHTML = `
                <td>${d.photoNumber}</td>
                <td>${d.cdeStatus}</td>
                <td>${d.mongoStatus}</td>
                <td>${d.cdeQbItem}</td>
                <td><span class="severity-badge ${d.severity}">${severityIcon} ${d.severity}</span></td>
                <td>${d.issue}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

window.monitor = new InventoryMonitor();