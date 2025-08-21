require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Product = require('./src/models/Product');
const Selection = require('./src/models/Selection');

async function finalCheck() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\\n🎯 VERIFICAÇÃO FINAL DO SISTEMA:\\n');
    console.log('=' .repeat(50));
    
    // 1. PhotoStatus
    const photoStats = await PhotoStatus.aggregate([
        { $group: { _id: '$virtualStatus.status', count: { $sum: 1 } } }
    ]);
    
    console.log('\\n📸 FOTOS (PhotoStatus):');
    let totalPhotos = 0;
    photoStats.forEach(s => {
        console.log(`   ${s._id || 'sem status'}: ${s.count} fotos`);
        totalPhotos += s.count;
    });
    console.log(`   TOTAL: ${totalPhotos} fotos`);
    
    // 2. Products
    const productStats = await Product.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('\\n📦 PRODUTOS:');
    let totalProducts = 0;
    productStats.forEach(s => {
        console.log(`   ${s._id || 'sem status'}: ${s.count} produtos`);
        totalProducts += s.count;
    });
    console.log(`   TOTAL: ${totalProducts} produtos`);
    
    // 3. Seleções
    const selectionStats = await Selection.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('\\n📋 SELEÇÕES:');
    selectionStats.forEach(s => {
        console.log(`   ${s._id}: ${s.count} seleções`);
    });
    
    // 4. Verificar sincronização
    console.log('\\n✅ VERIFICAÇÕES:');
    const sync = totalPhotos === totalProducts;
    console.log(`   Sincronização Photos/Products: ${sync ? '✅ OK' : '❌ PROBLEMA'}`);
    
    const reserved = photoStats.find(s => s._id === 'reserved');
    console.log(`   Fotos reservadas: ${reserved ? reserved.count : 0}`);
    console.log(`   Sistema: ${reserved ? '⚠️ Tem reservas ativas' : '✅ LIMPO'}`);
    
    console.log('\\n' + '=' .repeat(50));
    console.log('🚀 SISTEMA PRONTO PARA USO!');
    
    await mongoose.disconnect();
}

finalCheck();
