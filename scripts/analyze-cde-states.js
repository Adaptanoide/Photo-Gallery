// scripts/analyze-cde-states.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function analyzeCDEStates() {
    const connection = await mysql.createConnection({
        host: '216.246.112.6',
        port: 3306,
        user: 'tzwgctib_photos',
        password: 'T14g0@photos',
        database: 'tzwgctib_inventario'
    });

    try {
        // 1. Contar estados das fotos
        console.log('\n📊 DISTRIBUIÇÃO DE ESTADOS (apenas produtos com foto):');
        const [states] = await connection.execute(`
            SELECT AESTADOP, COUNT(*) as total
            FROM tbinventario 
            WHERE ATIPOETIQUETA != '0' 
            AND ATIPOETIQUETA != ''
            GROUP BY AESTADOP
            ORDER BY total DESC
        `);
        
        states.forEach(row => {
            console.log(`  ${row.AESTADOP}: ${row.total} produtos`);
        });

        // 2. Ver uso do campo RESERVEDUSU
        console.log('\n🔍 USO DO CAMPO RESERVEDUSU:');
        const [reserved] = await connection.execute(`
            SELECT COUNT(*) as total
            FROM tbinventario 
            WHERE RESERVEDUSU IS NOT NULL 
            AND RESERVEDUSU != ''
        `);
        console.log(`  ${reserved[0].total} produtos com RESERVEDUSU preenchido`);

        // 3. Exemplos de RESERVED e STANDBY
        console.log('\n📝 EXEMPLOS DE PRODUTOS RESERVED/STANDBY COM FOTO:');
        const [examples] = await connection.execute(`
            SELECT AIDH, AESTADOP, ATIPOETIQUETA, RESERVEDUSU, DATE(AFECHA) as DATA
            FROM tbinventario 
            WHERE ATIPOETIQUETA != '0' 
            AND ATIPOETIQUETA != ''
            AND AESTADOP IN ('RESERVED', 'STANDBY')
            LIMIT 5
        `);
        
        examples.forEach(row => {
            console.log(`  IDH: ${row.AIDH}, Foto: ${row.ATIPOETIQUETA}, Estado: ${row.AESTADOP}`);
        });

    } finally {
        await connection.end();
    }
}

analyzeCDEStates().catch(console.error);