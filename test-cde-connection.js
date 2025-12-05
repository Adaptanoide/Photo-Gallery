// test-cde-connection.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
    console.log('Testando conexão com CDE...');
    console.log('Host:', process.env.CDE_HOST);
    
    try {
        const conn = await mysql.createConnection({
            host: process.env.CDE_HOST,
            user: process.env.CDE_USER,
            password: process.env.CDE_PASSWORD,
            database: process.env.CDE_DATABASE,
            connectTimeout: 10000
        });
        
        console.log('✅ Conectado!');
        
        // Query simples
        const [result] = await conn.execute('SELECT COUNT(*) as total FROM tbinventario');
        console.log('Total de produtos:', result[0].total);
        
        await conn.end();
        console.log('✅ Teste completo!');
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

testConnection();