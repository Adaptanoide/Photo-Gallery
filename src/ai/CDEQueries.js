// src/ai/CDEQueries.js - VERSÃO OTIMIZADA COM POOL E PERFORMANCE
const mysql = require('mysql2/promise');
const ConnectionManager = require('../services/ConnectionManager');

class CDEQueries {
    constructor() {
        this.pool = null;
        this.isInitialized = false;
        
        // Estatísticas de performance por query
        this.queryStats = {};
    }

    async initializePool() {
        if (this.pool && this.isInitialized) return this.pool;
        
        console.log('🔄 Initializing CDE connection pool...');
        const startTime = Date.now();
        
        try {
            this.pool = mysql.createPool({
                host: process.env.CDE_HOST || '216.246.112.6',
                user: process.env.CDE_USER,
                password: process.env.CDE_PASSWORD,
                database: process.env.CDE_DATABASE,
                connectionLimit: 3,        // Aumentado para 3 para melhor performance
                connectTimeout: 30000,     // 30 segundos
                waitForConnections: true,
                queueLimit: 10,            // Limite de queries na fila
                enableKeepAlive: true,
                keepAliveInitialDelay: 0
            });

            // Testar conexão inicial
            await this.pool.execute('SELECT 1');
            
            this.isInitialized = true;
            ConnectionManager.status.cde = 'online';
            
            const elapsed = Date.now() - startTime;
            console.log(`✅ Pool initialized in ${elapsed}ms`);
            
            // Configurar cleanup ao fechar processo
            process.on('SIGINT', () => this.close());
            process.on('SIGTERM', () => this.close());
            
            return this.pool;
            
        } catch (error) {
            console.error('❌ Pool initialization failed:', error.message);
            ConnectionManager.status.cde = 'offline';
            ConnectionManager.status.lastError = error.message;
            this.isInitialized = false;
            throw error;
        }
    }

    async connect() {
        if (!this.pool || !this.isInitialized) {
            await this.initializePool();
        }
        return this.pool;
    }

    /**
     * Executa query com logging e métricas
     */
    async executeQuery(queryName, querySQL, params = []) {
        const startTime = Date.now();
        
        try {
            const conn = await this.connect();
            const [result] = await conn.execute(querySQL, params);
            
            // Registrar métricas
            const elapsed = Date.now() - startTime;
            this.updateQueryStats(queryName, elapsed, true);
            
            if (elapsed > 5000) {
                console.warn(`⚠️ Slow query "${queryName}": ${elapsed}ms`);
            } else if (elapsed > 1000) {
                console.log(`🐢 Query "${queryName}": ${elapsed}ms`);
            }
            
            return result;
            
        } catch (error) {
            const elapsed = Date.now() - startTime;
            this.updateQueryStats(queryName, elapsed, false);
            console.error(`❌ Query "${queryName}" failed after ${elapsed}ms:`, error.message);
            throw error;
        }
    }

    updateQueryStats(queryName, responseTime, success) {
        if (!this.queryStats[queryName]) {
            this.queryStats[queryName] = {
                calls: 0,
                successes: 0,
                failures: 0,
                totalTime: 0,
                avgTime: 0,
                lastCall: null
            };
        }
        
        const stats = this.queryStats[queryName];
        stats.calls++;
        stats.totalTime += responseTime;
        stats.avgTime = Math.round(stats.totalTime / stats.calls);
        stats.lastCall = new Date();
        
        if (success) {
            stats.successes++;
        } else {
            stats.failures++;
        }
    }

    // TESTE DE CONEXÃO
    async testConnection() {
        try {
            await this.executeQuery('test', 'SELECT 1');
            ConnectionManager.status.cde = 'online';
            return true;
        } catch (error) {
            ConnectionManager.status.cde = 'offline';
            return false;
        }
    }

    // Query 1: Inventário atual - OTIMIZADA
    async getCurrentInventory() {
        const query = `
            SELECT 
                inv.AQBITEM as qbCode,
                COALESCE(items.ADESCRIPTION, inv.AQBITEM) as description,
                COUNT(*) as quantity,
                COALESCE(items.ACATEGORIA, 'Uncategorized') as category
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND inv.AQBITEM IS NOT NULL
            AND inv.AQBITEM != ''
            GROUP BY inv.AQBITEM, items.ADESCRIPTION, items.ACATEGORIA
            ORDER BY quantity DESC
            LIMIT 20
        `;
        
        return this.executeQuery('getCurrentInventory', query);
    }

    // Query 2: Produtos em carrinho - OTIMIZADA
    async getProductsInCart() {
        const query = `
            SELECT 
                RESERVEDUSU as client,
                COUNT(*) as items,
                SUBSTRING(GROUP_CONCAT(ATIPOETIQUETA SEPARATOR ', '), 1, 200) as photos
            FROM tbinventario
            WHERE AESTADOP = 'PRE-SELECTED'
            AND RESERVEDUSU IS NOT NULL
            GROUP BY RESERVEDUSU
            LIMIT 50
        `;
        
        return this.executeQuery('getProductsInCart', query);
    }

