// cleanup-carts.js
const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupCarts() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Cart = require('./src/models/Cart');
    const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
    
    console.log('🧹 LIMPEZA DE CARRINHOS\n');
    
    // 1. Limpar carrinhos com problemas de expiração
    const problematicCarts = await Cart.find({
        isActive: true,
        $or: [
            { expiresAt: null },
            { expiresAt: { $lt: new Date() } }
        ]
    });
    
    console.log(`⚠️ ${problematicCarts.length} carrinhos com problemas\n`);
    
    for (const cart of problematicCarts) {
        console.log(`Limpando carrinho ${cart.clientCode}:`);
        
        // Liberar fotos reservadas
        const photoNumbers = cart.items.map(item => 
            item.fileName.replace('.webp', '')
        );
        
        const result = await UnifiedProductComplete.updateMany(
            { 
                photoNumber: { $in: photoNumbers },
                status: 'reserved'
            },
            {
                $set: {
                    status: 'available',
                    currentStatus: 'available',
                    'virtualStatus.status': 'available',
                    cdeStatus: 'INGRESADO'
                },
                $unset: {
                    'reservedBy': 1,
                    'reservationInfo': 1
                }
            }
        );
        
        console.log(`  ✅ ${result.modifiedCount} fotos liberadas`);
        
        // Desativar carrinho
        cart.isActive = false;
        await cart.save();
        console.log(`  ✅ Carrinho desativado\n`);
    }
    
    mongoose.disconnect();
}

cleanupCarts();