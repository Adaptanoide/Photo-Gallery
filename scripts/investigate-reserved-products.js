// scripts/investigate-reserved-products.js
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const Cart = require('../src/models/Cart');
require('dotenv').config();

async function investigate() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🔍 INVESTIGANDO PRODUTOS RESERVED\n');
    console.log('=' .repeat(60));
    
    // 1. Ver produtos reserved do cliente 6753
    console.log('\n📦 Cliente 6753:');
    const client6753 = await Product.find({ 
        status: 'reserved',
        'reservedBy.clientCode': '6753' 
    });
    
    for (const prod of client6753) {
        const photoNum = prod.driveFileId?.split('/').pop()?.replace('.webp', '');
        console.log(`  Foto ${photoNum}:`);
        console.log(`    Status: ${prod.status}`);
        console.log(`    Atualizado: ${prod.updatedAt}`);
        console.log(`    SessionId: ${prod.reservedBy?.sessionId}`);
    }
    
    // 2. Ver o carrinho real do 6753
    const cart6753 = await Cart.findOne({ clientCode: '6753' });
    console.log(`\n  Carrinho tem ${cart6753?.items?.length || 0} items`);
    
    // 3. Ver produtos reserved do cliente 2028
    console.log('\n📦 Cliente 2028:');
    const client2028 = await Product.find({ 
        status: 'reserved',
        'reservedBy.clientCode': '2028' 
    });
    
    for (const prod of client2028) {
        const photoNum = prod.driveFileId?.split('/').pop()?.replace('.webp', '');
        console.log(`  Foto ${photoNum}:`);
        console.log(`    Status: ${prod.status}`);
        console.log(`    Atualizado: ${prod.updatedAt}`);
    }
    
    // 4. Ver o carrinho real do 2028
    const cart2028 = await Cart.findOne({ clientCode: '2028' });
    console.log(`\n  Carrinho tem ${cart2028?.items?.length || 0} items`);
    
    // 5. Verificar produtos "órfãos" (reserved mas sem carrinho)
    console.log('\n' + '=' .repeat(60));
    console.log('🔍 PRODUTOS ÓRFÃOS (reserved mas fora de carrinhos):');
    
    const allReserved = await Product.find({ status: 'reserved' });
    const allCarts = await Cart.find({ 'items.0': { $exists: true } });
    
    const itemsInCarts = new Set();
    allCarts.forEach(cart => {
        cart.items.forEach(item => {
            itemsInCarts.add(item.driveFileId);
        });
    });
    
    let orphans = 0;
    for (const prod of allReserved) {
        if (!itemsInCarts.has(prod.driveFileId)) {
            const photoNum = prod.driveFileId?.split('/').pop()?.replace('.webp', '');
            console.log(`  ❌ ${photoNum} - Cliente ${prod.reservedBy?.clientCode} (órfão)`);
            orphans++;
        }
    }
    
    console.log(`\nTotal de produtos órfãos: ${orphans}`);
    
    await mongoose.connection.close();
}

investigate().catch(console.error);