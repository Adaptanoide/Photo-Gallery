// check-current-carts.js
const mongoose = require('mongoose');
require('dotenv').config();

async function checkCarts() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Cart = require('./src/models/Cart');
    const UnifiedProductComplete = require('./src/models/UnifiedProductComplete');
    
    // 1. Verificar carrinhos ativos
    const activeCarts = await Cart.find({ isActive: true });
    console.log(`\n📦 ${activeCarts.length} carrinhos ativos\n`);
    
    for (const cart of activeCarts) {
        const expiresIn = Math.round((cart.expiresAt - new Date()) / 1000 / 60);
        console.log(`Cliente ${cart.clientCode}:`);
        console.log(`  Items: ${cart.items.length}`);
        console.log(`  Expira em: ${expiresIn} minutos`);
        console.log(`  Session: ${cart.sessionId}`);
        
        // Verificar se as fotos ainda existem e estão disponíveis
        let available = 0, unavailable = 0;
        for (const item of cart.items) {
            const photo = await UnifiedProductComplete.findOne({
                fileName: item.fileName
            });
            if (photo && photo.status === 'available') available++;
            else unavailable++;
        }
        console.log(`  ✅ Disponíveis: ${available}`);
        console.log(`  ❌ Indisponíveis: ${unavailable}\n`);
    }
    
    // 2. Verificar carrinhos expirados
    const expiredCarts = await Cart.find({
        isActive: true,
        expiresAt: { $lt: new Date() }
    });
    
    console.log(`⚠️ ${expiredCarts.length} carrinhos expirados mas ainda ativos\n`);
    
    mongoose.disconnect();
}

checkCarts();