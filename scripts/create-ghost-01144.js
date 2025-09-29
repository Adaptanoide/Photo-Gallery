// scripts/create-ghost-01144.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createGhost() {
    const connection = await mysql.createConnection({
        host: process.env.CDE_HOST,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    console.log('\n🔴 Simulando Fort Myers reservando a foto 01144...');
    
    const [result] = await connection.execute(
        `UPDATE tbinventario 
         SET AESTADOP = 'RESERVED', 
             RESERVEDUSU = 'FORT_MYERS_CLIENTE_123',
             AFECHA = NOW() 
         WHERE ATIPOETIQUETA = '01144'`
    );
    
    console.log('✅ Foto 01144 agora está RESERVED para outro cliente');
    console.log('⏰ Aguarde até 5 minutos para o sync detectar...');
    
    await connection.end();
}

createGhost();