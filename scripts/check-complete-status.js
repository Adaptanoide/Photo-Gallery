require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Product = require('./src/models/Product');
const Selection = require('./src/models/Selection');

async function checkComplete() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n🎯 ANÁLISE COMPLETA DO SISTEMA:\n');
    
    // 1. Status das fotos
    const photoStats = await PhotoStatus.aggregate([
        { $group: { _id: '$virtualStatus.status', count: { $sum: 1 } } }
    ]);
    
    console.log('📸 FOTOS POR STATUS:');
    photoStats.forEach(s => {
        console.log(`   ${s._id}: ${s.count} fotos`);
    });
    
    // 2. Status dos produtos
    const productStats = await Product.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📦 PRODUTOS POR STATUS:');
    productStats.forEach(s => {
        console.log(`   ${s._id || 'sem status'}: ${s.count} produtos`);
    });
    
    // 3. Seleções
    const selections = await Selection.find({}).sort({ createdAt: -1 }).limit(5);
    console.log('\n📋 ÚLTIMAS 5 SELEÇÕES:');
    selections.forEach(s => {
        console.log(`   ${s.selectionId}: ${s.status} (${s.totalItems} items)`);
    });
    
    // 4. Fotos que foram revertidas
    const reverted = await PhotoStatus.find({
        'virtualStatus.tags': 'available',
        'virtualStatus.status': 'available'
    }).limit(3);
    
    console.log('\n🔄 FOTOS DISPONÍVEIS APÓS REVERSÃO:');
    reverted.forEach(p => {
        console.log(`   ${p.fileName}: ${p.virtualStatus.status}`);
    });
    
    await mongoose.disconnect();
}

checkComplete();
