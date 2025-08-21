require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Product = require('./src/models/Product');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n🏷️ VERIFICAÇÃO FINAL DO SISTEMA DE TAGS:\n');
    
    // Ver fotos VENDIDAS
    const sold = await PhotoStatus.find({ 
        'virtualStatus.status': 'sold' 
    });
    
    console.log(`✅ Fotos VENDIDAS (tags): ${sold.length}`);
    sold.forEach(p => {
        console.log(`  - ${p.fileName}:`);
        console.log(`    Status: ${p.virtualStatus.status}`);
        console.log(`    Tags: ${p.virtualStatus.tags.join(', ')}`);
    });
    
    // Ver produtos VENDIDOS
    const productsSold = await Product.find({ status: 'sold' });
    console.log(`\n✅ Products VENDIDOS: ${productsSold.length}`);
    
    // Resumo
    console.log('\n📊 RESUMO DO SISTEMA:');
    const available = await PhotoStatus.countDocuments({ 'virtualStatus.status': 'available' });
    const reserved = await PhotoStatus.countDocuments({ 'virtualStatus.status': 'reserved' });
    const soldCount = await PhotoStatus.countDocuments({ 'virtualStatus.status': 'sold' });
    
    console.log(`  - Disponíveis: ${available}`);
    console.log(`  - Reservadas: ${reserved}`);
    console.log(`  - Vendidas: ${soldCount}`);
    console.log(`  - TOTAL: ${available + reserved + soldCount}`);
    
    await mongoose.disconnect();
}

check();
