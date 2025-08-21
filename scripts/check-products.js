require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');

async function checkProducts() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const productCount = await Product.countDocuments();
    console.log(`\n📦 Products no banco: ${productCount}`);
    
    if (productCount > 1000) {
        console.log('✅ Products tem MUITOS registros - provavelmente todas as fotos!');
        
        // Ver amostra
        const sample = await Product.find().limit(5);
        console.log('\nAmostra:');
        sample.forEach(p => {
            console.log(`  ${p.fileName}: ${p.status || 'sem status'}`);
        });
    } else {
        console.log('❌ Products tem poucos registros também');
    }
    
    await mongoose.disconnect();
}

checkProducts();
