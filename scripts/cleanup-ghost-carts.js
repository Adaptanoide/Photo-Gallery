// scripts/cleanup-ghost-carts.js
const mongoose = require('mongoose');
const Cart = require('../src/models/Cart');
const Product = require('../src/models/Product');
require('dotenv').config();

async function cleanupGhostCarts() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🧹 LIMPANDO CARRINHOS FANTASMA\n');
    
    // Apenas os que não existem mais
    const ghostCodes = ['1100', '5435'];
    
    for (const code of ghostCodes) {
        const cart = await Cart.findOne({ clientCode: code });
        
        if (cart && !cart.isActive) {
            console.log(`\nProcessando carrinho fantasma ${code}:`);
            console.log(`  Items: ${cart.items.length}`);
            console.log(`  Expirou em: ${cart.items[0]?.expiresAt}`);
            
            // Liberar produtos
            let freed = 0;
            for (const item of cart.items) {
                const result = await Product.updateOne(
                    { 
                        driveFileId: item.driveFileId,
                        status: 'reserved'
                    },
                    { 
                        status: 'available',
                        $unset: { reservedBy: 1, cartAddedAt: 1 }
                    }
                );
                if (result.modifiedCount > 0) freed++;
            }
            
            // Deletar carrinho fantasma
            await Cart.deleteOne({ _id: cart._id });
            
            console.log(`  ✅ Liberadas ${freed} fotos`);
            console.log(`  ✅ Carrinho fantasma deletado`);
        }
    }
    
    await mongoose.connection.close();
}

cleanupGhostCarts().catch(console.error);