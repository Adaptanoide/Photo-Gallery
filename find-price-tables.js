// find-price-tables.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function findPriceTables() {
    console.log('💰 PROCURANDO TABELAS DE PREÇOS NO CDE\n');
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
        
        // Buscar tabelas com possíveis preços
        console.log('📋 TABELAS COM POSSÍVEL INFO DE PREÇOS:');
        const [tables] = await connection.execute(`
            SELECT DISTINCT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? 
            AND (
                TABLE_NAME LIKE '%price%' OR 
                TABLE_NAME LIKE '%prec%' OR 
                TABLE_NAME LIKE '%cost%' OR
                TABLE_NAME LIKE '%valor%' OR
                TABLE_NAME LIKE '%invoice%' OR
                TABLE_NAME LIKE '%item%'
            )
        `, [process.env.CDE_DATABASE]);
        
        for (const table of tables) {
            console.log(`\n  Tabela: ${table.TABLE_NAME}`);
            
            // Ver estrutura
            const [cols] = await connection.execute(
                `SHOW COLUMNS FROM ${table.TABLE_NAME}`
            );
            console.log('    Colunas:', cols.map(c => c.Field).join(', '));
            
            // Contar registros
            const [count] = await connection.execute(
                `SELECT COUNT(*) as total FROM ${table.TABLE_NAME}`
            );
            console.log(`    Registros: ${count[0].total}`);
        }
        
        // Explorar tbinvoice especificamente
        console.log('\n💳 EXPLORANDO tbinvoice:');
        const [invoice] = await connection.execute(`
            SELECT * FROM tbinvoice LIMIT 3
        `);
        console.log(invoice);
        
        // Explorar items
        console.log('\n📦 EXPLORANDO items:');
        const [items] = await connection.execute(`
            SELECT * FROM items 
            WHERE APRECIO IS NOT NULL 
            LIMIT 5
        `);
        if (items.length > 0) {
            items.forEach(i => {
                console.log(`  Item: ${i.AQBITEM} - Preço: ${i.APRECIO}`);
            });
        }
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
    }
}

findPriceTables();