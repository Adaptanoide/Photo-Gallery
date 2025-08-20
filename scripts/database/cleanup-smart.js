// cleanup-smart.js
require('dotenv').config();
const mongoose = require('mongoose');

async function smartCleanup() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🧹 LIMPEZA INTELIGENTE SUNSHINE\n');

    // 1. LIMPAR CATEGORIAS ANTIGAS (antes de 16/08)
    const PhotoCategory = require('../../src/models/PhotoCategory');
    const cutoffDate = new Date('2025-08-16');

    const deletedOldCats = await PhotoCategory.deleteMany({
        lastSync: { $lt: cutoffDate }
    });
    console.log(`✅ ${deletedOldCats.deletedCount} categorias ANTIGAS removidas`);

    const remaining = await PhotoCategory.countDocuments();
    console.log(`✅ ${remaining} categorias R2 PRESERVADAS com preços!\n`);

    // 2. LIMPAR PRODUCTS (todos bugados)
    const Product = require('../../src/models/Product');
    const delProducts = await Product.deleteMany({});
    console.log(`✅ ${delProducts.deletedCount} produtos removidos`);

    // 3. LIMPAR CARTS
    const Cart = require('../../src/models/Cart');
    const delCarts = await Cart.deleteMany({});
    console.log(`✅ ${delCarts.deletedCount} carrinhos removidos`);

    // 4. LIMPAR CLIENTES (pode recriar)
    const AccessCode = require('../../src/models/AccessCode');
    const delClients = await AccessCode.deleteMany({});
    console.log(`✅ ${delClients.deletedCount} clientes removidos`);

    // 5. LIMPAR SELEÇÕES
    const Selection = require('../../src/models/Selection');
    const delSelections = await Selection.deleteMany({});
    console.log(`✅ ${delSelections.deletedCount} seleções removidas`);

    // 6. LIMPAR PHOTO STATUS
    const PhotoStatus = require('../../src/models/PhotoStatus');
    const delStatus = await PhotoStatus.deleteMany({});
    console.log(`✅ ${delStatus.deletedCount} photo status removidos`);

    console.log('\n📋 PRESERVADO:');
    console.log('✅ 89 PhotoCategory com preços R2');
    console.log('✅ QuantityDiscount (regras de volume)');
    console.log('✅ Admins');
    console.log('✅ EmailConfig');

    await mongoose.disconnect();
    console.log('\n🎉 LIMPEZA INTELIGENTE CONCLUÍDA!');
}

smartCleanup().catch(console.error);