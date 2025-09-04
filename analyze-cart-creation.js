// analyze-cart-creation.js
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI);

async function analyzeCartCreation() {
    const Cart = require('./src/models/Cart');
    
    console.log('\n🔍 ANALISANDO CRIAÇÃO DE CARRINHOS...\n');
    
    // Ver quantos clientes tem múltiplos carrinhos ativos
    const result = await Cart.aggregate([
        { $match: { isActive: true } },
        { $group: { 
            _id: '$clientCode', 
            count: { $sum: 1 },
            carts: { $push: { 
                sessionId: '$sessionId', 
                items: '$totalItems',
                created: '$createdAt'
            }}
        }},
        { $match: { count: { $gt: 1 } } }
    ]);
    
    console.log(`⚠️  ${result.length} clientes com MÚLTIPLOS carrinhos ativos:\n`);
    
    result.forEach(client => {
        console.log(`Cliente ${client._id}: ${client.count} carrinhos ativos`);
        client.carts.forEach(cart => {
            console.log(`  - ${cart.items} items (criado: ${cart.created})`);
        });
    });
    
    mongoose.disconnect();
}

analyzeCartCreation().catch(console.error);