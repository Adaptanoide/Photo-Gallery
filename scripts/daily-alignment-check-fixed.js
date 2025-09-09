const mongoose = require('mongoose');
require('dotenv').config();

async function dailyCheck() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Product = require('../src/models/Product');
    const PhotoStatus = require('../src/models/PhotoStatus');
    const Cart = require('../src/models/Cart');
    
    const products = await Product.find({});
    let realConflicts = 0;
    let inCartDifferences = 0;
    
    for (const product of products) {
        if (!product.fileName) continue;
        const ps = await PhotoStatus.findOne({ fileName: product.fileName });
        
        if (ps && product.status !== ps.currentStatus) {
            // Ignorar se são equivalentes (reserved = unavailable)
            if (product.status === 'reserved' && ps.currentStatus === 'unavailable') continue;
            
            // Verificar se está em carrinho
            const cart = await Cart.findOne({
                'items.fileName': product.fileName,
                isActive: true
            });
            
            if (cart) {
                inCartDifferences++;  // Normal, não é problema
            } else {
                realConflicts++;
                console.log(`Conflito REAL: ${product.fileName}`);
            }
        }
    }
    
    console.log(`\n📊 RESULTADO:`);
    console.log(`  ✅ Em carrinhos (normal): ${inCartDifferences}`);
    console.log(`  ❌ Conflitos REAIS: ${realConflicts}`);
    
    if (realConflicts > 0) {
        console.log(`\n⚠️ ALERTA: ${realConflicts} conflitos reais detectados!`);
    } else {
        console.log('\n✅ Sistema alinhado');
    }
    
    await mongoose.connection.close();
}

dailyCheck();
