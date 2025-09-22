// scripts/monitor-cart-expiration.js
const mongoose = require('mongoose');
require('dotenv').config();

async function monitorExpiration() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Cart = require('../src/models/Cart');
    const UnifiedProductComplete = require('../src/models/UnifiedProductComplete');
    
    console.clear();
    console.log('⏱️ MONITOR DE EXPIRAÇÃO DE CARRINHO\n');
    console.log('=' .repeat(60));
    console.log('Cliente: 6753 | Foto: 01144\n');
    
    // Verificar carrinho
    const cart = await Cart.findOne({ clientCode: '6753' });
    
    if (cart && cart.items.length > 0) {
        console.log(`📦 Carrinho encontrado: ${cart.sessionId}`);
        console.log(`   Items: ${cart.items.length}`);
        
        cart.items.forEach(item => {
            const now = new Date();
            const expiry = new Date(item.expiresAt);
            const secondsLeft = Math.floor((expiry - now) / 1000);
            
            console.log(`\n   📸 ${item.fileName}:`);
            console.log(`      Status: ${item.status}`);
            console.log(`      Expira em: ${secondsLeft}s`);
            
            if (secondsLeft <= 0) {
                console.log(`      ⚠️ EXPIRADO!`);
            }
        });
    } else {
        console.log('❌ Nenhum carrinho ativo');
    }
    
    // Verificar status da foto
    const photo = await UnifiedProductComplete.findOne({ 
        fileName: '01144.webp' 
    });
    
    if (photo) {
        console.log(`\n📸 Status da foto 01144:`);
        console.log(`   MongoDB: ${photo.status}`);
        console.log(`   CDE: ${photo.cdeStatus}`);
    }
    
    await mongoose.connection.close();
}

// Loop contínuo
async function continuousMonitor() {
    while (true) {
        await monitorExpiration();
        console.log('\n' + '=' .repeat(60));
        console.log('Próxima verificação em 10 segundos... (Ctrl+C para parar)');
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
}

continuousMonitor();