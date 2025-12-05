// src/ai/CDEQueries.js
const mysql = require('mysql2/promise');

class CDEQueries {
    constructor() {
        this.connection = null;
    }
    
    async connect() {
        if (!this.connection) {
            this.connection = await mysql.createConnection({
                host: process.env.CDE_HOST,
                user: process.env.CDE_USER,
                password: process.env.CDE_PASSWORD,
                database: process.env.CDE_DATABASE
            });
        }
        return this.connection;
    }
    
    // Query 1: Inventário atual com descrições
    async getCurrentInventory() {
        const conn = await this.connect();
        const [result] = await conn.execute(`
            SELECT 
                inv.AQBITEM as qbCode,
                items.ADESCRIPTION as description,
                COUNT(*) as quantity,
                items.ACATEGORIA as category
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND inv.AQBITEM IS NOT NULL
            GROUP BY inv.AQBITEM, items.ADESCRIPTION, items.ACATEGORIA
            ORDER BY quantity DESC
            LIMIT 20
        `);
        return result;
    }
    
    // Query 2: Produtos em carrinho
    async getProductsInCart() {
        const conn = await this.connect();
        const [result] = await conn.execute(`
            SELECT 
                RESERVEDUSU as client,
                COUNT(*) as items,
                GROUP_CONCAT(ATIPOETIQUETA SEPARATOR ', ') as photos
            FROM tbinventario
            WHERE AESTADOP = 'PRE-SELECTED'
            GROUP BY RESERVEDUSU
        `);
        return result;
    }
    
    // Query 3: Produtos em trânsito
    async getProductsInTransit() {
        const conn = await this.connect();
        const [result] = await conn.execute(`
            SELECT 
                AESTADOP as status,
                COUNT(*) as quantity
            FROM tbetiqueta
            WHERE AESTADOP IN ('PRE-TRANSITO', 'TRANSITO', 'WAREHOUSE')
            GROUP BY AESTADOP
        `);
        return result;
    }
    
    // Query 4: Produtos parados (aging)
    async getAgingProducts() {
        const conn = await this.connect();
        const [result] = await conn.execute(`
            SELECT 
                inv.AQBITEM as qbCode,
                items.ADESCRIPTION as description,
                COUNT(*) as quantity,
                AVG(DATEDIFF(NOW(), inv.AFECHA)) as avgDays
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            AND inv.AFECHA < DATE_SUB(NOW(), INTERVAL 60 DAY)
            GROUP BY inv.AQBITEM, items.ADESCRIPTION
            HAVING quantity > 5
            ORDER BY avgDays DESC
            LIMIT 10
        `);
        return result;
    }
    
    // Query 5: Vendas recentes
    async getRecentSales() {
        const conn = await this.connect();
        const [result] = await conn.execute(`
            SELECT 
                DATE(AFECHA) as date,
                COUNT(*) as quantity
            FROM tbinventario
            WHERE AESTADOP = 'RETIRADO'
            AND AFECHA >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(AFECHA)
            ORDER BY date DESC
        `);
        return result;
    }

    // Query 6: Análise completa de inventário
    async getTotalInventoryAnalysis() {
        const conn = await this.connect();
        
        // Total geral
        const [total] = await conn.execute(`
            SELECT COUNT(*) as total,
                COUNT(DISTINCT AQBITEM) as unique_products
            FROM tbinventario 
            WHERE AESTADOP = 'INGRESADO'
        `);
        
        // Por categoria
        const [byCategory] = await conn.execute(`
            SELECT 
                items.ACATEGORIA as category,
                COUNT(*) as quantity,
                COUNT(DISTINCT inv.AQBITEM) as unique_items
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            GROUP BY items.ACATEGORIA
            ORDER BY quantity DESC
        `);
        
        // Velocidade média
        const [velocity] = await conn.execute(`
            SELECT 
                AVG(DATEDIFF(NOW(), AFECHA)) as avg_days_in_stock
            FROM tbinventario
            WHERE AESTADOP = 'INGRESADO'
        `);
        
        return {
            total: total[0],
            byCategory,
            velocity: velocity[0]
        };
    }

    // Query 7: Produtos que precisam reposição
    async getRestockingNeeds() {
        const conn = await this.connect();
        const [result] = await conn.execute(`
            SELECT 
                inv.AQBITEM as qbCode,
                items.ADESCRIPTION as description,
                COUNT(*) as current_stock,
                items.TMIN as minimum_stock
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            GROUP BY inv.AQBITEM, items.ADESCRIPTION, items.TMIN
            HAVING current_stock < 100
            ORDER BY current_stock ASC
            LIMIT 15
        `);
        return result;
    }

    // Query 8: Análise de vendas detalhada
    async getSalesAnalysis(days = 30) {
        const conn = await this.connect();
        const [result] = await conn.execute(`
            SELECT 
                inv.AQBITEM as qbCode,
                items.ADESCRIPTION as description,
                COUNT(*) as units_sold,
                DATE(inv.AFECHA) as sale_date
            FROM tbinventario inv
            LEFT JOIN items ON inv.AQBITEM = items.AQBITEM
            WHERE inv.AESTADOP = 'RETIRADO'
            AND inv.AFECHA >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY inv.AQBITEM, items.ADESCRIPTION, DATE(inv.AFECHA)
            ORDER BY units_sold DESC
            LIMIT 20
        `, [days]);
        return result;
    }
    
    async close() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }
}

module.exports = CDEQueries;