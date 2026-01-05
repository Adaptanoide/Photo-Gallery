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

    // ========== NOVAS QUERIES PARA AI AGENT ==========

    // Query 15: Análise de Sazonalidade - Padrões de venda por mês
    async getSeasonalTrends() {
        const query = `
            SELECT
                MONTH(AFECHA_ITEMPEDIDO) as mes,
                YEAR(AFECHA_ITEMPEDIDO) as ano,
                COUNT(*) as vendas_total,
                COUNT(DISTINCT AQR_ITEMPEDIO) as pedidos,
                COUNT(DISTINCT AQBITEM_ITEMPEDIDO) as produtos_diferentes,
                ROUND(COUNT(*) / COUNT(DISTINCT WEEK(AFECHA_ITEMPEDIDO)), 1) as media_semanal
            FROM tbitem_pedido
            WHERE AFECHA_ITEMPEDIDO >= DATE_SUB(NOW(), INTERVAL 24 MONTH)
            AND AFECHA_ITEMPEDIDO IS NOT NULL
            GROUP BY YEAR(AFECHA_ITEMPEDIDO), MONTH(AFECHA_ITEMPEDIDO)
            ORDER BY ano DESC, mes DESC
            LIMIT 24
        `;

        return this.executeQuery('getSeasonalTrends', query);
    }

    // Query 16: Performance de Lead Time - Tempo de entrega por origem
    async getLeadTimeAnalysis() {
        const query = `
            SELECT
                COALESCE(items.ORIGEN, 'Unknown') as origem,
                COUNT(DISTINCT inv.AQBITEM) as produtos,
                COUNT(*) as total_items,
                ROUND(AVG(DATEDIFF(inv.AFECHA, inv.AFECHA_SHIP)), 1) as avg_lead_days,
                MIN(DATEDIFF(inv.AFECHA, inv.AFECHA_SHIP)) as min_lead_days,
                MAX(DATEDIFF(inv.AFECHA, inv.AFECHA_SHIP)) as max_lead_days
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AFECHA_SHIP IS NOT NULL
            AND inv.AFECHA IS NOT NULL
            AND inv.AFECHA >= DATE_SUB(NOW(), INTERVAL 180 DAY)
            GROUP BY items.ORIGEN
            ORDER BY total_items DESC
        `;

        return this.executeQuery('getLeadTimeAnalysis', query);
    }

    // Query 17: Produtos em Trânsito Detalhado - Com dias em trânsito
    async getDetailedTransitProducts() {
        const query = `
            SELECT
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                COALESCE(MAX(items.ORIGEN), 'Unknown') as origem,
                COUNT(*) as quantity,
                ROUND(AVG(DATEDIFF(NOW(), inv.AFECHA_SHIP)), 0) as dias_em_transito,
                MIN(inv.AFECHA_SHIP) as primeiro_envio,
                MAX(inv.AFECHA_SHIP) as ultimo_envio
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP IN ('PRE-TRANSITO', 'TRANSITO', 'WAREHOUSE')
            AND inv.AFECHA_SHIP IS NOT NULL
            GROUP BY inv.AQBITEM
            HAVING dias_em_transito > 0
            ORDER BY dias_em_transito DESC
            LIMIT 20
        `;

        return this.executeQuery('getDetailedTransitProducts', query);
    }

    // Query 18: Análise de Preço vs Velocidade
    async getPriceVelocityAnalysis() {
        const query = `
            SELECT
                ip.AQBITEM_ITEMPEDIDO as codigo,
                MAX(i.ADESCRIPTION) as produto,
                ROUND(AVG(COALESCE(i.APRECIO, 0)), 2) as precio_promedio,
                COUNT(*) as vendas_30d,
                ROUND(COUNT(*) / 30, 2) as velocidade_dia,
                COUNT(DISTINCT DATE(ip.AFECHA_ITEMPEDIDO)) as dias_com_venda
            FROM tbitem_pedido ip
            LEFT JOIN items i ON ip.AQBITEM_ITEMPEDIDO = i.AQBITEM
            WHERE ip.AFECHA_ITEMPEDIDO >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND ip.AQBITEM_ITEMPEDIDO IS NOT NULL
            GROUP BY ip.AQBITEM_ITEMPEDIDO
            HAVING vendas_30d >= 5
            ORDER BY velocidade_dia DESC
            LIMIT 20
        `;

        return this.executeQuery('getPriceVelocityAnalysis', query);
    }

    // Query 19: Produtos por Fornecedor/Origem
    async getProductsByOrigin() {
        const query = `
            SELECT
                COALESCE(items.ORIGEN, 'Unknown') as origem,
                COUNT(DISTINCT inv.AQBITEM) as produtos_unicos,
                COUNT(*) as total_em_estoque,
                ROUND(AVG(DATEDIFF(NOW(), inv.AFECHA)), 0) as dias_medio_estoque
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            GROUP BY items.ORIGEN
            ORDER BY total_em_estoque DESC
        `;

        return this.executeQuery('getProductsByOrigin', query);
    }

    // Query 20: Estoque Crítico - Produtos abaixo do mínimo com lead time
    async getCriticalStock() {
        const query = `
            SELECT
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                COALESCE(MAX(items.ORIGEN), 'Unknown') as origem,
                COUNT(*) as current_stock,
                MAX(COALESCE(items.TMIN, 50)) as minimum_stock,
                ROUND(
                    (COUNT(*) / NULLIF(MAX(COALESCE(items.TMIN, 50)), 0)) * 100,
                    0
                ) as percent_of_min
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND inv.AQBITEM IS NOT NULL
            GROUP BY inv.AQBITEM
            HAVING current_stock < minimum_stock
            ORDER BY percent_of_min ASC
            LIMIT 15
        `;

        return this.executeQuery('getCriticalStock', query);
    }

    // Query 21: Histórico de Vendas por Canal (últimos 90 dias)
    // Nota: Dados detalhados de clientes vêm do QuickBooks
    async getSalesByClient() {
        const query = `
            SELECT
                o.AIDMARKETPLACE as canal,
                COUNT(DISTINCT o.AQR_ORDEN) as pedidos,
                COUNT(ip.AQBITEM_ITEMPEDIDO) as itens_vendidos,
                MIN(o.AFECHAO) as primeira_venda,
                MAX(o.AFECHAO) as ultima_venda,
                DATEDIFF(NOW(), MAX(o.AFECHAO)) as dias_desde_ultima
            FROM tborden o
            LEFT JOIN tbitem_pedido ip ON o.AQR_ORDEN = ip.AQR_ITEMPEDIO
            WHERE o.AFECHAO >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            AND o.AIDMARKETPLACE IS NOT NULL
            AND o.AIDMARKETPLACE != ''
            GROUP BY o.AIDMARKETPLACE
            ORDER BY itens_vendidos DESC
            LIMIT 20
        `;

        return this.executeQuery('getSalesByClient', query);
    }

    // Query 22: Projeção de Estoque - Quando vai acabar baseado na velocidade
    async getStockProjection() {
        const query = `
            SELECT
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                COUNT(*) as estoque_atual,
                COALESCE(sales.vendas_30d, 0) as vendas_30d,
                ROUND(COALESCE(sales.vendas_30d, 0) / 30, 2) as media_dia,
                CASE
                    WHEN COALESCE(sales.vendas_30d, 0) > 0
                    THEN ROUND(COUNT(*) / (sales.vendas_30d / 30), 0)
                    ELSE 999
                END as dias_ate_acabar
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            LEFT JOIN (
                SELECT
                    AQBITEM_ITEMPEDIDO,
                    COUNT(*) as vendas_30d
                FROM tbitem_pedido
                WHERE AFECHA_ITEMPEDIDO >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY AQBITEM_ITEMPEDIDO
            ) sales ON inv.AQBITEM = sales.AQBITEM_ITEMPEDIDO
            WHERE inv.AESTADOP = 'INGRESADO'
            AND inv.AQBITEM IS NOT NULL
            GROUP BY inv.AQBITEM, sales.vendas_30d
            HAVING vendas_30d > 0
            ORDER BY dias_ate_acabar ASC
            LIMIT 20
        `;

        return this.executeQuery('getStockProjection', query);
    }

    // Query 23: Comparativo Mensal - Este mês vs mês passado
    async getMonthlyComparison() {
        const query = `
            SELECT
                'current_month' as periodo,
                COUNT(*) as vendas,
                COUNT(DISTINCT AQR_ITEMPEDIO) as pedidos,
                COUNT(DISTINCT AQBITEM_ITEMPEDIDO) as produtos
            FROM tbitem_pedido
            WHERE MONTH(AFECHA_ITEMPEDIDO) = MONTH(NOW())
            AND YEAR(AFECHA_ITEMPEDIDO) = YEAR(NOW())

            UNION ALL

            SELECT
                'last_month' as periodo,
                COUNT(*) as vendas,
                COUNT(DISTINCT AQR_ITEMPEDIO) as pedidos,
                COUNT(DISTINCT AQBITEM_ITEMPEDIDO) as produtos
            FROM tbitem_pedido
            WHERE MONTH(AFECHA_ITEMPEDIDO) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
            AND YEAR(AFECHA_ITEMPEDIDO) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
        `;

        return this.executeQuery('getMonthlyComparison', query);
    }

    // Query 24: Produtos Inativos - Sem venda há mais de X dias
    async getInactiveProducts(days = 60) {
        const query = `
            SELECT
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                COUNT(*) as em_estoque,
                COALESCE(MAX(last_sale.ultima_venda), 'Never') as ultima_venda,
                DATEDIFF(NOW(), MAX(last_sale.data_ultima_venda)) as dias_sem_venda
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            LEFT JOIN (
                SELECT
                    AQBITEM_ITEMPEDIDO,
                    MAX(DATE(AFECHA_ITEMPEDIDO)) as data_ultima_venda,
                    DATE_FORMAT(MAX(AFECHA_ITEMPEDIDO), '%Y-%m-%d') as ultima_venda
                FROM tbitem_pedido
                GROUP BY AQBITEM_ITEMPEDIDO
            ) last_sale ON inv.AQBITEM = last_sale.AQBITEM_ITEMPEDIDO
            WHERE inv.AESTADOP = 'INGRESADO'
            AND inv.AQBITEM IS NOT NULL
            GROUP BY inv.AQBITEM
            HAVING dias_sem_venda > ? OR dias_sem_venda IS NULL
            ORDER BY em_estoque DESC
            LIMIT 15
        `;

        return this.executeQuery('getInactiveProducts', query, [days]);
    }

    // Query 25: Busca por Código de Produto (QBITEM pattern)
    async getProductsByCode(codePattern) {
        const pattern = codePattern.includes('%') ? codePattern : `${codePattern}%`;
        const query = `
            SELECT
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                MAX(items.ACATEGORIA) as categoria,
                MAX(items.ORIGEN) as origem,
                COUNT(*) as em_estoque,
                ROUND(AVG(DATEDIFF(NOW(), inv.AFECHA)), 0) as dias_medio_estoque
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND inv.AQBITEM LIKE ?
            GROUP BY inv.AQBITEM
            ORDER BY em_estoque DESC
            LIMIT 30
        `;

        return this.executeQuery('getProductsByCode', query, [pattern]);
    }

    // Query 26: Busca por Sufixo (cor/padrão como TRI, BRI, SP, Z%)
    async getProductsBySuffix(suffix) {
        const pattern = `%${suffix}%`;
        const query = `
            SELECT
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                MAX(items.ACATEGORIA) as categoria,
                MAX(items.ORIGEN) as origem,
                COUNT(*) as em_estoque,
                ROUND(AVG(DATEDIFF(NOW(), inv.AFECHA)), 0) as dias_medio_estoque
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND inv.AQBITEM LIKE ?
            GROUP BY inv.AQBITEM
            ORDER BY em_estoque DESC
            LIMIT 30
        `;

        return this.executeQuery('getProductsBySuffix', query, [pattern]);
    }

    // Query 27: Busca por Origem específica (BRA, COL, etc)
    async getStockByOrigin(origin) {
        const query = `
            SELECT
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                MAX(items.ACATEGORIA) as categoria,
                COUNT(*) as em_estoque,
                ROUND(AVG(DATEDIFF(NOW(), inv.AFECHA)), 0) as dias_medio_estoque
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND items.ORIGEN = ?
            GROUP BY inv.AQBITEM
            ORDER BY em_estoque DESC
            LIMIT 50
        `;

        return this.executeQuery('getStockByOrigin', query, [origin]);
    }

    // Query 28: Busca produtos em trânsito por código
    async getTransitByCode(codePattern) {
        const pattern = codePattern.includes('%') ? codePattern : `${codePattern}%`;
        const query = `
            SELECT
                inv.AQBITEM as qbCode,
                MAX(items.ADESCRIPTION) as description,
                inv.AESTADOP as status,
                COUNT(*) as quantidade,
                MIN(inv.AFECHA) as data_mais_antiga,
                ROUND(AVG(DATEDIFF(NOW(), inv.AFECHA)), 0) as dias_em_transito
            FROM tbetiqueta inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP IN ('PRE-TRANSITO', 'TRANSITO', 'WAREHOUSE')
            AND inv.AQBITEM LIKE ?
            GROUP BY inv.AQBITEM, inv.AESTADOP
            ORDER BY quantidade DESC
            LIMIT 30
        `;

        return this.executeQuery('getTransitByCode', query, [pattern]);
    }

    // Query 29: Resumo rápido de um produto específico
    async getProductSummary(qbitem) {
        const query = `
            SELECT
                i.AQBITEM as qbCode,
                i.ADESCRIPTION as description,
                i.ACATEGORIA as categoria,
                i.ORIGEN as origem,
                COALESCE(stock.em_estoque, 0) as em_estoque,
                COALESCE(transit.em_transito, 0) as em_transito,
                COALESCE(sales.vendas_30d, 0) as vendas_30d,
                COALESCE(sales.vendas_90d, 0) as vendas_90d
            FROM items i
            LEFT JOIN (
                SELECT AQBITEM, COUNT(*) as em_estoque
                FROM tbinventario
                WHERE AESTADOP = 'INGRESADO'
                GROUP BY AQBITEM
            ) stock ON i.AQBITEM = stock.AQBITEM
            LEFT JOIN (
                SELECT AQBITEM, COUNT(*) as em_transito
                FROM tbetiqueta
                WHERE AESTADOP IN ('PRE-TRANSITO', 'TRANSITO', 'WAREHOUSE')
                GROUP BY AQBITEM
            ) transit ON i.AQBITEM = transit.AQBITEM
            LEFT JOIN (
                SELECT
                    AQBITEM_ITEMPEDIDO as AQBITEM,
                    SUM(CASE WHEN AFECHA_ITEMPEDIDO >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as vendas_30d,
                    SUM(CASE WHEN AFECHA_ITEMPEDIDO >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) as vendas_90d
                FROM tbitem_pedido
                GROUP BY AQBITEM_ITEMPEDIDO
            ) sales ON i.AQBITEM = sales.AQBITEM
            WHERE i.AQBITEM = ?
        `;

        return this.executeQuery('getProductSummary', query, [qbitem]);
    }

    // ========== FIM DAS NOVAS QUERIES ==========

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

    // ========== QUERIES PARA CATALOG PRODUCTS ==========

    // Query: Listar todos os produtos de catálogo (sem foto) com estoque
    async getAllCatalogProducts() {
        // Query OTIMIZADA que busca TODOS os produtos de catálogo (sem foto), incluindo sem estoque
        // Usa LEFT JOIN ao invés de NOT IN (muito mais rápido)
        // Prioriza dados do tbinventario (com estoque real) e complementa com items table
        const query = `
            SELECT
                qbItem,
                MAX(name) as name,
                MAX(category) as category,
                MAX(origin) as origin,
                MAX(stock) as stock,
                0 as basePrice
            FROM (
                -- Produtos com estoque no inventário (sem foto)
                SELECT
                    inv.AQBITEM as qbItem,
                    items.ADESCRIPTION as name,
                    items.ACATEGORIA as category,
                    items.ORIGEN as origin,
                    COUNT(*) as stock
                FROM tbinventario inv
                LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
                WHERE inv.AESTADOP = 'INGRESADO'
                AND (inv.ATIPOETIQUETA IS NULL OR inv.ATIPOETIQUETA = '')
                AND inv.AQBITEM IS NOT NULL
                AND inv.AQBITEM != ''
                -- ✅ EXCLUIR fotos únicas (52xxx e 53xxx)
                AND inv.AQBITEM NOT LIKE '52%'
                AND inv.AQBITEM NOT LIKE '53%'
                -- ✅ EXCLUIR itens específicos
                AND inv.AQBITEM NOT IN ('LC0100', '5475BR', '6001', '6002', '6003', '6011', '6012', '6013', '6022', '6023', 'MISC')
                GROUP BY inv.AQBITEM, items.ADESCRIPTION, items.ACATEGORIA, items.ORIGEN

                UNION ALL

                -- Produtos de catálogo SEM estoque (otimizado com LEFT JOIN)
                SELECT
                    i.AQBITEM as qbItem,
                    i.ADESCRIPTION as name,
                    i.ACATEGORIA as category,
                    i.ORIGEN as origin,
                    0 as stock
                FROM items i
                LEFT JOIN (
                    SELECT DISTINCT AQBITEM
                    FROM tbinventario
                    WHERE AESTADOP = 'INGRESADO'
                    AND (ATIPOETIQUETA IS NULL OR ATIPOETIQUETA = '')
                ) inv_stock ON i.AQBITEM = inv_stock.AQBITEM
                WHERE inv_stock.AQBITEM IS NULL
                AND i.AQBITEM IS NOT NULL
                AND i.AQBITEM != ''
                AND i.AQBITEM NOT LIKE '%P'
                -- ✅ EXCLUIR fotos únicas (52xxx e 53xxx)
                AND i.AQBITEM NOT LIKE '52%'
                AND i.AQBITEM NOT LIKE '53%'
                -- ✅ EXCLUIR itens específicos
                AND i.AQBITEM NOT IN ('LC0100', '5475BR', '6001', '6002', '6003', '6011', '6012', '6013', '6022', '6023', 'MISC')
                AND (
                    -- Catalog items (7xxx, 6xxx)
                    i.AQBITEM LIKE '7%'
                    OR i.AQBITEM LIKE '6%'
                    -- Special cowhide descriptions
                    OR i.ADESCRIPTION LIKE '%Printed%'
                    OR i.ADESCRIPTION LIKE '%Devore%'
                    OR i.ADESCRIPTION LIKE '%Metallic%'
                    OR i.ADESCRIPTION LIKE '%Dyed%'
                    -- Furniture category and keywords
                    OR i.ACATEGORIA = 'MOBILIARIO'
                    OR i.ADESCRIPTION LIKE '%Chair%'
                    OR i.ADESCRIPTION LIKE '%Puff%'
                    OR i.ADESCRIPTION LIKE '%Pouf%'
                    OR i.ADESCRIPTION LIKE '%Ottoman%'
                    OR i.ADESCRIPTION LIKE '%Footstool%'
                    OR i.ADESCRIPTION LIKE '%Foot Stool%'
                    OR i.ADESCRIPTION LIKE '%Bench%'
                    OR i.ADESCRIPTION LIKE '%Wingback%'
                    OR i.ADESCRIPTION LIKE '%Barrel%'
                    OR i.ADESCRIPTION LIKE '%Swivel%'
                    -- Accessories category and keywords
                    OR i.ACATEGORIA = 'ACCESORIOS'
                    OR i.ACATEGORIA = 'ACCESORIO'
                    OR i.ADESCRIPTION LIKE '%Bag%'
                    OR i.ADESCRIPTION LIKE '%Duffle%'
                    OR i.ADESCRIPTION LIKE '%Handbag%'
                    OR i.ADESCRIPTION LIKE '%Crossbody%'
                    OR i.ADESCRIPTION LIKE '%Purse%'
                    OR i.ADESCRIPTION LIKE '%Tote%'
                    OR i.ADESCRIPTION LIKE '%Pillow%'
                    OR i.ADESCRIPTION LIKE '%Coaster%'
                    OR i.ADESCRIPTION LIKE '%Place Mat%'
                    OR i.ADESCRIPTION LIKE '%Slipper%'
                    OR i.ADESCRIPTION LIKE '%Stocking%'
                    OR i.ADESCRIPTION LIKE '%Napkin%'
                    OR i.ADESCRIPTION LIKE '%Wine%'
                    OR i.ADESCRIPTION LIKE '%Koozie%'
                )
            ) AS combined
            GROUP BY qbItem
            ORDER BY category, name
        `;

        return this.executeQuery('getAllCatalogProducts', query);
    }

    // Query: Buscar estoque de um QBITEM específico (sem foto)
    async getCatalogProductStock(qbItem) {
        const query = `
            SELECT
                COUNT(*) as stock,
                COUNT(CASE WHEN AESTADOP = 'INGRESADO' THEN 1 END) as available,
                COUNT(CASE WHEN AESTADOP = 'PRE-SELECTED' THEN 1 END) as reserved
            FROM tbinventario
            WHERE AQBITEM = ?
            AND (ATIPOETIQUETA IS NULL OR ATIPOETIQUETA = '')
        `;

        const result = await this.executeQuery('getCatalogProductStock', query, [qbItem]);
        return result[0] || { stock: 0, available: 0, reserved: 0 };
    }

    // Query: Buscar detalhes de um produto de catálogo
    async getCatalogProductDetails(qbItem) {
        const query = `
            SELECT
                inv.AQBITEM as qbItem,
                MAX(items.ADESCRIPTION) as name,
                MAX(items.ACATEGORIA) as category,
                MAX(items.ORIGEN) as origin,
                0 as basePrice,
                COUNT(*) as totalStock,
                SUM(CASE WHEN inv.AESTADOP = 'INGRESADO' THEN 1 ELSE 0 END) as availableStock,
                SUM(CASE WHEN inv.AESTADOP = 'PRE-SELECTED' THEN 1 ELSE 0 END) as reservedStock
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AQBITEM = ?
            AND (inv.ATIPOETIQUETA IS NULL OR inv.ATIPOETIQUETA = '')
            GROUP BY inv.AQBITEM
        `;

        const result = await this.executeQuery('getCatalogProductDetails', query, [qbItem]);
        return result[0] || null;
    }

    // Query: Buscar IDHs disponíveis de um produto de catálogo
    async getAvailableCatalogIDHs(qbItem, limit = 100) {
        const query = `
            SELECT AIDH
            FROM tbinventario
            WHERE AQBITEM = ?
            AND AESTADOP = 'INGRESADO'
            AND (ATIPOETIQUETA IS NULL OR ATIPOETIQUETA = '')
            ORDER BY AFECHA ASC
            LIMIT ?
        `;

        return this.executeQuery('getAvailableCatalogIDHs', query, [qbItem, limit]);
    }

    // Query: Buscar produtos de catálogo por categoria
    async getCatalogProductsByCategory(category) {
        const query = `
            SELECT
                inv.AQBITEM as qbItem,
                MAX(items.ADESCRIPTION) as name,
                MAX(items.ACATEGORIA) as category,
                MAX(items.ORIGEN) as origin,
                COUNT(*) as stock,
                0 as basePrice
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND (inv.ATIPOETIQUETA IS NULL OR inv.ATIPOETIQUETA = '')
            AND items.ACATEGORIA = ?
            GROUP BY inv.AQBITEM
            HAVING stock > 0
            ORDER BY name
        `;

        return this.executeQuery('getCatalogProductsByCategory', query, [category]);
    }

    // Query: Listar categorias de catálogo com contagem
    async getCatalogCategories() {
        const query = `
            SELECT
                COALESCE(items.ACATEGORIA, 'Uncategorized') as category,
                COUNT(DISTINCT inv.AQBITEM) as productCount,
                SUM(CASE WHEN inv.AESTADOP = 'INGRESADO' THEN 1 ELSE 0 END) as totalStock
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE (inv.ATIPOETIQUETA IS NULL OR inv.ATIPOETIQUETA = '')
            AND inv.AESTADOP = 'INGRESADO'
            GROUP BY items.ACATEGORIA
            HAVING totalStock > 0
            ORDER BY totalStock DESC
        `;

        return this.executeQuery('getCatalogCategories', query);
    }

    // Query: Buscar produtos de catálogo com padrão de QBITEM
    async getCatalogProductsByPattern(pattern) {
        const searchPattern = pattern.includes('%') ? pattern : `${pattern}%`;
        const query = `
            SELECT
                inv.AQBITEM as qbItem,
                MAX(items.ADESCRIPTION) as name,
                MAX(items.ACATEGORIA) as category,
                MAX(items.ORIGEN) as origin,
                COUNT(*) as stock,
                0 as basePrice
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND (inv.ATIPOETIQUETA IS NULL OR inv.ATIPOETIQUETA = '')
            AND inv.AQBITEM LIKE ?
            GROUP BY inv.AQBITEM
            HAVING stock > 0
            ORDER BY stock DESC
            LIMIT 50
        `;

        return this.executeQuery('getCatalogProductsByPattern', query, [searchPattern]);
    }

    // ========== FIM QUERIES CATALOG ==========

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