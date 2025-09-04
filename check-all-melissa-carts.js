// check-all-melissa-carts.js
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI);

async function checkAllMelissaCarts() {
    const Cart = require('./src/models/Cart');
    
    console.log('\n🔍 INVESTIGANDO TODOS OS CARRINHOS DA MELISSA (2960)...\n');
    
    // Buscar TODOS os carrinhos dela (ativos e inativos)
    const allCarts = await Cart.find({ 
        clientCode: '2960' 
    }).sort({ lastActivity: -1 });
    
    console.log(`📊 Total de carrinhos encontrados: ${allCarts.length}\n`);
    
    allCarts.forEach((cart, index) => {
        console.log(`CARRINHO ${index + 1}:`);
        console.log(`  SessionId: ${cart.sessionId}`);
        console.log(`  Items: ${cart.items.length} (totalItems: ${cart.totalItems})`);
        console.log(`  Ativo: ${cart.isActive}`);
        console.log(`  Criado: ${cart.createdAt.toLocaleString()}`);
        console.log(`  Última atividade: ${cart.lastActivity.toLocaleString()}`);
        
        // Mostrar primeiros 3 items
        if (cart.items.length > 0) {
            console.log('  Primeiros items:');
            cart.items.slice(0, 3).forEach(item => {
                console.log(`    - ${item.fileName}`);
            });
        }
        console.log('  ---\n');
    });
    
    // Verificar qual a API do admin está pegando
    console.log('🎯 SIMULANDO O QUE O ADMIN VÊ:');
    
    // Esta é provavelmente a query que o admin usa
    const adminQuery = await Cart.findOne({
        clientCode: '2960',
        isActive: true,
        'items.0': { $exists: true }
    }).sort({ lastActivity: -1 });
    
    if (adminQuery) {
        console.log('  Admin deve estar vendo:');
        console.log(`    SessionId: ${adminQuery.sessionId}`);
        console.log(`    Items: ${adminQuery.items.length}`);
    }
    
    mongoose.disconnect();
}

checkAllMelissaCarts().catch(console.error);