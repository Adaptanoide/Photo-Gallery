// scripts/reset-test-photos.js
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

async function resetTestPhotos() {
    await mongoose.connect(process.env.MONGODB_URI);
    const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
    const Cart = require('../src/models/Cart');
    
    const connection = await mysql.createConnection({
        host: process.env.CDE_HOST,
        user: process.env.CDE_USER,
        password: process.env.CDE_PASSWORD,
        database: process.env.CDE_DATABASE
    });
    
    console.log('\n🔄 RESET COMPLETO DAS FOTOS DE TESTE');
    console.log('=' .repeat(50));
    
    // 1. FORÇAR limpeza no CDE
    console.log('1️⃣ Resetando CDE...');
    
    await connection.execute(
        `UPDATE tbinventario 
         SET AESTADOP = 'INGRESADO',
             RESERVEDUSU = NULL,
             AFECHA = NOW()
         WHERE ATIPOETIQUETA IN ('01144', '01150')`
    );
    
    // 2. FORÇAR limpeza no MongoDB
    console.log('2️⃣ Resetando MongoDB...');
    
    await UnifiedProductComplete.updateMany(
        { fileName: { $in: ['01144.webp', '01150.webp'] } },
        {
            $set: {
                status: 'available',
                cdeStatus: 'INGRESADO'
            },
            $unset: {
                reservedBy: 1,
                ghostStatus: 1,
                ghostReason: 1,
                ghostedAt: 1,
                selectionId: 1,
                cartAddedAt: 1,
                reservedAt: 1
            }
        }
    );
    
    // 3. Deletar TODOS os carrinhos do cliente teste
    console.log('3️⃣ Limpando carrinhos...');
    await Cart.deleteMany({ clientCode: '6753' });
    
    // 4. Verificar resultado final
    console.log('\n✅ VERIFICAÇÃO FINAL:');
    
    const [cde] = await connection.execute(
        'SELECT ATIPOETIQUETA, AESTADOP, RESERVEDUSU FROM tbinventario WHERE ATIPOETIQUETA IN (?, ?) ORDER BY ATIPOETIQUETA',
        ['01144', '01150']
    );
    
    console.log('\nCDE:');
    cde.forEach(row => {
        console.log(`  ${row.ATIPOETIQUETA}: ${row.AESTADOP} (Reservado: ${row.RESERVEDUSU || 'NINGUÉM'})`);
    });
    
    const mongo = await UnifiedProductComplete.find(
        { fileName: { $in: ['01144.webp', '01150.webp'] } },
        { fileName: 1, status: 1, cdeStatus: 1, reservedBy: 1 }
    ).sort({ fileName: 1 });
    
    console.log('\nMongoDB:');
    mongo.forEach(doc => {
        console.log(`  ${doc.fileName}: ${doc.status}/${doc.cdeStatus} (Reservado: ${doc.reservedBy ? 'SIM' : 'NÃO'})`);
    });
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ AMBIENTE LIMPO!');
    
    await connection.end();
    await mongoose.disconnect();
}

resetTestPhotos();