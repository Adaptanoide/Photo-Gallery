require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const Cart = require('./src/models/Cart');
const PhotoStatus = require('./src/models/PhotoStatus');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n🔍 TESTE DO FLUXO CARRINHO → FINALIZAÇÃO\n');
    
    // 1. Ver carrinho ativo
    const cart = await Cart.findOne({ isActive: true });
    if (!cart || cart.items.length === 0) {
        console.log('❌ Carrinho vazio ou inativo!');
        console.log('👉 Por favor, adicione items pelo navegador primeiro!');
        await mongoose.disconnect();
        return;
    }
    
    console.log(`✅ Carrinho encontrado: ${cart.items.length} items`);
    
    // 2. Ver status dos Products
    console.log('\n📦 STATUS DOS PRODUCTS:');
    for (const item of cart.items) {
        const product = await Product.findById(item.productId);
        if (product) {
            console.log(`- ${product.fileName}: status = ${product.status}`);
            console.log(`  reservedBy: ${JSON.stringify(product.reservedBy)}`);
        }
    }
    
    // 3. Ver PhotoStatus
    console.log('\n🏷️ PHOTO STATUS (TAGS):');
    for (const item of cart.items) {
        const photoStatus = await PhotoStatus.findOne({ photoId: item.driveFileId });
        if (photoStatus) {
            console.log(`- ${photoStatus.fileName}: virtualStatus = ${photoStatus.virtualStatus.status}`);
        } else {
            console.log(`- ${item.fileName}: SEM PhotoStatus!`);
        }
    }
    
    await mongoose.disconnect();
}

test();
