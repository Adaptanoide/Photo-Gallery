// explore-items-table.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function exploreItems() {
    console.log('📦 EXPLORANDO TABELA items COMPLETA\n');
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
        
        // 1. Ver estrutura completa
        console.log('ESTRUTURA DA TABELA items:');
        console.log('-'.repeat(50));
        const [structure] = await connection.execute('DESCRIBE items');
        structure.forEach(col => {
            console.log(`${col.Field}: ${col.Type}`);
        });
        
        // 2. Ver alguns registros exemplo
        console.log('\nEXEMPLOS DE ITEMS:');
        console.log('-'.repeat(50));
        const [items] = await connection.execute(`
            SELECT AID, AQBITEM, ADESCRIPTION, ACATEGORIA, ASUBCATEGORIA
            FROM items 
            WHERE ADESCRIPTION IS NOT NULL
            LIMIT 10
        `);
        
        items.forEach(item => {
            console.log(`\nQB: ${item.AQBITEM}`);
            console.log(`Descrição: ${item.ADESCRIPTION}`);
            console.log(`Categoria: ${item.ACATEGORIA}`);
            console.log(`Subcategoria: ${item.ASUBCATEGORIA}`);
        });
        
        // 3. Buscar items que estão no inventário
        console.log('\n\nITEMS QUE EXISTEM NO INVENTÁRIO:');
        console.log('-'.repeat(50));
        const [matching] = await connection.execute(`
            SELECT 
                i.AQBITEM,
                i.ADESCRIPTION,
                COUNT(inv.ATIPOETIQUETA) as quantidade_em_estoque
            FROM items i
            JOIN tbinventario inv ON i.AQBITEM = inv.AQBITEM
            WHERE inv.AESTADOP = 'INGRESADO'
            GROUP BY i.AQBITEM, i.ADESCRIPTION
            ORDER BY quantidade_em_estoque DESC
            LIMIT 10
        `);
        
        matching.forEach(m => {
            console.log(`${m.AQBITEM}: ${m.ADESCRIPTION} (${m.quantidade_em_estoque} em estoque)`);
        });
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
    }
}

exploreItems();