    // Query 3: Produtos em trânsito - SIMPLIFICADA
    async getProductsInTransit() {
        const query = `
            SELECT 
                AESTADOP as status,
                COUNT(*) as quantity
            FROM tbetiqueta
            WHERE AESTADOP IN ('PRE-TRANSITO', 'TRANSITO', 'WAREHOUSE')
            GROUP BY AESTADOP
        `;
        
        return this.executeQuery('getProductsInTransit', query);
    }

    // Query 4: Produtos parados - OTIMIZADA COM INDEX HINTS
    async getAgingProducts() {
        const query = `
            SELECT 
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                COUNT(*) as quantity,
                ROUND(AVG(DATEDIFF(NOW(), inv.AFECHA))) as avgDays
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND inv.AFECHA < DATE_SUB(NOW(), INTERVAL 60 DAY)
            AND inv.AQBITEM IS NOT NULL
            GROUP BY inv.AQBITEM
            HAVING quantity > 5
            ORDER BY avgDays DESC
            LIMIT 10
        `;
        
        return this.executeQuery('getAgingProducts', query);
    }

    // Query 5: Vendas recentes - OTIMIZADA
    async getRecentSales() {
        const query = `
            SELECT 
                DATE(AFECHA) as date,
                COUNT(*) as quantity
            FROM tbinventario
            WHERE AESTADOP = 'RETIRADO'
            AND AFECHA >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(AFECHA)
            ORDER BY date DESC
        `;
        
        return this.executeQuery('getRecentSales', query);
    }

