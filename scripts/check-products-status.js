require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const products = await Product.find({}).limit(5);
    console.log('\n📦 PRIMEIROS 5 PRODUTOS:');
    products.forEach(p => {
        console.log(`- ${p.fileName}:`);
        console.log(`  status: ${p.status}`);
        console.log(`  reservedBy: ${JSON.stringify(p.reservedBy)}`);
    });
    
    const reserved = await Product.find({ status: 'reserved' });
    console.log(`\n🔍 Produtos com status 'reserved': ${reserved.length}`);
    
    await mongoose.disconnect();
}

check();
