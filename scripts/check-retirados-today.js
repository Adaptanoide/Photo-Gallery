const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRetirados() {
    const conn = await mysql.createConnection({
        host: '216.246.112.6',
        port: 3306,
        user: 'tzwgctib_photos',
        password: 'T14g0@photos',
        database: 'tzwgctib_inventario'
    });
    
    console.log('Buscando RETIRADOS de hoje...');
    
    // Buscar todos RETIRADOS de hoje
    const [rows] = await conn.execute(
        `SELECT AIDH, AESTADOP, ATIPOETIQUETA, AFECHA 
         FROM tbinventario 
         WHERE AESTADOP = 'RETIRADO' 
         AND DATE(AFECHA) = CURDATE()
         ORDER BY AFECHA DESC`
    );
    
    console.log(`Total RETIRADOS hoje: ${rows.length}`);
    
    // Procurar pelo IDH específico
    const target = rows.find(r => r.AIDH === '800002205');
    if (target) {
        console.log('\n✅ ENCONTRADO:');
        console.log(`IDH: ${target.AIDH}`);
        console.log(`ATIPOETIQUETA: ${target.ATIPOETIQUETA}`);
        console.log(`AFECHA: ${target.AFECHA}`);
    } else {
        console.log('\n❌ IDH 800002205 NÃO está como RETIRADO hoje');
    }
    
    // Mostrar últimos 5
    console.log('\nÚltimos 5 RETIRADOS:');
    rows.slice(0, 5).forEach(r => {
        console.log(`IDH: ${r.AIDH}, Foto: ${r.ATIPOETIQUETA}, Hora: ${r.AFECHA}`);
    });
    
    await conn.end();
}

checkRetirados();