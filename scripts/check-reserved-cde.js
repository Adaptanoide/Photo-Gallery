// scripts/check-reserved-cde.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkReserved() {
    const connection = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });

    try {
        console.log('🔒 ANALISANDO PRODUTOS RESERVED NO CDE\n');
        console.log('=' .repeat(50));

        // Ver os 29 produtos RESERVED
        const [reserved] = await connection.execute(`
            SELECT ATIPOETIQUETA, RESERVEDUSU, AFECHA
            FROM tbinventario 
            WHERE AESTADOP = 'RESERVED'
            ORDER BY AFECHA DESC
            LIMIT 10
        `);
        
        console.log('\n📋 PRODUTOS RESERVED (10 mais recentes):');
        reserved.forEach((row, i) => {
            console.log(`\n${i + 1}. Foto: ${row.ATIPOETIQUETA}`);
            console.log(`   RESERVEDUSU: ${row.RESERVEDUSU || 'VAZIO'}`);
            console.log(`   Data: ${row.AFECHA}`);
        });

        // Ver padrão do RESERVEDUSU
        console.log('\n📝 PADRÕES EM RESERVEDUSU:');
        const [patterns] = await connection.execute(`
            SELECT DISTINCT RESERVEDUSU
            FROM tbinventario 
            WHERE RESERVEDUSU IS NOT NULL 
            AND RESERVEDUSU != ''
            LIMIT 10
        `);
        
        patterns.forEach(row => {
            console.log(`  - ${row.RESERVEDUSU}`);
        });

    } finally {
        await connection.end();
    }
}

checkReserved().catch(console.error);