const mongoose = require('mongoose');
require('dotenv').config();

async function finalCheck() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Product = require('../src/models/Product');
    const PhotoStatus = require('../src/models/PhotoStatus');
    const Cart = require('../src/models/Cart');
    
    console.log('📊 ANÁLISE FINAL DO SISTEMA:\n');
    
    const products = await Product.find({});
    let inCartConflicts = 0;
    let realConflicts = 0;
    
    for (const product of products) {
        if (!product.fileName) continue;
        
        const ps = await PhotoStatus.findOne({ fileName: product.fileName });
        if (!ps) continue;
        
        // Ignorar se são equivalentes
        if (product.status === 'reserved' && ps.currentStatus === 'unavailable') continue;
        
        if (product.status !== ps.currentStatus) {
            // Verificar se está em carrinho
            const cart = await Cart.findOne({
                'items.fileName': product.fileName,
                isActive: true
            });
            
            if (cart) {
                inCartConflicts++;
            } else {
                realConflicts++;
                console.log(`❌ Conflito real: ${product.fileName} - Product=${product.status}, PhotoStatus=${ps.currentStatus}`);
            }
        }
    }
    
    console.log(`\n✅ RESULTADO FINAL:`);
    console.log(`  Fotos em carrinhos (normal ter diferença): ${inCartConflicts}`);
    console.log(`  Conflitos REAIS: ${realConflicts}`);
    console.log(`\n${realConflicts === 0 ? '🎉 SISTEMA 100% ALINHADO!' : '⚠️ Ainda há conflitos para resolver'}`);
    
    await mongoose.connection.close();
}

finalCheck().catch(console.error);
