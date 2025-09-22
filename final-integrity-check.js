const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
require('dotenv').config();

async function finalCheck() {
    const cde = await mysql.createConnection({
        host: '216.246.112.6',
        port: 3306,
        user: 'tzwgctib_photos',
        password: 'T14g0@photos',
        database: 'tzwgctib_inventario'
    });
    
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('=== VERIFICAÇÃO FINAL DE INTEGRIDADE ===\n');
    
    // 1. Fotos INGRESADO no CDE que deveriam estar available no MongoDB
    const [cdeIngresado] = await cde.execute(
        'SELECT COUNT(*) as total FROM tbinventario WHERE ATIPOETIQUETA REGEXP "^[0-9]{5}$" AND AESTADOP = "INGRESADO"'
    );
    
    const mongoAvailable = await db.collection('unified_products_complete').countDocuments({
        status: 'available'
    });
    
    console.log('1. FOTOS DISPONÍVEIS:');
    console.log('   CDE INGRESADO:', cdeIngresado[0].total);
    console.log('   MongoDB available:', mongoAvailable);
    console.log('   Diferença:', Math.abs(cdeIngresado[0].total - mongoAvailable));
    
    // 2. Verificar se ainda existem inconsistências do tipo "sold sem selectionId mas INGRESADO no CDE"
    const soldNoSelection = await db.collection('unified_products_complete').find({
        status: 'sold',
        selectionId: null
    }).limit(5).toArray();
    
    let problemCount = 0;
    console.log('\n2. VERIFICANDO INCONSISTÊNCIAS:');
    for (const photo of soldNoSelection) {
        const photoNum = photo.fileName.replace('.webp', '');
        const [cdeCheck] = await cde.execute(
            'SELECT AESTADOP FROM tbinventario WHERE ATIPOETIQUETA = ?',
            [photoNum]
        );
        
        if (cdeCheck[0]?.AESTADOP === 'INGRESADO') {
            console.log(`   ❌ Foto ${photoNum}: CDE=INGRESADO mas MongoDB=sold`);
            problemCount++;
        }
    }
    
    if (problemCount === 0) {
        console.log('   ✅ Nenhuma inconsistência encontrada na amostra');
    }
    
    // 3. Estatísticas gerais
    const [cdeStats] = await cde.execute(
        'SELECT AESTADOP, COUNT(*) as total FROM tbinventario WHERE ATIPOETIQUETA REGEXP "^[0-9]{5}$" GROUP BY AESTADOP'
    );
    
    console.log('\n3. ESTATÍSTICAS CDE:');
    cdeStats.forEach(stat => {
        console.log(`   ${stat.AESTADOP}: ${stat.total}`);
    });
    
    const mongoStats = await db.collection('unified_products_complete').aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    
    console.log('\n4. ESTATÍSTICAS MONGODB:');
    mongoStats.forEach(stat => {
        console.log(`   ${stat._id}: ${stat.count}`);
    });
    
    await cde.end();
    await mongoose.connection.close();
}

finalCheck().catch(console.error);
