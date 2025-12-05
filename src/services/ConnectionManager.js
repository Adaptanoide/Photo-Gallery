// src/services/ConnectionManager.js - VERSÃO OTIMIZADA COM CACHE INTELIGENTE
const mysql = require('mysql2/promise');

class ConnectionManager {
    constructor() {
        this.status = {
            cde: 'unknown',
            quickbooks: 'offline',
            gallery: 'offline',
            lastCheck: null,
            lastError: null
        };
        
        // Cache melhorado com timestamps individuais
        this.cache = {};
        
        // Configuração de conexão otimizada
        this.connectionConfig = {
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE,
            connectTimeout: 30000,  // Aumentado para 30s considerando latência de 150ms
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            waitForConnections: true
        };
        
        // Estatísticas de uso
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            totalQueries: 0,
            failedQueries: 0,
            avgResponseTime: 0
        };
        
        // Limpar cache antigo a cada 30 minutos
        setInterval(() => this.cleanupOldCache(), 30 * 60 * 1000);
    }

    async testCDEConnection() {
        const startTime = Date.now();
        try {
            const conn = await mysql.createConnection(this.connectionConfig);
            await conn.execute('SELECT 1');
            await conn.end();
            
            this.status.cde = 'online';
            this.status.lastCheck = new Date();
            this.status.lastError = null;
            
            const responseTime = Date.now() - startTime;
            this.updateAverageResponseTime(responseTime);
            
            console.log(`✅ CDE Connected (${responseTime}ms)`);
            return true;
        } catch (error) {
            console.error('❌ CDE Connection failed:', error.message);
            this.status.cde = 'offline';
            this.status.lastCheck = new Date();
            this.status.lastError = error.message;
            this.stats.failedQueries++;
            return false;
        }
    }

    /**
     * Executa query com cache inteligente
     * @param {string} key - Chave única para o cache
     * @param {Function} queryFunction - Função que executa a query
     * @param {number} cacheMinutes - Tempo de cache em minutos (padrão 10)
     * @returns {Promise<any>} Dados da query ou do cache
     */
    async executeWithCache(key, queryFunction, cacheMinutes = 10) {
        this.stats.totalQueries++;
        
        // Verificar se tem cache válido
        if (this.cache[key]) {
            const cacheEntry = this.cache[key];
            const ageInMinutes = this.getCacheAgeInMinutes(cacheEntry.timestamp);
            
            if (ageInMinutes < cacheMinutes) {
                this.stats.cacheHits++;
                console.log(`📦 Cache HIT for "${key}" (${ageInMinutes}min old)`);
                return cacheEntry.data;
            }
        }
        
        // Cache miss ou expirado - buscar dados frescos
        this.stats.cacheMisses++;
        console.log(`🔍 Cache MISS for "${key}" - fetching fresh data`);
        
        const startTime = Date.now();
        
        try {
            // Executar a query
            const result = await queryFunction();
            
            // Salvar no cache com timestamp
            this.cache[key] = {
                data: result,
                timestamp: new Date(),
                hits: 0
            };
            
            // Atualizar status e estatísticas
            this.status.cde = 'online';
            const responseTime = Date.now() - startTime;
            this.updateAverageResponseTime(responseTime);
            
            console.log(`✅ Fresh data for "${key}" fetched in ${responseTime}ms`);
            return result;
            
        } catch (error) {
            console.error(`❌ Error fetching "${key}":`, error.message);
            this.stats.failedQueries++;
            
            // Se tem cache antigo, usar ele como fallback
            if (this.cache[key]) {
                const ageInMinutes = this.getCacheAgeInMinutes(this.cache[key].timestamp);
                console.log(`⚠️ Using stale cache for "${key}" (${ageInMinutes}min old)`);
                this.cache[key].hits++;
                return this.cache[key].data;
            }
            
            // Se não tem cache, tentar com retry
            if (!this.cache[key]) {
                console.log(`🔄 Attempting retry for "${key}"`);
                return this.executeWithRetry(() => queryFunction());
            }
            
            throw error;
        }
    }

    async executeWithRetry(queryFunction, maxRetries = 2) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                const result = await queryFunction();
                this.status.cde = 'online';
                return { success: true, data: result };
            } catch (error) {
                lastError = error;
                console.log(`⚠️ Retry ${i + 1}/${maxRetries} failed:`, error.message);
                
                if (i < maxRetries - 1) {
                    // Espera progressiva: 2s, 4s, 6s...
                    await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
                }
            }
        }
        
        this.status.cde = 'offline';
        this.status.lastError = lastError.message;
        return { 
            success: false, 
            error: lastError.message,
            fallbackData: this.getRecentCacheData()
        };
    }

    /**
     * Atualiza cache manualmente
     */
    async updateCache(key, data) {
        this.cache[key] = {
            data: data,
            timestamp: new Date(),
            hits: 0
        };
        console.log(`📝 Cache updated for "${key}"`);
    }

    /**
     * Limpa cache específico
     */
    clearCache(key = null) {
        if (key) {
            delete this.cache[key];
            console.log(`🗑️ Cache cleared for "${key}"`);
        } else {
            const count = Object.keys(this.cache).length;
            this.cache = {};
            console.log(`🗑️ All cache cleared (${count} entries)`);
        }
    }

    /**
     * Retorna idade do cache em minutos
     */
    getCacheAgeInMinutes(timestamp) {
        if (!timestamp) return Infinity;
        const diff = Date.now() - new Date(timestamp).getTime();
        return Math.floor(diff / 60000);
    }

    /**
     * Retorna informações sobre o cache
     */
    getCacheInfo() {
        const cacheEntries = Object.keys(this.cache).map(key => ({
            key,
            age: this.getCacheAgeInMinutes(this.cache[key].timestamp),
            hits: this.cache[key].hits || 0
        }));
        
        return {
            totalEntries: cacheEntries.length,
            entries: cacheEntries,
            oldestEntry: Math.max(...cacheEntries.map(e => e.age)),
            stats: this.stats
        };
    }

    /**
     * Limpa cache antigo (mais de 2 horas)
     */
    cleanupOldCache() {
        const maxAgeMinutes = 120; // 2 horas
        let cleaned = 0;
        
        for (const key in this.cache) {
            const age = this.getCacheAgeInMinutes(this.cache[key].timestamp);
            if (age > maxAgeMinutes) {
                delete this.cache[key];
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} old cache entries`);
        }
    }

    /**
     * Retorna dados recentes do cache para fallback
     */
    getRecentCacheData() {
        const recentData = {};
        
        for (const key in this.cache) {
            const age = this.getCacheAgeInMinutes(this.cache[key].timestamp);
            if (age < 60) { // Menos de 1 hora
                recentData[key] = {
                    data: this.cache[key].data,
                    ageMinutes: age
                };
            }
        }
        
        return recentData;
    }

    /**
     * Atualiza tempo médio de resposta
     */
    updateAverageResponseTime(newTime) {
        const currentAvg = this.stats.avgResponseTime;
        const totalQueries = this.stats.totalQueries - this.stats.failedQueries;
        
        if (totalQueries === 0) {
            this.stats.avgResponseTime = newTime;
        } else {
            this.stats.avgResponseTime = Math.round(
                (currentAvg * (totalQueries - 1) + newTime) / totalQueries
            );
        }
    }

    /**
     * Retorna mensagem de status formatada
     */
    getStatusMessage() {
        if (this.status.cde === 'online') {
            const hitRate = this.stats.totalQueries > 0 
                ? Math.round((this.stats.cacheHits / this.stats.totalQueries) * 100)
                : 0;
            
            return `🟢 CDE Connected | Cache Hit Rate: ${hitRate}% | Avg Response: ${this.stats.avgResponseTime}ms`;
        } else if (this.status.cde === 'offline') {
            const cacheCount = Object.keys(this.cache).length;
            if (cacheCount > 0) {
                return `🟡 CDE Offline | Using cached data (${cacheCount} entries available)`;
            }
            return `🔴 CDE Offline | No cached data available`;
        } else {
            return `⚪ CDE Status Unknown | Checking connection...`;
        }
    }

    /**
     * Retorna status completo do sistema
     */
    getFullStatus() {
        return {
            services: this.status,
            cache: this.getCacheInfo(),
            performance: {
                avgResponseTime: this.stats.avgResponseTime,
                cacheHitRate: this.stats.totalQueries > 0 
                    ? Math.round((this.stats.cacheHits / this.stats.totalQueries) * 100)
                    : 0,
                totalQueries: this.stats.totalQueries,
                failedQueries: this.stats.failedQueries
            },
            message: this.getStatusMessage()
        };
    }

    /**
     * Pre-aquece o cache com queries essenciais
     */
    async warmupCache() {
        console.log('🔥 Warming up cache...');
        const startTime = Date.now();
        
        try {
            // Aqui você pode adicionar queries que deseja pre-carregar
            // Exemplo:
            // await this.executeWithCache('inventory', () => cdeQueries.getTotalInventoryAnalysis(), 30);
            // await this.executeWithCache('topProducts', () => cdeQueries.getTopSellingProducts(), 60);
            
            const elapsed = Date.now() - startTime;
            console.log(`✅ Cache warmed up in ${elapsed}ms`);
            return true;
        } catch (error) {
            console.error('❌ Cache warmup failed:', error.message);
            return false;
        }
    }
}

module.exports = new ConnectionManager();