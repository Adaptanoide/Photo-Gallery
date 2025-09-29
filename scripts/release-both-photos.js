// scripts/release-both-photos.js
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

async function releaseBoth() {
    await mongoose.connect(process.env.MONGODB_URI);
    const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
    
    const connection = await mysql.createConnection({
        host: process.env.CDE_HOST,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    console.log('\n🔓 LIBERANDO AMBAS AS FOTOS');
    console.log('=' .repeat(50));
    
    // 1. Liberar no CDE
    console.log('Liberando no CDE...');
    await connection.execute(
        `UPDATE tbinventario 
         SET AESTADOP = 'INGRESADO',
             RESERVEDUSU = NULL,
             AFECHA = NOW()
         WHERE ATIPOETIQUETA IN ('01144', '01150')`
    );
    
    // 2. Liberar no MongoDB
    console.log('Liberando no MongoDB...');
    await UnifiedProductComplete.updateMany(
        { fileName: { $in: ['01144.webp', '01150.webp'] } },
        {
            $set: {
                status: 'available',
                cdeStatus: 'INGRESADO'
            },
            $unset: {
                reservedBy: 1,
                selectionId: 1,
                ghostStatus: 1,
                ghostReason: 1,
                cartAddedAt: 1,
                reservedAt: 1
            }
        }
    );
    
    // 3. Verificar
    const [check] = await connection.execute(
        'SELECT ATIPOETIQUETA, AESTADOP FROM tbinventario WHERE ATIPOETIQUETA IN (?, ?)',
        ['01144', '01150']
    );
    
    console.log('\n✅ RESULTADO:');
    check.forEach(row => {
        console.log(`  ${row.ATIPOETIQUETA}: ${row.AESTADOP}`);
    });
    
    console.log('\nFotos liberadas e prontas para novo teste!');
    
    await connection.end();
    await mongoose.disconnect();
}

releaseBoth();