// scripts/monitor-expiration-live.js
const mongoose = require('mongoose');
require('dotenv').config();

async function monitorLive() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Cart = require('../src/models/Cart');
    
    setInterval(async () => {
        const cart = await Cart.findOne({ clientCode: '6753' });
        if (!cart || cart.items.length === 0) {
            console.log('Sem carrinho ativo');
            return;
        }
        
        console.clear();
        console.log('⏱️ MONITOR AO VIVO - Cliente 6753\n');
        
        cart.items.forEach(item => {
            const now = new Date();
            const expiry = new Date(item.expiresAt);
            const seconds = Math.floor((expiry - now) / 1000);
            
            console.log(`${item.fileName}: ${seconds > 0 ? seconds + 's' : 'EXPIRADO!'}`);
        });
    }, 1000); // atualiza a cada segundo
}

monitorLive();