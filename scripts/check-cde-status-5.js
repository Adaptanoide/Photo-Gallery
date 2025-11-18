// scripts/check-cde-status-5.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    const photos = ['25571', '26289', '26625', '26705', '71022'];
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🔍 VERIFICAR ESTADO CDE');
    console.log('═══════════════════════════════════════════════════\n');
    
    for (const photo of photos) {
        const [rows] = await connection.execute(
            `SELECT ATIPOETIQUETA, AESTADOP, AQBITEM, RESERVEDUSU, AFECHA
             FROM tbinventario 
             WHERE ATIPOETIQUETA = ?
             ORDER BY AFECHA DESC`,
            [photo]
        );
        
        console.log(`📸 ${photo}:`);
        rows.forEach((row, i) => {
            console.log(`   ${i+1}. Status: ${row.AESTADOP} | QB: ${row.AQBITEM} | Reservado: ${row.RESERVEDUSU || 'NULL'} | Data: ${row.AFECHA}`);
        });
        console.log('');
    }
    
    await connection.end();
}

main();