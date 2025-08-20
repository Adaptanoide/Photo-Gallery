require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const PhotoStatus = require('./src/models/PhotoStatus');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const totalProducts = await Product.countDocuments();
    const totalPhotoStatus = await PhotoStatus.countDocuments();
    
    console.log('📊 ESTADO DO BANCO:');
    console.log(`- Products: ${totalProducts}`);
    console.log(`- PhotoStatus: ${totalPhotoStatus}`);
    
    // Pegar uma foto de exemplo
    const sampleProduct = await Product.findOne().limit(1);
    if (sampleProduct) {
        console.log('\n📸 Exemplo de foto:');
        console.log(`- ID: ${sampleProduct.driveFileId}`);
        console.log(`- Nome: ${sampleProduct.fileName}`);
        console.log(`- Categoria: ${sampleProduct.category}`);
    }
    
    // Ver se alguma tem virtualStatus
    const withVirtual = await PhotoStatus.countDocuments({ 
        'virtualStatus.status': { $exists: true } 
    });
    console.log(`\n🏷️ PhotoStatus com virtualStatus: ${withVirtual}`);
    
    await mongoose.disconnect();
}

check();
