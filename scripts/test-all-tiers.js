// test-all-tiers.js
const mongoose = require('mongoose');
require('dotenv').config();

async function testarTodasFaixas() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const { calculateDiscountWithHierarchy } = require('./src/routes/cart');
    const Cart = require('./src/models/Cart');
    const PhotoCategory = require('./src/models/PhotoCategory');
    
    const brindle = await PhotoCategory.findOne({ displayName: /Brindle/i });
    
    console.log('🧪 TESTANDO TODAS AS FAIXAS - BRINDLE\n');
    console.log('Faixas configuradas:');
    console.log('1-12: $109 | 13-36: $105 | 37+: $99\n');
    console.log('=' .repeat(50));
    
    // Testar cada faixa
    const testes = [
        { qtd: 5, esperado: 109 },   // Faixa 1
        { qtd: 20, esperado: 105 },  // Faixa 2
        { qtd: 50, esperado: 99 }    // Faixa 3
    ];
    
    for (const teste of testes) {
        const sessionId = 'test_' + Date.now();
        const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
        
        // Criar carrinho
        const cart = new Cart({
            sessionId: sessionId,
            clientCode: '9999',
            clientName: 'TESTE FAIXAS',
            items: Array(teste.qtd).fill().map((_, i) => ({
                productId: new mongoose.Types.ObjectId(),
                driveFileId: `item_${i+1}`,
                fileName: `Item ${i+1}`,
                category: brindle.displayName,
                price: brindle.basePrice,
                hasPrice: true,
                formattedPrice: `$${brindle.basePrice}`,
                expiresAt: expiresAt,
                addedAt: new Date()
            }))
        });
        
        await cart.save();
        
        const subtotal = teste.qtd * brindle.basePrice;
        const resultado = await calculateDiscountWithHierarchy(cart, teste.qtd, subtotal);
        
        const detalheBrindle = resultado.detalhesCompletos?.[0];
        const precoUnit = detalheBrindle?.precoUnitario || 0;
        
        console.log(`\n📦 ${teste.qtd} itens:`);
        console.log(`   Preço unitário: $${precoUnit}`);
        console.log(`   Total: $${teste.qtd * precoUnit}`);
        console.log(`   ${precoUnit === teste.esperado ? '✅ CORRETO!' : '❌ ERRO! Esperado: $' + teste.esperado}`);
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ TESTE COMPLETO!');
    
    process.exit();
}

testarTodasFaixas().catch(console.error);