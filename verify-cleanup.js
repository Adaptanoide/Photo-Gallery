// verify-cleanup.js
const mongoose = require('mongoose');
require('dotenv').config();

async function verifyCleanup() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Cart = require('./src/models/Cart');
    
    console.log('📊 ESTADO ATUAL DOS CARRINHOS\n');
    
    // Carrinhos ativos
    const activeCarts = await Cart.find({ isActive: true });
    console.log(`✅ Carrinhos ativos: ${activeCarts.length}`);
    
    // Carrinhos inativos dos clientes específicos
    const clients = ['2960', '9782', '5483', '8369'];
    for (const clientCode of clients) {
        const carts = await Cart.find({ clientCode });
        console.log(`\nCliente ${clientCode}:`);
        console.log(`  Total de carrinhos: ${carts.length}`);
        console.log(`  Ativos: ${carts.filter(c => c.isActive).length}`);
        console.log(`  Inativos: ${carts.filter(c => !c.isActive).length}`);
    }
    
    mongoose.disconnect();
}

verifyCleanup();