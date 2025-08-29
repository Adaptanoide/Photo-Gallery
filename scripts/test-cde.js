// Criar arquivo test-cde.js
const mysql = require('mysql2/promise');

async function checkCDE() {
    const conn = await mysql.createConnection({
        host: '216.246.112.6',
        port: 3306,
        user: 'tzwgctib_photos',
        password: 'T14g0@photos',
        database: 'tzwgctib_inventario'
    });
    
    // Ver últimos 5 RETIRADOS
    const [rows] = await conn.execute(
        "SELECT AIDH, AESTADOP, ATIPOETIQUETA FROM tbinventario WHERE AESTADOP = 'RETIRADO' ORDER BY AFECHA DESC LIMIT 5"
    );
    console.log('Últimos RETIRADOS:', rows);
    
    // Buscar 02205
    const [search] = await conn.execute(
        "SELECT * FROM tbinventario WHERE AIDH LIKE ? OR ATIPOETIQUETA = ?",
        ['%02205%', '02205']
    );
    console.log('Busca por 02205:', search);
    
    await conn.end();
}

checkCDE();