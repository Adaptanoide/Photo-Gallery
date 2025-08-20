require('dotenv').config();
const mongoose = require('mongoose');
const PhotoStatus = require('./src/models/PhotoStatus');
const Product = require('./src/models/Product');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n🏷️ SISTEMA DE TAGS - STATUS ATUAL:\n');
    
    // Ver fotos com tags
    const reserved = await PhotoStatus.find({ 
        'virtualStatus.status': 'reserved' 
    });
    
    console.log(`📸 Fotos RESERVADAS (tags): ${reserved.length}`);
    reserved.forEach(p => {
        console.log(`  - ${p.fileName}:`);
        console.log(`    Status: ${p.virtualStatus.status}`);
        console.log(`    Cliente: ${p.virtualStatus.clientCode || 'nenhum'}`);
        console.log(`    Selection: ${p.virtualStatus.currentSelection || 'nenhuma'}`);
    });
    
    // Ver produtos
    const products = await Product.find({ 
        status: 'reserved_pending' 
    });
    
    console.log(`\n📦 Products RESERVED_PENDING: ${products.length}`);
    products.forEach(p => {
        console.log(`  - ${p.fileName}: ${p.status}`);
    });
    
    await mongoose.disconnect();
}

check();
