// scripts/verify-cde-status.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyStatus(photoNumber) {
    const connection = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    const [result] = await connection.execute(
        'SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
        [photoNumber]
    );
    
    if (result.length > 0) {
        console.log(`\n📸 Foto ${photoNumber}:`);
        console.log(`Estado: ${result[0].AESTADOP}`);
        console.log(`RESERVEDUSU: ${result[0].RESERVEDUSU || 'VAZIO'}`);
        
        if (result[0].AESTADOP === 'RESERVED') {
            console.log('✅ SUCESSO! Está RESERVED no CDE!');
        }
    }
    
    await connection.end();
}

// Usar a foto que você adicionou
verifyStatus('08182').catch(console.error);