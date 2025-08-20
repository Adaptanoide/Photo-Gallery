// test-cart-normal.js
const mongoose = require('mongoose');
require('dotenv').config();

async function testarCarrinhoNormal() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Cart = require('./src/models/Cart');
    const PhotoCategory = require('./src/models/PhotoCategory');
    
    const sessionId = 'test_normal_' + Date.now();
    const brindle = await PhotoCategory.findOne({ displayName: /Brindle/i });
    const exotic = await PhotoCategory.findOne({ displayName: /Exotic/i });
    
    console.log('🔍 TESTE COM CLIENTE NORMAL (1234)\n');
    
    const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
    
    // Cliente NORMAL sem regras especiais
    const cart = new Cart({
        sessionId: sessionId,
        clientCode: '1234',
        clientName: 'CLIENTE NORMAL',
        items: [
            // 15 Brindle
            ...Array(15).fill().map((_, i) => ({
                productId: new mongoose.Types.ObjectId(),
                driveFileId: `brindle_${i+1}`,
                fileName: `Brindle Item ${i+1}`,
                category: brindle ? brindle.displayName : 'Brindle',
                price: 99,
                hasPrice: true,
                formattedPrice: '$99.00',
                expiresAt: expiresAt,
                addedAt: new Date()
            })),
            // 25 Exotic
            ...Array(25).fill().map((_, i) => ({
                productId: new mongoose.Types.ObjectId(),
                driveFileId: `exotic_${i+1}`,
                fileName: `Exotic Item ${i+1}`,
                category: exotic ? exotic.displayName : 'Exotic',
                price: 109,
                hasPrice: true,
                formattedPrice: '$109.00',
                expiresAt: expiresAt,
                addedAt: new Date()
            }))
        ]
    });
    
    await cart.save();
    console.log(`✅ Carrinho: ${sessionId}`);
    console.log(`📦 Total: ${cart.items.length} itens (15 Brindle + 25 Exotic)\n`);
    
    let subtotal = cart.items.reduce((sum, item) => sum + item.price, 0);
    
    const { calculateDiscountWithHierarchy } = require('./src/routes/cart');
    const resultado = await calculateDiscountWithHierarchy(cart, cart.items.length, subtotal);
    
    console.log('\n🎯 RESULTADO:');
    console.log('====================');
    if (resultado.detalhesCompletos) {
        resultado.detalhesCompletos.forEach(d => {
            console.log(`\n📁 ${d.categoria.split('→')[1] || d.categoria}:`);
            console.log(`   ${d.quantidade} itens × $${d.precoUnitario} = $${d.subtotal}`);
            console.log(`   Fonte: ${d.fonte}`);
        });
    }
    console.log(`\n💰 TOTAL GERAL: $${resultado.finalTotal}`);
    
    process.exit();
}

testarCarrinhoNormal().catch(console.error);