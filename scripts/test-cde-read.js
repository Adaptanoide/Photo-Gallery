// scripts/test-cde-read.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function testRead() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.CDE_HOST,
            port: process.env.CDE_PORT,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE
        });
        
        console.log('✅ Conectado ao CDE!');
        
        // Teste de leitura
        const [result] = await conn.execute('SELECT COUNT(*) as total FROM tbinventario');
        console.log(`Total de registros: ${result[0].total}`);
        
        await conn.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

testRead();