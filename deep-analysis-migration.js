// deep-analysis-migration.js
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function deepAnalysis() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
    
    console.log('🔍 ANÁLISE PROFUNDA DA MIGRAÇÃO\n');
    
    // 1. Contar registros na nova collection
    const totalUnified = await UnifiedProductComplete.countDocuments();
    console.log(`📊 UnifiedProductComplete: ${totalUnified} fotos\n`);
    
    // 2. Conectar ao CDE
    const conn = await mysql.createConnection({
        host: process.env.CDE_HOST,
        port: process.env.CDE_PORT,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    // 3. Contar fotos Sunshine no CDE
    const [totalCDE] = await conn.execute(
        "SELECT COUNT(*) as total FROM tbinventario WHERE IDH LIKE 'S-%'"
    );
    console.log(`📊 CDE (Sunshine): ${totalCDE[0].total} fotos\n`);
    
    // 4. Verificar fotos específicas que estão faltando
    const missingPhotos = ["11998", "12008", "14785", "14806", "10629", "10609"];
    
    console.log('📸 ANÁLISE DAS FOTOS FALTANTES:\n');
    
    for (const photoNum of missingPhotos) {
        const [cdeRows] = await conn.execute(
            'SELECT IDH, AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [photoNum]
        );
        
        if (cdeRows.length > 0) {
            console.log(`${photoNum}:`);
            console.log(`  CDE IDH: ${cdeRows[0].IDH}`);
            console.log(`  CDE Estado: ${cdeRows[0].AESTADOP}`);
            console.log(`  CDE Reservado: ${cdeRows[0].RESERVEDUSU || 'Não'}`);
            
            // Verificar se tem IDH de Sunshine
            if (!cdeRows[0].IDH?.startsWith('S-')) {
                console.log(`  ⚠️ NÃO É SUNSHINE (IDH: ${cdeRows[0].IDH})`);
            }
        }
    }
    
    // 5. Verificar quantas fotos do CDE não estão no MongoDB
    const [allCDE] = await conn.execute(
        "SELECT ATIPOETIQUETA FROM tbinventario WHERE IDH LIKE 'S-%' LIMIT 100"
    );
    
    let missing = 0;
    for (const row of allCDE) {
        const exists = await UnifiedProductComplete.findOne({
            photoNumber: row.ATIPOETIQUETA
        });
        if (!exists) missing++;
    }
    
    console.log(`\n⚠️ RESULTADO: ${missing} de 100 fotos testadas estão faltando no MongoDB`);
    
    await conn.end();
    mongoose.disconnect();
}

deepAnalysis();