    // Query 6: Análise de inventário - DIVIDIDA EM QUERIES MENORES
    async getTotalInventoryAnalysis() {
        try {
            // Query 1: Total simples (rápida)
            const totalQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(DISTINCT AQBITEM) as unique_products
                FROM tbinventario 
                WHERE AESTADOP = 'INGRESADO'
            `;
            
            const [total] = await this.executeQuery('getInventoryTotal', totalQuery);
            
            // Query 2: Top 5 categorias apenas (não todas)
            const categoryQuery = `
                SELECT 
                    COALESCE(items.ACATEGORIA, 'Uncategorized') as category,
                    COUNT(*) as quantity
                FROM tbinventario inv
                LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
                WHERE inv.AESTADOP = 'INGRESADO'
                GROUP BY items.ACATEGORIA
                ORDER BY quantity DESC
                LIMIT 5
            `;
            
            const byCategory = await this.executeQuery('getInventoryByCategory', categoryQuery);
            
            // Query 3: Velocidade simplificada
            const velocityQuery = `
                SELECT 
                    ROUND(AVG(DATEDIFF(NOW(), AFECHA))) as avg_days_in_stock
                FROM (
                    SELECT AFECHA 
                    FROM tbinventario 
                    WHERE AESTADOP = 'INGRESADO' 
                    AND AFECHA IS NOT NULL
                    ORDER BY RAND() 
                    LIMIT 1000
                ) sample
            `;
            
            const [velocity] = await this.executeQuery('getInventoryVelocity', velocityQuery);
            
            return {
                total: total,
                byCategory: byCategory,
                velocity: velocity
            };
            
        } catch (error) {
            console.error('Error in inventory analysis:', error);
            // Retornar dados básicos em caso de erro
            return {
                total: { total: 0, unique_products: 0 },
                byCategory: [],
                velocity: { avg_days_in_stock: 0 }
            };
        }
    }

    // Query 7: Restocking needs - OTIMIZADA
    async getRestockingNeeds() {
        const query = `
            SELECT 
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                COUNT(*) as current_stock,
                MAX(COALESCE(items.TMIN, 20)) as minimum_stock
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND inv.AQBITEM IS NOT NULL
            GROUP BY inv.AQBITEM
            HAVING current_stock < 100
            ORDER BY current_stock ASC
            LIMIT 15
        `;
        
        return this.executeQuery('getRestockingNeeds', query);
    }

    // Query 8: Sales analysis - COM LIMIT DINÂMICO
    async getSalesAnalysis(days = 30) {
        const query = `
            SELECT 
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                COUNT(*) as units_sold
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'RETIRADO'
            AND inv.AFECHA >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND inv.AQBITEM IS NOT NULL
            GROUP BY inv.AQBITEM
            ORDER BY units_sold DESC
            LIMIT 20
        `;
        
        return this.executeQuery('getSalesAnalysis', query, [days]);
    }

    // Query 9: Top produtos - CACHE FRIENDLY
    async getTopSellingProducts() {
        const query = `
            SELECT 
                ip.AQBITEM_ITEMPEDIDO as codigo,
                MAX(i.ADESCRIPTION) as produto,
                COUNT(*) as vendas_total,
                COUNT(DISTINCT DATE(ip.AFECHA_ITEMPEDIDO)) as dias_vendido
            FROM tbitem_pedido ip
            LEFT JOIN items i ON ip.AQBITEM_ITEMPEDIDO = i.AQBITEM
            WHERE ip.AFECHA_ITEMPEDIDO >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            AND ip.AQBITEM_ITEMPEDIDO IS NOT NULL
            GROUP BY ip.AQBITEM_ITEMPEDIDO
            ORDER BY vendas_total DESC
            LIMIT 10
        `;
        
        return this.executeQuery('getTopSellingProducts', query);
    }

    // Query 10: Performance diária - OTIMIZADA
    async getDailySalesPerformance() {
        const query = `
            SELECT 
                DATE(AFECHA_ITEMPEDIDO) as data,
                COUNT(*) as itens_vendidos,
                COUNT(DISTINCT AQR_ITEMPEDIO) as pedidos,
                COUNT(DISTINCT AQBITEM_ITEMPEDIDO) as produtos_diferentes
            FROM tbitem_pedido
            WHERE AFECHA_ITEMPEDIDO >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(AFECHA_ITEMPEDIDO)
            ORDER BY data DESC
            LIMIT 7
        `;
        
        return this.executeQuery('getDailySalesPerformance', query);
    }

    // Query 11: Sales velocity - MANTIDA SIMPLES
    async getSalesVelocity() {
        const query = `
            SELECT 
                AQBITEM_ITEMPEDIDO as codigo,
                COUNT(*) as vendas_30d,
                ROUND(COUNT(*) / 30, 1) as media_dia
            FROM tbitem_pedido
            WHERE AFECHA_ITEMPEDIDO >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND AQBITEM_ITEMPEDIDO IN ('2110', '2115', '2129', '2117', '2116')
            GROUP BY AQBITEM_ITEMPEDIDO
            ORDER BY vendas_30d DESC
        `;
        
        return this.executeQuery('getSalesVelocity', query);
    }

    // Query 12: Canais de venda - OTIMIZADA
    async getSalesByChannel() {
        const query = `
            SELECT 
                AIDMARKETPLACE as canal,
                COUNT(*) as pedidos
            FROM tborden
            WHERE AFECHAO >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND AIDMARKETPLACE IS NOT NULL
            GROUP BY AIDMARKETPLACE
            ORDER BY pedidos DESC
            LIMIT 10
        `;
        
        return this.executeQuery('getSalesByChannel', query);
    }

    // Query 13: Trending products - SIMPLIFICADA
    async getTrendingNewProducts() {
        const query = `
            SELECT 
                ip.AQBITEM_ITEMPEDIDO as codigo,
                MAX(i.ADESCRIPTION) as produto,
                COUNT(*) as vendas,
                DATEDIFF(NOW(), MIN(ip.AFECHA_ITEMPEDIDO)) as dias_no_mercado,
                ROUND(COUNT(*) / GREATEST(DATEDIFF(NOW(), MIN(ip.AFECHA_ITEMPEDIDO)), 1), 2) as vendas_por_dia
            FROM tbitem_pedido ip
            LEFT JOIN items i ON ip.AQBITEM_ITEMPEDIDO = i.AQBITEM
            WHERE ip.AFECHA_ITEMPEDIDO >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            GROUP BY ip.AQBITEM_ITEMPEDIDO
            HAVING dias_no_mercado <= 90
            ORDER BY vendas_por_dia DESC
            LIMIT 10
        `;
        
        return this.executeQuery('getTrendingNewProducts', query);
    }

    // Query 14: Inventory flow - OTIMIZADA
    async getInventoryFlow() {
        const query = `
            SELECT 
                DATE(AFECHAMOV) as data,
                SUM(IF(ATIPOMOV = '1', 1, 0)) as entradas,
                SUM(IF(ATIPOMOV = '2', 1, 0)) as saidas,
                SUM(IF(ATIPOMOV = '1', 1, -1)) as saldo_dia
            FROM tbmovimientos
            WHERE AFECHAMOV >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            AND ATIPOMOV IN ('1', '2')
            GROUP BY DATE(AFECHAMOV)
            ORDER BY data DESC
            LIMIT 7
        `;
        
        return this.executeQuery('getInventoryFlow', query);
    }

    // Método para obter estatísticas de performance
    getQueryStats() {
        const stats = [];
        
        for (const [name, data] of Object.entries(this.queryStats)) {
            stats.push({
                query: name,
                calls: data.calls,
                avgTime: `${data.avgTime}ms`,
                successRate: `${Math.round((data.successes / data.calls) * 100)}%`,
                lastCall: data.lastCall
            });
        }
        
        return stats.sort((a, b) => b.calls - a.calls);
    }

    // Fechar pool corretamente
    async close() {
        if (this.pool) {
            console.log('🔒 Closing CDE connection pool...');
            await this.pool.end();
            this.pool = null;
            this.isInitialized = false;
            ConnectionManager.status.cde = 'offline';
        }
    }
}

module.exports = CDEQueries;