// src/services/CatalogSyncService.js - Stub para funcionalidade futura

class CatalogSyncService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
    }

    static instance = null;

    static getInstance() {
        if (!CatalogSyncService.instance) {
            CatalogSyncService.instance = new CatalogSyncService();
        }
        return CatalogSyncService.instance;
    }

    startPeriodicSync(intervalMinutes = 5) {
        if (this.isRunning) {
            console.log('[CATALOG SYNC] Já está em execução');
            return;
        }

        this.isRunning = true;
        console.log(`[CATALOG SYNC] Sincronização periódica iniciada (a cada ${intervalMinutes} minutos)`);

        // Stub - não faz nada por enquanto
        this.intervalId = setInterval(() => {
            // Placeholder para sincronização futura
        }, intervalMinutes * 60 * 1000);
    }

    stopPeriodicSync() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[CATALOG SYNC] Sincronização parada');
    }

    async syncCatalog() {
        // Stub - implementar no futuro
        console.log('[CATALOG SYNC] Sincronização de catálogo (stub)');
        return { success: true, message: 'Stub - não implementado' };
    }
}

module.exports = CatalogSyncService;
